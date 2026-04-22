import type { ConverterOptions } from '../types';

interface SettingsPanelProps {
  options: ConverterOptions;
  onChange: (opts: ConverterOptions) => void;
}

interface CheckboxProps {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: () => void;
}

function Checkbox({ label, desc, checked, onChange }: CheckboxProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 0',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ marginTop: 2, accentColor: 'var(--accent)' }}
      />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>}
      </div>
    </label>
  );
}

export function SettingsPanel({ options, onChange }: SettingsPanelProps) {
  const toggle = (key: keyof ConverterOptions) => {
    onChange({ ...options, [key]: !options[key] });
  };

  return (
    <div
      className="panel"
      style={{
        position: 'absolute',
        top: 60,
        right: 20,
        width: 320,
        zIndex: 100,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div className="panel-header">转换设置</div>
      <div className="panel-body" style={{ padding: '0 16px' }}>
        <Checkbox
          label="使用 IDENTITY 替代 SEQUENCE"
          desc="Oracle 12c+ 支持的自增列语法"
          checked={!!options.useIdentity}
          onChange={() => toggle('useIdentity')}
        />
        <Checkbox
          label="生成 SEQUENCE + NEXTVAL"
          desc="为 AUTO_INCREMENT 列创建序列并设置默认值"
          checked={!!options.useSequenceTrigger}
          onChange={() => toggle('useSequenceTrigger')}
        />
        <Checkbox
          label="生成更新触发器"
          desc="为 ON UPDATE CURRENT_TIMESTAMP 生成触发器"
          checked={!!options.generateTrigger}
          onChange={() => toggle('generateTrigger')}
        />
        <Checkbox
          label="转换表注释"
          desc="将 COMMENT 转为 COMMENT ON TABLE/COLUMN"
          checked={!!options.addComments}
          onChange={() => toggle('addComments')}
        />
        <Checkbox
          label="移除 ENGINE/CHARSET"
          desc="移除 MySQL 特有的表选项"
          checked={!!options.convertEngineCharset}
          onChange={() => toggle('convertEngineCharset')}
        />
        <Checkbox
          label="保留原始大小写"
          desc="使用双引号保留标识符的原始大小写"
          checked={!!options.preserveCase}
          onChange={() => toggle('preserveCase')}
        />
      </div>
    </div>
  );
}
