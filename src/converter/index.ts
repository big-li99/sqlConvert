import type { ConversionLog, ConversionResult, ConversionStats, ConverterOptions } from '../types';
import { DEFAULT_OPTIONS } from '../types';
import { splitStatements, removeComments } from './utils';
import { convertCreateTable } from './rules/createTable';
import { convertIndex, convertAlterTable } from './rules/index';
import { convertPartition } from './rules/partition';
import { convertDML } from './rules/dml';
import { convertComment, convertDrop, convertTruncate, convertView } from './rules/comments';
import { convertProcedure, convertSequence } from './rules/others';

/**
 * 判断语句类型并路由到对应的转换器
 */
function convertStatement(sql: string, options: ConverterOptions, logs: ConversionLog[]): string {
  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('CREATE TABLE')) {
    return convertCreateTable(sql, options, logs);
  }

  if (trimmed.startsWith('CREATE INDEX') || trimmed.startsWith('DROP INDEX')) {
    return convertIndex(sql, options, logs);
  }

  if (trimmed.startsWith('ALTER TABLE')) {
    return convertAlterTable(sql, options, logs);
  }

  if (trimmed.startsWith('CREATE') && /PARTITION\s+BY/i.test(sql)) {
    return convertPartition(sql, options, logs);
  }

  if (trimmed.startsWith('CREATE') && /VIEW/i.test(sql)) {
    return convertView(sql, options, logs);
  }

  if (trimmed.startsWith('CREATE') && /PROCEDURE|FUNCTION/i.test(sql)) {
    return convertProcedure(sql, options, logs);
  }

  if (trimmed.startsWith('CREATE') && /SEQUENCE/i.test(sql)) {
    return convertSequence(sql, options, logs);
  }

  if (trimmed.startsWith('DROP TABLE') || trimmed.startsWith('DROP TEMPORARY TABLE')) {
    return convertDrop(sql, options, logs);
  }

  if (trimmed.startsWith('TRUNCATE')) {
    return convertTruncate(sql, options, logs);
  }

  if (trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE') || trimmed.startsWith('SELECT')) {
    return convertDML(sql, options, logs);
  }

  if (trimmed.startsWith('COMMENT')) {
    return convertComment(sql, options, logs);
  }

  // 对于无法识别的语句，只转换标识符
  logs.push({
    type: 'warning',
    message: `未识别语句类型，仅进行基本标识符转换`,
  });
  return sql.replace(/`([^`]+)`/g, (_, id) => `"${id}"`.toUpperCase());
}

/**
 * 主转换函数
 */
export function convertSQL(input: string, options: ConverterOptions = DEFAULT_OPTIONS): ConversionResult {
  const logs: ConversionLog[] = [];
  const stats: ConversionStats = {
    totalStatements: 0,
    convertedStatements: 0,
    warnings: 0,
    errors: 0,
    dataTypeConversions: 0,
    autoIncrementConversions: 0,
    commentConversions: 0,
  };

  if (!input.trim()) {
    return {
      success: true,
      output: '',
      logs: [{ type: 'info', message: '输入为空' }],
      stats,
    };
  }

  const cleanedInput = removeComments(input);
  const statements = splitStatements(cleanedInput);
  stats.totalStatements = statements.length;

  const outputs: string[] = [];

  for (const stmt of statements) {
    try {
      const converted = convertStatement(stmt, options, logs);
      if (converted && converted.trim()) {
        outputs.push(converted);
        stats.convertedStatements++;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logs.push({
        type: 'error',
        message: `转换失败: ${errorMsg}`,
        detail: stmt.substring(0, 200),
      });
      stats.errors++;
      outputs.push(`-- 转换失败: ${errorMsg}\n-- 原始语句:\n${stmt};`);
    }
  }

  // 统计日志
  stats.warnings = logs.filter((l) => l.type === 'warning').length;
  stats.errors = logs.filter((l) => l.type === 'error').length;

  logs.forEach((log) => {
    if (log.message.includes('数据类型')) stats.dataTypeConversions++;
    if (log.message.includes('AUTO_INCREMENT') || log.message.includes('SEQUENCE')) stats.autoIncrementConversions++;
    if (log.message.includes('COMMENT')) stats.commentConversions++;
  });

  return {
    success: stats.errors === 0,
    output: outputs.join('\n\n'),
    logs,
    stats,
  };
}

export { DEFAULT_OPTIONS };
export type { ConversionResult, ConversionLog, ConversionStats, ConverterOptions };
