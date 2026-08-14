'use client';

/**
 * 市场洞察 · 竞品情报（Phase 2 重塑：shadcn 组件层 + 等宽数字 + 统一分区节奏）。
 * 数据逻辑与口径不动；空态/错误态仍由 AsyncBoundary 诚实呈现。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Radio, BarChart3, Newspaper } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { insight } from '../../lib/api';
import { useListView, exportCsv } from '../../lib/useListView';
import ListToolbar from '../../components/ListToolbar';
import { CompetitiveLandscapePanel } from '../../components/CompetitiveLandscapePanel';
import { CdpConnectionPanel } from '../../components/CdpConnectionPanel';
import { SectionCardHeader } from '../../components/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const CATEGORIES = [
  { code: 'central-hot-water', name: '中央热水' },
  { code: 'wall-hung-boiler', name: '壁挂炉' },
  { code: 'water-cooled-ac', name: '水机空调' },
];
const DIMENSIONS: Array<[string, string]> = [
  ['ai_sov', 'AI声量'],
  ['product', '产品'],
  ['price', '价格'],
  ['channel', '渠道'],
  ['marketing', '营销'],
];

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

export default function InsightPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState('central-hot-water');
  const [f, setF] = useState({ competitor: '', dimension: 'ai_sov', metric: 'AI声量', value: '' });

  const sov = useSWR(`insight:sov:${category}`, () => insight.sov(category));
  const records = useSWR(`insight:rec:${category}`, () => insight.listByCategory(category));
  const signals = useSWR(`insight:sig:${category}`, () => insight.listSignals({ category }));

  async function record() {
    if (!f.competitor) {
      toast('请填写竞品品牌', 'error');
      return;
    }
    try {
      await insight.recordCompetitor({
        category,
        competitor: f.competitor,
        dimension: f.dimension,
        metric: f.metric,
        value: Number(f.value) || undefined,
        source: 'manual',
      });
      setF({ ...f, competitor: '', value: '' });
      toast('已录入', 'success');
      sov.mutate();
      records.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const sovRows: any[] = sov.data?.shareOfVoice || [];
  const recRows: any[] = records.data?.records || [];
  const sigRows: any[] = signals.data?.signals || [];
  const iv = useListView(recRows, {
    pageSize: 14,
    searchFields: ['competitor', 'metric', 'valueText'],
    filters: [
      {
        key: 'dimension',
        label: '维度',
        options: DIMENSIONS.map(([value, label]) => ({ value, label })),
      },
    ],
  });

  return (
    <div className="page-container">
      <PageHeader
        title="市场洞察 · 竞品情报"
        subtitle="按品类跟踪竞品与 AI 声量份额(SoV) —— 看清中央热水/壁挂炉/水机空调竞争格局，剑指行业冠军"
      />

      <div className="mb-5 flex gap-2">
        {CATEGORIES.map((c) => (
          <Button
            key={c.code}
            size="sm"
            variant={category === c.code ? 'default' : 'outline'}
            onClick={() => setCategory(c.code)}
          >
            {c.name}
          </Button>
        ))}
      </div>

      {/* 竞争格局：集中度 + 动量 + 头部差距 + 威胁排序（GEO 探测时序派生） */}
      <div className="mb-5">
        <CompetitiveLandscapePanel category={category} />
      </div>

      <Card className="mb-5">
        <CardContent className="p-5">
          <SectionCardHeader icon={<BarChart3 size={16} />} title="AI 声量份额（SoV）" />
          <AsyncBoundary
            status={statusOf(sov.isLoading, sov.error, sovRows.length === 0)}
            errorMessage="SoV 加载失败（需 API + 数据库）"
            onRetry={() => sov.mutate()}
            emptyTitle="暂无 SoV 数据"
            emptyDescription="录入 dimension=ai_sov 的竞品声量值后，这里显示份额对比。"
          >
            <div className="grid gap-2.5">
              {sovRows.map((s) => (
                <div key={s.competitor}>
                  <div className="flex justify-between text-sm">
                    <span>{s.competitor}</span>
                    <span className="tabular-nums">{(s.share * 100).toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded bg-secondary">
                    <div
                      className="h-full rounded bg-primary transition-[width] duration-300"
                      style={{ width: `${s.share * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AsyncBoundary>
        </CardContent>
      </Card>

      <Card className="mb-5">
        <CardContent className="p-5">
          <SectionCardHeader icon={<Radio size={16} />} title="录入竞品情报" />
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              value={f.competitor}
              onChange={(e) => setF({ ...f, competitor: e.target.value })}
              placeholder="竞品品牌"
              className="w-36"
            />
            <select
              className="input"
              value={f.dimension}
              onChange={(e) => setF({ ...f, dimension: e.target.value })}
            >
              {DIMENSIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Input
              value={f.metric}
              onChange={(e) => setF({ ...f, metric: e.target.value })}
              placeholder="指标"
              className="w-32"
            />
            <Input
              value={f.value}
              onChange={(e) => setF({ ...f, value: e.target.value })}
              placeholder="值"
              type="number"
              className="w-24"
            />
            <Button onClick={record}>录入</Button>
          </div>
          <AsyncBoundary
            status={statusOf(records.isLoading, records.error, recRows.length === 0)}
            errorMessage="情报加载失败（需 API + 数据库）"
            onRetry={() => records.mutate()}
            emptyTitle="暂无竞品情报"
            emptyDescription="录入竞品的产品/价格/渠道/营销/AI声量维度指标。"
          >
            <ListToolbar
              q={iv.q}
              onSearch={iv.onSearch}
              searchPlaceholder="搜竞品/指标"
              filters={[
                {
                  key: 'dimension',
                  label: '维度',
                  options: DIMENSIONS.map(([value, label]) => ({ value, label })),
                },
              ]}
              filterVals={iv.filterVals}
              onFilter={iv.setFilter}
              total={iv.total}
              page={iv.page}
              pageCount={iv.pageCount}
              onPage={iv.setPage}
              onExport={() =>
                exportCsv(
                  iv.filtered,
                  [
                    { key: 'competitor', label: '竞品' },
                    { key: 'dimension', label: '维度' },
                    { key: 'metric', label: '指标' },
                    { key: 'value', label: '值' },
                    { key: 'valueText', label: '文本值' },
                  ],
                  `insight-${category}`
                )
              }
            />
            <div className="grid gap-1">
              {iv.pageRows.map((r) => (
                <div key={r.id} className="border-t py-1 text-xs text-muted-foreground">
                  {r.competitor} · {r.dimension} · {r.metric} ={' '}
                  <span className="tabular-nums">{r.value ?? r.valueText ?? '-'}</span>
                </div>
              ))}
            </div>
          </AsyncBoundary>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <SectionCardHeader icon={<Newspaper size={16} />} title="市场/行业信号" />
          <AsyncBoundary
            status={statusOf(signals.isLoading, signals.error, sigRows.length === 0)}
            errorMessage="信号加载失败（需 API + 数据库）"
            onRetry={() => signals.mutate()}
            emptyTitle="暂无信号"
            emptyDescription="宏观/行业/趋势/AI认知 信号将在此汇总。"
          >
            <div className="grid gap-1">
              {sigRows.slice(0, 12).map((s) => (
                <div key={s.id} className="flex items-center gap-2 border-t py-1.5 text-sm">
                  <Badge variant={s.severity === 'alert' ? 'destructive' : 'secondary'}>
                    {s.signalType}
                  </Badge>
                  {s.title}
                </div>
              ))}
            </div>
          </AsyncBoundary>
        </CardContent>
      </Card>

      <CdpConnectionPanel />
    </div>
  );
}
