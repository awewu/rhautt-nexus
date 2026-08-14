'use client';

/**
 * 2026-08 全页 UX 重构二期 · WorkspaceKit 化
 *
 * 舆情雷达（真数据版，替换原硬编码假 SENTIMENT）。
 * 连 /api/v2/growth/opinion/mentions + /alerts，展示真实声量/情绪/风险。
 * 无数据时如实显示空态，不再编造"92% 正向"。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RadioTower, RefreshCw } from 'lucide-react';
import { WorkspaceSection } from '@/components/WorkspaceKit';
import { MiniStat } from '@/components/StatCard';
import { cn } from '@/lib/utils';
import { growthOpinion } from '../lib/api';

interface Mention {
  id: string;
  source: string;
  content: string;
  url: string | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: string | null;
  severity: string | null;
  entities: string[];
  capturedAt: string;
  createdAt: string;
}
interface Alert {
  id: string;
  severity?: string;
  status?: string;
  title?: string;
  content?: string;
  createdAt?: string;
}

/** 情绪视觉映射：Tailwind 语义 token（取代原 CSS 变量内联）。 */
const SENTIMENT_META: Record<string, { label: string; badge: string }> = {
  positive: { label: '正向', badge: 'border-success/40 bg-success/10 text-success' },
  neutral: { label: '中性', badge: 'border-border bg-secondary text-muted-foreground' },
  negative: { label: '负向', badge: 'border-destructive/40 bg-destructive/10 text-destructive' },
};
const SOURCE_LABEL: Record<string, string> = {
  zhihu: '知乎',
  xiaohongshu: '小红书',
  douyin: '抖音',
  weibo: '微博',
  wechat: '公众号',
  tieba: '贴吧',
  search: '搜索问答',
};
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—';

export function SentimentRadarPanel() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, a] = await Promise.all([growthOpinion.mentions(), growthOpinion.alerts()]);
      setMentions((m?.items || m || []) as Mention[]);
      setAlerts((a?.items || a || []) as Alert[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载舆情失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = mentions.length;
    const pos = mentions.filter((m) => m.sentiment === 'positive').length;
    const neg = mentions.filter((m) => m.sentiment === 'negative').length;
    const neu = total - pos - neg;
    const goodRate = total ? Math.round(((pos + neu) / total) * 100) : 0;
    return { total, pos, neg, neu, goodRate };
  }, [mentions]);

  return (
    <WorkspaceSection
      icon={<RadioTower size={16} />}
      title={
        <span className="block">
          <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">
            舆情雷达
          </span>
          公开渠道声量 · 情绪 · 风险
        </span>
      }
      aside={
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      }
    >
      <div className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          真实抓取的公开渠道提及，情绪与风险线索汇总。数据来自后端舆情库，无数据即显示空态。
        </p>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat
            label={
              <span className="inline-flex items-center gap-1">
                <RadioTower size={13} />
                总提及
              </span>
            }
            value={stats.total}
          />
          <MiniStat
            label="正向及中性"
            value={
              <span className={cn(stats.goodRate >= 80 && stats.total > 0 && 'text-success')}>
                {stats.total ? stats.goodRate + '%' : '—'}
              </span>
            }
          />
          <MiniStat
            label="负向声量"
            value={<span className={cn(stats.neg > 0 && 'text-destructive')}>{stats.neg}</span>}
          />
          <MiniStat
            label={
              <span className="inline-flex items-center gap-1">
                <AlertTriangle size={13} />
                风险告警
              </span>
            }
            value={
              <span className={cn(alerts.length > 0 && 'text-warning')}>{alerts.length}</span>
            }
          />
        </div>

        <div className="table-shell">
          <table className="table">
            <thead>
              <tr>
                <th>渠道</th>
                <th>内容</th>
                <th>意图</th>
                <th>情绪</th>
                <th>级别</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {mentions.map((m) => {
                const sm = SENTIMENT_META[m.sentiment] || SENTIMENT_META.neutral;
                return (
                  <tr key={m.id}>
                    <td className="font-bold">{SOURCE_LABEL[m.source] || m.source}</td>
                    <td className="max-w-80">{m.content}</td>
                    <td>{m.intent || '-'}</td>
                    <td>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                          sm.badge
                        )}
                      >
                        {sm.label}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
                        {m.severity || '-'}
                      </span>
                    </td>
                    <td className="tabular-nums">{fmtDate(m.capturedAt || m.createdAt)}</td>
                  </tr>
                );
              })}
              {!mentions.length ? (
                <tr>
                  <td colSpan={6} className="py-7 text-center text-muted-foreground">
                    {loading ? '加载中…' : '暂无舆情记录（后端舆情库为空，接入采集源后自动填充）'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </WorkspaceSection>
  );
}
