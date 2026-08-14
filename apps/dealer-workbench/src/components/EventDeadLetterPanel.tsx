'use client';

/**
 * 事件死信面板（只读）。
 * 平台的跨域反应（成交→北极星、问诊→CDP、内容→GEO 再探测）全部走 outbox 事件。
 * 死信 = 某条反应链断了且重试耗尽——此前死信只能进数据库查，堆积无人知道，
 * 表面一切正常、实际飞轮某段已停转。这是可观测缺口，不是新功能。
 */

import useSWR from 'swr';
import { AlertTriangle } from 'lucide-react';
import { AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
import { eventOps } from '../lib/api';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

export function EventDeadLetterPanel() {
  const dead = useSWR('eventops:dead', () => eventOps.deadLetters(), { refreshInterval: 60000 });
  const rows: any[] = Array.isArray(dead.data) ? dead.data : [];

  return (
    <div className="card" style={{ padding: 20, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <AlertTriangle size={16} />
        <span className="t-lg" style={{ fontWeight: 600 }}>
          事件死信 · 成效回流断点
        </span>
        {rows.length > 0 && (
          <span
            className="t-xs"
            style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              borderRadius: 10,
              padding: '2px 8px',
            }}
          >
            {rows.length} 条待处理
          </span>
        )}
      </div>
      <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginBottom: 12 }}>
        死信 = 事件重试耗尽仍投递失败，对应的跨域反应（北极星重算/CDP 摄取/通知等）没有发生。
        死信不会自愈——需要修复消费方后人工处理。
      </div>
      <AsyncBoundary
        status={statusOf(dead.isLoading, dead.error, rows.length === 0)}
        errorMessage="死信队列加载失败（需 API + 数据库）"
        onRetry={() => dead.mutate()}
        emptyTitle="无死信"
        emptyDescription="事件管道当前无投递失败堆积。"
      >
        <div style={{ display: 'grid', gap: 4 }}>
          {rows.slice(0, 30).map((e: any) => (
            <div key={e.id} className="t-sm" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--t-strong)' }}>{e.eventType}</span>
                <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>
                  重试 {e.attempts} 次 · {e.createdAt ? String(e.createdAt).slice(0, 16).replace('T', ' ') : ''}
                </span>
              </div>
              {e.lastError && (
                <div className="t-xs" style={{ color: 'var(--t-tertiary)' }}>
                  {String(e.lastError).slice(0, 120)}
                </div>
              )}
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </div>
  );
}
