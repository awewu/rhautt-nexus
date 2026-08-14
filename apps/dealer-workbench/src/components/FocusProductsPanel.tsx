'use client';

/**
 * 主销产品面板：声明（三闸预检 → 声明）· 生效清单 · 后验分歧镜子 · 型号级 GEO 选题派生。
 *
 * 诚实原则（与后端口径一致，不在前端加戏）：
 * - 主销是**策略声明**非市场事实；镜子只报事实不判"定错了"——处置属经营决策。
 * - 预检失败时逐闸展示原因（blockedBy 全量），不吞并成一句"不合格"。
 * - 报价口径是领先信号非成交事实；匹配不上的 BOM 行如实展示 unmatched，不猜归属。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Crosshair, Scale, ListTree } from 'lucide-react';
import { AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { productMgmt, products } from '../lib/api';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

const BRANDS = ['rheem', 'ruud', 'everhot', 'lithnova'];

export default function FocusProductsPanel() {
  const { toast } = useToast();
  const [brandSlug, setBrandSlug] = useState('rheem');
  const [category, setCategory] = useState('');

  const focusList = useSWR(['pm:focus', brandSlug, category], () =>
    productMgmt.listFocus({ brandSlug, category: category || undefined })
  );
  const catalog = useSWR(['pm:devices', brandSlug], () =>
    products.list({ brand: brandSlug, pageSize: '100' })
  );

  // ── 声明表单 ──
  const [productId, setProductId] = useState('');
  const [period, setPeriod] = useState({ start: '', end: '' });
  const [rationale, setRationale] = useState('');
  const [precheck, setPrecheck] = useState<any>(null);

  async function runPrecheck() {
    if (!productId) return toast('先选择产品', 'error');
    try {
      const r = await productMgmt.focusEligibility(productId);
      setPrecheck(r);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function declare() {
    if (!productId || !period.start || !period.end || !rationale.trim())
      return toast('产品/生效期/理由均必填（主销是政策，必须写明为什么推它）', 'error');
    try {
      const item: any = (catalog.data?.data?.items || catalog.data?.items || []).find(
        (p: any) => p.id === productId
      );
      await productMgmt.declareFocus({
        brandSlug,
        category: item?.category || category,
        productId,
        periodStart: period.start,
        periodEnd: period.end,
        rationale: rationale.trim(),
      });
      toast('主销声明已生效（已过三闸）', 'success');
      setPrecheck(null);
      setRationale('');
      focusList.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function revoke(id: string) {
    try {
      await productMgmt.revokeFocus(id, '工作台撤销');
      toast('已撤销（保留决策痕迹，不物理删除）', 'success');
      focusList.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  // ── 分歧镜子 ──
  const [mirror, setMirror] = useState<any>(null);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  async function runMirror() {
    setMirrorLoading(true);
    try {
      setMirror(await productMgmt.focusRealityCheck(brandSlug, category || undefined));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setMirrorLoading(false);
    }
  }

  // ── 型号级选题派生 ──
  const [topics, setTopics] = useState<any>(null);
  async function deriveTopics(dryRun: boolean) {
    try {
      const r = await productMgmt.deriveFocusTopics({
        brandSlug,
        category: category || undefined,
        dryRun,
      });
      setTopics(r.data);
      if (!dryRun)
        toast(`已落库 ${r.data?.saved ?? 0} 题（跳过已存在 ${r.data?.skippedExisting ?? 0}）`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const rows: any[] = focusList.data?.declarations || [];
  const deviceItems: any[] = catalog.data?.data?.items || catalog.data?.items || [];

  return (
    <div className="card" style={{ padding: 20, marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Crosshair size={16} />
        <span className="t-lg" style={{ fontWeight: 600 }}>
          主销产品 · 策略声明与后验镜子
        </span>
      </div>
      <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginBottom: 16 }}>
        主销是品牌方策略声明（须过毛利/生命周期/卖点证据三闸），不是市场热度事实；是否真好卖由下方镜子对照渠道报价/成交后验。
      </div>

      {/* 范围选择 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input" value={brandSlug} onChange={(e) => setBrandSlug(e.target.value)}>
          {BRANDS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="品类（可选，如 中央热水）"
          style={{ width: 200 }}
        />
      </div>

      {/* 声明区 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <select
          className="input"
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setPrecheck(null);
          }}
          style={{ minWidth: 220 }}
        >
          <option value="">选择产品…</option>
          {deviceItems.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.sku ? `[${p.sku}] ` : ''}
              {p.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          type="date"
          value={period.start}
          onChange={(e) => setPeriod({ ...period, start: e.target.value })}
        />
        <input
          className="input"
          type="date"
          value={period.end}
          onChange={(e) => setPeriod({ ...period, end: e.target.value })}
        />
        <button className="btn btn-outline" onClick={runPrecheck}>
          三闸预检
        </button>
        <button
          className="btn btn-brand"
          disabled={!precheck?.eligibility?.eligible}
          title={precheck ? '' : '先预检'}
          onClick={declare}
        >
          声明主销
        </button>
      </div>
      <input
        className="input"
        value={rationale}
        onChange={(e) => setRationale(e.target.value)}
        placeholder="为什么推它（必填——政策必须留下理由）"
        style={{ width: '100%', marginBottom: 8 }}
      />
      {precheck && (
        <div style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
          {(precheck.eligibility?.checks || []).map((c: any) => (
            <div key={c.id} className="t-sm" style={{ display: 'flex', gap: 8 }}>
              <span>{c.passed ? '✅' : '⛔'}</span>
              <span style={{ color: c.passed ? 'var(--t-secondary)' : 'var(--t-strong)' }}>
                {c.reason}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 生效清单 */}
      <AsyncBoundary
        status={statusOf(focusList.isLoading, focusList.error, rows.length === 0)}
        errorMessage="主销清单加载失败（需 API + 数据库）"
        onRetry={() => focusList.mutate()}
        emptyTitle="当前无生效中的主销声明"
        emptyDescription="声明须过三闸：毛利达标 + 非停产 + 有带证据的卖点。"
      >
        <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
          {rows.map((d: any) => (
            <div
              key={d.id}
              className="t-sm"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span>
                <span style={{ color: 'var(--t-strong)' }}>{d.sku || d.product_id}</span> ·{' '}
                {d.category} · {d.period_start}~{d.period_end}
                <span className="t-xs" style={{ color: 'var(--t-tertiary)', marginLeft: 8 }}>
                  {d.rationale}
                </span>
              </span>
              <button className="btn btn-outline btn-sm" onClick={() => revoke(d.id)}>
                撤销
              </button>
            </div>
          ))}
        </div>
      </AsyncBoundary>

      {/* 后验镜子 + 选题派生 */}
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button className="btn btn-outline" onClick={runMirror} disabled={mirrorLoading}>
          <Scale size={14} style={{ marginRight: 4 }} />
          {mirrorLoading ? '对照中…' : '后验镜子：声明 vs 渠道实况'}
        </button>
        <button className="btn btn-outline" onClick={() => deriveTopics(true)}>
          <ListTree size={14} style={{ marginRight: 4 }} />
          预览型号级 GEO 选题
        </button>
        <button className="btn btn-brand" onClick={() => deriveTopics(false)}>
          落库选题
        </button>
      </div>

      {mirror && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 8 }}>
          {(mirror.signals || []).length > 0 ? (
            <div style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
              {mirror.signals.map((s: any, i: number) => (
                <div key={i} className="t-sm" style={{ color: 'var(--t-strong)' }}>
                  ⚠️ {s.detail}
                </div>
              ))}
            </div>
          ) : (mirror.focus || []).length > 0 ? (
            <div className="t-sm" style={{ marginBottom: 8 }}>
              无分歧信号
            </div>
          ) : null}
          {(mirror.focus || []).map((f: any) => (
            <div key={f.sku} className="t-sm" style={{ padding: '4px 0' }}>
              主销 {f.sku} · 报价 {f.quotedQty} 台 / ¥{f.quotedAmount} · 成交 {f.signedQty} 台 / ¥
              {f.signedAmount}
            </div>
          ))}
          {(mirror.topNonFocus || []).length > 0 && (
            <div className="t-sm" style={{ color: 'var(--t-secondary)', padding: '4px 0' }}>
              渠道实际在报（非主销 Top）：
              {mirror.topNonFocus
                .slice(0, 5)
                .map((r: any) => `${r.sku} ${r.quotedQty}台`)
                .join(' · ')}
            </div>
          )}
          <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 6 }}>
            {mirror.unmatchedQuoteLines > 0 &&
              `另有 ${mirror.unmatchedQuoteLines} 行报价 SKU 无法匹配产品目录（不猜归属）。`}
            {mirror.note}
          </div>
        </div>
      )}

      {topics && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="t-sm" style={{ marginBottom: 6 }}>
            型号级选题 {topics.topics?.length ?? 0} 条{topics.dryRun ? '（预览未落库）' : `（新落库 ${topics.saved}）`}
            · 覆盖主销产品 {topics.focusProducts}
          </div>
          {(topics.topics || []).slice(0, 8).map((t: any, i: number) => (
            <div key={i} className="t-sm" style={{ padding: '2px 0' }}>
              <span style={{ color: 'var(--t-strong)' }}>{t.question}</span>
              <span className="t-xs" style={{ color: 'var(--t-tertiary)', marginLeft: 8 }}>
                {t.stage}/{t.intent} · priority {t.priority} · 主销权重 {t.factors?.focus ?? 0}
              </span>
            </div>
          ))}
          <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 6 }}>
            {topics.note}
          </div>
        </div>
      )}
    </div>
  );
}
