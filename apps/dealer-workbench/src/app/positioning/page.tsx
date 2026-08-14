'use client';

/**
 * 品牌定位 Messaging House（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排：左 2/3 = 定位屋清单主工作区（工具栏 + 卡片列表）；右 1/3 = 编辑定位屋表单列。
 * 原版编辑表单全宽压在清单上方、19 处内联样式；支柱签改 Pill，状态改软标签。
 */
import { useState } from 'react';
import useSWR from 'swr';
import { Landmark, Layers3 } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { WorkspaceSection, Pill } from '@/components/WorkspaceKit';
import { positioning } from '../../lib/api';
import { useListView, exportCsv } from '../../lib/useListView';
import ListToolbar from '../../components/ListToolbar';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

export default function PositioningPage() {
  const { toast } = useToast();
  const houses = useSWR('positioning:houses', () => positioning.listHouses());
  const [f, setF] = useState({
    brandCode: 'rheem',
    category: 'central-hot-water',
    promise: '',
    pillars: '',
    proof: '',
  });

  async function save() {
    if (!f.brandCode || !f.category) {
      toast('品牌与品类必填', 'error');
      return;
    }
    try {
      const pillars = f.pillars
        .split('\n')
        .filter(Boolean)
        .map((t) => ({ title: t.trim() }));
      const proofPoints = f.proof
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [claim, evidence] = line.split('|');
          return { claim: claim?.trim(), evidence: evidence?.trim() };
        });
      const r = await positioning.upsertHouse({
        brandCode: f.brandCode,
        category: f.category,
        promise: f.promise,
        pillars,
        proofPoints,
      });
      toast(
        r.evidenceMissing
          ? `已保存（${r.evidenceMissing} 条信任状缺事实依据，基座4建议补 evidence）`
          : '定位屋已保存',
        r.evidenceMissing ? 'info' : 'success'
      );
      houses.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function approve(id: string) {
    try {
      await positioning.setStatus(id, 'approved');
      toast('已批准', 'success');
      houses.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const rows: any[] = houses.data?.houses || [];
  const hv = useListView(rows, {
    pageSize: 12,
    searchFields: ['brandCode', 'category', 'promise'],
    filters: [
      {
        key: 'status',
        label: '状态',
        options: [
          ['draft', '草稿'],
          ['approved', '已批准'],
          ['archived', '已归档'],
        ].map(([value, label]) => ({ value, label })),
      },
    ],
  });

  return (
    <div className="page-container">
      <PageHeader
        title="品牌定位 · Messaging House"
        subtitle="每个 品牌×品类 的定位话术弹药：核心承诺 / 价值支柱 / 信任状(事实依据) / 竞品差异 —— 喂 AgenticGEO 与内容，决定“凭什么被 AI 首选”"
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {/* ── 左 2/3：定位屋清单主工作区 ─────────────────────── */}
        <div className="lg:col-span-2">
          <WorkspaceSection
            icon={<Layers3 size={16} />}
            title="定位屋清单"
            aside={`共 ${rows.length} 个`}
          >
            <AsyncBoundary
              status={statusOf(houses.isLoading, houses.error, rows.length === 0)}
              errorMessage="定位屋加载失败（需 API + 数据库）"
              onRetry={() => houses.mutate()}
              emptyTitle="暂无定位屋"
              emptyDescription="为品牌×品类建立定位屋后，AgenticGEO 与内容工厂将据此生成话术。"
            >
              <ListToolbar
                q={hv.q}
                onSearch={hv.onSearch}
                searchPlaceholder="搜品牌/品类/承诺"
                filters={[
                  {
                    key: 'status',
                    label: '状态',
                    options: [
                      ['draft', '草稿'],
                      ['approved', '已批准'],
                      ['archived', '已归档'],
                    ].map(([value, label]) => ({ value, label })),
                  },
                ]}
                filterVals={hv.filterVals}
                onFilter={hv.setFilter}
                total={hv.total}
                page={hv.page}
                pageCount={hv.pageCount}
                onPage={hv.setPage}
                onExport={() =>
                  exportCsv(
                    hv.filtered,
                    [
                      { key: 'brandCode', label: '品牌' },
                      { key: 'category', label: '品类' },
                      { key: 'promise', label: '核心承诺' },
                      { key: 'status', label: '状态' },
                    ],
                    'positioning-houses'
                  )
                }
              />
              <div className="grid gap-2.5">
                {hv.pageRows.map((hh) => (
                  <div
                    key={hh.id}
                    className="rounded-lg border p-3.5 transition-colors duration-150 hover:bg-secondary/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold">
                        {hh.brandCode} · {hh.category}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-muted-foreground/80">{hh.status}</span>
                        {hh.status === 'draft' && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => approve(hh.id)}
                          >
                            批准
                          </button>
                        )}
                      </span>
                    </div>
                    {hh.promise && (
                      <p className="my-2 text-[13px] text-muted-foreground">{hh.promise}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(hh.pillars || []).map((p: any, i: number) => (
                        <Pill key={i}>{p.title}</Pill>
                      ))}
                    </div>
                    {(hh.proofPoints || []).length > 0 && (
                      <ul className="mt-2.5 list-disc pl-4 text-xs text-muted-foreground/80">
                        {(hh.proofPoints || []).map((p: any, i: number) => (
                          <li key={i}>
                            {p.claim}
                            {p.evidence ? ` — 依据：${p.evidence}` : ' ⚠️缺依据'}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </AsyncBoundary>
          </WorkspaceSection>
        </div>

        {/* ── 右 1/3：编辑定位屋表单列 ──────────────────────── */}
        <WorkspaceSection icon={<Landmark size={16} />} title="编辑定位屋">
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input"
                value={f.brandCode}
                onChange={(e) => setF({ ...f, brandCode: e.target.value })}
                placeholder="品牌 rheem"
              />
              <input
                className="input"
                value={f.category}
                onChange={(e) => setF({ ...f, category: e.target.value })}
                placeholder="品类 central-hot-water"
              />
            </div>
            <input
              className="input w-full"
              value={f.promise}
              onChange={(e) => setF({ ...f, promise: e.target.value })}
              placeholder="核心承诺（一句话定位）"
            />
            <textarea
              className="textarea min-h-16"
              value={f.pillars}
              onChange={(e) => setF({ ...f, pillars: e.target.value })}
              placeholder="价值支柱（每行一条）"
            />
            <textarea
              className="textarea min-h-16"
              value={f.proof}
              onChange={(e) => setF({ ...f, proof: e.target.value })}
              placeholder="信任状（每行：主张|事实依据，如 出水恒温±0.5℃|国标GB xxxx）"
            />
            <button className="btn btn-brand mt-1" onClick={save}>
              保存草稿
            </button>
          </div>
        </WorkspaceSection>
      </div>
    </div>
  );
}
