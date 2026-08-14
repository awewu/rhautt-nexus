'use client';

/**
 * GTM AI 驾驶舱（Phase 2 重塑：shadcn 组件层 + 统一 Stat 词汇 + 等宽数字）。
 * 数据逻辑与既有口径完全不动——只换视觉层；空态/错误态仍由 AsyncBoundary 诚实呈现。
 */

import useSWR from 'swr';
import { Filter, Gauge, Route, Search, ShieldCheck, Sparkles, TrendingUp, Users } from 'lucide-react';
import { PageHeader, AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
import { cockpit } from '../../lib/api';
import { EventDeadLetterPanel } from '../../components/EventDeadLetterPanel';
import { StatCard, MiniStat, SectionCardHeader } from '../../components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ChannelSlice = { channel: string; label: string; count: number };
type NorthStar = {
  period: string;
  highIntentLeads: number;
  geoReach: number;
  geoAttributedLeads: number;
  geoAttributionRate: number | null;
  geoAttributedChannels: string[];
  channelBreakdown: ChannelSlice[];
  attributedLeads: number;
  activeProfitableDealers: number;
  networkGmv: number;
  dealers: number;
};
type DealerRow = {
  dealerId: string;
  active: boolean;
  gmv: number;
  profit: number;
  profitSource: string;
  closeRate: number;
  deals: number;
};
type BrandHealth = {
  period: string;
  aiVisibility: number;
  citedRate: number;
  sov: number;
  positiveSentiment: number;
  probes: number;
  note?: string;
};
type FunnelStage = { stage: string; label: string; count: number };
type AarrrFunnel = { period: string; stages: FunnelStage[] };
type GeoLoop = {
  probes: number;
  cited: number;
  gaps: number;
  citedRate: number;
  content: { drafts: number; approved: number; published: number; total: number };
};
type LeadRouting = {
  total: number;
  routed: number;
  unrouted: number;
  routingRate: number;
  unroutedSamples: {
    province: string | null;
    city: string | null;
    category: string | null;
    reason: string;
  }[];
};

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

const yuan = (n: number) => `¥${(n || 0).toLocaleString('zh-CN')}`;

export default function CockpitPage() {
  const ns = useSWR<NorthStar>('cockpit:north-star', () => cockpit.northStar());
  const ds = useSWR<DealerRow[]>('cockpit:dealer-success', () => cockpit.dealerSuccess());
  const bh = useSWR<BrandHealth>('cockpit:brand-health', () => cockpit.brandHealth());
  const fn = useSWR<AarrrFunnel>('cockpit:aarrr', () => cockpit.aarrrFunnel());
  const gl = useSWR<GeoLoop>('cockpit:geo-loop', () => cockpit.geoLoop());
  const lr = useSWR<LeadRouting>('cockpit:lead-routing', () => cockpit.leadRouting());
  const gmvTrend = useSWR<{ metricKey: string; series: { date: string; value: number }[] }>(
    'cockpit:trend:gmv',
    () => cockpit.trends('network_gmv', 30)
  );

  return (
    <>
      <PageHeader
        title="GTM AI驾驶舱"
        subtitle="北极星（当期）= GEO→高意向线索数 · 副指标 = 活跃盈利经销商/网络 GMV · 品牌健康度为 A 引擎领先指标"
      />

      {/* 北极星 KPI */}
      <AsyncBoundary
        status={statusOf(ns.isLoading, ns.error, false)}
        errorMessage="北极星加载失败"
        onRetry={() => ns.mutate()}
      >
        {/* 主指标：GEO→高意向线索数（宪章锁定的当期北极星，真实按渠道归因） */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <StatCard
            emphasis
            icon={<Sparkles size={15} />}
            label="GEO 高意向线索 · 北极星"
            value={ns.data?.geoAttributedLeads ?? 0}
            hint={
              ns.data?.geoAttributionRate == null
                ? `周期 ${ns.data?.period ?? '-'} · GEO 渠道线索计数`
                : `占高意向线索 ${ns.data.geoAttributionRate}% · GEO 渠道：${(ns.data?.geoAttributedChannels ?? []).join('/')}`
            }
          />
          <StatCard
            icon={<Users size={15} />}
            label="高意向线索总数"
            value={ns.data?.highIntentLeads ?? 0}
            hint={`已归因 ${ns.data?.attributedLeads ?? 0} · 漏斗 lead 真实计数`}
          />
          <StatCard
            icon={<Route size={15} />}
            label="GEO 触达数 · 领先"
            value={ns.data?.geoReach ?? 0}
            hint="AI 回答被引触达（漏斗 reach）"
          />
        </div>

        {/* 高意向线索获客渠道拆分（口径透明：GEO 集 = geo/ai-diagnosis） */}
        {(ns.data?.channelBreakdown?.length ?? 0) > 0 && (
          <Card className="mb-4">
            <CardContent className="flex flex-wrap items-center gap-2 px-5 py-3">
              <span className="text-xs whitespace-nowrap text-muted-foreground">线索获客渠道</span>
              {ns.data!.channelBreakdown.map((c) => {
                const isGeo = (ns.data?.geoAttributedChannels ?? []).includes(c.channel);
                return (
                  <Badge key={c.channel} variant={isGeo ? 'default' : 'secondary'} className="tabular-nums">
                    {c.label} {c.count}
                    {isGeo ? ' · GEO' : ''}
                  </Badge>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* 副指标：经销商侧 + 领先指标 */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatCard
            icon={<Users size={15} />}
            label="活跃盈利经销商 · 副"
            value={ns.data?.activeProfitableDealers ?? 0}
            hint={`共 ${ns.data?.dealers ?? 0} 家在册`}
          />
          <StatCard
            icon={<TrendingUp size={15} />}
            label="网络月度 GMV · 副"
            value={yuan(ns.data?.networkGmv ?? 0)}
            hint={`周期 ${ns.data?.period ?? '-'}`}
          />
          <StatCard
            icon={<Gauge size={15} />}
            label="AI 被引率 · 领先指标"
            value={`${bh.data?.citedRate ?? 0}%`}
            hint={`SoV ${bh.data?.sov ?? 0}% · 正声量 ${bh.data?.positiveSentiment ?? 0}% · ${bh.data?.probes ?? 0} 探测`}
          />
        </div>
      </AsyncBoundary>

      {/* 北极星趋势（日快照） */}
      {(gmvTrend.data?.series?.length ?? 0) > 1 && (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-4 px-5 py-3">
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              网络 GMV · 近 {gmvTrend.data!.series.length} 日
            </span>
            <Sparkline points={gmvTrend.data!.series.map((s) => s.value)} />
            <span className="font-bold whitespace-nowrap tabular-nums">
              {yuan(gmvTrend.data!.series[gmvTrend.data!.series.length - 1]?.value ?? 0)}
            </span>
          </CardContent>
        </Card>
      )}

      {/* AARRR 增长漏斗 */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <SectionCardHeader
            icon={<Filter size={16} />}
            title="AARRR 增长漏斗"
            aside={`周期 ${fn.data?.period ?? '-'}`}
          />
          <AsyncBoundary
            status={statusOf(
              fn.isLoading,
              fn.error,
              (fn.data?.stages?.reduce((s, x) => s + x.count, 0) ?? 0) === 0
            )}
            errorMessage="漏斗数据加载失败"
            onRetry={() => fn.mutate()}
            emptyTitle="暂无漏斗数据"
            emptyDescription="线索(lead.created)/方案(opportunity.signed)/签约(crm.deal.signed)/转介绍事件将自动归集。"
          >
            <FunnelBars stages={fn.data?.stages ?? []} />
          </AsyncBoundary>
        </CardContent>
      </Card>

      {/* GEO 内容闭环（A 造需求） */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <SectionCardHeader
            icon={<Search size={16} />}
            title="GEO 内容闭环"
            aside="缺口 → 生成 → 审核 → 发布 → 复测"
          />
          <AsyncBoundary
            status={statusOf(gl.isLoading, gl.error, false)}
            errorMessage="GEO 闭环数据加载失败"
            onRetry={() => gl.mutate()}
          >
            <div className="grid grid-cols-5 gap-3">
              <MiniStat
                label="被引率"
                value={`${gl.data?.citedRate ?? 0}%`}
                hint={`${gl.data?.cited ?? 0}/${gl.data?.probes ?? 0} 探测`}
              />
              <MiniStat label="可见度缺口" value={gl.data?.gaps ?? 0} hint="未被引问题" accent />
              <MiniStat label="内容草稿" value={gl.data?.content?.drafts ?? 0} hint="待审核" />
              <MiniStat label="已审核" value={gl.data?.content?.approved ?? 0} hint="待发布" />
              <MiniStat label="已发布" value={gl.data?.content?.published ?? 0} hint="喂 AI 复测" />
            </div>
          </AsyncBoundary>
        </CardContent>
      </Card>

      {/* 线索分配（B 转化 · 派单引擎） */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <SectionCardHeader
            icon={<Route size={16} />}
            title="线索分配"
            aside="地域 + 品类 + 合同等级 − 负载 打分派单"
          />
          <AsyncBoundary
            status={statusOf(lr.isLoading, lr.error, false)}
            errorMessage="线索分配数据加载失败"
            onRetry={() => lr.mutate()}
          >
            <div className="grid grid-cols-3 gap-3">
              <MiniStat
                label="分配成功率"
                value={`${lr.data?.routingRate ?? 0}%`}
                hint={`${lr.data?.routed ?? 0}/${lr.data?.total ?? 0} 已派`}
              />
              <MiniStat label="已分配" value={lr.data?.routed ?? 0} hint="命中经销商" />
              <MiniStat
                label="未能分配"
                value={lr.data?.unrouted ?? 0}
                hint="无经销商可服务"
                accent
              />
            </div>
            {(lr.data?.unroutedSamples?.length ?? 0) > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs text-muted-foreground">
                  未覆盖地域/品类（拓商信号）
                </div>
                {(lr.data?.unroutedSamples ?? []).map((s, i) => (
                  <div key={i} className="border-b py-1 text-xs text-muted-foreground">
                    {[s.province, s.city, s.category].filter(Boolean).join(' · ') || '—'}
                    <span className="ml-2 opacity-70">{s.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>

      {/* 经销商成功度明细 */}
      <Card>
        <CardContent className="p-5">
          <SectionCardHeader icon={<ShieldCheck size={16} />} title="经销商成功度" />
          <AsyncBoundary
            status={statusOf(ds.isLoading, ds.error, (ds.data?.length ?? 0) === 0)}
            errorMessage="经销商数据加载失败"
            onRetry={() => ds.mutate()}
            emptyTitle="暂无经销商成交数据"
            emptyDescription="成交(crm.deal.signed)后自动归集；也可在测试环境触发重算。"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>经销商</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">GMV</TableHead>
                  <TableHead className="text-right">利润(口径)</TableHead>
                  <TableHead className="text-right">成交率</TableHead>
                  <TableHead className="text-right">单数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ds.data ?? []).map((r) => (
                  <TableRow key={r.dealerId}>
                    <TableCell className="font-mono text-xs">{r.dealerId}</TableCell>
                    <TableCell>
                      <Badge variant={r.active ? 'default' : 'secondary'}>
                        {r.active ? '活跃' : '沉默'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{yuan(r.gmv)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {yuan(r.profit)}{' '}
                      <span className="text-xs text-muted-foreground">
                        {r.profitSource === 'actual' ? '实核' : '估算'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(r.closeRate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.deals}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AsyncBoundary>
        </CardContent>
      </Card>

      <EventDeadLetterPanel />
    </>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 240,
    h = 32,
    pad = 2;
  const max = Math.max(...points, 1),
    min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const path = points
    .map(
      (v, i) =>
        `${(pad + i * step).toFixed(1)},${(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1)}`
    )
    .join(' ');
  return (
    <svg width={w} height={h} className="flex-1 overflow-visible" aria-hidden>
      <polyline
        points={path}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv = prev && prev > 0 ? `${Math.round((s.count / prev) * 100)}%` : null;
        return (
          <div key={s.stage} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[13px] text-muted-foreground">{s.label}</span>
            <div className="h-[22px] flex-1 overflow-hidden rounded bg-secondary">
              <div
                className="h-full rounded bg-primary transition-[width] duration-300"
                style={{ width: `${Math.round((s.count / max) * 100)}%`, minWidth: s.count > 0 ? 2 : 0 }}
              />
            </div>
            <span className="w-12 text-right font-semibold tabular-nums">{s.count}</span>
            <span className="w-[52px] text-right text-xs tabular-nums text-muted-foreground">
              {conv ?? '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
