'use client';

/** 2026-08 全页 UX 重构二期 · WorkspaceKit 化 */

import { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  Loader2,
  RefreshCw,
  Shield,
  Swords,
  Target,
  TrendingDown,
} from 'lucide-react';
import { WorkspaceSection, EmptyState } from '@/components/WorkspaceKit';
import { growthGeo } from '../lib/api';

/**
 * AI 视角 SWOT 面板：把「主观自评 SWOT」变成**可测的 SWOT**。
 * 四格全部由真实探测数据派生，每格都能点开看到具体问题与被引率：
 *  S = AI 认可并引用我方的问题
 *  W = AI 说得出竞品却说不出我方（可测的真实弱点）+ AI 错误描述我方（幻觉=紧急弱点）
 *  O = 我方与竞品均未占位的空白（先发可能独占）
 *  T = 我方缺席时被引的竞品
 *
 * 诚实呈现：窗口内无真实探测 → 空态并说明需先跑探测，不生成"看起来像 SWOT"的话术。
 */

interface SwotItem {
  question: string;
  category: string | null;
  engines: string[];
  probes: number;
  citedRate: number;
  avgAivs: number;
  competitors: string[];
  reason?: string;
}
interface ThreatItem {
  competitor: string;
  hits: number;
  sampleQuestions: string[];
}
interface Hallucination {
  question: string;
  engine: string;
  reasons: string[];
}
interface SwotData {
  window: { days: number; since: string; probes: number; questions: number };
  scope: { brandSlug: string | null; category: string | null };
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  hallucinations: Hallucination[];
  opportunities: SwotItem[];
  threats: ThreatItem[];
  note: string;
}

const WINDOWS = [30, 90, 180];

function QuadrantHeader({
  icon,
  title,
  hint,
  count,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  count: number;
  tone: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      {icon}
      <strong className="text-[13px] font-semibold">{title}</strong>
      <span
        className={`rounded-full border border-current px-2 text-[10px] leading-4 tabular-nums ${tone}`}
      >
        {count}
      </span>
      <span className="ml-auto text-right text-[11px] text-muted-foreground">{hint}</span>
    </div>
  );
}

function ItemRow({ item, showCited }: { item: SwotItem; showCited?: boolean }) {
  return (
    <div className="grid gap-0.5 border-t py-1.5">
      <span className="text-xs">{item.question}</span>
      <div className="flex flex-wrap gap-2.5 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{item.probes} 次探测</span>
        {showCited ? <span className="tabular-nums">被引率 {item.citedRate}%</span> : null}
        {item.avgAivs ? <span className="tabular-nums">AIVS {item.avgAivs}</span> : null}
        {item.competitors.length ? (
          <span>竞品：{item.competitors.slice(0, 3).join('、')}</span>
        ) : null}
        {item.engines.length ? <span>{item.engines.join('/')}</span> : null}
      </div>
    </div>
  );
}

export function AiSwotPanel({
  brandSlug = 'rheem',
  category,
}: {
  brandSlug?: string;
  category?: string;
}) {
  const [data, setData] = useState<SwotData | null>(null);
  const [windowDays, setWindowDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await growthGeo.swot({ brandSlug, category, windowDays });
      setData((r?.data ?? r) as SwotData);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [brandSlug, category, windowDays]);
  useEffect(() => {
    load();
  }, [load]);

  const hasProbes = !!data?.window.probes;

  return (
    <WorkspaceSection
      icon={<Target size={16} className="text-primary" />}
      title="可测的 SWOT（非主观自评）"
      aside={
        <span className="inline-flex items-center gap-1.5">
          {WINDOWS.map((d) => (
            <button
              key={d}
              className={windowDays === d ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => setWindowDays(d)}
            >
              {d}天
            </button>
          ))}
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </span>
      }
    >
      <div className="grid gap-4">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground">
            战略分析 · AI 视角 SWOT
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            优势=AI 真引用了我方；劣势=AI
            说得出竞品却说不出我方；机会=无人占位的空白；威胁=我方缺席时被引的竞品。
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
            {error}
          </div>
        ) : null}

        {data ? (
          <div className="flex flex-wrap gap-4 rounded-lg border bg-secondary/60 px-3.5 py-2.5 text-xs text-muted-foreground">
            <span>
              窗口 <strong className="text-foreground tabular-nums">{data.window.days}</strong> 天
            </span>
            <span>
              真实探测{' '}
              <strong
                className={`tabular-nums ${hasProbes ? 'text-foreground' : 'text-warning'}`}
              >
                {data.window.probes}
              </strong>{' '}
              次
            </span>
            <span>
              覆盖问题{' '}
              <strong className="text-foreground tabular-nums">{data.window.questions}</strong> 个
            </span>
            <span className="ml-auto">
              {data.scope.brandSlug || '全品牌'}
              {data.scope.category ? ` · ${data.scope.category}` : ''}
            </span>
          </div>
        ) : null}

        {/* 无探测数据：如实空态，指出前置动作 */}
        {data && !hasProbes ? (
          <EmptyState title="窗口内无真实探测数据 → SWOT 为空态" hint={data.note} />
        ) : null}

        {data && hasProbes ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {/* S */}
            <div className="rounded-lg border bg-secondary/60 p-3.5">
              <QuadrantHeader
                icon={<Shield size={15} className="text-success" />}
                title="优势 S · AI 引用我方"
                hint="按被引率×AIVS 排序"
                count={data.strengths.length}
                tone="text-success"
              />
              {data.strengths.length ? (
                data.strengths.map((i) => <ItemRow key={i.question} item={i} showCited />)
              ) : (
                <p className="text-xs text-muted-foreground">
                  窗口内 AI 未引用我方 —— 这本身就是最强的行动信号
                </p>
              )}
            </div>

            {/* W */}
            <div className="rounded-lg border bg-secondary/60 p-3.5">
              <QuadrantHeader
                icon={<TrendingDown size={15} className="text-destructive" />}
                title="劣势 W · 说得出竞品说不出我方"
                hint="可测的真实弱点"
                count={data.weaknesses.length}
                tone="text-destructive"
              />
              {data.weaknesses.length ? (
                data.weaknesses.map((i) => <ItemRow key={i.question} item={i} />)
              ) : (
                <p className="text-xs text-muted-foreground">无「竞品被引而我方缺席」的问题</p>
              )}

              {data.hallucinations.length ? (
                <div className="mt-3 border-t pt-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <AlertOctagon size={14} className="text-destructive" />
                    <strong className="text-xs font-semibold text-destructive">
                      AI 错误描述我方（紧急）
                    </strong>
                  </div>
                  {data.hallucinations.map((h, idx) => (
                    <div key={`${h.question}-${h.engine}-${idx}`} className="grid gap-0.5 py-1">
                      <span className="text-xs">{h.question}</span>
                      <span className="text-[11px] text-muted-foreground">
                        [{h.engine}] {h.reasons.join('；')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* O */}
            <div className="rounded-lg border bg-secondary/60 p-3.5">
              <QuadrantHeader
                icon={<Target size={15} className="text-primary" />}
                title="机会 O · 无人占位的空白"
                hint="先发即可能独占"
                count={data.opportunities.length}
                tone="text-primary"
              />
              {data.opportunities.length ? (
                data.opportunities.map((i) => <ItemRow key={i.question} item={i} />)
              ) : (
                <p className="text-xs text-muted-foreground">
                  无空白问题（每个问题都已有人被引）
                </p>
              )}
            </div>

            {/* T */}
            <div className="rounded-lg border bg-secondary/60 p-3.5">
              <QuadrantHeader
                icon={<Swords size={15} className="text-warning" />}
                title="威胁 T · 我方缺席时被引的竞品"
                hint="按频次排序"
                count={data.threats.length}
                tone="text-warning"
              />
              {data.threats.length ? (
                data.threats.map((t) => (
                  <div key={t.competitor} className="grid gap-0.5 border-t py-1.5">
                    <div className="flex items-baseline gap-2">
                      <strong className="text-xs font-semibold">{t.competitor}</strong>
                      <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                        {t.hits} 次抢位
                      </span>
                    </div>
                    {t.sampleQuestions.map((q) => (
                      <span key={q} className="text-[11px] text-muted-foreground">
                        · {q}
                      </span>
                    ))}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">无竞品在我方缺席时被引</p>
              )}
            </div>
          </div>
        ) : null}

        {data?.note && hasProbes ? (
          <p className="text-[11px] text-muted-foreground">{data.note}</p>
        ) : null}
        {loading && !data ? (
          <p className="text-[13px] text-muted-foreground">加载中…</p>
        ) : null}
      </div>
    </WorkspaceSection>
  );
}
