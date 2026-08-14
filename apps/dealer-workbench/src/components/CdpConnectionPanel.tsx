'use client';

/**
 * 2026-08 全页 UX 重构二期 · WorkspaceKit 化
 *
 * CDP 数据连接面板（只读）。
 * CDP 在本平台只是【数据连接层】：从 diagnosis.completed / crm.deal.signed 事件自动摄取
 * 终端用户画像（脱敏，不出明文 PII），供分群 → GEO/战役。终端用户管理属瑞诺瓦问诊域，
 * 此处不建管理界面——只让运营看见"连接层里到底有什么"，此前这层是黑盒。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Database } from 'lucide-react';
import { AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
import { WorkspaceSection, FilterChips } from '@/components/WorkspaceKit';
import { cdp } from '../lib/api';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

export function CdpConnectionPanel() {
  const [segment, setSegment] = useState('');
  const segments = useSWR('cdp:segments', () => cdp.listSegments());
  const profiles = useSWR(['cdp:profiles', segment], () =>
    cdp.listProfiles({ segment: segment || undefined, limit: 50 })
  );

  const segRows: any[] = segments.data?.segments || [];
  const profRows: any[] = profiles.data?.profiles || [];

  return (
    <WorkspaceSection
      icon={<Database size={16} />}
      title="CDP 数据连接 · 画像与分群（只读）"
      className="mt-5"
    >
      <p className="mb-3 text-xs text-muted-foreground">
        由 diagnosis.completed / crm.deal.signed 事件自动摄取的脱敏画像（不出明文
        PII）；分群供 GEO 选题与战役圈人。此处只读——终端用户管理属瑞诺瓦问诊域。
      </p>

      <div className="mb-3">
        <FilterChips
          options={[
            { value: '', label: '全部' },
            ...segRows.map((s: any) => ({
              value: String(s.code),
              label: s.name || s.code,
            })),
          ]}
          value={segment}
          onChange={setSegment}
        />
      </div>

      <AsyncBoundary
        status={statusOf(
          profiles.isLoading || segments.isLoading,
          profiles.error || segments.error,
          profRows.length === 0
        )}
        errorMessage="CDP 数据加载失败（需 API + 数据库）"
        onRetry={() => {
          profiles.mutate();
          segments.mutate();
        }}
        emptyTitle="连接层暂无画像"
        emptyDescription="画像由问诊完成/成交事件自动摄取——没有真实事件就没有画像，不造样本数据。"
      >
        <div className="grid gap-1">
          {profRows.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 border-t py-1.5 text-xs first:border-t-0"
            >
              <span className="min-w-0">
                <span className="font-medium">{p.source || '未知来源'}</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  {(p.segmentCodes || []).join(' · ') || '未分群'}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                同意状态 {p.consentStatus || '-'} ·{' '}
                {p.updatedAt ? String(p.updatedAt).slice(0, 10) : ''}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground tabular-nums">
          共 {profiles.data?.total ?? profRows.length} 条（最多显示 50）
        </div>
      </AsyncBoundary>
    </WorkspaceSection>
  );
}
