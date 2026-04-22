export interface ConversionLog {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  line?: number;
  detail?: string;
}

export interface ConversionResult {
  success: boolean;
  output: string;
  logs: ConversionLog[];
  stats: ConversionStats;
}

export interface ConversionStats {
  totalStatements: number;
  convertedStatements: number;
  warnings: number;
  errors: number;
  dataTypeConversions: number;
  autoIncrementConversions: number;
  commentConversions: number;
}

export interface ConverterOptions {
  useIdentity?: boolean;          // 使用 IDENTITY 替代 SEQUENCE
  useSequenceTrigger?: boolean;   // 使用 SEQUENCE + TRIGGER 方式
  preserveCase?: boolean;         // 保留原始大小写
  addComments?: boolean;          // 添加注释转换
  convertEngineCharset?: boolean; // 移除 ENGINE/CHARSET
  generateSequence?: boolean;     // 生成序列
  generateTrigger?: boolean;      // 生成更新触发器
}

export const DEFAULT_OPTIONS: ConverterOptions = {
  useIdentity: false,
  useSequenceTrigger: true,
  preserveCase: false,
  addComments: true,
  convertEngineCharset: true,
  generateSequence: true,
  generateTrigger: true,
};
