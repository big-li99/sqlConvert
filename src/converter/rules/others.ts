import type { ConversionLog, ConverterOptions } from '../../types';
import { convertIdentifier } from '../utils';

/**
 * 转换存储过程和函数
 */
export function convertProcedure(sql: string, options: ConverterOptions, _logs: ConversionLog[]): string {
  // MySQL: CREATE PROCEDURE name(IN p1 INT, OUT p2 VARCHAR(100))
  // Oracle: CREATE OR REPLACE PROCEDURE name(p1 IN NUMBER, p2 OUT VARCHAR2)

  // MySQL: CREATE FUNCTION name(p1 INT) RETURNS VARCHAR(100)
  // Oracle: CREATE OR REPLACE FUNCTION name(p1 NUMBER) RETURN VARCHAR2

  // 这种转换非常复杂，涉及语法树的完全重写
  // 这里只做简单的标识符和类型替换，并给出警告

  _logs.push({
    type: 'warning',
    message: '存储过程/函数的完整转换需要手动处理，已进行部分标识符替换',
  });

  let result = sql;

  // 添加 OR REPLACE
  if (/\bCREATE\s+PROCEDURE\b/i.test(result) && !/\bOR\s+REPLACE\b/i.test(result)) {
    result = result.replace(/\bCREATE\s+PROCEDURE\b/i, 'CREATE OR REPLACE PROCEDURE');
  }
  if (/\bCREATE\s+FUNCTION\b/i.test(result) && !/\bOR\s+REPLACE\b/i.test(result)) {
    result = result.replace(/\bCREATE\s+FUNCTION\b/i, 'CREATE OR REPLACE FUNCTION');
  }

  // RETURNS -> RETURN
  result = result.replace(/\bRETURNS\b/gi, 'RETURN');

  // 转换标识符
  result = result.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));

  return result;
}

/**
 * 转换 CREATE SEQUENCE / ALTER SEQUENCE / DROP SEQUENCE
 */
export function convertSequence(sql: string, options: ConverterOptions, _logs: ConversionLog[]): string {
  // 序列语法在 MySQL 中不存在（用 AUTO_INCREMENT），但在迁移时可能已有手动创建的序列
  // 转换标识符即可
  return sql.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));
}
