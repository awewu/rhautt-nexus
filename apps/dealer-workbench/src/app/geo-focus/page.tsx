'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Archive, Bot, Crosshair, Flame, Gauge, Layers3, Route, Target } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
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
  { key: '', label: '全部探测' },
  { key: 'category', label: '品类' },
  { key: 'scenario', label: '场景' },
  { key: 'comparison', label: '对比' },
  { key: 'selection', label: '选型' },
  { key: 'pain_point', label: '痛点' },
  { key: 'region', label: '区域' },
  { key: 'role', label: '角色' },
];
const PROBE_TYPE_LABEL: Record<string, string> = {
  category: '品类问题',
  scenario: '场景问题',
  comparison: '对比问题',
  selection: '选型问题',
  pain_point: '痛点问题',
  region: '区域问题',
  role: '角色问题',
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
  if (isLoading) return 'loading'; if (error) return 'error'; if (empty) return 'empty'; return 'ok';
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
  const [nt, setNt] = useState({ query: '', segment: '', engine: '', region: '', priorityScore: '', probeType: 'category', intentStage: 'compare' });

  const funnel = useSWR(`geo:funnel:${category}`, () => geoFocus.cognitionFunnel(category));
  const pool = useSWR(`geo:probe-pool:${category}:${probeType}`, () => geoFocus.listProbePool({ category, ...(probeType ? { probeType } : {}) }));

  async function addTarget() {
    if (!nt.query) { toast('请填写目标 AI 查询', 'error'); return; }
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
      setNt({ query: '', segment: '', engine: '', region: '', priorityScore: '', probeType: 'category', intentStage: 'compare' });
      toast('探测点已录入', 'success');
      pool.mutate();
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function seedPool() {
    setSeeding(true);
    try {
      const r = await geoFocus.seedProbePool({ category });
      toast(`探测池已丰富：新增 ${r.created || 0} 个，跳过 ${r.skipped || 0} 个`, 'success');
      pool.mutate();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSeeding(false); }
  }
  async function ignite() {
    setIgniting(true);
    try { const r = await agenticGeo.ignite(category, undefined, 5); setPlays(r.plays || []); toast(r.note || `已就位 ${r.selected} 个选点`, 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setIgniting(false); }
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
  const highPriorityTargets = Number(summary.highPriority ?? tRows.filter((t) => Number(t.priorityScore || 0) >= 70).length);
  const assetRows = Object.entries(
    tRows.reduce((acc: Record<string, number>, t) => {
      const gaps = Array.isArray(t.assetGaps) ? t.assetGaps : [];
      for (const gap of gaps) acc[String(gap)] = (acc[String(gap)] || 0) + 1;
      return acc;
    }, {}),
  ).map(([name, count]) => ({ name, count: Number(count), readiness: clampScore(100 - (Number(count) * 12)), desc: ASSET_DESC[name] || '由探测结果回流形成的待补资产' }));
  const preparedAssets = assetRows.filter((a) => a.readiness >= 60).length;
  const igniteReadiness = clampScore(
    (brandPresenceRate * 28)
    + (Math.min(tRows.length, 8) / 8 * 24)
    + (preparedAssets / Math.max(assetRows.length, 1) * 24)
    + (recommended > 0 ? 14 : 0)
    + (leads > 0 ? 10 : 0),
  );
  const selectedCategory = CATEGORIES.find((c) => c.code === category)?.name || category;

  return (
    <div className="page-container">
      <PageHeader
        title="GEO 进化 · 探测池 / 认知资产 / 引爆"
        subtitle="先丰富 AI 答案战场探测池，再用千问扩展高价值选点：探测池找战场，认知资产占战场，引爆打穿战场。"
        actions={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-outline" disabled={seeding} onClick={seedPool}><Target size={15} />{seeding ? '丰富中…' : '丰富探测池'}</button><button className="btn btn-brand" disabled={igniting} onClick={ignite}><Flame size={15} />{igniting ? '引爆生成中…' : '品类引爆'}</button></div>}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => (
          <button key={c.code} className={category === c.code ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { setCategory(c.code); setProbeType(''); setPlays([]); }}>{c.name}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>探测池总览</span>
          </div>
          <div className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{selectedCategory} · 先找战场，再做千问</div>
        </div>
        <AsyncBoundary status={statusOf(pool.isLoading, pool.error, false)} errorMessage="探测池加载失败（需 API + 数据库）" onRetry={() => pool.mutate()}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
            {[
              ['探测点', summary.total ?? tRows.length],
              ['高价值点', highPriorityTargets],
              ['已探测', summary.probed ?? 0],
              ['覆盖率', pct(summary.coverageRate ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="inset" style={{ padding: 12, textAlign: 'center' }}>
                <div className="t-num" style={{ fontSize: 22, color: 'var(--brand)', fontWeight: 800 }}>{value}</div>
                <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PROBE_TYPES.map((p) => (
              <button key={p.key || 'all'} className={probeType === p.key ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setProbeType(p.key)}>{p.label} {p.key ? (summary.byType?.[p.key] || 0) : (summary.total ?? tRows.length)}</button>
            ))}
          </div>
        </AsyncBoundary>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['探测池负责找战场', '千问负责扩战场', '认知资产负责占战场', '引爆负责打穿战场'].map((label) => (
          <span key={label} className="t-xs" style={{ background: 'var(--surface-2)', color: 'var(--t-secondary)', borderRadius: 999, padding: '5px 12px' }}>{label}</span>
        ))}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crosshair size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>AI 答案占位漏斗</span>
          </div>
          <div className="t-xs" style={{ color: 'var(--t-tertiary)' }}>答案占位率 <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{pct(brandPresenceRate)}</span></div>
        </div>
        <AsyncBoundary status={statusOf(funnel.isLoading, funnel.error, false)} errorMessage="认知资产加载失败（需 API + 数据库）" onRetry={() => funnel.mutate()}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {STAGES.map(([k, label, desc], i) => {
              const v = funnelData?.[k] ?? 0;
              const rate = i > 0 ? rates?.[RATE_KEY[i]] : null;
              return (
                <div key={k} style={{ flex: 1, textAlign: 'center' }}>
                  <div className="inset" style={{ padding: '14px 4px' }}>
                    <div className="t-num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)' }}>{v}</div>
                    <div className="t-xs" style={{ color: 'var(--t-secondary)', fontWeight: 600 }}>{label}</div>
                    <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 3 }}>{desc}</div>
                  </div>
                  {rate != null && <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 4 }}>转化 {pct(rate)}</div>}
                </div>
              );
            })}
          </div>
        </AsyncBoundary>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>AI 战场探测池</span>
          </div>
          <div className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{selectedCategory} · 高价值点 {highPriorityTargets} 个</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="input" value={nt.query} onChange={(e) => setNt({ ...nt, query: e.target.value })} placeholder="目标 AI 查询（如 中央热水哪个品牌好）" style={{ flex: 1, minWidth: 220 }} />
          <select className="input" value={nt.probeType} onChange={(e) => setNt({ ...nt, probeType: e.target.value })} style={{ width: 110 }}>
            {PROBE_TYPES.filter((p) => p.key).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select className="input" value={nt.intentStage} onChange={(e) => setNt({ ...nt, intentStage: e.target.value })} style={{ width: 110 }}>
            {Object.entries(INTENT_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <input className="input" value={nt.segment} onChange={(e) => setNt({ ...nt, segment: e.target.value })} placeholder="人群段" style={{ width: 110 }} />
          <input className="input" value={nt.engine} onChange={(e) => setNt({ ...nt, engine: e.target.value })} placeholder="引擎" style={{ width: 100 }} />
          <input className="input" value={nt.region} onChange={(e) => setNt({ ...nt, region: e.target.value })} placeholder="区域" style={{ width: 90 }} />
          <input className="input" value={nt.priorityScore} onChange={(e) => setNt({ ...nt, priorityScore: e.target.value })} placeholder="优先级" type="number" style={{ width: 90 }} />
          <button className="btn btn-brand" onClick={addTarget}>录入</button>
        </div>
        <AsyncBoundary status={statusOf(pool.isLoading, pool.error, tRows.length === 0)} errorMessage="探测池加载失败（需 API + 数据库）" onRetry={() => pool.mutate()} emptyTitle="暂无探测点" emptyDescription="先点击“丰富探测池”，生成多类型 AI 查询战场，再对高价值点做千问引爆。">
          <div style={{ display: 'grid', gap: 8 }}>
            {tRows.map((t) => (
              <div key={t.id} className="inset" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 10, alignItems: 'center', padding: '10px 12px' }}>
                <div>
                  <div className="t-sm" style={{ fontWeight: 600, color: 'var(--t-strong)' }}>{t.query}</div>
                  <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 3 }}>{t.segment || '通用人群'} / {t.engine || '全部引擎'}{t.region ? ` / ${t.region}` : ''}</div>
                </div>
                <div className="t-xs" style={{ color: 'var(--t-secondary)' }}>探测类型<br /><span style={{ color: 'var(--t-strong)', fontWeight: 600 }}>{PROBE_TYPE_LABEL[t.probeType] || t.probeType || '品类问题'}</span></div>
                <div className="t-xs" style={{ color: 'var(--t-secondary)' }}>意图阶段<br /><span style={{ color: 'var(--t-strong)', fontWeight: 600 }}>{INTENT_LABEL[t.intentStage] || '比较'}</span></div>
                <div className="t-xs" style={{ color: 'var(--t-secondary)' }}>当前状态<br /><span style={{ color: 'var(--brand)', fontWeight: 700 }}>{t.status || '待监测'}</span></div>
                <div className="t-xs" style={{ color: 'var(--t-secondary)' }}>资产缺口<br /><span style={{ color: 'var(--t-strong)', fontWeight: 600 }}>{Array.isArray(t.assetGaps) && t.assetGaps.length ? t.assetGaps.slice(0, 2).join('/') : '待探测'}</span></div>
                <div style={{ textAlign: 'right' }}>
                  <div className="t-xs" style={{ color: 'var(--brand)', fontWeight: 700 }}>优先级 {Number(t.priorityScore).toFixed(0)}</div>
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 6 }} onClick={() => previewAction('探测动作')}>查看动作</button>
                </div>
              </div>
            ))}
          </div>
        </AsyncBoundary>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Archive size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>认知资产缺口池</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {(assetRows.length ? assetRows : [{ name: '待探测资产', count: 0, readiness: 0, desc: '丰富探测池后由资产缺口自动汇总' }]).map((asset) => (
              <div key={asset.name} className="inset" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div className="t-sm" style={{ fontWeight: 600 }}>{asset.name}</div>
                    <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 4 }}>{asset.desc} · 缺口 {asset.count}</div>
                  </div>
                  <div className="t-xs" style={{ color: 'var(--brand)', fontWeight: 700 }}>{asset.readiness}%</div>
                </div>
                <div style={{ height: 4, background: 'var(--surface-3)', borderRadius: 999, marginTop: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${asset.readiness}%`, height: '100%', background: 'var(--brand)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Gauge size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>引爆准备度</span>
          </div>
          <div className="inset" style={{ padding: 16, textAlign: 'center', marginBottom: 12 }}>
            <div className="t-num" style={{ fontSize: 34, color: 'var(--brand)', fontWeight: 800 }}>{igniteReadiness}</div>
            <div className="t-xs" style={{ color: 'var(--t-tertiary)' }}>探测池密度 / 品牌出现 / 权威资产 / 线索归因</div>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              ['探测池规模', `${tRows.length} 个`],
              ['品牌出现基础', pct(brandPresenceRate)],
              ['资产可用度', `${preparedAssets}/${Math.max(assetRows.length, 1)}`],
              ['经销商承接', leads > 0 ? '已回流' : '待回流'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{label}</span>
                <span className="t-xs" style={{ color: 'var(--t-strong)', fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={() => previewAction('区域引爆')}><Route size={14} />区域引爆</button>
            <button className="btn btn-outline btn-sm" onClick={() => previewAction('场景引爆')}><Layers3 size={14} />场景引爆</button>
            <button className="btn btn-outline btn-sm" onClick={() => previewAction('竞品引爆')}><Bot size={14} />竞品引爆</button>
          </div>
        </div>
      </div>

      {plays.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Flame size={16} style={{ color: 'var(--brand)' }} /><span className="t-lg" style={{ fontWeight: 600 }}>引爆 · 千问千面草稿（{plays.length}）</span>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {plays.map((p) => (
              <div key={p.targetId} className="inset">
                <div className="t-sm" style={{ color: 'var(--t-strong)', fontWeight: 600 }}>{p.query} <span className="t-xs" style={{ color: 'var(--t-tertiary)', fontWeight: 400 }}>· 策略 {(p.strategies || []).join('/')}</span></div>
                <pre className="t-xs" style={{ color: 'var(--t-secondary)', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', margin: '6px 0 0' }}>{p.draft?.text?.slice(0, 500)}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
