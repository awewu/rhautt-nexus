'use client';

/**
 * 战役 · 预算 MROI · OKR（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排思路：顶部 5 格 MROI KPI（StatCard），下方 lg 双列并排
 * 「战役/预算」与「OKR 三级」两大工作区；OKR 进度统一 ProgressStat；26 处内联样式清零。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Coins, Target } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { WorkspaceSection, ProgressStat } from '@/components/WorkspaceKit';
import { StatCard } from '@/components/StatCard';
import { gtmplan } from '../../lib/api';
import { useListView, exportCsv } from '../../lib/useListView';
import ListToolbar from '../../components/ListToolbar';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}
const yuan = (n: number) => `¥${(Number(n) || 0).toLocaleString('zh-CN')}`;

export default function GtmPage() {
  const { toast } = useToast();
  const mroi = useSWR('gtm:mroi', () => gtmplan.mroi());
  const campaigns = useSWR('gtm:campaigns', () => gtmplan.listCampaigns());
  const okrs = useSWR('gtm:okrs', () => gtmplan.listOkrs());
  const okrSum = useSWR('gtm:okrsum', () => gtmplan.okrSummary());
  const [nc, setNc] = useState({ name: '', budget: '', period: '' });
  const [no, setNo] = useState({ level: 'group', objective: '', progress: '' });

  async function addCampaign() {
    if (!nc.name) {
      toast('请填写战役名称', 'error');
      return;
    }
    try {
      await gtmplan.createCampaign({
        name: nc.name,
        budget: Number(nc.budget) || 0,
        period: nc.period,
      });
      setNc({ name: '', budget: '', period: '' });
      toast('战役已创建', 'success');
      campaigns.mutate();
      mroi.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function addOkr() {
    if (!no.objective) {
      toast('请填写目标', 'error');
      return;
    }
    try {
      await gtmplan.upsertOkr({
        level: no.level,
        objective: no.objective,
        progress: Number(no.progress) || 0,
      });
      setNo({ level: 'group', objective: '', progress: '' });
      toast('OKR 已创建', 'success');
      okrs.mutate();
      okrSum.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const m = mroi.data;
  const cRows: any[] = campaigns.data?.campaigns || [];
  const oRows: any[] = okrs.data?.okrs || [];
  const cv = useListView(cRows, {
    pageSize: 15,
    searchFields: ['name', 'period'],
    filters: [
      {
        key: 'status',
        label: '状态',
        options: [
          ['planned', '计划'],
          ['running', '进行'],
          ['ended', '结束'],
        ].map(([value, label]) => ({ value, label })),
      },
    ],
  });
  const sum = okrSum.data?.byLevel || [];

  return (
    <div className="page-container">
      <PageHeader
        title="战役 · 预算 MROI · OKR"
        subtitle="营销战役预算/花费/归因收入 → MROI；集团→事业部→职能 三级 OKR"
      />

      <AsyncBoundary
        status={statusOf(mroi.isLoading, mroi.error, false)}
        errorMessage="MROI 加载失败（需 API + 数据库）"
        onRetry={() => mroi.mutate()}
      >
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="战役数" value={m?.campaigns ?? 0} />
          <StatCard label="预算" value={yuan(m?.budget ?? 0)} />
          <StatCard label="花费" value={yuan(m?.spend ?? 0)} />
          <StatCard label="归因收入" value={yuan(m?.attributedRevenue ?? 0)} />
          <StatCard label="MROI" value={m?.mroi != null ? `${m.mroi.toFixed(2)}×` : '—'} emphasis />
        </div>
      </AsyncBoundary>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <WorkspaceSection icon={<Coins size={16} />} title="战役 / 预算">
          <div className="mb-4 flex flex-wrap gap-2">
            <input
              className="input min-w-32 flex-1"
              value={nc.name}
              onChange={(e) => setNc({ ...nc, name: e.target.value })}
              placeholder="战役名称"
            />
            <input
              className="input w-28"
              value={nc.budget}
              onChange={(e) => setNc({ ...nc, budget: e.target.value })}
              placeholder="预算"
              type="number"
            />
            <input
              className="input w-28"
              value={nc.period}
              onChange={(e) => setNc({ ...nc, period: e.target.value })}
              placeholder="周期"
            />
            <button className="btn btn-brand" onClick={addCampaign}>
              新建
            </button>
          </div>
          <AsyncBoundary
            status={statusOf(campaigns.isLoading, campaigns.error, cRows.length === 0)}
            errorMessage="战役加载失败（需 API + 数据库）"
            onRetry={() => campaigns.mutate()}
            emptyTitle="暂无战役"
            emptyDescription="创建战役后可记录花费与归因收入，自动汇总 MROI。"
          >
            <ListToolbar
              q={cv.q}
              onSearch={cv.onSearch}
              searchPlaceholder="搜战役/周期"
              filters={[
                {
                  key: 'status',
                  label: '状态',
                  options: [
                    ['planned', '计划'],
                    ['running', '进行'],
                    ['ended', '结束'],
                  ].map(([value, label]) => ({ value, label })),
                },
              ]}
              filterVals={cv.filterVals}
              onFilter={cv.setFilter}
              total={cv.total}
              page={cv.page}
              pageCount={cv.pageCount}
              onPage={cv.setPage}
              onExport={() =>
                exportCsv(
                  cv.filtered,
                  [
                    { key: 'name', label: '战役' },
                    { key: 'period', label: '周期' },
                    { key: 'budget', label: '预算' },
                    { key: 'spend', label: '花费' },
                    { key: 'attributedRevenue', label: '归因收入' },
                    { key: 'status', label: '状态' },
                  ],
                  'gtm-campaigns'
                )
              }
            />
            <div className="grid gap-1">
              {cv.pageRows.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 border-t py-1.5 text-[13px] first:border-t-0"
                >
                  <span className="min-w-0 truncate">
                    {c.name} · {c.period || '-'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    预算{yuan(c.budget)} · 花{yuan(c.spend)} · 收入{yuan(c.attributedRevenue)}
                  </span>
                </div>
              ))}
            </div>
          </AsyncBoundary>
        </WorkspaceSection>

        <WorkspaceSection
          icon={<Target size={16} />}
          title="OKR（三级）"
          aside={
            sum.length > 0
              ? sum.map((b: any) => `${b.level} ${(b.avgProgress * 100).toFixed(0)}%`).join(' · ')
              : undefined
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <select
              className="input"
              value={no.level}
              onChange={(e) => setNo({ ...no, level: e.target.value })}
            >
              <option value="group">集团</option>
              <option value="business_unit">事业部</option>
              <option value="function">职能</option>
            </select>
            <input
              className="input min-w-32 flex-1"
              value={no.objective}
              onChange={(e) => setNo({ ...no, objective: e.target.value })}
              placeholder="目标 Objective"
            />
            <input
              className="input w-24"
              value={no.progress}
              onChange={(e) => setNo({ ...no, progress: e.target.value })}
              placeholder="进度0-1"
              type="number"
              step="0.1"
            />
            <button className="btn btn-brand" onClick={addOkr}>
              新建
            </button>
          </div>
          <AsyncBoundary
            status={statusOf(okrs.isLoading, okrs.error, oRows.length === 0)}
            errorMessage="OKR 加载失败（需 API + 数据库）"
            onRetry={() => okrs.mutate()}
            emptyTitle="暂无 OKR"
            emptyDescription="建立集团→事业部→职能三级目标，进度自动汇总到驾驶舱。"
          >
            <div className="grid gap-2">
              {oRows.map((o) => (
                <ProgressStat
                  key={o.id}
                  label={`[${o.level}] ${o.objective}`}
                  percent={Math.round(Math.min(o.progress * 100, 100))}
                />
              ))}
            </div>
          </AsyncBoundary>
        </WorkspaceSection>
      </div>
    </div>
  );
}
