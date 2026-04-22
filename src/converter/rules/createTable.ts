import type { ConversionLog, ConverterOptions } from '../../types';
import { convertDataType } from './dataTypes';
import { convertIdentifier, generateSequenceName, generateTriggerName, stripQuotes } from '../utils';

interface ParsedColumn {
  name: string;
  def: string;
  hasAutoIncrement: boolean;
  hasComment: boolean;
  comment?: string;
  isPrimaryKey: boolean;
}

/**
 * 解析 CREATE TABLE 语句的列定义
 */
function parseColumns(body: string, _options: ConverterOptions): { columns: ParsedColumn[]; constraints: string[] } {
  const columns: ParsedColumn[] = [];
  const constraints: string[] = [];

  // 按逗号拆分（忽略括号内和字符串内的逗号）
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let current = '';
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    const nextChar = body[i + 1];

    // 处理字符串（单引号）
    if (char === "'") {
      if (inString && nextChar === "'") {
        // 转义单引号 ''
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

    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());

  for (const part of parts) {
    const upper = part.toUpperCase();

    // 约束检测
    if (
      upper.startsWith('PRIMARY KEY') ||
      upper.startsWith('UNIQUE') ||
      upper.startsWith('KEY') ||
      upper.startsWith('INDEX') ||
      upper.startsWith('FULLTEXT') ||
      upper.startsWith('SPATIAL') ||
      upper.startsWith('CONSTRAINT') ||
      upper.startsWith('FOREIGN KEY') ||
      upper.startsWith('CHECK')
    ) {
      constraints.push(part);
      continue;
    }

    // 列定义
    const colMatch = part.match(/^(`?[^`\s]+`?)\s+(.+)$/i);
    if (!colMatch) continue;

    const name = colMatch[1];
    let def = colMatch[2];

    const hasAutoIncrement = /\bAUTO_INCREMENT\b/i.test(def);
    const commentMatch = def.match(/\bCOMMENT\s+'([^']*)'/i);
    const isPrimaryKey = /\bPRIMARY\s+KEY\b/i.test(def);

    if (commentMatch) {
      def = def.replace(/\s*COMMENT\s+'[^']*'/i, '').trim();
    }

    // 移除 AUTO_INCREMENT
    if (hasAutoIncrement) {
      def = def.replace(/\bAUTO_INCREMENT\b/gi, '').trim();
      // 移除紧随的整数显示宽度
      def = def.replace(/\bNUMBER\(\d+\)\s*\(\d+\)/, 'NUMBER(19)');
    }

    columns.push({
      name,
      def,
      hasAutoIncrement,
      hasComment: !!commentMatch,
      comment: commentMatch ? commentMatch[1] : undefined,
      isPrimaryKey,
    });
  }

  return { columns, constraints };
}

/**
 * 转换 CREATE TABLE 语句
 */
export function convertCreateTable(sql: string, options: ConverterOptions, logs: ConversionLog[]): string {
  const headerMatch = sql.match(/CREATE\s+(?:TEMPORARY\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(`?[^`\s]+`?)\s*\(/i);
  if (!headerMatch) {
    logs.push({ type: 'warning', message: '无法解析 CREATE TABLE 语句' });
    return sql;
  }

  const tableNameRaw = headerMatch[1];
  const isTemporary = /\bTEMPORARY\b/i.test(sql);

  // 手动提取括号内容（支持嵌套括号）
  const startIdx = sql.indexOf('(', headerMatch[0].length - 1);
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx === -1) {
    logs.push({ type: 'warning', message: '无法找到 CREATE TABLE 的匹配右括号' });
    return sql;
  }

  const body = sql.slice(startIdx + 1, endIdx);
  const tail = sql.slice(endIdx + 1);

  const tableName = convertIdentifier(tableNameRaw, options.preserveCase);
  const { columns, constraints } = parseColumns(body, options);

  const outputLines: string[] = [];
  const commentLines: string[] = [];
  const afterLines: string[] = [];
  const sequences: string[] = [];
  const triggers: string[] = [];

  // 处理 TEMPORARY -> GLOBAL TEMPORARY
  let tableKeyword = 'CREATE';
  if (isTemporary) {
    tableKeyword = 'CREATE GLOBAL TEMPORARY';
    logs.push({ type: 'info', message: `将临时表 ${tableName} 转换为 Oracle GLOBAL TEMPORARY TABLE` });
  } else {
    tableKeyword = 'CREATE TABLE';
  }

  // 转换列定义
  const convertedColumns: string[] = [];
  for (const col of columns) {
    // 转换数据类型
    let colDef = convertDataType(col.def, logs);

    // 处理 ON UPDATE CURRENT_TIMESTAMP -> 需要触发器
    if (/\bON\s+UPDATE\s+CURRENT_TIMESTAMP\b/i.test(colDef)) {
      colDef = colDef.replace(/\bDEFAULT\s+CURRENT_TIMESTAMP\b/i, 'DEFAULT SYSDATE')
        .replace(/\s*ON\s+UPDATE\s+CURRENT_TIMESTAMP\b(?:\(\d+\))?/i, '');

      if (options.generateTrigger) {
        const triggerName = generateTriggerName(tableNameRaw, col.name);
        triggers.push(
          `CREATE OR REPLACE TRIGGER ${triggerName}`,
          `BEFORE UPDATE ON ${tableName} FOR EACH ROW`,
          `BEGIN`,
          `    :NEW.${convertIdentifier(col.name, options.preserveCase)} := SYSDATE;`,
          `END;`
        );
        logs.push({
          type: 'info',
          message: `为列 ${col.name} 的 ON UPDATE CURRENT_TIMESTAMP 生成更新触发器 ${triggerName}`,
        });
      } else {
        logs.push({
          type: 'warning',
          message: `列 ${col.name} 的 ON UPDATE CURRENT_TIMESTAMP 在 Oracle 中需要触发器支持，已移除`,
        });
      }
    } else {
      // 普通 DEFAULT CURRENT_TIMESTAMP -> DEFAULT SYSDATE
      colDef = colDef.replace(/\bDEFAULT\s+CURRENT_TIMESTAMP\b(?:\(\d+\))?/i, 'DEFAULT SYSDATE');
      colDef = colDef.replace(/\bDEFAULT\s+NOW\s*\(\s*\)/i, 'DEFAULT SYSDATE');
      colDef = colDef.replace(/\bDEFAULT\s+LOCALTIME\b/i, 'DEFAULT SYSDATE');
      colDef = colDef.replace(/\bDEFAULT\s+LOCALTIMESTAMP\b(?:\(\d+\))?/i, 'DEFAULT SYSDATE');
    }

    // 处理 DEFAULT UUID() -> SYS_GUID()
    colDef = colDef.replace(/\bDEFAULT\s+UUID\s*\(\s*\)/i, 'DEFAULT SYS_GUID()');

    // 处理自增列
    if (col.hasAutoIncrement) {
      if (options.useIdentity) {
        colDef += ` GENERATED BY DEFAULT AS IDENTITY (START WITH 1 INCREMENT BY 1 CACHE 20)`;
        logs.push({
          type: 'info',
          message: `列 ${col.name} 使用 IDENTITY 替代 AUTO_INCREMENT`,
        });
      } else if (options.useSequenceTrigger && options.generateSequence) {
        const seqName = generateSequenceName(tableNameRaw, col.name);
        colDef = colDef.replace(/\bNUMBER\(\d+\)/, 'NUMBER(19)');
        // 检查是否已有 DEFAULT
        if (/\bDEFAULT\b/i.test(colDef)) {
          colDef = colDef.replace(/\bDEFAULT\s+\S+/, `DEFAULT ${seqName}.NEXTVAL`);
        } else {
          colDef += ` DEFAULT ${seqName}.NEXTVAL`;
        }
        sequences.push(
          `CREATE SEQUENCE ${seqName}`,
          `    START WITH 1`,
          `    INCREMENT BY 1`,
          `    MINVALUE 1`,
          `    MAXVALUE 999999999999999999`,
          `    CACHE 20`,
          `    NOCYCLE;`
        );
        logs.push({
          type: 'info',
          message: `列 ${col.name} 使用 SEQUENCE ${seqName} 替代 AUTO_INCREMENT`,
        });
      }
    }

    // 移除 UNSIGNED（Oracle 不支持）
    colDef = colDef.replace(/\bUNSIGNED\b/gi, '');
    // 移除 ZEROFILL
    colDef = colDef.replace(/\bZEROFILL\b/gi, '');
    // 移除 CHARACTER SET xxx
    colDef = colDef.replace(/\bCHARACTER\s+SET\s+\S+/gi, '');
    // 移除 COLLATE xxx
    colDef = colDef.replace(/\bCOLLATE\s+\S+/gi, '');

    convertedColumns.push(`    ${convertIdentifier(col.name, options.preserveCase)} ${colDef}`);

    // 收集列注释
    if (options.addComments && col.hasComment && col.comment) {
      commentLines.push(`COMMENT ON COLUMN ${tableName}.${convertIdentifier(col.name, options.preserveCase)} IS '${col.comment}';`);
    }
  }

  // 转换约束
  for (const constraint of constraints) {
    const upper = constraint.toUpperCase();

    if (upper.startsWith('PRIMARY KEY')) {
      const pkMatch = constraint.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) {
        const cols = pkMatch[1].split(',').map((c) => convertIdentifier(c.trim(), options.preserveCase)).join(', ');
        convertedColumns.push(`    CONSTRAINT pk_${stripQuotes(tableNameRaw).toLowerCase()} PRIMARY KEY (${cols})`);
      }
    } else if (upper.startsWith('UNIQUE') || upper.startsWith('UNIQUE KEY')) {
      const ukMatch = constraint.match(/UNIQUE\s+(?:KEY\s+)?(?:`?([^`\s]+)`?\s+)?\(([^)]+)\)/i);
      if (ukMatch) {
        const name = ukMatch[1];
        const cols = ukMatch[2].split(',').map((c) => convertIdentifier(c.trim(), options.preserveCase)).join(', ');
        if (name) {
          afterLines.push(`ALTER TABLE ${tableName} ADD CONSTRAINT ${convertIdentifier(name, options.preserveCase)} UNIQUE (${cols});`);
        } else {
          afterLines.push(`ALTER TABLE ${tableName} ADD CONSTRAINT uk_${stripQuotes(tableNameRaw).toLowerCase()}_${stripQuotes(cols.split(',')[0].trim()).toLowerCase()} UNIQUE (${cols});`);
        }
      }
    } else if (upper.startsWith('KEY') || upper.startsWith('INDEX')) {
      const idxMatch = constraint.match(/(?:KEY|INDEX)\s+(?:`?([^`\s]+)`?\s+)?\(([^)]+)\)(?:\s+USING\s+\w+)?/i);
      if (idxMatch) {
        const name = idxMatch[1];
        const cols = idxMatch[2].split(',').map((c) => convertIdentifier(c.trim(), options.preserveCase)).join(', ');
        if (name) {
          afterLines.push(`CREATE INDEX ${convertIdentifier(name, options.preserveCase)} ON ${tableName}(${cols});`);
        } else {
          afterLines.push(`CREATE INDEX idx_${stripQuotes(tableNameRaw).toLowerCase()}_${stripQuotes(cols.split(',')[0].trim()).toLowerCase()} ON ${tableName}(${cols});`);
        }
      }
    } else if (upper.startsWith('FULLTEXT')) {
      const ftMatch = constraint.match(/FULLTEXT\s+(?:INDEX\s+)?(?:`?([^`\s]+)`?\s+)?\(([^)]+)\)/i);
      if (ftMatch) {
        const name = ftMatch[1];
        const cols = ftMatch[2].split(',').map((c) => convertIdentifier(c.trim(), options.preserveCase)).join(', ');
        logs.push({
          type: 'warning',
          message: `FULLTEXT 索引 ${name || ''} 在 Oracle 中需要使用 Oracle Text (CTXSYS)，已转为普通索引`,
        });
        if (name) {
          afterLines.push(`CREATE INDEX ${convertIdentifier(name, options.preserveCase)} ON ${tableName}(${cols});`);
        }
      }
    } else if (upper.startsWith('CONSTRAINT') || upper.startsWith('FOREIGN KEY')) {
      // 转换外键约束
      let fkSql = constraint;
      // 移除 ON UPDATE（Oracle 不支持）
      if (/\bON\s+UPDATE\b/i.test(fkSql)) {
        fkSql = fkSql.replace(/\s*ON\s+UPDATE\s+\w+/gi, '');
        logs.push({ type: 'warning', message: 'Oracle 不支持 ON UPDATE，已移除' });
      }
      // 转换标识符
      fkSql = fkSql.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));
      convertedColumns.push(`    ${fkSql}`);
    } else if (upper.startsWith('CHECK')) {
      convertedColumns.push(`    ${constraint}`);
    }
  }

  // 处理表尾部选项
  let tableTail = tail;
  if (options.convertEngineCharset) {
    // 移除 ENGINE=InnoDB 等
    const removedEngine = tableTail.replace(/\bENGINE\s*=\s*\S+/gi, '');
    const removedCharset = removedEngine.replace(/\bDEFAULT\s+CHARSET\s*=\s*\S+/gi, '');
    const removedCollate = removedCharset.replace(/\bCOLLATE\s*=\s*\S+/gi, '');
    const removedRowFormat = removedCollate.replace(/\bROW_FORMAT\s*=\s*\S+/gi, '');
    const removedAutoInc = removedRowFormat.replace(/\bAUTO_INCREMENT\s*=\s*\d+/gi, '');
    const removedCompression = removedAutoInc.replace(/\bCOMPRESSION\s*=\s*'[^']*'/gi, '');
    tableTail = removedCompression;
  }

  // 提取表注释
  const tableCommentMatch = tableTail.match(/\bCOMMENT\s*=\s*'([^']*)'/i);
  if (tableCommentMatch && options.addComments) {
    commentLines.unshift(`COMMENT ON TABLE ${tableName} IS '${tableCommentMatch[1]}';`);
    tableTail = tableTail.replace(/\s*COMMENT\s*=\s*'[^']*'/i, '');
  }
  // 清理尾部多余逗号和空格
  tableTail = tableTail.replace(/,\s*\)/g, ')').replace(/\s+/g, ' ').trim();

  // 组装输出
  if (sequences.length > 0) {
    outputLines.push(...sequences.map((s, i) => (i === sequences.length - 1 ? s : s)));
    outputLines.push('');
  }

  outputLines.push(`${tableKeyword} ${tableName} (`);
  outputLines.push(convertedColumns.join(',\n'));
  outputLines.push(`)${tableTail};`);

  if (commentLines.length > 0) {
    outputLines.push('');
    outputLines.push(...commentLines);
  }

  if (afterLines.length > 0) {
    outputLines.push('');
    outputLines.push(...afterLines);
  }

  if (triggers.length > 0) {
    outputLines.push('');
    for (let i = 0; i < triggers.length; i++) {
      const line = triggers[i];
      const isLast = i === triggers.length - 1;
      if (line.endsWith(';')) {
        outputLines.push(line);
      } else if (isLast) {
        outputLines.push(line + ';');
      } else {
        outputLines.push(line);
      }
    }
  }

  return outputLines.join('\n');
}
