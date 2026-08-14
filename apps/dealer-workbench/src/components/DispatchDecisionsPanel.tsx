'use client';

/**
 * 线索派单决策面板（只读）。
 * 飞轮中段：GEO/获客 → lead.captured → 按 地域+品类+负载 打分选经销商 → 落审计。
 * 此前派单决策只存在于 dispatch_routing_decisions 表里无人可见——线索去了哪个
 * 经销商、凭什么去，总部看不见就无法发现派偏/派空。
 */

import useSWR from 'swr';
import { Route } from 'lucide-react';
import { AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
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
    <div className="card" style={{ padding: 20, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Route size={16} />
        <span className="t-lg" style={{ fontWeight: 600 }}>
          线索派单决策（只读审计）
        </span>
      </div>
      <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginBottom: 12 }}>
        lead.captured → 按 地域+品类+负载 打分选经销商；每条派单落审计。未命中经销商的
        线索也如实显示（chosen 为空 = 派空，需要补目录或调规则）。
      </div>
      <AsyncBoundary
        status={statusOf(decisions.isLoading, decisions.error, rows.length === 0)}
        errorMessage="派单决策加载失败（需 API + 数据库）"
        onRetry={() => decisions.mutate()}
        emptyTitle="暂无派单决策"
        emptyDescription="派单由真实 lead.captured 事件驱动——没有线索就没有决策，不造样本。"
      >
        <div style={{ display: 'grid', gap: 4 }}>
          {rows.map((d: any) => (
            <div
              key={d.id}
              className="t-sm"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span>
                <span style={{ color: 'var(--t-strong)' }}>
                  {[d.province, d.city].filter(Boolean).join(' ') || '地域未知'}
                </span>
                <span className="t-xs" style={{ color: 'var(--t-tertiary)', marginLeft: 8 }}>
                  {d.category || '品类未知'} · 来源 {d.source || '-'} · 规则 {d.rule}
                </span>
              </span>
              <span
                className="t-xs"
                style={{ color: d.chosenDealerId ? 'var(--t-secondary)' : 'var(--t-strong)' }}
              >
                {d.chosenDealerId ? `→ ${d.chosenDealerId.slice(0, 8)}…` : '⚠️ 派空（无匹配经销商）'}
                {d.createdAt ? ` · ${String(d.createdAt).slice(0, 10)}` : ''}
              </span>
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </div>
  );
}
