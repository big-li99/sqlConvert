import type { ConversionLog, ConverterOptions } from '../../types';
import { convertIdentifier } from '../utils';

/**
 * 转换 CREATE INDEX / DROP INDEX
 */
export function convertIndex(sql: string, options: ConverterOptions, _logs: ConversionLog[]): string {
  // CREATE INDEX
  const createMatch = sql.match(/CREATE\s+(UNIQUE\s+)?(BITMAP\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(`?[^`\s]+`?)\s+ON\s+(`?[^`\s]+`?)\s*\(([^)]+)\)/i);
  if (createMatch) {
    const unique = createMatch[1] || '';
    const bitmap = createMatch[2] || '';
    const idxName = convertIdentifier(createMatch[3], options.preserveCase);
    const tblName = convertIdentifier(createMatch[4], options.preserveCase);
    const cols = createMatch[5].split(',').map((c) => {
      // 保留函数索引
      const trimmed = c.trim();
      return convertIdentifier(trimmed, options.preserveCase);
    }).join(', ');

    // 移除 USING BTREE / USING HASH
    return `CREATE ${unique}${bitmap}INDEX ${idxName} ON ${tblName}(${cols});`;
  }

  // DROP INDEX
  const dropMatch = sql.match(/DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(`?[^`\s]+`?)\s+(?:ON\s+(`?[^`\s]+`?))?/i);
  if (dropMatch) {
    const idxName = convertIdentifier(dropMatch[1], options.preserveCase);
    // Oracle 不需要 ON table
    return `DROP INDEX ${idxName};`;
  }

  return sql;
}

/**
 * 转换 ALTER TABLE
 */
export function convertAlterTable(sql: string, options: ConverterOptions, logs: ConversionLog[]): string {
  const match = sql.match(/ALTER\s+TABLE\s+(`?[^`\s]+`?)\s+(.+)/i);
  if (!match) return sql;

  const tableName = convertIdentifier(match[1], options.preserveCase);
  let action = match[2];

  // ADD COLUMN -> ADD
  action = action.replace(/\bADD\s+COLUMN\b/gi, 'ADD');

  // DROP COLUMN -> DROP
  action = action.replace(/\bDROP\s+COLUMN\b/gi, 'DROP');

  // CHANGE old new type -> RENAME COLUMN old TO new + MODIFY
  const changeMatch = action.match(/\bCHANGE\s+(`?[^`\s]+`?)\s+(`?[^`\s]+`?)\s+(.+)/i);
  if (changeMatch) {
    const oldName = convertIdentifier(changeMatch[1], options.preserveCase);
    const newName = convertIdentifier(changeMatch[2], options.preserveCase);
    logs.push({
      type: 'info',
      message: `CHANGE 拆分为 RENAME COLUMN 和 MODIFY`,
    });
    // 简化处理：只返回 RENAME COLUMN
    return `ALTER TABLE ${tableName} RENAME COLUMN ${oldName} TO ${newName};`;
  }

  // MODIFY 列类型
  const modifyMatch = action.match(/\bMODIFY\s+(?:COLUMN\s+)?(`?[^`\s]+`?)\s+(.+)/i);
  if (modifyMatch) {
    const colName = convertIdentifier(modifyMatch[1], options.preserveCase);
    // 移除注释部分（Oracle MODIFY 不支持 COMMENT）
    const colDef = modifyMatch[2].replace(/\s*COMMENT\s+'[^']*'/i, '');
    return `ALTER TABLE ${tableName} MODIFY ${colName} ${colDef};`;
  }

  // DROP PRIMARY KEY
  if (/\bDROP\s+PRIMARY\s+KEY\b/i.test(action)) {
    return `ALTER TABLE ${tableName} DROP CONSTRAINT pk_${convertIdentifier(match[1], false).toLowerCase()};`;
  }

  // DROP FOREIGN KEY
  const dropFkMatch = action.match(/\bDROP\s+FOREIGN\s+KEY\s+(`?[^`\s]+`?)/i);
  if (dropFkMatch) {
    return `ALTER TABLE ${tableName} DROP CONSTRAINT ${convertIdentifier(dropFkMatch[1], options.preserveCase)};`;
  }

  // DROP INDEX
  const dropIdxMatch = action.match(/\bDROP\s+INDEX\s+(`?[^`\s]+`?)/i);
  if (dropIdxMatch) {
    return `DROP INDEX ${convertIdentifier(dropIdxMatch[1], options.preserveCase)};`;
  }

  // 通用：转换标识符
  action = action.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));

  return `ALTER TABLE ${tableName} ${action};`;
}
