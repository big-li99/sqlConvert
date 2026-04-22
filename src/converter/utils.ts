/**
 * 工具函数集合
 */

/**
 * 移除 MySQL 反引号，转为 Oracle 双引号或去除
 */
export function convertIdentifier(id: string, preserveCase = false): string {
  // 如果已经是双引号包裹，保持不变
  if (id.startsWith('"') && id.endsWith('"')) {
    return id;
  }
  // 移除反引号
  const cleaned = id.replace(/^`/, '').replace(/`$/, '');
  // Oracle 中如果不加引号，标识符会转为大写
  // 如果 preserveCase 为 true，用双引号包裹保留大小写
  if (preserveCase && /[a-z]/.test(cleaned)) {
    return `"${cleaned}"`;
  }
  return cleaned.toUpperCase();
}

/**
 * 移除字符串外侧的引号（单引号或双引号或反引号）
 */
export function stripQuotes(str: string): string {
  return str.replace(/^['"`]/, '').replace(/['"`]$/, '');
}

/**
 * 提取字符串常量（保持内部内容不变）
 */
export function extractStringLiterals(sql: string): { sql: string; literals: string[] } {
  const literals: string[] = [];
  const result = sql.replace(/'(?:''|[^'])*'/g, (match) => {
    literals.push(match);
    return `__STR_${literals.length - 1}__`;
  });
  return { sql: result, literals };
}

/**
 * 还原字符串常量
 */
export function restoreStringLiterals(sql: string, literals: string[]): string {
  return sql.replace(/__STR_(\d+)__/g, (_, idx) => literals[parseInt(idx)]);
}

/**
 * 去除行内和块注释
 */
export function removeComments(sql: string): string {
  // 先保护字符串中的内容
  const { sql: noStr, literals } = extractStringLiterals(sql);
  // 去除行注释
  let result = noStr.replace(/--.*$/gm, '');
  // 去除块注释
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  return restoreStringLiterals(result, literals);
}

/**
 * 将 SQL 按语句拆分（按分号，但忽略字符串内部的分号）
 */
export function splitStatements(sql: string): string[] {
  const { sql: processed, literals } = extractStringLiterals(sql);
  const statements = processed
    .split(';')
    .map((s) => restoreStringLiterals(s.trim(), literals))
    .filter((s) => s.length > 0);
  return statements;
}

/**
 * 驼峰/下划线命名互转
 */
export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

/**
 * 生成序列名称
 */
export function generateSequenceName(tableName: string, columnName: string): string {
  const t = stripQuotes(tableName).toUpperCase();
  const c = stripQuotes(columnName).toUpperCase();
  return `SEQ_${t}_${c}`;
}

/**
 * 生成触发器名称
 */
export function generateTriggerName(tableName: string, columnName: string): string {
  const t = stripQuotes(tableName).toUpperCase();
  const c = stripQuotes(columnName).toUpperCase();
  return `TRG_${t}_${c}`;
}

/**
 * 生成 schema 唯一的索引名：前缀加上表名
 */
export function makeUniqueIndexName(idxName: string, tblName: string, logs: { type: 'info' | 'warning' | 'error' | 'success'; message: string }[]): string {
  const cleanIdx = idxName.replace(/^"/, '').replace(/"$/, '');
  const cleanTbl = tblName.replace(/^"/, '').replace(/"$/, '');
  if (cleanIdx.toUpperCase().startsWith(cleanTbl.toUpperCase() + '_')) {
    return idxName;
  }
  const newName = `${tblName}_${idxName}`;
  logs.push({
    type: 'info',
    message: `索引名已添加表名前缀以保证 schema 唯一：${idxName} -> ${newName}`,
  });
  return newName;
}
