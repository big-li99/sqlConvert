import type { ConversionLog, ConverterOptions } from '../../types';
import { convertDataType } from './dataTypes';
import { convertIdentifier, makeUniqueIndexName } from '../utils';

/**
 * 转换 CREATE INDEX / DROP INDEX
 */
export function convertIndex(sql: string, options: ConverterOptions, logs: ConversionLog[]): string {
  // CREATE INDEX
  const createMatch = sql.match(/CREATE\s+(UNIQUE\s+)?(BITMAP\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(`?[^`\s]+`?)\s+ON\s+(`?[^`\s]+`?)\s*\(([^)]+)\)/i);
  if (createMatch) {
    const unique = (createMatch[1] || '').trim().toUpperCase();
    const bitmap = (createMatch[2] || '').trim().toUpperCase();
    let idxName = convertIdentifier(createMatch[3], options.preserveCase);
    const tblName = convertIdentifier(createMatch[4], options.preserveCase);
    idxName = makeUniqueIndexName(idxName, tblName, logs);
    const cols = createMatch[5].split(',').map((c) => {
      // 保留函数索引
      const trimmed = c.trim();
      return convertIdentifier(trimmed, options.preserveCase);
    }).join(', ');

    // 移除 USING BTREE / USING HASH
    const keywords = [unique, bitmap].filter(Boolean).join(' ');
    return `CREATE ${keywords ? keywords + ' ' : ''}INDEX ${idxName} ON ${tblName}(${cols});`;
  }

  // DROP INDEX
  const dropMatch = sql.match(/DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(`?[^`\s]+`?)\s+(?:ON\s+(`?[^`\s]+`?))?/i);
  if (dropMatch) {
    let idxName = convertIdentifier(dropMatch[1], options.preserveCase);
    const tblName = dropMatch[2] ? convertIdentifier(dropMatch[2], options.preserveCase) : '';
    if (tblName) {
      idxName = makeUniqueIndexName(idxName, tblName, logs);
    }
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

  // 处理 ADD [IF NOT EXISTS] col_name type ...
  const addMatch = action.match(/\bADD\s+(?:IF\s+NOT\s+EXISTS\s+)?(`?[^`\s]+`?)\s+(.+)/i);
  if (addMatch) {
    const colNameRaw = addMatch[1];
    let colDef = addMatch[2];
    const colName = convertIdentifier(colNameRaw, options.preserveCase);

    // 提取注释
    const commentMatch = colDef.match(/\bCOMMENT\s+'([^']*)'/i);
    let comment = '';
    if (commentMatch) {
      comment = commentMatch[1];
      colDef = colDef.replace(/\s*COMMENT\s+'[^']*'/i, '').trim();
    }

    // 移除 COLLATE
    colDef = colDef.replace(/\s*COLLATE\s+\S+/gi, '');
    // 移除 CHARACTER SET
    colDef = colDef.replace(/\s*CHARACTER\s+SET\s+\S+/gi, '');
    // 移除 AFTER column（Oracle 不支持）
    colDef = colDef.replace(/\s+AFTER\s+(`?[^`\s]+`?)/gi, '');

    // 转换数据类型
    colDef = convertDataType(colDef, logs);

    const alterLine = `ALTER TABLE ${tableName} ADD ${colName} ${colDef};`;
    if (comment && options.addComments) {
      return `${alterLine}\n\nCOMMENT ON COLUMN ${tableName}.${colName} IS '${comment}';`;
    }
    return alterLine;
  }

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
