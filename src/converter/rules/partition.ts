import type { ConversionLog, ConverterOptions } from '../../types';
import { convertIdentifier } from '../utils';

/**
 * 转换分区表 DDL
 */
export function convertPartition(sql: string, options: ConverterOptions, _logs: ConversionLog[]): string {
  // RANGE 分区
  // MySQL: PARTITION BY RANGE (expr) (PARTITION p0 VALUES LESS THAN (value), ...)
  // Oracle: 基本相同，但注意 MAXVALUE 和函数表达式

  // LIST 分区
  // MySQL: VALUES IN (...)
  // Oracle: VALUES (...) + 支持 DEFAULT

  let result = sql;

  // 转换 LIST 分区的 VALUES IN -> VALUES
  result = result.replace(/\bVALUES\s+IN\b/gi, 'VALUES');

  // 转换 RANGE 中的 TO_DAYS 为直接日期
  // PARTITION BY RANGE (TO_DAYS(log_date)) -> PARTITION BY RANGE (log_date)
  result = result.replace(/PARTITION\s+BY\s+RANGE\s*\(\s*TO_DAYS\s*\(([^)]+)\)\s*\)/gi, 'PARTITION BY RANGE ($1)');

  // 转换 LESS THAN (TO_DAYS('xxx')) -> LESS THAN (DATE 'xxx')
  result = result.replace(/LESS\s+THAN\s*\(\s*TO_DAYS\s*\('([^']+)'\)\s*\)/gi, "LESS THAN (DATE '$1')");

  // MAXVALUE 加括号处理
  // MySQL: LESS THAN MAXVALUE
  // Oracle: LESS THAN (MAXVALUE)
  result = result.replace(/LESS\s+THAN\s+MAXVALUE/gi, 'LESS THAN (MAXVALUE)');

  // 转换标识符
  result = result.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));

  return result;
}
