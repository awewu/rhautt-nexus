'use client';

/**
 * 活动运营页（2026-08 全页 UX 重构二期 · WorkspaceKit 化）。
 * 信息架构：左 2/3 = 活动清单主工作区（工具栏 + 行卡）；右 1/3 = 新建活动表单。
 * 原版问题：12 处内联样式、全宽单列卡叠放；本版收编为 Tailwind + WorkspaceKit 原语。
 * 2026-08 内容生产台范式对齐：页首任务 Hero（活动总数/进行中/裂变盘子等真实计数）+
 * 活动类型流水线（点击即接活动清单既有类型筛选），API 调用不动。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { ListChecks, Zap, Ticket, Users, Timer, Share2, UserPlus } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { WorkspaceSection, WorkQueueHero, PipelineStages } from '@/components/WorkspaceKit';
import { activation } from '../../lib/api';
import { useListView, exportCsv } from '../../lib/useListView';
import ListToolbar from '../../components/ListToolbar';

const TYPES: Array<[string, string]> = [
  ['coupon', '优惠券'],
  ['groupon', '拼团'],
  ['flashsale', '秒杀'],
  ['fission', '裂变'],
  ['referral', '转介绍'],
];
const TYPE_STAGES = [
  { key: 'coupon', label: '优惠券', hint: '促成交的价格钩子', icon: Ticket, tone: 'neutral' as const },
  { key: 'groupon', label: '拼团', hint: '拉人成团的社交转化', icon: Users, tone: 'info' as const },
  { key: 'flashsale', label: '秒杀', hint: '限时冲量清库存', icon: Timer, tone: 'warning' as const },
  { key: 'fission', label: '裂变', hint: '老带新，线索计入飞轮', icon: Share2, tone: 'brand' as const },
  { key: 'referral', label: '转介绍', hint: '转介线索回流归因', icon: UserPlus, tone: 'success' as const },
];
const NEXT: Record<string, string> = { draft: 'running', running: 'paused', paused: 'running' };
function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

export default function ActivationPage() {
  const { toast } = useToast();
  const list = useSWR('activation:list', () => activation.list());
  const [f, setF] = useState({ name: '', type: 'coupon', budget: '' });

  async function create() {
    if (!f.name) {
      toast('请填写活动名称', 'error');
      return;
    }
    try {
      await activation.create({ name: f.name, type: f.type, budget: Number(f.budget) || 0 });
      setF({ name: '', type: 'coupon', budget: '' });
      toast('活动已创建', 'success');
      list.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function toggle(id: string, status: string) {
    try {
      await activation.setStatus(id, NEXT[status] || 'ended');
      list.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const rows: any[] = list.data?.activities || [];
  const av = useListView(rows, {
    searchFields: ['name', 'type'],
    filters: [
      { key: 'type', label: '类型', options: TYPES.map(([value, label]) => ({ value, label })) },
      {
        key: 'status',
        label: '状态',
        options: [
          ['draft', '草稿'],
          ['running', '进行中'],
          ['paused', '暂停'],
          ['ended', '结束'],
        ].map(([value, label]) => ({ value, label })),
      },
    ],
  });

  return (
    <div className="page-container">
      <PageHeader
        title="活动运营"
        subtitle="优惠券 · 拼团 · 秒杀 · 裂变 · 转介绍 —— 裂变/转介绍带来的线索计入线索飞轮"
      />

      <div className="mb-4">
        <WorkQueueHero
          title="今天要跑哪些活动"
          desc="先盯进行中的活动启停与预算，再看裂变/转介绍的线索回流是否进飞轮。"
          metrics={[
            { value: rows.length, label: '活动' },
            { value: rows.filter((a) => a.status === 'running').length, label: '进行中' },
            {
              value: rows.filter((a) => a.type === 'fission' || a.type === 'referral').length,
              label: '裂变/转介绍',
            },
            {
              value: rows.reduce((sum, a) => sum + Number(a.metrics?.referredLeads ?? 0), 0),
              label: '转介线索',
            },
          ]}
        />
      </div>
      <div className="mb-4">
        <PipelineStages
          label="活动类型流水线"
          stages={TYPE_STAGES.map((s) => {
            const Icon = s.icon;
            return {
              key: s.key,
              label: s.label,
              hint: s.hint,
              value: rows.filter((a) => a.type === s.key).length,
              icon: <Icon size={16} />,
              tone: s.tone,
              active: av.filterVals.type === s.key,
              onClick: () => av.setFilter('type', av.filterVals.type === s.key ? '' : s.key),
            };
          })}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* ── 左 2/3：活动清单主工作区 ─────────────────────────── */}
        <WorkspaceSection
          icon={<ListChecks size={16} />}
          title="活动清单"
          aside={`共 ${rows.length} 个活动`}
          className="lg:col-span-2"
        >
          <AsyncBoundary
            status={statusOf(list.isLoading, list.error, rows.length === 0)}
            errorMessage="活动加载失败（需 API + 数据库）"
            onRetry={() => list.mutate()}
            emptyTitle="暂无活动"
            emptyDescription="创建促销/裂变活动后可启停，并统计转介绍带来的线索。"
          >
            <ListToolbar
              q={av.q}
              onSearch={av.onSearch}
              searchPlaceholder="搜活动名/类型"
              filters={[
                {
                  key: 'type',
                  label: '类型',
                  options: TYPES.map(([value, label]) => ({ value, label })),
                },
                {
                  key: 'status',
                  label: '状态',
                  options: [
                    ['draft', '草稿'],
                    ['running', '进行中'],
                    ['paused', '暂停'],
                    ['ended', '结束'],
                  ].map(([value, label]) => ({ value, label })),
                },
              ]}
              filterVals={av.filterVals}
              onFilter={av.setFilter}
              total={av.total}
              page={av.page}
              pageCount={av.pageCount}
              onPage={av.setPage}
              onExport={() =>
                exportCsv(
                  av.filtered,
                  [
                    { key: 'name', label: '名称' },
                    { key: 'type', label: '类型' },
                    { key: 'budget', label: '预算' },
                    { key: 'status', label: '状态' },
                  ],
                  'activation'
                )
              }
            />
            <div className="grid gap-1.5">
              {av.pageRows.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150 hover:bg-secondary/50"
                >
                  <span className="min-w-0 truncate text-[13px]">
                    <span className="font-semibold text-foreground">{a.name}</span>{' '}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      · {(TYPES.find((t) => t[0] === a.type) || [])[1] || a.type} · 预算¥{a.budget}{' '}
                      · 转介线索 {a.metrics?.referredLeads ?? 0}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{a.status}</span>
                    {a.status !== 'ended' && (
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => toggle(a.id, a.status)}
                      >
                        {a.status === 'running' ? '暂停' : '启动'}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </AsyncBoundary>
        </WorkspaceSection>

        {/* ── 右 1/3：新建活动 ─────────────────────────────────── */}
        <WorkspaceSection icon={<Zap size={16} />} title="新建活动">
          <div className="grid gap-2">
            <input
              className="input"
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
              placeholder="活动名称"
            />
            <select
              className="input"
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
            >
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={f.budget}
              onChange={(e) => setF({ ...f, budget: e.target.value })}
              placeholder="预算"
              type="number"
            />
            <button className="btn btn-brand" onClick={create}>
              新建
            </button>
          </div>
        </WorkspaceSection>
      </div>
    </div>
  );
}
