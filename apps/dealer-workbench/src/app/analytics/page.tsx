'use client';

/**
 * 经营分析（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排：KPI 5 连 StatCard 置顶；主区 lg:grid-cols-3（GMV 趋势占 2/3 + 漏斗 1/3），
 * 渠道/城市/产品结构三卡并列；季节曲线全宽收尾。删除渐变装饰背景，内联样式仅留图表动态高宽/色。
 */
import { useEffect, useState } from 'react';
import {
  GMV_TREND,
  FUNNEL,
  CHANNELS,
  CITIES,
  PRODUCT_MIX,
  SEASON,
  analyticsSummary,
  loadLiveAnalytics,
  type MonthPoint,
  type FunnelStep,
} from '../../lib/analytics-data';
import { PageHeader } from '@rhautt/ui';
import { BarChart3, CalendarRange, Filter } from 'lucide-react';
import { WorkspaceSection, EmptyState } from '@/components/WorkspaceKit';
import { StatCard } from '@/components/StatCard';

const fmt = (v: number) => `${(v / 10000).toFixed(0)}万`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

type Slice = { label: string; value: number; color: string };

function Bars({ data, color }: { data: Slice[]; color?: boolean }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="grid gap-2">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span>{d.label}</span>
            <span className="font-semibold text-muted-foreground tabular-nums">{d.value}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              /* 动态宽度/数据驱动配色：内联样式合法场景 */
              style={{
                width: `${(d.value / max) * 100}%`,
                ...(color ? { background: d.color } : {}),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  // 诚实原则：不以假种子作为展示值。初始为空 + 加载态；真数据(CRM pipeline)到位才显示；
  // CRM 无商机则显示空态，不回落假数据误导经营判断。
  const [gmvTrend, setGmvTrend] = useState<MonthPoint[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [cities, setCities] = useState<Slice[]>([]);
  const [s, setS] = useState<ReturnType<typeof analyticsSummary> | null>(null);
  const [state, setState] = useState<'loading' | 'live' | 'empty'>('loading');

  useEffect(() => {
    loadLiveAnalytics()
      .then((live) => {
        if (!live) {
          setState('empty');
          return;
        }
        setGmvTrend(live.gmvTrend);
        setFunnel(live.funnel);
        setCities(live.cities);
        setS(live.summary);
        setState('live');
      })
      .catch(() => setState('empty'));
  }, []);

  const maxGmv = Math.max(1, ...gmvTrend.map((m) => Math.max(m.gmv, m.target)));
  const maxSeason = Math.max(...SEASON.map((m) => m.demand));

  return (
    <div className="page-container">
      <PageHeader title="经营分析" subtitle="业务数据总览与趋势分析（来自 CRM 商机管道）" />

      {state === 'loading' ? (
        <EmptyState icon={<BarChart3 size={28} />} title="正在加载真实经营数据…" />
      ) : null}
      {state === 'empty' ? (
        <EmptyState
          icon={<BarChart3 size={28} />}
          title="暂无经营数据：CRM 商机管道为空或未登录。"
          hint="录入商机后，此处展示真实 GMV / 漏斗 / 城市分布。"
        />
      ) : null}

      {/* KPI 行（真数据） */}
      {state === 'live' && s ? (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatCard label="年度 GMV" value={fmt(s.ytdGmv)} hint={`目标 ${fmt(s.ytdTarget)}`} emphasis />
          <StatCard label="目标完成率" value={pct(s.completion)} hint="累计达成" />
          <StatCard label="成交订单" value={String(s.ytdOrders)} hint="年度累计" />
          <StatCard label="客单价" value={fmt(s.avgOrder)} hint="平均合同额" />
          <StatCard label="问诊→签约" value={pct(s.signRate)} hint="全链路转化" />
        </div>
      ) : null}

      {state === 'live' ? (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {/* GMV 趋势 */}
          <WorkspaceSection
            icon={<BarChart3 size={16} />}
            title="月度 GMV 趋势（实际 vs 目标）"
            className="lg:col-span-2"
          >
            <div className="flex h-40 items-end gap-3">
              {gmvTrend.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center">
                  <div className="mb-1 text-[10px] text-muted-foreground tabular-nums">
                    {fmt(m.gmv)}
                  </div>
                  <div className="flex h-[110px] w-full items-end justify-center gap-[3px]">
                    <div
                      className="w-3.5 rounded-t-[3px]"
                      /* 图表动态高度/达标配色：内联样式合法场景 */
                      style={{
                        background: m.gmv >= m.target ? 'var(--success)' : 'var(--brand)',
                        height: `${(m.gmv / maxGmv) * 100}%`,
                      }}
                    />
                    <div
                      className="w-3.5 rounded-t-[3px] bg-muted-foreground/30"
                      style={{ height: `${(m.target / maxGmv) * 100}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[11px]">{m.month}</div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex gap-4 text-[11px] text-muted-foreground">
              <span>● 实际 GMV</span>
              <span className="text-muted-foreground/70">● 月度目标</span>
            </div>
          </WorkspaceSection>

          {/* 转化漏斗 */}
          <WorkspaceSection icon={<Filter size={16} />} title="销售转化漏斗">
            <div className="grid gap-1.5">
              {funnel.map((f, i) => (
                <div key={f.stage}>
                  <div className="mb-0.5 flex items-center justify-between text-[11px]">
                    <span>{f.stage}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {f.count} · {pct(f.rate)}
                    </span>
                  </div>
                  <div className="h-[18px] overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded"
                      /* 阶段渐进配色 + 动态宽度：内联样式合法场景 */
                      style={{
                        width: `${f.rate * 100}%`,
                        background: `hsl(${110 - i * 4}, ${46 - i * 3}%, ${40 + i * 5}%)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </WorkspaceSection>

          {/* 渠道来源（后端暂无此维度，标示例） */}
          <WorkspaceSection title="客户来源渠道（示例）">
            <Bars data={CHANNELS} color />
          </WorkspaceSection>
          {/* 城市分布（真数据） */}
          <WorkspaceSection title="城市订单分布">
            <Bars data={cities} color />
          </WorkspaceSection>
          {/* 产品结构（后端暂无此维度，标示例） */}
          <WorkspaceSection title="产品组合结构（示例）">
            <Bars data={PRODUCT_MIX} color />
          </WorkspaceSection>

          {/* 季节需求曲线（行业经验示例，非本租户数据） */}
          <WorkspaceSection
            icon={<CalendarRange size={16} />}
            title="季节需求曲线 · 备货预测（行业示例）"
            className="lg:col-span-3"
          >
            <div className="flex h-[100px] items-end gap-1.5">
              {SEASON.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center">
                  <div
                    className="w-3/5 rounded-t-[3px]"
                    /* 需求档位配色 + 动态高度：内联样式合法场景 */
                    style={{
                      background:
                        m.demand > 85
                          ? 'var(--brand)'
                          : m.demand > 65
                            ? 'var(--warning)'
                            : 'var(--info)',
                      height: `${(m.demand / maxSeason) * 80}px`,
                    }}
                  />
                  <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                    {m.month}月
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              🔴 制冷季(6-8月) / 🟠 采暖季(11-12月) 双高峰 — 提前 1-2 月备货
            </div>
          </WorkspaceSection>
        </div>
      ) : null}
    </div>
  );
}
