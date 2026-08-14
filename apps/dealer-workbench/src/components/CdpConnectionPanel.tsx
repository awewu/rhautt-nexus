'use client';

/**
 * CDP 数据连接面板（只读）。
 * CDP 在本平台只是【数据连接层】：从 diagnosis.completed / crm.deal.signed 事件自动摄取
 * 终端用户画像（脱敏，不出明文 PII），供分群 → GEO/战役。终端用户管理属瑞诺瓦问诊域，
 * 此处不建管理界面——只让运营看见"连接层里到底有什么"，此前这层是黑盒。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Database } from 'lucide-react';
import { AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
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
    <div className="card" style={{ padding: 20, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Database size={16} />
        <span className="t-lg" style={{ fontWeight: 600 }}>
          CDP 数据连接 · 画像与分群（只读）
        </span>
      </div>
      <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginBottom: 12 }}>
        由 diagnosis.completed / crm.deal.signed 事件自动摄取的脱敏画像（不出明文
        PII）；分群供 GEO 选题与战役圈人。此处只读——终端用户管理属瑞诺瓦问诊域。
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          className={`btn btn-sm ${segment === '' ? 'btn-brand' : 'btn-outline'}`}
          onClick={() => setSegment('')}
        >
          全部
        </button>
        {segRows.map((s: any) => (
          <button
            key={s.id || s.code}
            className={`btn btn-sm ${segment === s.code ? 'btn-brand' : 'btn-outline'}`}
            onClick={() => setSegment(s.code)}
          >
            {s.name || s.code}
          </button>
        ))}
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
        <div style={{ display: 'grid', gap: 4 }}>
          {profRows.map((p: any) => (
            <div
              key={p.id}
              className="t-sm"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span>
                <span style={{ color: 'var(--t-strong)' }}>{p.source || '未知来源'}</span>
                <span className="t-xs" style={{ color: 'var(--t-tertiary)', marginLeft: 8 }}>
                  {(p.segmentCodes || []).join(' · ') || '未分群'}
                </span>
              </span>
              <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>
                同意状态 {p.consentStatus || '-'} ·{' '}
                {p.updatedAt ? String(p.updatedAt).slice(0, 10) : ''}
              </span>
            </div>
          ))}
        </div>
        <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 8 }}>
          共 {profiles.data?.total ?? profRows.length} 条（最多显示 50）
        </div>
      </AsyncBoundary>
    </div>
  );
}
