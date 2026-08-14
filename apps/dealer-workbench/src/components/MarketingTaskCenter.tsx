'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  Loader2,
  PenTool,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { growthGeo, growthCopy } from '../lib/api';

/**
 * 品牌运营任务中枢（P0 · 把散落的 GEO 缺口→生成→审核→发布串成待办看板）。
 * 解决："功能都在但串不起来，运营要自己记哪个缺口补了没"。
 * 全部连真数据：probe-batches(缺口) · copy(草稿/审核/发布) · experiments(闭环验证)。
 */

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—';

interface Batch {
  id: string;
  brandSlug: string;
  citedRate: number;
  totalProbes: number;
  status: string;
  createdAt: string;
}
interface Copy {
  id: string;
  channel: string;
  question: string | null;
  status: string;
  brandSlug: string | null;
  createdAt: string;
}
interface Experiment {
  id: string;
  question: string;
  status: string;
  lift: number | null;
}

export function MarketingTaskCenter({ brandSlug = 'rheem' }: { brandSlug?: string }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, c, e] = await Promise.all([
        growthGeo.probeBatches({ brandSlug }),
        growthCopy.list(),
        growthGeo.experiments({ brandSlug }),
      ]);
      setBatches((b?.items || b?.data?.items || []) as Batch[]);
      setCopies((c?.items || c || []) as Copy[]);
      setExperiments((e?.items || e || []) as Experiment[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载任务失败');
    } finally {
      setLoading(false);
    }
  }, [brandSlug]);
  useEffect(() => {
    load();
  }, [load]);

  // 待办聚合：低可见度批次=待补缺口；draft=待审核；published=已发布；verifying=实验中
  const tasks = useMemo(() => {
    const gaps = batches.filter((b) => b.status === 'succeeded' && b.citedRate < 50).length;
    const toReview = copies.filter((c) => c.status === 'draft').length;
    const published = copies.filter((c) => c.status === 'published').length;
    const verifying = experiments.filter(
      (e) => e.status === 'verifying' || e.status === 'content-linked'
    ).length;
    return { gaps, toReview, published, verifying };
  }, [batches, copies, experiments]);

  const draftList = copies.filter((c) => c.status === 'draft').slice(0, 8);

  return (
    <section className="card-elevated grid gap-4 p-4.5">
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">品牌运营 · 任务中枢</p>
          <h2 className="workbench-section-header__title">缺口 → 生成 → 审核 → 发布</h2>
          <p className="workbench-section-header__description">
            把 GEO 缺口、待审内容、发布与实验聚成一个待办看板。数据实时来自各模块，点标签跳转处理。
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

      {/* 四阶段待办流 */}
      <div className="grid grid-cols-4 gap-3">
        <FlowCard
          icon={Search}
          label="① 待补缺口"
          value={tasks.gaps}
          tone="danger"
          href="/growth/geo"
          hint="出现率<50%的探测"
        />
        <FlowCard
          icon={PenTool}
          label="② 待审内容"
          value={tasks.toReview}
          tone="warning"
          href="/growth/copywriter"
          hint="draft 状态文案"
        />
        <FlowCard
          icon={FlaskConical}
          label="③ 实验验证中"
          value={tasks.verifying}
          tone="brand"
          href="/growth/geo"
          hint="复投中/待复投"
        />
        <FlowCard
          icon={Send}
          label="④ 已发布"
          value={tasks.published}
          tone="success"
          href="/growth/wechat-drafts"
          hint="已上线内容"
        />
      </div>

      {/* 待审内容清单（最需要运营动作的） */}
      <div className="inset grid gap-2.5 p-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-primary" />
          <strong className="text-sm text-foreground">
            待我审核（{draftList.length}）
          </strong>
          <a href="/growth/copywriter" className="btn btn-outline btn-sm ml-auto">
            去审核
          </a>
        </div>
        {draftList.length ? (
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>内容</th>
                  <th>渠道</th>
                  <th>品牌</th>
                  <th>生成</th>
                </tr>
              </thead>
              <tbody>
                {draftList.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.question || c.channel}</td>
                    <td>
                      <span className="badge">{c.channel}</span>
                    </td>
                    <td>{c.brandSlug || '—'}</td>
                    <td>{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-success">
            <CheckCircle2 size={15} />
            暂无待审内容，审核队列已清空。
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
        <AlertCircle size={12} />
        闭环：GEO 探测发现缺口 → 生成内容(带策略) → 此处审核 → 发布 → 闭环实验验证 lift。
      </p>
    </section>
  );
}

/** tone 语义映射（原 CSS 变量动态色，2026-08 三期收编为类名） */
const FLOW_TONE: Record<string, { border: string; text: string }> = {
  danger: { border: 'border-t-destructive', text: 'text-destructive' },
  warning: { border: 'border-t-warning', text: 'text-warning' },
  brand: { border: 'border-t-primary', text: 'text-primary' },
  success: { border: 'border-t-success', text: 'text-success' },
};

function FlowCard({
  icon: Icon,
  label,
  value,
  tone,
  href,
  hint,
}: {
  icon: any;
  label: string;
  value: number;
  tone: 'danger' | 'warning' | 'brand' | 'success';
  href: string;
  hint: string;
}) {
  const t = FLOW_TONE[tone];
  return (
    <a href={href} className={`inset grid gap-1.5 border-t-[3px] p-3.5 no-underline ${t.border}`}>
      <div className="flex items-center justify-between">
        <span className="t-label text-muted-foreground">{label}</span>
        <Icon size={15} className={t.text} />
      </div>
      <div className={`text-[28px] font-extrabold tabular-nums ${t.text}`}>{value}</div>
      <span className="text-[11px] text-muted-foreground/80">{hint}</span>
    </a>
  );
}
