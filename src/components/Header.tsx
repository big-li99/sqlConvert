import { ArrowRightLeft, Trash2, Upload, Download, Settings, FileCode } from 'lucide-react';

interface HeaderProps {
  onConvert: () => void;
  onClear: () => void;
  onImport: () => void;
  onExport: () => void;
  onToggleSettings: () => void;
  onLoadExample: () => void;
  isSettingsOpen: boolean;
}

export function Header({
  onConvert,
  onClear,
  onImport,
  onExport,
  onToggleSettings,
  onLoadExample,
  isSettingsOpen,
}: HeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg-primary)',
          }}
        >
          <ArrowRightLeft size={20} />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            MySQL → Oracle 语法转换器
          </h1>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
            支持 OceanBase MySQL 模式到 Oracle 模式
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn btn-sm" onClick={onLoadExample} title="加载示例">
          <FileCode size={14} />
          示例
        </button>
        <button className="btn btn-sm" onClick={onImport} title="导入SQL文件">
          <Upload size={14} />
          导入
        </button>
        <button className="btn btn-sm" onClick={onExport} title="导出结果">
          <Download size={14} />
          导出
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <button className="btn btn-sm" onClick={onClear} title="清空">
          <Trash2 size={14} />
          清空
        </button>
        <button
          className={`btn btn-sm ${isSettingsOpen ? 'btn-primary' : ''}`}
          onClick={onToggleSettings}
          title="设置"
        >
          <Settings size={14} />
          设置
        </button>
        <button className="btn btn-primary" onClick={onConvert} title="开始转换 (Ctrl+Enter)">
          <ArrowRightLeft size={16} />
          转换
        </button>
      </div>
    </header>
  );
}
