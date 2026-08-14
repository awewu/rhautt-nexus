'use client';

/**
 * 2026-08 全页 UX 重构二期 · WorkspaceKit 化
 *
 * 事件死信面板（只读）。
 * 平台的跨域反应（成交→北极星、问诊→CDP、内容→GEO 再探测）全部走 outbox 事件。
 * 死信 = 某条反应链断了且重试耗尽——此前死信只能进数据库查，堆积无人知道，
 * 表面一切正常、实际飞轮某段已停转。这是可观测缺口，不是新功能。
 */

import useSWR from 'swr';
import { AlertTriangle } from 'lucide-react';
import { AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
import { WorkspaceSection } from '@/components/WorkspaceKit';
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
    <WorkspaceSection
      icon={<AlertTriangle size={16} />}
      title="事件死信 · 成效回流断点"
      className="mt-5"
      aside={
        rows.length > 0 ? (
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive tabular-nums">
            {rows.length} 条待处理
          </span>
        ) : undefined
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        死信 = 事件重试耗尽仍投递失败，对应的跨域反应（北极星重算/CDP 摄取/通知等）没有发生。
        死信不会自愈——需要修复消费方后人工处理。
      </p>
      <AsyncBoundary
        status={statusOf(dead.isLoading, dead.error, rows.length === 0)}
        errorMessage="死信队列加载失败（需 API + 数据库）"
        onRetry={() => dead.mutate()}
        emptyTitle="无死信"
        emptyDescription="事件管道当前无投递失败堆积。"
      >
        <div className="grid gap-1">
          {rows.slice(0, 30).map((e: any) => (
            <div key={e.id} className="border-t py-1.5 text-xs first:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{e.eventType}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  重试 {e.attempts} 次 ·{' '}
                  {e.createdAt ? String(e.createdAt).slice(0, 16).replace('T', ' ') : ''}
                </span>
              </div>
              {e.lastError && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {String(e.lastError).slice(0, 120)}
                </div>
              )}
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </WorkspaceSection>
  );
}
