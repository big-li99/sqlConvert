import type { ConversionStats } from '../types';

interface StatsPanelProps {
  stats: ConversionStats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  const items = [
    { label: '总语句', value: stats.totalStatements, color: 'var(--text-secondary)' },
    { label: '已转换', value: stats.convertedStatements, color: 'var(--success)' },
    { label: '警告', value: stats.warnings, color: 'var(--warning)' },
    { label: '错误', value: stats.errors, color: 'var(--error)' },
    { label: '类型转换', value: stats.dataTypeConversions, color: 'var(--accent)' },
    { label: '自增转换', value: stats.autoIncrementConversions, color: 'var(--info)' },
    { label: '注释转换', value: stats.commentConversions, color: 'var(--text-secondary)' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '8px 16px',
        background: 'var(--bg-tertiary)',
        borderTop: '1px solid var(--border)',
        fontSize: 12,
        flexShrink: 0,
      }}
    >
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text-muted)' }}>{item.label}:</span>
          <span style={{ color: item.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
