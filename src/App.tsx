import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Header } from './components/Header';
import { SettingsPanel } from './components/SettingsPanel';
import { LogPanel } from './components/LogPanel';
import { StatsPanel } from './components/StatsPanel';
import { convertSQL, DEFAULT_OPTIONS } from './converter';
import type { ConversionResult, ConverterOptions, ConversionStats } from './types';
import { Copy, Check, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const EXAMPLE_SQL = `-- 示例：用户表和订单表（MySQL 语法）
CREATE TABLE \`sys_user\` (
    \`id\` BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    \`username\` VARCHAR(50) NOT NULL COMMENT '用户名',
    \`password\` VARCHAR(100) NOT NULL COMMENT '密码',
    \`email\` VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
    \`phone\` VARCHAR(20) DEFAULT NULL COMMENT '电话',
    \`status\` TINYINT(1) DEFAULT 1 COMMENT '状态：0禁用，1启用',
    \`create_time\` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    \`update_time\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    \`deleted\` TINYINT(1) DEFAULT 0 COMMENT '删除标记',
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uk_username\` (\`username\`),
    KEY \`idx_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

CREATE TABLE \`sys_order\` (
    \`id\` BIGINT(20) NOT NULL AUTO_INCREMENT,
    \`order_no\` VARCHAR(50) NOT NULL,
    \`user_id\` BIGINT(20) NOT NULL,
    \`amount\` DECIMAL(10,2) NOT NULL,
    \`status\` TINYINT(1) DEFAULT 0,
    \`create_time\` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uk_order_no\` (\`order_no\`),
    KEY \`idx_user_id\` (\`user_id\`),
    CONSTRAINT \`fk_user\` FOREIGN KEY (\`user_id\`)
        REFERENCES \`sys_user\` (\`id\`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- DML 示例
INSERT INTO sys_user SET id=1, username='admin';
SELECT * FROM sys_user WHERE status=1 LIMIT 10 OFFSET 0;
UPDATE sys_order SET status=1 WHERE id=1;`;

const DEFAULT_STATS: ConversionStats = {
  totalStatements: 0,
  convertedStatements: 0,
  warnings: 0,
  errors: 0,
  dataTypeConversions: 0,
  autoIncrementConversions: 0,
  commentConversions: 0,
};

export default function App() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [logs, setLogs] = useState<ConversionResult['logs']>([]);
  const [stats, setStats] = useState<ConversionStats>(DEFAULT_STATS);
  const [options, setOptions] = useState<ConverterOptions>(DEFAULT_OPTIONS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConvert = useCallback(() => {
    const result = convertSQL(input, options);
    setOutput(result.output);
    setLogs(result.logs);
    setStats(result.stats);
  }, [input, options]);

  const handleClear = useCallback(() => {
    setInput('');
    setOutput('');
    setLogs([]);
    setStats(DEFAULT_STATS);
  }, []);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setInput(text);
      setLogs([{ type: 'success', message: `成功导入文件: ${file.name}` }]);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, []);

  const handleExport = useCallback(() => {
    if (!output.trim()) {
      setLogs((prev) => [...prev, { type: 'warning', message: '输出为空，无法导出' }]);
      return;
    }
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_oracle_${new Date().getTime()}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    setLogs((prev) => [...prev, { type: 'success', message: '结果已导出为 SQL 文件' }]);
  }, [output]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [output]);

  const handleLoadExample = useCallback(() => {
    setInput(EXAMPLE_SQL);
    setLogs([{ type: 'info', message: '已加载示例 SQL' }]);
  }, []);

  // 快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleConvert();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleConvert]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-primary)',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".sql,.txt"
        onChange={handleFileChange}
      />

      <Header
        onConvert={handleConvert}
        onClear={handleClear}
        onImport={handleImport}
        onExport={handleExport}
        onToggleSettings={() => setIsSettingsOpen((v) => !v)}
        onLoadExample={handleLoadExample}
        isSettingsOpen={isSettingsOpen}
      />

      {isSettingsOpen && (
        <SettingsPanel options={options} onChange={setOptions} />
      )}

      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          gap: 8,
          padding: '0 8px 8px',
        }}
      >
        {/* 输入区域 */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="panel-header">
            <div className="panel-title">
              <span style={{ color: 'var(--accent)' }}>MySQL</span>
              <span>输入</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {input.length} 字符
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              value={input}
              onChange={(v) => setInput(v || '')}
              language="sql"
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
              }}
            />
          </div>
        </div>

        {/* 输出区域 */}
        <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="panel-header">
            <div className="panel-title">
              <span style={{ color: 'var(--success)' }}>Oracle</span>
              <span>输出</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {output && (
                <button className="btn btn-sm" onClick={handleCopy} title="复制结果">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制'}
                </button>
              )}
              <button
                className="btn btn-sm"
                onClick={() => setIsLogOpen((v) => !v)}
                title={isLogOpen ? '收起日志' : '展开日志'}
              >
                {isLogOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
                日志
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              value={output}
              language="sql"
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                readOnly: true,
              }}
            />
          </div>
        </div>

        {/* 日志面板 */}
        {isLogOpen && (
          <div
            className="panel"
            style={{
              width: 340,
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div className="panel-header">
              <div className="panel-title">转换日志</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {logs.length} 条
              </span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <LogPanel logs={logs} />
            </div>
            <StatsPanel stats={stats} />
          </div>
        )}
      </div>
    </div>
  );
}
