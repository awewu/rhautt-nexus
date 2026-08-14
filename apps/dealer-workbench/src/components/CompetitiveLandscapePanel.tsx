'use client';

/** 2026-08 全页 UX 重构二期 · WorkspaceKit 化 */

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Crosshair, Loader2, PieChart, RefreshCw } from 'lucide-react';
import { WorkspaceSection, EmptyState } from '@/components/WorkspaceKit';
import { insight } from '../lib/api';

/**
 * 竞争格局面板：把「份额一张条形图」升级为**格局形态 + 趋势 + 威胁排序**。
 * 数据源只有 GEO 探测自动入账的 ai_sov 时序（手工台账无时间序列，做不出动量）。
 *
 * 诚实呈现（守基座4）：
 *  - basis='none' 时如实显示"无数据"与原因，不画空图假装有格局。
 *  - 样本不足的动量显示"样本不足"而非百分点数字。
 *  - universeIncludesSelf=false 时**必须警示**份额只是"竞品之间的份额"，不可当全量读。
 */

interface SovRow {
  competitor: string;
  isSelf: boolean;
  value: number;
  share: number;
}
interface MomentumRow {
  competitor: string;
  currentHits: number;
  previousHits: number;
  shareDeltaPp: number | null;
  verdict: 'rising' | 'falling' | 'flat' | 'insufficient-data';
  reason: string;
}
interface ThreatRow {
  competitor: string;
  score: number;
  factors: { share: number; momentum: number; leader: number };
  reason: string;
}
interface Landscape {
  category: string;
  windowDays: number;
  basis: 'geo-probe' | 'none';
  universeIncludesSelf: boolean;
  note?: string;
  concentration: { hhi: number; band: string; players: number; effectivePlayers: number } | null;
  shareOfVoice: SovRow[];
  momentum: MomentumRow[];
  threats: ThreatRow[];
  leaderGap: {
    leader: string | null;
    leaderShare: number;
    selfShare: number | null;
    gapPp: number | null;
    selfIsLeader: boolean;
  } | null;
}

const BAND_META: Record<string, { label: string; tone: string; hint: string }> = {
  'highly-concentrated': {
    label: '高集中',
    tone: 'text-destructive',
    hint: '寡头格局：头部话语权强，打法应聚焦细分场景侧翼切入',
  },
  'moderately-concentrated': {
    label: '中度集中',
    tone: 'text-warning',
    hint: '格局未定：份额仍可争夺，先占高价值场景',
  },
  unconcentrated: {
    label: '分散',
    tone: 'text-success',
    hint: '分散格局：谁先系统化占位谁受益',
  },
};

const VERDICT_META: Record<string, { label: string; tone: string }> = {
  rising: { label: '上升', tone: 'text-destructive' },
  falling: { label: '下降', tone: 'text-success' },
  flat: { label: '持平', tone: 'text-muted-foreground' },
  'insufficient-data': { label: '样本不足', tone: 'text-muted-foreground' },
};

export function CompetitiveLandscapePanel({
  category,
  windowDays = 30,
}: {
  category: string;
  windowDays?: number;
}) {
  const [data, setData] = useState<Landscape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await insight.landscape(category, windowDays);
      setData((r?.data ?? r) as Landscape);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [category, windowDays]);
  useEffect(() => {
    load();
  }, [load]);

  const momentumOf = (competitor: string) =>
    data?.momentum.find((m) => m.competitor === competitor);
  const band = data?.concentration ? BAND_META[data.concentration.band] : null;

  return (
    <WorkspaceSection
      icon={<PieChart size={16} className="text-primary" />}
      title="集中度 · 动量 · 头部差距 · 威胁排序"
      aside={
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      }
    >
      <div className="grid gap-4">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground">
            竞品情报 · 竞争格局
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            份额 30% 是在涨还是在跌、品类是寡头还是分散，决定完全不同的打法。数据源：GEO
            探测自动入账的 AI 声量时序。
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
            {error}
          </div>
        ) : null}

        {/* 无数据：如实说明原因，不画空图 */}
        {data && data.basis === 'none' ? (
          <EmptyState title="该品类暂无 AI 声量时序数据" hint={data.note} />
        ) : null}

        {data && data.basis === 'geo-probe' ? (
          <>
            {/* 口径警示：我方不在样本内时，份额不可当全量份额读 */}
            {!data.universeIncludesSelf ? (
              <div className="flex items-center gap-2 rounded-lg border-l-[3px] border-warning bg-secondary/60 px-3.5 py-2.5">
                <AlertTriangle size={14} className="shrink-0 text-warning" />
                <span className="text-xs text-muted-foreground">
                  本窗口内我方未被 AI 引用，下列份额是<strong>竞品之间的份额</strong>
                  ，不可当作全量份额；「与头部差距」因此无法计算。
                </span>
              </div>
            ) : null}

            {/* ① 格局形态 + 头部差距 */}
            <div className="grid gap-2.5 md:grid-cols-2">
              <div className="grid gap-1 rounded-lg border bg-secondary/60 p-3.5">
                <div className="flex items-center gap-1.5">
                  <PieChart size={14} className="text-primary" />
                  <span className="text-xs text-muted-foreground">集中度 HHI</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <strong className="text-[22px] font-bold tabular-nums">
                    {data.concentration?.hhi}
                  </strong>
                  {band ? (
                    <span
                      className={`rounded-full border border-current px-2 text-[10px] leading-4 ${band.tone}`}
                    >
                      {band.label}
                    </span>
                  ) : null}
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  有效竞争者 {data.concentration?.effectivePlayers} 家（共{' '}
                  {data.concentration?.players} 家在榜）
                </span>
                {band ? (
                  <span className="text-[11px] text-muted-foreground">{band.hint}</span>
                ) : null}
              </div>

              <div className="grid gap-1 rounded-lg border bg-secondary/60 p-3.5">
                <div className="flex items-center gap-1.5">
                  <Crosshair size={14} className="text-primary" />
                  <span className="text-xs text-muted-foreground">与头部差距</span>
                </div>
                {data.leaderGap?.gapPp === null || data.leaderGap === null ? (
                  <>
                    <strong className="text-[15px] text-muted-foreground">无我方口径</strong>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      当前头部：{data.leaderGap?.leader ?? '-'}（
                      {((data.leaderGap?.leaderShare ?? 0) * 100).toFixed(1)}%）
                    </span>
                  </>
                ) : data.leaderGap.selfIsLeader ? (
                  <>
                    <strong className="text-[22px] font-bold text-success">我方领先</strong>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      我方份额 {((data.leaderGap.selfShare ?? 0) * 100).toFixed(1)}%
                    </span>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <strong className="text-[22px] font-bold text-warning tabular-nums">
                        {data.leaderGap.gapPp}
                      </strong>
                      <span className="text-xs text-muted-foreground">pp 落后</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      头部 {data.leaderGap.leader}（
                      {(data.leaderGap.leaderShare * 100).toFixed(1)}%） vs 我方{' '}
                      {((data.leaderGap.selfShare ?? 0) * 100).toFixed(1)}%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* ② 份额 + 动量（同一行看存量与趋势） */}
            <div className="grid gap-2.5 rounded-lg border bg-secondary/60 p-4">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-primary" />
                <strong className="text-sm font-semibold">AI 声量份额与动量</strong>
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  近 {data.windowDays} 天 vs 前 {data.windowDays} 天
                </span>
              </div>
              <div className="grid gap-2.5">
                {data.shareOfVoice.map((s) => {
                  const m = momentumOf(s.competitor);
                  const vm = m ? VERDICT_META[m.verdict] : null;
                  return (
                    <div key={s.competitor}>
                      <div className="flex items-baseline gap-2 text-[13px]">
                        <span className={s.isSelf ? 'font-bold text-primary' : 'font-medium'}>
                          {s.competitor}
                          {s.isSelf ? '（我方）' : ''}
                        </span>
                        {vm ? (
                          <span
                            className={`text-[11px] tabular-nums ${vm.tone}`}
                            title={m!.reason}
                          >
                            {vm.label}
                            {m!.shareDeltaPp !== null
                              ? ` ${m!.shareDeltaPp > 0 ? '+' : ''}${m!.shareDeltaPp}pp`
                              : ''}
                          </span>
                        ) : null}
                        <span className="ml-auto text-muted-foreground tabular-nums">
                          {(s.share * 100).toFixed(1)}%
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {s.value} 次
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
                        <div
                          className={`h-full ${s.isSelf ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                          /* 动态份额条宽度：内联样式的合法例外（数据驱动百分比） */
                          style={{ width: `${s.share * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ③ 威胁排序：可解释因子全展开，防黑箱 */}
            <div className="grid gap-2.5 rounded-lg border bg-secondary/60 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-primary" />
                <strong className="text-sm font-semibold">威胁排序</strong>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  份额存量(≤60) + 动量增量(≤30) + 头部加成(10)
                </span>
              </div>
              <div className="grid gap-2">
                {data.threats.map((t) => (
                  <div
                    key={t.competitor}
                    className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"
                  >
                    <strong className="min-w-[90px] text-[13px] font-bold">{t.competitor}</strong>
                    <span className="text-[11px] text-muted-foreground">{t.reason}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                      {t.factors.share}+{t.factors.momentum}+{t.factors.leader}
                    </span>
                    <strong
                      className={`text-lg font-bold tabular-nums ${
                        t.score >= 50 ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {t.score}
                    </strong>
                  </div>
                ))}
                {!data.threats.length ? (
                  <p className="text-[13px] text-muted-foreground">窗口内无竞品被引</p>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                威胁评分是<strong>可解释启发式</strong>而非统计模型；因子已全量展开供复核。
                「只大不涨」的老牌靠存量分、「小而猛涨」的新秀靠动量分，两类都不会被漏看。
              </p>
            </div>
          </>
        ) : null}

        {loading && !data ? (
          <p className="text-[13px] text-muted-foreground">加载中…</p>
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
