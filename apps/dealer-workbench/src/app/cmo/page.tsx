'use client';

/**
 * CMO 营销管理驾驶舱（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排思路：九屏面板改为 md:2 / xl:3 列 WorkspaceSection 网格（aside 显「已接/待建」状态签），
 * 面板内关键指标统一 tabular-nums 小统计；多触点归因区模型切换收进卡头；27 处内联样式清零。
 */

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Gauge,
  ShieldCheck,
  Filter,
  Store,
  Network,
  Search,
  Boxes,
  Swords,
  Coins,
  Target,
  AlertTriangle,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { WorkspaceSection } from '@/components/WorkspaceKit';
import { cockpit, metrics } from '../../lib/api';

const MODEL_LABEL: Record<string, string> = {
  linear: '线性',
  position: '位置(U型)',
  time_decay: '时间衰减',
};
const thisPeriod = () => new Date().toISOString().slice(0, 7);

type Scope = {
  role: string;
  scopeType: string;
  scopeDimension: string | null;
  scopeRef: string | null;
};
type Panel = { source?: string; data?: unknown; status?: string; note?: string };
type CmoDashboard = {
  bu: { type: string; id: string | null };
  panels: Record<string, Panel>;
  honesty: string;
};

const PANELS: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  { key: 'northStar', label: '北极星 · GEO 高意向线索', icon: <Search size={15} /> },
  { key: 'brandEquity', label: '品牌资产健康', icon: <ShieldCheck size={15} /> },
  { key: 'demandFunnel', label: '需求漏斗 (AARRR)', icon: <Filter size={15} /> },
  { key: 'channelDealer', label: '经销商成功度', icon: <Store size={15} /> },
  { key: 'channelHealth', label: '渠道网络健康', icon: <Network size={15} /> },
  { key: 'geoLoop', label: 'GEO 闭环', icon: <Search size={15} /> },
  { key: 'productPortfolio', label: '产品组合健康', icon: <Boxes size={15} /> },
  { key: 'competitive', label: '竞争态势 (按品类)', icon: <Swords size={15} /> },
  { key: 'mroi', label: '营销经济性 MROI', icon: <Coins size={15} /> },
  { key: 'teamOkr', label: '团队与 OKR', icon: <Target size={15} /> },
  { key: 'riskAlerts', label: '风险与合规告警', icon: <AlertTriangle size={15} /> },
];

function readScopes(): Scope[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').scopes || [];
  } catch {
    return [];
  }
}
function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

const yuan = (n: unknown) => `¥${(Number(n) || 0).toLocaleString('zh-CN')}`;
const pct = (n: unknown) => `${Number(n) || 0}%`;

// 把各面板的数据抽成"关键指标卡"（消除原始 JSON 展示）。
function panelStats(
  key: string,
  data: any
): Array<{ label: string; value: string | number; accent?: boolean }> {
  const d = data || {};
  switch (key) {
    case 'northStar':
      return [
        { label: '⭐ GEO 高意向线索', value: d.geoAttributedLeads ?? 0, accent: true },
        { label: '高意向线索', value: d.highIntentLeads ?? 0 },
        { label: 'GEO 触达', value: d.geoReach ?? 0 },
      ];
    case 'brandEquity':
      return [
        { label: 'AI 被引率', value: pct(d.citedRate) },
        { label: 'SoV', value: pct(d.sov) },
        { label: '正声量', value: pct(d.positiveSentiment) },
      ];
    case 'demandFunnel':
      return (d.stages || []).map((s: any) => ({ label: s.label || s.stage, value: s.count ?? 0 }));
    case 'channelDealer':
      return [
        { label: '经销商', value: Array.isArray(d) ? d.length : (d.dealers ?? 0) },
        {
          label: '活跃盈利',
          value: Array.isArray(d) ? d.filter((x: any) => x.active && x.profit > 0).length : 0,
        },
      ];
    case 'channelHealth':
      return [
        { label: '经销商', value: d.partners ?? 0 },
        { label: '活跃', value: d.active ?? 0 },
        { label: '活跃盈利', value: d.activeProfitable ?? 0 },
        { label: '网络GMV', value: yuan(d.networkGmv) },
      ];
    case 'geoLoop':
      return [
        { label: '被引率', value: pct(d.citedRate) },
        { label: '可见度缺口', value: d.gaps ?? 0, accent: true },
        { label: '已发布', value: d.content?.published ?? 0 },
      ];
    case 'productPortfolio': {
      const s = d.byStage || {};
      return [
        { label: '引入', value: s.intro ?? 0 },
        { label: '成长', value: s.growth ?? 0 },
        { label: '成熟', value: s.mature ?? 0 },
        { label: '退市', value: s.eol ?? 0 },
        { label: '在途上市', value: d.activeLaunches ?? 0 },
      ];
    }
    case 'competitive':
      return (d.shareOfVoice || []).slice(0, 4).map((s: any) => ({
        label: s.competitor,
        value: `${(Number(s.share) * 100).toFixed(0)}%`,
      }));
    case 'mroi':
      return [
        {
          label: 'MROI',
          value: d.mroi != null ? `${Number(d.mroi).toFixed(2)}×` : '—',
          accent: true,
        },
        { label: '花费', value: yuan(d.spend) },
        { label: '归因收入', value: yuan(d.attributedRevenue) },
      ];
    case 'teamOkr':
      return (d.byLevel || []).map((b: any) => ({
        label: b.level,
        value: `${(Number(b.avgProgress) * 100).toFixed(0)}%`,
      }));
    case 'riskAlerts':
      return [
        {
          label: '定价毛利闸告警',
          value: d.pricingMarginGateFail ?? 0,
          accent: (d.pricingMarginGateFail ?? 0) > 0,
        },
        {
          label: '返利毛利闸告警',
          value: d.rebateMarginGateFail ?? 0,
          accent: (d.rebateMarginGateFail ?? 0) > 0,
        },
        { label: '内容审核积压', value: d.contentReviewBacklog ?? 0 },
      ];
    default:
      return [];
  }
}

export default function CmoCockpitPage() {
  const [bu, setBu] = useState<{ buType?: string; buId?: string }>({});
  const scopes = readScopes();
  const buScopes = useMemo(() => scopes.filter((s) => s.scopeType === 'business_unit'), [scopes]);
  const key = `cmo:${bu.buType || 'group'}:${bu.buId || ''}`;
  const { data, error, isLoading, mutate } = useSWR<CmoDashboard>(key, () => cockpit.cmo(bu));

  const { toast } = useToast();
  const [model, setModel] = useState('position');
  const [period] = useState(thisPeriod());
  const [refreshing, setRefreshing] = useState(false);
  const attr = useSWR(`metrics:attr:${period}:${model}`, () => metrics.attribution(period, model));
  async function refreshMetrics() {
    setRefreshing(true);
    try {
      await metrics.refresh(period, model);
      await attr.mutate();
      toast('读模型已刷新（含多触点归因）', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setRefreshing(false);
    }
  }
  const attrChannels: any[] = attr.data?.channels || [];

  return (
    <div className="page-container">
      <PageHeader
        title="CMO 营销管理驾驶舱"
        subtitle="经营层总舵 · 九屏聚合 · 按事业部切片 —— 一套真实度量源，不造虚荣数（基座4）"
        actions={
          <select
            className="input"
            value={bu.buType ? `${bu.buType}:${bu.buId}` : 'group'}
            onChange={(e) => {
              if (e.target.value === 'group') {
                setBu({});
                return;
              }
              const [buType, buId] = e.target.value.split(':');
              setBu({ buType, buId });
            }}
          >
            <option value="group">集团（全品牌/全品类）</option>
            {buScopes.map((s) => (
              <option
                key={`${s.scopeDimension}:${s.scopeRef}`}
                value={`${s.scopeDimension}:${s.scopeRef}`}
              >
                事业部 · {s.scopeDimension === 'brand' ? '品牌' : '品类'} {s.scopeRef}
              </option>
            ))}
          </select>
        }
      />

      <AsyncBoundary
        status={statusOf(isLoading, error, false)}
        errorMessage="驾驶舱数据加载失败（需 API + 数据库）"
        onRetry={() => mutate()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Gauge size={15} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            当前范围：
            {data?.bu?.type === 'group' || !data?.bu
              ? '集团'
              : `事业部 ${data.bu.type}:${data.bu.id}`}
          </span>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
          {PANELS.map(({ key: k, label, icon }) => {
            const panel = data?.panels?.[k];
            const todo = panel?.status === 'todo';
            return (
              <WorkspaceSection
                key={k}
                icon={icon}
                title={<span className="text-[13px]">{label}</span>}
                aside={
                  <span
                    className={
                      todo
                        ? 'rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground'
                        : 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600'
                    }
                  >
                    {todo ? '待建' : '已接'}
                  </span>
                }
              >
                {todo ? (
                  <p className="m-0 text-xs text-muted-foreground">{panel?.note}</p>
                ) : (
                  (() => {
                    const stats = panelStats(k, panel?.data);
                    if (!stats.length)
                      return <p className="m-0 text-xs text-muted-foreground">（暂无数据）</p>;
                    return (
                      <div className="flex flex-wrap content-start gap-3.5">
                        {stats.map((s, i) => (
                          <div key={i} className="min-w-[72px]">
                            <div
                              className={
                                s.accent
                                  ? 'text-xl leading-tight font-bold text-primary tabular-nums'
                                  : 'text-xl leading-tight font-bold tabular-nums'
                              }
                            >
                              {s.value}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
                {panel?.source && (
                  <div className="mt-2 text-xs text-muted-foreground/70">源：{panel.source}</div>
                )}
              </WorkspaceSection>
            );
          })}
        </div>
      </AsyncBoundary>

      {/* 多触点归因（度量中台读模型：RLS 读模型 + 线性/位置/时间衰减，替代直查 OLTP） */}
      <div className="mt-5">
        <WorkspaceSection
          icon={<GitBranch size={16} className="text-primary" />}
          title={`多触点归因 · ${period}`}
          aside={
            <span className="flex flex-wrap items-center gap-1.5">
              {(['linear', 'position', 'time_decay'] as const).map((m) => (
                <button
                  key={m}
                  className={model === m ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'}
                  onClick={() => setModel(m)}
                >
                  {MODEL_LABEL[m]}
                </button>
              ))}
              <button
                className="btn btn-outline btn-sm"
                disabled={refreshing}
                onClick={refreshMetrics}
              >
                <RefreshCw size={13} />
                {refreshing ? '刷新中…' : '重算读模型'}
              </button>
            </span>
          }
        >
          <AsyncBoundary
            status={statusOf(attr.isLoading, attr.error, attrChannels.length === 0)}
            errorMessage="归因加载失败（需 API + 数据库）"
            onRetry={() => attr.mutate()}
            emptyTitle="暂无归因数据"
            emptyDescription="点「重算读模型」从漏斗旅程重建；有已签约旅程后显示各渠道信用份额。"
          >
            <div className="grid gap-2.5">
              {attrChannels.map((c) => (
                <div key={c.channel}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span>
                      {c.channel}{' '}
                      <span className="text-xs text-muted-foreground">· {c.touches} 触点</span>
                    </span>
                    <span className="font-semibold text-primary tabular-nums">
                      {(c.share * 100).toFixed(1)}% · {c.creditedConversions.toFixed(2)} 信用
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
                    {/* 动态宽度是内联样式的合法场景（棘轮口径） */}
                    <div
                      className="h-full bg-primary transition-[width] duration-300"
                      style={{ width: `${Math.min(c.share * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AsyncBoundary>
          <div className="mt-2.5 text-xs text-muted-foreground/80">
            源：metric_channel_attribution（RLS 读模型）· 信用按 {MODEL_LABEL[model]}{' '}
            模型跨触点分配,和=转化数
          </div>
        </WorkspaceSection>
      </div>
    </div>
  );
}
