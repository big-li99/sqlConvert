import type { ConversionLog } from '../../types';

/**
 * 数据类型映射表
 */
const TYPE_MAP: Record<string, string | ((match: string, args?: string) => string)> = {
  // 整数类型
  'TINYINT': () => 'NUMBER(3)',
  'SMALLINT': () => 'NUMBER(5)',
  'MEDIUMINT': () => 'NUMBER(7)',
  'INT': () => {
    // INT(n) 中的 n 只是显示宽度，转为 NUMBER(10)
    return 'NUMBER(10)';
  },
  'INTEGER': () => 'NUMBER(10)',
  'BIGINT': () => 'NUMBER(19)',

  // 浮点类型
  'FLOAT': () => 'FLOAT',
  'DOUBLE': () => 'DOUBLE PRECISION',
  'REAL': () => 'FLOAT',

  // DECIMAL / NUMERIC
  'DECIMAL': (_m: string, args?: string) => args ? `NUMBER${args}` : 'NUMBER',
  'NUMERIC': (_m: string, args?: string) => args ? `NUMBER${args}` : 'NUMBER',

  // 字符串类型
  'CHAR': (_m: string, args?: string) => args ? `CHAR${args}` : 'CHAR(1)',
  'VARCHAR': (_m: string, args?: string) => args ? `VARCHAR2${args}` : 'VARCHAR2(255)',
  'TINYTEXT': () => 'CLOB',
  'TEXT': () => 'CLOB',
  'MEDIUMTEXT': () => 'CLOB',
  'LONGTEXT': () => 'CLOB',

  // 二进制类型
  'BINARY': (_m: string, args?: string) => args ? `RAW${args}` : 'RAW(1)',
  'VARBINARY': (_m: string, args?: string) => args ? `RAW${args}` : 'RAW(255)',
  'TINYBLOB': () => 'BLOB',
  'BLOB': () => 'BLOB',
  'MEDIUMBLOB': () => 'BLOB',
  'LONGBLOB': () => 'BLOB',

  // 日期时间类型
  'DATE': () => 'DATE',
  'DATETIME': () => 'DATE',
  'TIMESTAMP': (_m: string, args?: string) => args ? `TIMESTAMP${args}` : 'TIMESTAMP',
  'TIME': () => 'INTERVAL DAY TO SECOND',
  'YEAR': () => 'NUMBER(4)',

  // 其他类型
  'BOOLEAN': () => 'NUMBER(1)',
  'BOOL': () => 'NUMBER(1)',
  'JSON': () => 'CLOB',
  'ENUM': () => 'VARCHAR2(255)',
  'SET': () => 'VARCHAR2(255)',
};

/**
 * 转换单行中的数据类型
 */
export function convertDataType(line: string, logs: ConversionLog[]): string {
  let converted = line;
  let conversionCount = 0;

  // 按顺序匹配类型，优先匹配带参数的
  const typeKeys = Object.keys(TYPE_MAP).sort((a, b) => b.length - a.length);

  for (const typeName of typeKeys) {
    const pattern = new RegExp(`\\b${typeName}\\b(\\s*\\([^)]*\\))?`, 'gi');
    converted = converted.replace(pattern, (match, args) => {
      const converter = TYPE_MAP[typeName];
      const result = typeof converter === 'function' ? converter(match, args) : converter;
      conversionCount++;
      return result;
    });
  }

  if (conversionCount > 0) {
    logs.push({
      type: 'info',
      message: `转换了 ${conversionCount} 个数据类型`,
    });
  }

  return converted;
}

/**
 * 处理 ENUM 类型，生成对应的 CHECK 约束
 */
export function extractEnumConstraint(columnDef: string): { type: string; check?: string } | null {
  const enumMatch = columnDef.match(/ENUM\s*\(([^)]+)\)/i);
  if (!enumMatch) return null;

  const values = enumMatch[1]
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  const checkExpr = values.join(', ');
  return {
    type: 'VARCHAR2(255)',
    check: `CHECK (${columnDef.split(/\s/)[0]} IN (${checkExpr}))`,
  };
}
