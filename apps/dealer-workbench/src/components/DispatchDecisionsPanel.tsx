'use client';

/**
 * 2026-08 全页 UX 重构二期 · WorkspaceKit 化
 *
 * 线索派单决策面板（只读）。
 * 飞轮中段：GEO/获客 → lead.captured → 按 地域+品类+负载 打分选经销商 → 落审计。
 * 此前派单决策只存在于 dispatch_routing_decisions 表里无人可见——线索去了哪个
 * 经销商、凭什么去，总部看不见就无法发现派偏/派空。
 */

import useSWR from 'swr';
import { Route } from 'lucide-react';
import { AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
import { WorkspaceSection } from '@/components/WorkspaceKit';
import { cn } from '@/lib/utils';
import { dispatchApi } from '../lib/api';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

export function DispatchDecisionsPanel() {
  const decisions = useSWR('dispatch:decisions', () => dispatchApi.decisions(50));
  const rows: any[] = Array.isArray(decisions.data) ? decisions.data : [];

  return (
    <WorkspaceSection
      icon={<Route size={16} />}
      title="线索派单决策（只读审计）"
      className="mt-5"
    >
      <p className="mb-3 text-xs text-muted-foreground">
        lead.captured → 按 地域+品类+负载 打分选经销商；每条派单落审计。未命中经销商的
        线索也如实显示（chosen 为空 = 派空，需要补目录或调规则）。
      </p>
      <AsyncBoundary
        status={statusOf(decisions.isLoading, decisions.error, rows.length === 0)}
        errorMessage="派单决策加载失败（需 API + 数据库）"
        onRetry={() => decisions.mutate()}
        emptyTitle="暂无派单决策"
        emptyDescription="派单由真实 lead.captured 事件驱动——没有线索就没有决策，不造样本。"
      >
        <div className="grid gap-1">
          {rows.map((d: any) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 border-t py-1.5 text-xs first:border-t-0"
            >
              <span className="min-w-0">
                <span className="font-medium">
                  {[d.province, d.city].filter(Boolean).join(' ') || '地域未知'}
                </span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {d.category || '品类未知'} · 来源 {d.source || '-'} · 规则 {d.rule}
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 text-[11px] tabular-nums',
                  d.chosenDealerId ? 'text-muted-foreground' : 'font-medium'
                )}
              >
                {d.chosenDealerId ? `→ ${d.chosenDealerId.slice(0, 8)}…` : '⚠️ 派空（无匹配经销商）'}
                {d.createdAt ? ` · ${String(d.createdAt).slice(0, 10)}` : ''}
              </span>
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </WorkspaceSection>
  );
}
