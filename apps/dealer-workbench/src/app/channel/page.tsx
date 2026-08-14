'use client';

/**
 * 渠道与伙伴营销（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排思路：顶部 4 格渠道健康 KPI（StatCard），下方 lg 双列并排
 * 「招募/分层认证」与「返利审批·毛利闸」两大工作区，消灭全宽单列叠放；30 处内联样式清零。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Store, Gift } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { WorkspaceSection } from '@/components/WorkspaceKit';
import { StatCard } from '@/components/StatCard';
import { channel } from '../../lib/api';
import { useListView, exportCsv } from '../../lib/useListView';
import ListToolbar from '../../components/ListToolbar';
import { DispatchDecisionsPanel } from '../../components/DispatchDecisionsPanel';
import { DiagnosisReportsPanel } from '../../components/DiagnosisReportsPanel';

const TIERS = ['prospect', 'bronze', 'silver', 'gold', 'platinum'];
const NEXT: Record<string, string> = { draft: 'running', running: 'paused', paused: 'running' };
function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}
const yuan = (n: number) => `¥${(Number(n) || 0).toLocaleString('zh-CN')}`;

export default function ChannelPage() {
  const { toast } = useToast();
  const partners = useSWR('channel:partners', () => channel.listPartners());
  const rebates = useSWR('channel:rebates', () => channel.listRebates());
  const health = useSWR('channel:health', () => channel.health());
  const [nw, setNw] = useState({ code: '', name: '', region: '' });
  const [rb, setRb] = useState({
    partnerId: '',
    period: '',
    basis: 'gmv',
    amount: '',
    gmv: '',
    baseMarginRate: '',
  });

  async function recruit() {
    if (!nw.code || !nw.name) {
      toast('编码与名称必填', 'error');
      return;
    }
    try {
      await channel.recruit(nw);
      setNw({ code: '', name: '', region: '' });
      toast('经销商已招募', 'success');
      partners.mutate();
      health.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function patch(id: string, p: Record<string, unknown>) {
    try {
      await channel.updatePartner(id, p);
      partners.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function submitRebate() {
    try {
      const r = await channel.submitRebate({
        partnerId: rb.partnerId || undefined,
        period: rb.period,
        basis: rb.basis,
        amount: Number(rb.amount),
        gmv: Number(rb.gmv),
        baseMarginRate: Number(rb.baseMarginRate),
      });
      toast(r.warning ? r.warning : '返利已提报（毛利闸通过）', r.warning ? 'info' : 'success');
      rebates.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function decide(id: string, d: string) {
    try {
      await channel.decideRebate(id, d);
      toast(`返利已${d === 'approved' ? '批准' : d === 'paid' ? '标记支付' : '驳回'}`, 'success');
      rebates.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const pRows: any[] = partners.data?.partners || [];
  const rRows: any[] = rebates.data?.rebates || [];
  const hh = health.data;

  const pv = useListView(pRows, {
    searchFields: ['name', 'code', 'region'],
    filters: [
      {
        key: 'status',
        label: '状态',
        options: [
          ['recruiting', '招募中'],
          ['active', '活跃'],
          ['suspended', '停用'],
        ].map(([value, label]) => ({ value, label })),
      },
      { key: 'tier', label: '层级', options: TIERS.map((t) => ({ value: t, label: t })) },
    ],
  });
  const rv = useListView(rRows, {
    searchFields: ['period', 'basis'],
    filters: [
      {
        key: 'status',
        label: '状态',
        options: [
          ['submitted', '待审'],
          ['approved', '已批'],
          ['rejected', '已驳'],
          ['paid', '已付'],
        ].map(([value, label]) => ({ value, label })),
      },
    ],
  });

  return (
    <div className="page-container">
      <PageHeader
        title="渠道与伙伴营销"
        subtitle="招募 · 分层认证 · 返利(毛利闸·基座3) · 绩效 —— 经销商网络扩张驱动销售倍增"
      />

      <AsyncBoundary
        status={statusOf(health.isLoading, health.error, false)}
        errorMessage="渠道健康加载失败（需 API + 数据库）"
        onRetry={() => health.mutate()}
      >
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="经销商总数" value={hh?.partners ?? 0} emphasis />
          <StatCard label="活跃" value={hh?.active ?? 0} />
          <StatCard label="活跃盈利" value={hh?.activeProfitable ?? 0} />
          <StatCard label="网络 GMV" value={yuan(hh?.networkGmv ?? 0)} />
        </div>
      </AsyncBoundary>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <WorkspaceSection icon={<Store size={16} />} title="招募 / 分层认证">
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              className="input w-32"
              value={nw.code}
              onChange={(e) => setNw({ ...nw, code: e.target.value })}
              placeholder="编码"
            />
            <input
              className="input min-w-32 flex-1"
              value={nw.name}
              onChange={(e) => setNw({ ...nw, name: e.target.value })}
              placeholder="名称"
            />
            <input
              className="input w-32"
              value={nw.region}
              onChange={(e) => setNw({ ...nw, region: e.target.value })}
              placeholder="区域"
            />
            <button className="btn btn-brand" onClick={recruit}>
              招募
            </button>
          </div>
          <AsyncBoundary
            status={statusOf(partners.isLoading, partners.error, pRows.length === 0)}
            errorMessage="经销商加载失败（需 API + 数据库）"
            onRetry={() => partners.mutate()}
            emptyTitle="暂无经销商"
            emptyDescription="招募经销商后可分层认证并发放返利。"
          >
            <ListToolbar
              q={pv.q}
              onSearch={pv.onSearch}
              searchPlaceholder="搜名称/编码/区域"
              filters={[
                {
                  key: 'status',
                  label: '状态',
                  options: [
                    ['recruiting', '招募中'],
                    ['active', '活跃'],
                    ['suspended', '停用'],
                  ].map(([value, label]) => ({ value, label })),
                },
                { key: 'tier', label: '层级', options: TIERS.map((t) => ({ value: t, label: t })) },
              ]}
              filterVals={pv.filterVals}
              onFilter={pv.setFilter}
              total={pv.total}
              page={pv.page}
              pageCount={pv.pageCount}
              onPage={pv.setPage}
              onExport={() =>
                exportCsv(
                  pv.filtered,
                  [
                    { key: 'code', label: '编码' },
                    { key: 'name', label: '名称' },
                    { key: 'region', label: '区域' },
                    { key: 'tier', label: '层级' },
                    { key: 'status', label: '状态' },
                    { key: 'certified', label: '认证' },
                  ],
                  'channel-partners'
                )
              }
            />
            <div className="grid gap-1.5">
              {pv.pageRows.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0"
                >
                  <span className="min-w-0 truncate text-[13px]">
                    {p.name}{' '}
                    <span className="text-xs text-muted-foreground">
                      · {p.region || '-'} · {p.status}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <select
                      className="input min-h-8 px-2 py-1"
                      value={p.tier}
                      onChange={(e) => patch(p.id, { tier: e.target.value })}
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={!!p.certified}
                        onChange={(e) => patch(p.id, { certified: e.target.checked })}
                      />{' '}
                      认证
                    </label>
                  </span>
                </div>
              ))}
            </div>
          </AsyncBoundary>
        </WorkspaceSection>

        <WorkspaceSection icon={<Gift size={16} />} title="返利审批 · 毛利闸">
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
            <input
              className="input"
              value={rb.partnerId}
              onChange={(e) => setRb({ ...rb, partnerId: e.target.value })}
              placeholder="经销商ID(可空)"
            />
            <input
              className="input"
              value={rb.period}
              onChange={(e) => setRb({ ...rb, period: e.target.value })}
              placeholder="周期 2026Q1"
            />
            <select
              className="input"
              value={rb.basis}
              onChange={(e) => setRb({ ...rb, basis: e.target.value })}
            >
              <option value="gmv">GMV</option>
              <option value="sell_through">动销</option>
              <option value="coop">Co-op</option>
            </select>
            <input
              className="input"
              value={rb.amount}
              onChange={(e) => setRb({ ...rb, amount: e.target.value })}
              placeholder="返利额"
              type="number"
            />
            <input
              className="input"
              value={rb.gmv}
              onChange={(e) => setRb({ ...rb, gmv: e.target.value })}
              placeholder="GMV"
              type="number"
            />
            <input
              className="input"
              value={rb.baseMarginRate}
              onChange={(e) => setRb({ ...rb, baseMarginRate: e.target.value })}
              placeholder="返前毛利率0.2"
              type="number"
            />
            <button className="btn btn-brand col-span-2 md:col-span-3" onClick={submitRebate}>
              提报
            </button>
          </div>
          <AsyncBoundary
            status={statusOf(rebates.isLoading, rebates.error, rRows.length === 0)}
            errorMessage="返利加载失败（需 API + 数据库）"
            onRetry={() => rebates.mutate()}
            emptyTitle="暂无返利政策"
            emptyDescription="提报返利将自动过毛利闸（净毛利低于阈值阻断批准）。"
          >
            <ListToolbar
              q={rv.q}
              onSearch={rv.onSearch}
              searchPlaceholder="搜周期/依据"
              filters={[
                {
                  key: 'status',
                  label: '状态',
                  options: [
                    ['submitted', '待审'],
                    ['approved', '已批'],
                    ['rejected', '已驳'],
                    ['paid', '已付'],
                  ].map(([value, label]) => ({ value, label })),
                },
              ]}
              filterVals={rv.filterVals}
              onFilter={rv.setFilter}
              total={rv.total}
              page={rv.page}
              pageCount={rv.pageCount}
              onPage={rv.setPage}
              onExport={() =>
                exportCsv(
                  rv.filtered,
                  [
                    { key: 'period', label: '周期' },
                    { key: 'basis', label: '依据' },
                    { key: 'amount', label: '返利额' },
                    { key: 'status', label: '状态' },
                  ],
                  'channel-rebates'
                )
              }
            />
            <div className="grid gap-1.5">
              {rv.pageRows.map((r) => {
                const gate = (r.marginCalc || {}).gatePassed;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0"
                  >
                    <span className="min-w-0 truncate text-[13px] tabular-nums">
                      {r.period} · {r.basis} · {yuan(r.amount)} · 净毛利{' '}
                      {((r.marginCalc?.netMarginRate || 0) * 100).toFixed(1)}% {gate ? '✅' : '⛔'}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">{r.status}</span>
                      {r.status === 'submitted' && (
                        <>
                          <button
                            className="btn btn-outline btn-sm"
                            disabled={!gate}
                            title={gate ? '' : '毛利闸未过'}
                            onClick={() => decide(r.id, 'approved')}
                          >
                            批准
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => decide(r.id, 'rejected')}
                          >
                            驳回
                          </button>
                        </>
                      )}
                      {r.status === 'approved' && (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => decide(r.id, 'paid')}
                        >
                          标记已付
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </AsyncBoundary>
        </WorkspaceSection>
      </div>
      <DispatchDecisionsPanel />
      <DiagnosisReportsPanel />
    </div>
  );
}
