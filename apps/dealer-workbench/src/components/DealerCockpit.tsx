'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, RefreshCw, TrendingUp, UserRound, Users } from 'lucide-react';
import { dealerCrm } from '../lib/api';

/**
 * 经销商专属工作台（P0 · 补"赋能客户"最大空缺）。
 * 经销商视角（非总部全网）：我的业绩 / 我的线索管道 / 我的客户 / 我的报价历史。
 * 全部连真数据：crm/pipeline · crm/customers · quotation。无数据显示空态。
 */

const STAGES = ['lead', 'contacted', 'proposal', 'negotiation', 'signed', 'lost'] as const;
const STAGE_LABEL: Record<string, string> = {
  lead: '新线索',
  contacted: '已联系',
  proposal: '方案中',
  negotiation: '谈判',
  signed: '已成交',
  lost: '流失',
};
/** 阶段色改语义类映射（原 CSS 变量内联色，2026-08 三期收编） */
const STAGE_TONE_CLASS: Record<string, string> = {
  lead: 'text-muted-foreground border-muted-foreground/40',
  contacted: 'text-primary border-primary/50',
  proposal: 'text-warning border-warning/50',
  negotiation: 'text-warning border-warning/50',
  signed: 'text-success border-success/50',
  lost: 'text-destructive border-destructive/50',
};
const yuan = (n: number) => `¥${(Number(n) || 0).toLocaleString('zh-CN')}`;
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—';

interface Opp {
  id: string;
  customerId: string;
  stage: string;
  estimatedValue: number;
  probability: number;
  nextActionAt: string | null;
  updatedAt: string;
  customer?: { name?: string; city?: string };
}
interface Customer {
  id: string;
  name: string;
  city: string | null;
  status: string;
  source: string | null;
  lastInteractionAt: string | null;
}
interface Quotation {
  id: string;
  quotationNo: string;
  status: string;
  customerId: string;
  createdAt: string;
  costBreakdown?: any;
}

export function DealerCockpit() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOpp, setBusyOpp] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, c, q] = await Promise.all([
        dealerCrm.pipeline(),
        dealerCrm.customers(),
        dealerCrm.quotations(),
      ]);
      setOpps((p?.items || p || []) as Opp[]);
      setCustomers((c?.items || c || []) as Customer[]);
      setQuotes((q?.items || q || []) as Quotation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = opps.length;
    const signed = opps.filter((o) => o.stage === 'signed').length;
    const active = opps.filter((o) => !['signed', 'lost'].includes(o.stage)).length;
    const pipeline = opps
      .filter((o) => !['signed', 'lost'].includes(o.stage))
      .reduce((s, o) => s + (Number(o.estimatedValue) || 0), 0);
    const closeRate = total ? Math.round((signed / total) * 100) : 0;
    return { total, signed, active, pipeline, closeRate };
  }, [opps]);

  const custName = (id: string) => customers.find((c) => c.id === id)?.name || id.slice(0, 8);

  const changeStage = async (opp: Opp, stage: string) => {
    setBusyOpp(opp.id);
    try {
      await dealerCrm.updateStage(opp.id, stage);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新阶段失败');
    } finally {
      setBusyOpp(null);
    }
  };

  const [exporting, setExporting] = useState<string | null>(null);
  const exportQuote = async (q: Quotation) => {
    setExporting(q.id);
    try {
      // 用报价真实数据在前端生成 CSV 下载（经销商自己的报价数据，不编造）。
      // 说明：后端 ExportEngine(quotation/export) 暂不可用，故前端直出；引擎修复后可切回服务端富格式。
      const items: any[] = Array.isArray((q as any).items) ? (q as any).items : [];
      const cost: any = (q as any).costBreakdown || {};
      const lines: string[] = [];
      lines.push(`报价单号,${q.quotationNo || q.id}`);
      lines.push(`客户,${custName(q.customerId)}`);
      lines.push(`状态,${q.status}`);
      lines.push(`日期,${fmtDate(q.createdAt)}`);
      lines.push('');
      lines.push('名称,型号,数量,单价');
      for (const it of items)
        lines.push(
          `${it.name ?? ''},${it.model ?? it.sku ?? ''},${it.quantity ?? 1},${it.price ?? it.unitPrice ?? ''}`
        );
      if (cost && (cost.total ?? cost.subtotal)) {
        lines.push('');
        lines.push(`小计,${cost.subtotal ?? ''}`);
        lines.push(`税,${cost.tax ?? ''}`);
        lines.push(`合计,${cost.total ?? ''}`);
      }
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `报价单-${q.quotationNo || q.id.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid gap-4">
      {/* 我的业绩 */}
      <section className="card-elevated grid gap-4 p-4.5">
        <div className="workbench-section-header">
          <div>
            <p className="workbench-section-header__eyebrow">经销商工作台 · 我的视角</p>
            <h2 className="workbench-section-header__title">我的业绩</h2>
            <p className="workbench-section-header__description">
              我的线索、客户与报价（本账号数据，非全网）。数据来自 CRM + 报价，真实无编造。
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
        <div className="g4 gap-3">
          <Stat icon={Users} label="活跃线索" value={String(stats.active)} />
          <Stat icon={TrendingUp} label="在途金额" value={yuan(stats.pipeline)} />
          <Stat icon={UserRound} label="我的客户" value={String(customers.length)} />
          <Stat
            icon={FileText}
            label="成交率"
            value={`${stats.closeRate}%`}
            tone={stats.closeRate >= 30 ? 'var(--success)' : undefined}
          />
        </div>
      </section>

      {/* 我的线索管道（可改阶段） */}
      <section className="card-elevated grid gap-3.5 p-4.5">
        <div className="workbench-section-header">
          <div>
            <p className="workbench-section-header__eyebrow">线索管道</p>
            <h2 className="workbench-section-header__title">我的线索（可推进阶段）</h2>
          </div>
        </div>
        <div className="table-shell">
          <table className="table">
            <thead>
              <tr>
                <th>客户</th>
                <th>阶段</th>
                <th>预估额</th>
                <th>赢率</th>
                <th>下次跟进</th>
                <th>推进</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((o) => (
                <tr key={o.id}>
                  <td className="font-bold">{o.customer?.name || custName(o.customerId)}</td>
                  <td>
                    <span className={`badge ${STAGE_TONE_CLASS[o.stage] || ''}`}>
                      {STAGE_LABEL[o.stage] || o.stage}
                    </span>
                  </td>
                  <td>{yuan(o.estimatedValue)}</td>
                  <td>{o.probability ? `${o.probability}%` : '—'}</td>
                  <td>{fmtDate(o.nextActionAt || undefined)}</td>
                  <td>
                    <select
                      value={o.stage}
                      disabled={busyOpp === o.id}
                      onChange={(e) => changeStage(o, e.target.value)}
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                    >
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!opps.length ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center text-muted-foreground/80"
                  >
                    {loading ? '加载中…' : '暂无线索。总部转派或官网询盘进来后在此跟进。'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* 我的客户 + 报价历史 */}
      <div className="g2 grid grid-cols-2 gap-4">
        <section className="card-elevated grid gap-3 p-4.5">
          <div className="workbench-section-header">
            <div>
              <h2 className="workbench-section-header__title text-base">
                我的客户
              </h2>
            </div>
          </div>
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>客户</th>
                  <th>城市</th>
                  <th>来源</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {customers.slice(0, 12).map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.name}</td>
                    <td>{c.city || '—'}</td>
                    <td>{c.source || '—'}</td>
                    <td>
                      <span className="badge">{c.status}</span>
                    </td>
                  </tr>
                ))}
                {!customers.length ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-5 text-center text-muted-foreground/80"
                    >
                      暂无客户
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-elevated grid gap-3 p-4.5">
          <div className="workbench-section-header">
            <div>
              <h2 className="workbench-section-header__title text-base">
                我的报价历史
              </h2>
            </div>
          </div>
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>报价单号</th>
                  <th>客户</th>
                  <th>状态</th>
                  <th>时间</th>
                  <th>导出</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="font-bold">{q.quotationNo || q.id.slice(0, 8)}</td>
                    <td>{custName(q.customerId)}</td>
                    <td>
                      <span className="badge">{q.status}</span>
                    </td>
                    <td>{fmtDate(q.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => exportQuote(q)}
                        disabled={exporting === q.id}
                      >
                        {exporting === q.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Download size={13} />
                        )}
                        导出
                      </button>
                    </td>
                  </tr>
                ))}
                {!quotes.length ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="p-5 text-center text-muted-foreground/80"
                    >
                      暂无报价。在售前工作台生成报价后在此归档。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <article className="inset p-3.5">
      <div className="flex items-center justify-between">
        <span className="t-label">{label}</span>
        <Icon size={15} style={{ color: tone || 'var(--brand)' }} />
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 24,
          fontWeight: 800,
          color: tone || 'var(--t-strong)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </article>
  );
}
