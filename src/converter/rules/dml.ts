import type { ConversionLog, ConverterOptions } from '../../types';
import { convertIdentifier } from '../utils';

/**
 * 转换 DML 语句（INSERT, UPDATE, DELETE, SELECT）
 */
export function convertDML(sql: string, options: ConverterOptions, logs: ConversionLog[]): string {
  let result = sql;
  const upper = sql.toUpperCase().trim();

  // INSERT SET 语法 -> 标准 INSERT VALUES
  if (upper.startsWith('INSERT') && /\bSET\b/i.test(sql)) {
    const match = sql.match(/INSERT\s+(?:INTO\s+)?(`?[^`\s]+`?)\s+SET\s+(.+)/i);
    if (match) {
      const table = convertIdentifier(match[1], options.preserveCase);
      const setPairs = match[2].split(',').map((p) => p.trim());
      const columns: string[] = [];
      const values: string[] = [];
      for (const pair of setPairs) {
        const [col, val] = pair.split('=').map((s) => s.trim());
        columns.push(convertIdentifier(col, options.preserveCase));
        values.push(val);
      }
      result = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')});`;
      logs.push({ type: 'info', message: '将 INSERT SET 语法转换为标准 INSERT VALUES' });
    }
  }

  // 多行 INSERT VALUES (...), (...)
  // Oracle 12c+ 支持多行 VALUES，但旧版本用 INSERT ALL
  // 这里不强行转换，因为 OceanBase Oracle 模式可能支持

  // UPDATE LIMIT -> 需要用 ROWNUM
  if (/\bUPDATE\b.*\bLIMIT\s+\d+/i.test(sql)) {
    logs.push({
      type: 'warning',
      message: 'Oracle 不支持 UPDATE LIMIT，需要手动使用 WHERE ROWNUM <= n 实现',
    });
  }

  // DELETE LIMIT
  if (/\bDELETE\b.*\bLIMIT\s+\d+/i.test(sql)) {
    logs.push({
      type: 'warning',
      message: 'Oracle 不支持 DELETE LIMIT，需要手动使用 WHERE ROWNUM <= n 实现',
    });
  }

  // SELECT LIMIT -> ROWNUM / OFFSET FETCH
  const limitMatch = sql.match(/\bLIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
  if (limitMatch) {
    const limit = parseInt(limitMatch[1]);
    const offset = limitMatch[2] ? parseInt(limitMatch[2]) : 0;

    // 移除 LIMIT 子句
    result = result.replace(/\s*\bLIMIT\s+\d+(?:\s+OFFSET\s+\d+)?/i, '');

    if (offset > 0) {
      // Oracle 12c+ OFFSET FETCH
      result = `${result}\nOFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
      logs.push({
        type: 'info',
        message: `将 LIMIT ${limit} OFFSET ${offset} 转换为 OFFSET ... FETCH NEXT ...`,
      });
    } else {
      // 简单 LIMIT n -> 在外层包 ROWNUM
      // 简单处理：直接加 WHERE ROWNUM <= n（假设没有 WHERE）
      // 如果有 WHERE，需要更复杂的处理
      if (/\bWHERE\b/i.test(result)) {
        logs.push({
          type: 'warning',
          message: 'SELECT 包含 WHERE 子句，LIMIT 转换可能需要手动调整为 ROWNUM 子查询',
        });
      } else {
        // 移除末尾分号
        result = result.replace(/;\s*$/, '');
        result = `SELECT * FROM (${result}) WHERE ROWNUM <= ${limit};`;
        logs.push({
          type: 'info',
          message: `将 LIMIT ${limit} 转换为 ROWNUM 子查询`,
        });
      }
    }
  }

  // SELECT 1 -> SELECT 1 FROM DUAL
  const selectDualMatch = result.match(/SELECT\s+([^)]+)\s*;?\s*$/i);
  if (selectDualMatch && !/\bFROM\b/i.test(result)) {
    result = result.replace(/;?\s*$/, '') + ' FROM DUAL;';
    logs.push({ type: 'info', message: '为无表 SELECT 添加 FROM DUAL' });
  }

  // 多表 UPDATE
  if (/\bUPDATE\s+[^,]+,/.test(sql)) {
    logs.push({
      type: 'warning',
      message: '多表 UPDATE 在 Oracle 中需要用子查询实现，请手动转换',
    });
  }

  // 多表 DELETE
  if (/\bDELETE\s+\w+\s+FROM\s+\w+\s*,/.test(sql)) {
    logs.push({
      type: 'warning',
      message: '多表 DELETE 在 Oracle 中需要用子查询实现，请手动转换',
    });
  }

  // 函数转换
  result = result.replace(/\bIFNULL\s*\(/gi, 'NVL(');
  result = result.replace(/\bUUID\s*\(\s*\)/gi, 'SYS_GUID()');
  result = result.replace(/\bNOW\s*\(\s*\)/gi, 'SYSDATE');
  result = result.replace(/\bSUBSTRING\s*\(/gi, 'SUBSTR(');
  result = result.replace(/\bTRUNCATE\s*\(/gi, 'TRUNC(');
  result = result.replace(/\bDATE_FORMAT\s*\(([^,]+),\s*'([^']+)'\s*\)/gi, "TO_CHAR($1, '$2')");
  result = result.replace(/\bSTR_TO_DATE\s*\(([^,]+),\s*'([^']+)'\s*\)/gi, "TO_DATE($1, '$2')");

  // 转换标识符
  result = result.replace(/`([^`]+)`/g, (_, id) => convertIdentifier(id, options.preserveCase));

  return result;
}
