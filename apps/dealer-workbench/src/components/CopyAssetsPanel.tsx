'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, PenTool, RefreshCw } from 'lucide-react';
import { growthCopy } from '../lib/api';

/**
 * 文案 Copilot 资产列表（真数据版，替换原硬编码假 COPY_TASKS）。
 * 连 /api/v2/growth/copy，展示真实生成的文案草稿/审核状态/所用 GEO 策略。
 */

interface CopyAsset {
  id: string;
  channel: string;
  source: string;
  brandSlug: string | null;
  question: string | null;
  draft: string | null;
  status: string;
  model: string | null;
  strategyKeys: string[];
  createdAt: string;
}

/** tone 语义映射（原 CSS 变量动态色，2026-08 三期收编为类名） */
const STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: '待审核', tone: 'text-warning border-warning/50' },
  approved: { label: '已核准', tone: 'text-success border-success/50' },
  published: { label: '已发布', tone: 'text-primary border-primary/50' },
  rejected: { label: '已驳回', tone: 'text-destructive border-destructive/50' },
};
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—';

export function CopyAssetsPanel() {
  const [items, setItems] = useState<CopyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await growthCopy.list();
      setItems((r?.items || r || []) as CopyAsset[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载文案失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="card-elevated grid gap-4 p-4.5">
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">文案 Copilot</p>
          <h2 className="workbench-section-header__title">已生成文案资产</h2>
          <p className="workbench-section-header__description">
            真实生成的官网/投放/私域文案草稿，含审核状态与所用 GEO 策略。可进入审核流转。
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>

      {error ? (
        <div className="inset text-[13px] text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2.5">
        {items.map((c) => {
          const sm = STATUS_META[c.status] || { label: c.status, tone: 'text-muted-foreground' };
          return (
            <article key={c.id} className="inset grid gap-2 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <strong className="text-sm text-foreground">{c.question || c.channel}</strong>
                <span className={`badge whitespace-nowrap ${sm.tone}`}>{sm.label}</span>
              </div>
              {c.draft ? (
                <p className="max-h-[60px] overflow-hidden text-[13px] leading-relaxed text-muted-foreground">
                  {c.draft.slice(0, 160)}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="badge">{c.channel}</span>
                {c.brandSlug ? <span className="badge">{c.brandSlug}</span> : null}
                {(c.strategyKeys || []).map((k) => (
                  <span key={k} className="badge text-[11px] text-primary">
                    {k}
                  </span>
                ))}
                <span className="ml-auto text-xs text-muted-foreground/80">
                  {c.model || ''} · {fmtDate(c.createdAt)}
                </span>
              </div>
            </article>
          );
        })}
        {!items.length ? (
          <div className="inset p-7 text-center text-muted-foreground/80">
            <PenTool size={24} className="mb-2" />
            <p className="text-[13px]">
              {loading ? '加载中…' : '暂无文案资产。在 GEO 面板对缺口问题"生成建议"即可产出文案。'}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
