import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import type { ConversionLog } from '../types';

interface LogPanelProps {
  logs: ConversionLog[];
}

const iconMap = {
  info: <Info size={14} style={{ color: 'var(--info)', flexShrink: 0 }} />,
  warning: <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />,
  error: <AlertCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />,
  success: <CheckCircle size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />,
};

const borderColorMap = {
  info: 'rgba(137, 220, 235, 0.2)',
  warning: 'rgba(249, 226, 175, 0.2)',
  error: 'rgba(243, 139, 168, 0.2)',
  success: 'rgba(166, 227, 161, 0.2)',
};

export function LogPanel({ logs }: LogPanelProps) {
  if (logs.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 13,
        }}
      >
        暂无日志信息
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12 }}>
      {logs.map((log, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            borderLeft: `3px solid ${borderColorMap[log.type]}`,
            background: 'var(--bg-tertiary)',
            fontSize: 12,
          }}
        >
          {iconMap[log.type]}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{log.message}</div>
            {log.detail && (
              <div
                style={{
                  color: 'var(--text-muted)',
                  marginTop: 4,
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {log.detail}
              </div>
            )}
            {log.line !== undefined && (
              <div style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: 11 }}>
                行号: {log.line}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
