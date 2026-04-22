import type { ConversionLog } from '../types';

/**
 * 自定义转换规则接口
 * 用户可以在此添加自己的特殊转换逻辑
 */
export interface CustomRule {
  name: string;
  description: string;
  /** 判断该规则是否适用于当前 SQL */
  match: (sql: string) => boolean;
  /** 执行转换 */
  transform: (sql: string) => string;
}

/** 转义正则特殊字符 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 生成 INSERT 语句 NULL 替换的 transform 函数
 * @param table 表名
 * @param column 列名
 * @param replacement 替换值
 */
function createInsertNullReplacer(table: string, column: string, replacement: string): (sql: string) => string {
  const colUpper = column.toUpperCase();

  return (sql: string) => {
    const tableMatch = sql.match(new RegExp(`INSERT\\s+INTO\\s+[\`"]?${escapeRegExp(table)}[\`"]?`, 'i'));
    if (!tableMatch) return sql;

    // 手动提取列名列表（从第一个 '(' 开始，按括号深度找匹配的 ')'）
    const startIdx = sql.indexOf('(', tableMatch[0].length);
    let depth = 0;
    let colEnd = -1;
    for (let i = startIdx; i < sql.length; i++) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') { depth--; if (depth === 0) { colEnd = i; break; } }
    }
    if (colEnd === -1) return sql;
    const colsStr = sql.slice(startIdx + 1, colEnd);

    // 手动提取 VALUES 列表
    const valuesIdx = sql.toUpperCase().indexOf('VALUES', colEnd);
    if (valuesIdx === -1) return sql;
    const valStart = sql.indexOf('(', valuesIdx);
    if (valStart === -1) return sql;
    depth = 0;
    let valEnd = -1;
    for (let i = valStart; i < sql.length; i++) {
      if (sql[i] === '(') depth++;
      else if (sql[i] === ')') { depth--; if (depth === 0) { valEnd = i; break; } }
    }
    if (valEnd === -1) return sql;
    const valsStr = sql.slice(valStart + 1, valEnd);

    // 解析列名（去除引号）
    const cols = colsStr.split(',').map((c) => c.trim().replace(/[`"]/g, '').toUpperCase());
    const colIdx = cols.indexOf(colUpper);
    if (colIdx === -1) return sql;

    // 解析值列表（需考虑字符串内逗号和嵌套括号）
    const values: string[] = [];
    let vDepth = 0;
    let inString = false;
    let current = '';
    for (let i = 0; i < valsStr.length; i++) {
      const char = valsStr[i];
      const nextChar = valsStr[i + 1];
      if (char === "'") {
        if (inString && nextChar === "'") {
          current += "''";
          i++;
          continue;
        }
        inString = !inString;
        current += char;
        continue;
      }
      if (inString) {
        current += char;
        continue;
      }
      if (char === '(') vDepth++;
      else if (char === ')') vDepth--;
      else if (char === ',' && vDepth === 0) {
        values.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) values.push(current.trim());

    // 如果目标列对应值为 NULL，替换为指定值
    if (values[colIdx]?.toUpperCase() === 'NULL') {
      values[colIdx] = replacement;
      const before = sql.slice(0, valStart + 1);
      const after = sql.slice(valEnd);
      return `${before}${values.join(', ')}${after}`;
    }

    return sql;
  };
}

/**
 * 生成 INSERT 语句中指定表/列的 NULL 替换规则
 * @param table 表名
 * @param column 列名
 * @param replacement 替换值，默认 SYSDATE
 *
 * 使用示例：
 *   nullReplacementRule('SYS_INDEXS', 'F_CHDATE', 'SYSDATE'),
 *   nullReplacementRule('SYS_INDEXS', 'F_CRDATE', 'SYSDATE'),
 *   nullReplacementRule('OTHER_TABLE', 'COL_X', "' '"),
 */
export function nullReplacementRule(table: string, column: string, replacement: string = 'SYSDATE'): CustomRule {
  return {
    name: `${table}_${column}_NULL`,
    description: `${table} 表的 ${column} 为 NULL 时替换为 ${replacement}`,
    match: (sql) =>
      new RegExp(`INSERT\\s+INTO\\s+[\`"]?${escapeRegExp(table)}[\`"]?`, 'i').test(sql) &&
      new RegExp(escapeRegExp(column), 'i').test(sql),
    transform: createInsertNullReplacer(table, column, replacement),
  };
}

/**
 * ============================================
 * 用户自定义规则列表
 * 在此处添加自定义转换规则，格式参考下方示例
 * ============================================
 */
export const customRules: CustomRule[] = [
  // 示例规则：SYS_OBJCOLS 表的 COL_APPTYPE1 空字符串转为空格
  {
    name: 'SYS_OBJCOLS_COL_APPTYPE1_EMPTY',
    description: 'SYS_OBJCOLS 表的 COL_APPTYPE1 空字符串转为空格',
    match: (sql) => {
      const upper = sql.toUpperCase();
      return /INSERT\s+INTO\s+[`"]?SYS_OBJCOLS[`"]?/i.test(sql) && upper.includes('COL_APPTYPE1');
    },
    transform: (sql) => {
      // 将 VALUES(...) 子句中所有 '' 替换为 ' '
      // 注意：如果 VALUES 中存在转义引号（如 'it''s'），也会被替换，
      // 适用于简单批量导入场景
      return sql.replace(
        /VALUES\s*\([^)]+\)/gi,
        (valuesClause) => valuesClause.replace(/''/g, "' '")
      );
    },
  },

  // 批量配置 NULL 替换规则（新增规则只需添加一行）
  nullReplacementRule('SYS_INDEXS', 'F_CHDATE', 'SYSDATE'),
  nullReplacementRule('SYS_DCT_CST', 'F_CHDATE', 'SYSDATE'),

  // 在此添加更多自定义规则...
  // nullReplacementRule('OTHER_TABLE', 'SOME_COL', "' '"),
];

/**
 * 应用所有匹配的自定义规则
 */
export function applyCustomRules(sql: string, logs: ConversionLog[]): string {
  let result = sql;
  for (const rule of customRules) {
    if (rule.match(result)) {
      const before = result;
      result = rule.transform(result);
      if (result !== before) {
        logs.push({
          type: 'info',
          message: `应用自定义规则 [${rule.name}]: ${rule.description}`,
        });
      }
    }
  }
  return result;
}
