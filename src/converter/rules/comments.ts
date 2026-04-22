import type { ConversionLog, ConverterOptions } from '../../types';
import { convertIdentifier } from '../utils';

/**
 * 转换 COMMENT 语句（MySQL 的 ALTER TABLE ... COMMENT 或独立的 COMMENT）
 */
export function convertComment(sql: string, _options: ConverterOptions, _logs: ConversionLog[]): string {
  // MySQL 没有独立的 COMMENT ON 语法，但如果输入中已有，保持原样
  // 这里主要处理一些特殊情况
  return sql;
}

/**
 * 转换 DROP TABLE / TRUNCATE TABLE
 */
export function convertDrop(sql: string, options: ConverterOptions, logs: ConversionLog[]): string {
  // 过滤掉 DROP TABLE IF EXISTS，不生成该语句
  if (/DROP\s+TABLE\s+IF\s+EXISTS/i.test(sql)) {
    logs.push({ type: 'info', message: '已过滤 DROP TABLE IF EXISTS 语句（Oracle 模式不建议使用）' });
    return '';
  }

  // DROP TEMPORARY TABLE -> 移除 TEMPORARY
  const dropTempMatch = sql.match(/DROP\s+TEMPORARY\s+TABLE/i);
  if (dropTempMatch) {
    return sql.replace(/DROP\s+TEMPORARY\s+TABLE/i, 'DROP TABLE');
  }

  // 转换标识符
  return sql.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));
}

/**
 * 转换 TRUNCATE TABLE
 */
export function convertTruncate(sql: string, options: ConverterOptions, _logs: ConversionLog[]): string {
  // TRUNCATE t -> TRUNCATE TABLE t
  const match = sql.match(/TRUNCATE\s+(?!TABLE\b)(`?[^`\s]+`?)/i);
  if (match) {
    return `TRUNCATE TABLE ${convertIdentifier(match[1], options.preserveCase)};`;
  }
  return sql.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));
}

/**
 * 转换 CREATE VIEW / DROP VIEW
 */
export function convertView(sql: string, options: ConverterOptions, _logs: ConversionLog[]): string {
  // CREATE VIEW 和 CREATE OR REPLACE VIEW 基本相同
  // 转换标识符即可
  return sql.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));
}
