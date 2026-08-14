'use client';

/**
 * GEO 进化工作台（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 信息架构：左 2/3 = 探测池主工作区（KPI + 过滤 + 录入 + 清单）+ 引爆草稿；
 * 右 1/3 = 占位漏斗 / 引爆准备度 / 资产缺口（辅助决策列）。
 * 原版问题：全宽单列卡叠放（1440 宽下大量留白）、口号装饰行、
 * 探测行 6 列 label/value 网格浪费纵向空间、86 处内联样式。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Archive, Bot, Crosshair, Flame, Gauge, Layers3, Route, Target } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import {
  WorkspaceSection,
  FilterChips,
  FunnelSteps,
  KeyValueRows,
  ProgressStat,
} from '@/components/WorkspaceKit';
import { MiniStat } from '@/components/StatCard';
import { agenticGeo, geoFocus } from '../../lib/api';

const CATEGORIES = [
  { code: 'central-hot-water', name: '中央热水' },
  { code: 'wall-hung-boiler', name: '壁挂炉' },
  { code: 'water-cooled-ac', name: '水机空调' },
];
const STAGES: Array<[string, string, string]> = [
  ['reach', 'AI 触达', '目标问题进入监测'],
  ['cited', '品牌出现', '答案中出现品牌/站点'],
  ['recommended', '权威引用', '引用产品事实/技术资产'],
  ['lead', '高意向线索', '进入经销商承接'],
];
const RATE_KEY = ['', 'citeRate', 'recommendRate', 'leadRate'];
const PROBE_TYPES = [
  { key: '', label: '全部' },
  { key: 'category', label: '品类' },
  { key: 'scenario', label: '场景' },
  { key: 'comparison', label: '对比' },
  { key: 'selection', label: '选型' },
  { key: 'pain_point', label: '痛点' },
  { key: 'region', label: '区域' },
  { key: 'role', label: '角色' },
];
const PROBE_TYPE_LABEL: Record<string, string> = {
  category: '品类',
  scenario: '场景',
  comparison: '对比',
  selection: '选型',
  pain_point: '痛点',
  region: '区域',
  role: '角色',
};
const INTENT_LABEL: Record<string, string> = {
  awareness: '认知',
  compare: '比较',
  selection: '选型',
  quote: '报价',
  after_sales: '售后',
};
const ASSET_DESC: Record<string, string> = {
  产品事实资产: '型号/性能/能效/适用场景',
  技术权威资产: '标准/认证/计算逻辑/工程边界',
  场景方案资产: '别墅/酒店/商用热水等方案',
  案例证明资产: '项目证据/交付结果/可归因故事',
  对比解释资产: '品牌差异/竞品替代/选型理由',
  机器可读资产: 'JSON-LD/sitemap/FAQ/robots',
  'FAQ 问答资产': '常见问题/痛点解释/行动建议',
  技术解释资产: '故障原因/技术边界/解决路径',
  区域承接页: '区域品牌站落地页/服务半径',
  经销商承接路径: '派单规则/表单/咨询转化',
};

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

function pct(n: number) {
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n * 100)}%`;
}

function clampScore(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export default function GeoFocusPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState('central-hot-water');
  const [probeType, setProbeType] = useState('');
  const [plays, setPlays] = useState<any[]>([]);
  const [igniting, setIgniting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [nt, setNt] = useState({
    query: '',
    segment: '',
    engine: '',
    region: '',
    priorityScore: '',
    probeType: 'category',
    intentStage: 'compare',
  });

  const funnel = useSWR(`geo:funnel:${category}`, () => geoFocus.cognitionFunnel(category));
  const pool = useSWR(`geo:probe-pool:${category}:${probeType}`, () =>
    geoFocus.listProbePool({ category, ...(probeType ? { probeType } : {}) })
  );

  async function addTarget() {
    if (!nt.query) {
      toast('请填写目标 AI 查询', 'error');
      return;
    }
    try {
      await geoFocus.upsertTarget({
        category,
        query: nt.query,
        segment: nt.segment || undefined,
        engine: nt.engine || undefined,
        region: nt.region || undefined,
        priorityScore: Number(nt.priorityScore) || 0,
        probeType: nt.probeType,
        intentStage: nt.intentStage,
      });
      setNt({
        query: '',
        segment: '',
        engine: '',
        region: '',
        priorityScore: '',
        probeType: 'category',
        intentStage: 'compare',
      });
      toast('探测点已录入', 'success');
      pool.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function seedPool() {
    setSeeding(true);
    try {
      const r = await geoFocus.seedProbePool({ category });
      toast(`探测池已丰富：新增 ${r.created || 0} 个，跳过 ${r.skipped || 0} 个`, 'success');
      pool.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSeeding(false);
    }
  }
  async function ignite() {
    setIgniting(true);
    try {
      const r = await agenticGeo.ignite(category, undefined, 5);
      setPlays(r.plays || []);
      toast(r.note || `已就位 ${r.selected} 个选点`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setIgniting(false);
    }
  }
  function previewAction(name: string) {
    toast(`${name}配置待接入：先补齐探测池、资产与线索归因`, 'success');
  }

  const tRows: any[] = pool.data?.targets || [];
  const summary = pool.data?.summary || {};
  const funnelData = (funnel.data?.funnel as any) || {};
  const rates = (funnel.data?.rates as any) || {};
  const reach = Number(funnelData.reach || 0);
  const cited = Number(funnelData.cited || 0);
  const recommended = Number(funnelData.recommended || 0);
  const leads = Number(funnelData.lead || 0);
  const brandPresenceRate = reach > 0 ? cited / reach : 0;
  const highPriorityTargets = Number(
    summary.highPriority ?? tRows.filter((t) => Number(t.priorityScore || 0) >= 70).length
  );
  const assetRows = Object.entries(
    tRows.reduce((acc: Record<string, number>, t) => {
      const gaps = Array.isArray(t.assetGaps) ? t.assetGaps : [];
      for (const gap of gaps) acc[String(gap)] = (acc[String(gap)] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, count]) => ({
    name,
    count: Number(count),
    readiness: clampScore(100 - Number(count) * 12),
    desc: ASSET_DESC[name] || '由探测结果回流形成的待补资产',
  }));
  const preparedAssets = assetRows.filter((a) => a.readiness >= 60).length;
  const igniteReadiness = clampScore(
    brandPresenceRate * 28 +
      (Math.min(tRows.length, 8) / 8) * 24 +
      (preparedAssets / Math.max(assetRows.length, 1)) * 24 +
      (recommended > 0 ? 14 : 0) +
      (leads > 0 ? 10 : 0)
  );
  const selectedCategory = CATEGORIES.find((c) => c.code === category)?.name || category;

  return (
    <div className="page-container">
      <PageHeader
        title="GEO 进化 · 探测池 / 认知资产 / 引爆"
        subtitle="探测池找战场，千问扩战场，认知资产占战场，引爆打穿战场。"
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-outline" disabled={seeding} onClick={seedPool}>
              <Target size={15} />
              {seeding ? '丰富中…' : '丰富探测池'}
            </button>
            <button className="btn btn-brand" disabled={igniting} onClick={ignite}>
              <Flame size={15} />
              {igniting ? '引爆生成中…' : '品类引爆'}
            </button>
          </div>
        }
      />

      <div className="mb-4">
        <FilterChips
          size="md"
          options={CATEGORIES.map((c) => ({ value: c.code, label: c.name }))}
          value={category}
          onChange={(code) => {
            setCategory(code);
            setProbeType('');
            setPlays([]);
          }}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* ── 左 2/3：探测池主工作区 ─────────────────────────────── */}
        <div className="grid gap-4 lg:col-span-2">
          <WorkspaceSection
            icon={<Target size={16} />}
            title="AI 战场探测池"
            aside={`${selectedCategory} · 高价值点 ${highPriorityTargets} 个`}
          >
            <AsyncBoundary
              status={statusOf(pool.isLoading, pool.error, false)}
              errorMessage="探测池加载失败（需 API + 数据库）"
              onRetry={() => pool.mutate()}
            >
              <div className="mb-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <MiniStat label="探测点" value={summary.total ?? tRows.length} accent />
                <MiniStat label="高价值点" value={highPriorityTargets} accent />
                <MiniStat label="已探测" value={summary.probed ?? 0} />
                <MiniStat label="覆盖率" value={pct(summary.coverageRate ?? 0)} />
              </div>
              <div className="mb-3.5">
                <FilterChips
                  options={PROBE_TYPES.map((p) => ({
                    value: p.key,
                    label: p.label,
                    count: p.key ? summary.byType?.[p.key] || 0 : (summary.total ?? tRows.length),
                  }))}
                  value={probeType}
                  onChange={setProbeType}
                />
              </div>

              <div className="mb-3.5 grid grid-cols-2 gap-2 rounded-lg border bg-secondary/40 p-3 md:grid-cols-4">
                <input
                  className="input col-span-2 md:col-span-4"
                  value={nt.query}
                  onChange={(e) => setNt({ ...nt, query: e.target.value })}
                  placeholder="目标 AI 查询（如 中央热水哪个品牌好）"
                />
                <select
                  className="input"
                  value={nt.probeType}
                  onChange={(e) => setNt({ ...nt, probeType: e.target.value })}
                  aria-label="探测类型"
                >
                  {PROBE_TYPES.filter((p) => p.key).map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  value={nt.intentStage}
                  onChange={(e) => setNt({ ...nt, intentStage: e.target.value })}
                  aria-label="意图阶段"
                >
                  {Object.entries(INTENT_LABEL).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  value={nt.segment}
                  onChange={(e) => setNt({ ...nt, segment: e.target.value })}
                  placeholder="人群段"
                />
                <input
                  className="input"
                  value={nt.engine}
                  onChange={(e) => setNt({ ...nt, engine: e.target.value })}
                  placeholder="引擎"
                />
                <input
                  className="input"
                  value={nt.region}
                  onChange={(e) => setNt({ ...nt, region: e.target.value })}
                  placeholder="区域"
                />
                <input
                  className="input"
                  value={nt.priorityScore}
                  onChange={(e) => setNt({ ...nt, priorityScore: e.target.value })}
                  placeholder="优先级"
                  type="number"
                />
                <button className="btn btn-brand col-span-2 md:col-span-2" onClick={addTarget}>
                  录入探测点
                </button>
              </div>

              <AsyncBoundary
                status={statusOf(pool.isLoading, pool.error, tRows.length === 0)}
                errorMessage="探测池加载失败（需 API + 数据库）"
                onRetry={() => pool.mutate()}
                emptyTitle="暂无探测点"
                emptyDescription="先点击“丰富探测池”，生成多类型 AI 查询战场，再对高价值点做千问引爆。"
              >
                <div className="grid gap-1.5">
                  {tRows.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150 hover:bg-secondary/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{t.query}</div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {PROBE_TYPE_LABEL[t.probeType] || '品类'} ·{' '}
                          {INTENT_LABEL[t.intentStage] || '比较'} · {t.segment || '通用人群'}/
                          {t.engine || '全部引擎'}
                          {t.region ? `/${t.region}` : ''} · 缺口{' '}
                          {Array.isArray(t.assetGaps) && t.assetGaps.length
                            ? t.assetGaps.slice(0, 2).join('/')
                            : '待探测'}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {t.status || '待监测'}
                      </span>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold text-primary tabular-nums">
                          {Number(t.priorityScore).toFixed(0)}
                        </div>
                        <button
                          className="btn btn-outline btn-sm mt-1"
                          onClick={() => previewAction('探测动作')}
                        >
                          动作
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </AsyncBoundary>
            </AsyncBoundary>
          </WorkspaceSection>

          {plays.length > 0 && (
            <WorkspaceSection
              icon={<Flame size={16} className="text-primary" />}
              title={`引爆 · 千问千面草稿（${plays.length}）`}
              aside="草稿 · 待人工核准"
            >
              <div className="grid gap-2.5">
                {plays.map((p) => (
                  <div key={p.targetId} className="rounded-lg border p-3">
                    <div className="text-[13px] font-semibold">
                      {p.query}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        · 策略 {(p.strategies || []).join('/')}
                      </span>
                    </div>
                    <pre className="mt-1.5 max-h-28 overflow-auto text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {p.draft?.text?.slice(0, 500)}
                    </pre>
                  </div>
                ))}
              </div>
            </WorkspaceSection>
          )}
        </div>

        {/* ── 右 1/3：决策辅助列 ────────────────────────────────── */}
        <div className="grid gap-4">
          <WorkspaceSection
            icon={<Crosshair size={16} />}
            title="AI 答案占位漏斗"
            aside={
              <>
                占位率 <span className="font-bold text-primary">{pct(brandPresenceRate)}</span>
              </>
            }
          >
            <AsyncBoundary
              status={statusOf(funnel.isLoading, funnel.error, false)}
              errorMessage="认知资产加载失败（需 API + 数据库）"
              onRetry={() => funnel.mutate()}
            >
              <FunnelSteps
                steps={STAGES.map(([k, label, desc], i) => ({
                  label,
                  hint: desc,
                  value: funnelData?.[k] ?? 0,
                  conversion: i > 0 ? pct(rates?.[RATE_KEY[i]] ?? 0) : undefined,
                }))}
                columns={2}
              />
            </AsyncBoundary>
          </WorkspaceSection>

          <WorkspaceSection icon={<Gauge size={16} />} title="引爆准备度">
            <div className="mb-3 rounded-lg border bg-secondary/60 px-4 py-4 text-center">
              <div className="text-[32px] leading-none font-extrabold text-primary tabular-nums">
                {igniteReadiness}
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                探测池密度 / 品牌出现 / 权威资产 / 线索归因
              </div>
            </div>
            <KeyValueRows
              rows={[
                { label: '探测池规模', value: `${tRows.length} 个` },
                { label: '品牌出现基础', value: pct(brandPresenceRate) },
                { label: '资产可用度', value: `${preparedAssets}/${Math.max(assetRows.length, 1)}` },
                { label: '经销商承接', value: leads > 0 ? '已回流' : '待回流' },
              ]}
            />
            <div className="mt-3.5 flex flex-wrap gap-2">
              <button className="btn btn-outline btn-sm" onClick={() => previewAction('区域引爆')}>
                <Route size={14} />
                区域引爆
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => previewAction('场景引爆')}>
                <Layers3 size={14} />
                场景引爆
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => previewAction('竞品引爆')}>
                <Bot size={14} />
                竞品引爆
              </button>
            </div>
          </WorkspaceSection>

          <WorkspaceSection icon={<Archive size={16} />} title="认知资产缺口池">
            <div className="grid gap-2">
              {(assetRows.length
                ? assetRows
                : [
                    {
                      name: '待探测资产',
                      count: 0,
                      readiness: 0,
                      desc: '丰富探测池后由资产缺口自动汇总',
                    },
                  ]
              ).map((asset) => (
                <ProgressStat
                  key={asset.name}
                  label={asset.name}
                  desc={`${asset.desc} · 缺口 ${asset.count}`}
                  percent={asset.readiness}
                />
              ))}
            </div>
          </WorkspaceSection>
        </div>
      </div>
    </div>
  );
}
