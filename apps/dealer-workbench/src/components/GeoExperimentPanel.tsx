'use client';

/**
 * 2026-08 全页 UX 重构二期 · WorkspaceKit 化
 *
 * GEO 第 7 层 · 闭环实验面板
 * 探测(基线) → 缺口 → 补内容 → 复投 → 验证 lift。
 * 视觉重心 = lift：before→after 对比 + 结论色带，一眼看出"这内容让 AI 出现率涨没涨"。
 *
 * 设计：复用 WorkspaceKit / StatCard 原语 + Tailwind 语义 token，
 * 零内联样式（无动态坐标场景），不引入第二套视觉。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { WorkspaceSection, EmptyState } from '@/components/WorkspaceKit';
import { MiniStat } from '@/components/StatCard';
import { cn } from '@/lib/utils';
import { growthCopy, growthGeo } from '../lib/api';

type ExperimentStatus =
  'baseline' | 'content-linked' | 'verifying' | 'improved' | 'no-change' | 'regressed' | 'killed';

interface Experiment {
  id: string;
  brandSlug: string;
  question: string;
  hypothesis?: string | null;
  killCriteria?: string | null;
  status: ExperimentStatus;
  baselineCitedRate?: number | null;
  verifyCitedRate?: number | null;
  lift?: number | null;
  conclusion?: string | null;
  contentPublishedAt?: string | null;
  category?: string;
  copyAssetId?: string | null;
  publicationUrl?: string | null;
  probeProvider?: string;
  copyAsset?: {
    id: string;
    status: string;
    complianceFlags?: string[];
    factRefs?: Array<{ type: string; id: string }>;
    model?: string | null;
    promptTemplateId?: string | null;
  } | null;
  promptTemplate?: {
    id: string;
    name: string;
    evidenceState: string;
    verifiedCount: number;
    averageLift: number;
  } | null;
  loop?: { phase: string; nextAction: string; terminal: boolean };
  createdAt: string;
}

interface GeoQuestion {
  id: string;
  question: string;
  stage?: string;
}

/** 状态视觉映射：Tailwind 语义 token（取代原 CSS 变量内联）。 */
const STATUS_META: Record<
  ExperimentStatus,
  { label: string; text: string; bg: string; border: string; stripe: string }
> = {
  baseline: {
    label: '基线已测',
    text: 'text-muted-foreground',
    bg: 'bg-secondary',
    border: 'border-border',
    stripe: 'bg-muted-foreground',
  },
  'content-linked': {
    label: '内容已补',
    text: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/40',
    stripe: 'bg-warning',
  },
  verifying: {
    label: '复投中',
    text: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/40',
    stripe: 'bg-primary',
  },
  improved: {
    label: '已验证 · 有效',
    text: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/40',
    stripe: 'bg-success',
  },
  'no-change': {
    label: '已验证 · 无变化',
    text: 'text-muted-foreground',
    bg: 'bg-secondary',
    border: 'border-border',
    stripe: 'bg-muted-foreground',
  },
  regressed: {
    label: '已验证 · 下降',
    text: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/40',
    stripe: 'bg-destructive',
  },
  killed: {
    label: '已终止',
    text: 'text-muted-foreground/70',
    bg: 'bg-muted',
    border: 'border-border',
    stripe: 'bg-muted-foreground/60',
  },
};

const pct = (v?: number | null) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—';

export function GeoExperimentPanel({
  brandSlug = 'rheem',
  category = '家用热水与舒适系统',
}: {
  brandSlug?: string;
  category?: string;
}) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [questions, setQuestions] = useState<GeoQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    questionId: '',
    hypothesis: '',
    killCriteria: '复投后 lift ≤ 0 则换内容策略',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, qRes] = await Promise.all([
        growthGeo.experiments({ brandSlug, category }),
        growthGeo.questionSet({ brandSlug, category }),
      ]);
      setExperiments((expRes?.items || expRes || []) as Experiment[]);
      setQuestions(((qRes?.questions || []) as GeoQuestion[]).filter((q) => q.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载实验失败');
    } finally {
      setLoading(false);
    }
  }, [brandSlug, category]);

  useEffect(() => {
    load();
  }, [load]);

  // 有 verifying / baseline(批次未完成) 时轮询回填 lift
  const hasPending = useMemo(
    () =>
      experiments.some(
        (e) => e.status === 'verifying' || (e.status === 'baseline' && e.baselineCitedRate === null)
      ),
    [experiments]
  );
  useEffect(() => {
    if (!hasPending) return undefined;
    const t = setInterval(async () => {
      const pend = experiments.filter(
        (e) => e.status === 'verifying' || (e.status === 'baseline' && e.baselineCitedRate === null)
      );
      let changed = false;
      for (const e of pend) {
        try {
          const fresh = (await growthGeo.experiment(e.id)) as any;
          const fe = (fresh?.experiment || fresh) as Experiment;
          if (
            fe &&
            (fe.status !== e.status ||
              fe.lift !== e.lift ||
              fe.baselineCitedRate !== e.baselineCitedRate)
          )
            changed = true;
        } catch {
          /* 忽略单次轮询错误 */
        }
      }
      if (changed) load();
    }, 6000);
    return () => clearInterval(t);
  }, [hasPending, experiments, load]);

  const startExperiment = async () => {
    if (!form.questionId) {
      setError('请选择一个监测问题');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const q = questions.find((x) => x.id === form.questionId);
      await growthGeo.startExperiment({
        brandSlug,
        category,
        questionId: form.questionId,
        question: q?.question,
        hypothesis: form.hypothesis || undefined,
        killCriteria: form.killCriteria || undefined,
      });
      setNotice('实验已开启，基线探测进行中…');
      setShowForm(false);
      setForm({ questionId: '', hypothesis: '', killCriteria: '复投后 lift ≤ 0 则换内容策略' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '开启实验失败');
    } finally {
      setSubmitting(false);
    }
  };

  const seedStandardQuestions = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const questionSet = await growthGeo.questionSet({ brandSlug, category });
      await growthGeo.saveGeneratedQuestions({
        brandSlug,
        category,
        questions: questionSet?.generated || [],
      });
      setNotice('标准问题库已初始化，可继续增删改和调整优先级');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '初始化标准问题库失败');
    } finally {
      setSubmitting(false);
    }
  };

  const generateContent = async (exp: Experiment) => {
    setBusyId(exp.id);
    setError(null);
    try {
      await growthGeo.generateExperimentContent(exp.id, { kind: 'faq' });
      setNotice('千问已基于 D2 产品事实生成草稿，等待人工核准');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成内容失败');
    } finally {
      setBusyId(null);
    }
  };

  const approveContent = async (exp: Experiment) => {
    if (!exp.copyAssetId) return;
    setBusyId(exp.id);
    setError(null);
    try {
      await growthCopy.approve(exp.copyAssetId);
      setNotice('内容已人工核准；实际发布后记录公开 URL 才能复测');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '核准内容失败');
    } finally {
      setBusyId(null);
    }
  };

  const recordPublication = async (exp: Experiment) => {
    if (!exp.copyAssetId) return;
    const publicationUrl = window.prompt('输入已经公开可访问的内容 URL');
    if (!publicationUrl) return;
    setBusyId(exp.id);
    setError(null);
    try {
      await growthGeo.linkExperimentContent(exp.id, {
        copyAssetId: exp.copyAssetId,
        publicationUrl,
      });
      setNotice('发布证据已记录，可以进行同问题复测');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '记录发布证据失败');
    } finally {
      setBusyId(null);
    }
  };

  const verify = async (id: string) => {
    setBusyId(id);
    try {
      await growthGeo.verifyExperiment(id, {});
      setNotice('复投探测已排队，稍后自动回填 lift');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '复投失败');
    } finally {
      setBusyId(null);
    }
  };

  const savePrompt = async (exp: Experiment) => {
    if (!exp.copyAssetId || exp.copyAsset?.promptTemplateId) return;
    setBusyId(exp.id);
    setError(null);
    try {
      const result = await growthCopy.savePromptTemplate(exp.copyAssetId);
      setNotice(
        result?.template?.verifiedCount > 0
          ? '提示词已入池，本次实验 lift 已回填到模板成绩'
          : '提示词已入池，实验完成后会自动回填效果'
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '提示词保存失败');
    } finally {
      setBusyId(null);
    }
  };

  const summary = useMemo(() => {
    const total = experiments.length;
    const improved = experiments.filter((e) => e.status === 'improved').length;
    const verified = experiments.filter((e) =>
      ['improved', 'no-change', 'regressed'].includes(e.status)
    ).length;
    const avgLift = verified
      ? Math.round(
          experiments
            .filter((e) => e.lift !== null && e.lift !== undefined)
            .reduce((s, e) => s + (e.lift || 0), 0) /
            Math.max(1, experiments.filter((e) => e.lift !== null && e.lift !== undefined).length)
        )
      : 0;
    return { total, improved, verified, avgLift };
  }, [experiments]);

  return (
    <WorkspaceSection
      icon={<FlaskConical size={16} />}
      title={
        <span className="block">
          <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">
            GEO 闭环实验 · 第 7 层
          </span>
          内容有没有用，用 lift 说话
        </span>
      }
      aside={
        <span className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={seedStandardQuestions}
            disabled={submitting}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Target size={14} />}
            初始化标准题库
          </button>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={load}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
          </button>
          <button
            className="btn btn-brand btn-sm"
            type="button"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? '取消' : '开启实验'}
          </button>
        </span>
      }
    >
      <div className="grid gap-4">
        <p className="text-xs text-muted-foreground">
          补内容前测一次基线，发布后复投再测一次，出现率之差（lift）即证明品牌建设是否有效。
        </p>

        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
            <X size={16} />
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border bg-secondary/60 px-3 py-2.5 text-[13px] text-success">
            {notice}
          </div>
        ) : null}

        {/* 概览指标 */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MiniStat
            label={
              <span className="inline-flex items-center gap-1">
                <FlaskConical size={13} />
                实验总数
              </span>
            }
            value={summary.total}
          />
          <MiniStat
            label={
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 size={13} />
                已验证
              </span>
            }
            value={summary.verified}
          />
          <MiniStat
            label={
              <span className="inline-flex items-center gap-1">
                <TrendingUp size={13} />
                有效实验
              </span>
            }
            value={
              <span className={cn(summary.improved > 0 && 'text-success')}>
                {summary.improved}
              </span>
            }
          />
          <MiniStat
            label={
              <span className="inline-flex items-center gap-1">
                <Target size={13} />
                平均 lift
              </span>
            }
            value={
              <span
                className={cn(
                  summary.avgLift > 0 && 'text-success',
                  summary.avgLift < 0 && 'text-destructive'
                )}
              >
                {summary.avgLift > 0 ? `+${summary.avgLift}%` : `${summary.avgLift}%`}
              </span>
            }
          />
        </div>

        {/* 开启实验表单 */}
        {showForm ? (
          <div className="grid gap-3 rounded-lg border bg-secondary/40 p-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">监测问题</label>
              <div className="relative">
                <select
                  className="input w-full cursor-pointer appearance-none pr-9"
                  value={form.questionId}
                  onChange={(e) => setForm((f) => ({ ...f, questionId: e.target.value }))}
                >
                  <option value="">选择一个问题…</option>
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.question}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute top-3 right-3 text-muted-foreground/70"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                假设（补什么内容 → 期望提升）
              </label>
              <input
                className="input w-full"
                value={form.hypothesis}
                onChange={(e) => setForm((f) => ({ ...f, hypothesis: e.target.value }))}
                placeholder="例：补一篇选型技术页，让 AI 推荐时提到我们"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                杀死准则（预注册，避免自我安慰）
              </label>
              <input
                className="input w-full"
                value={form.killCriteria}
                onChange={(e) => setForm((f) => ({ ...f, killCriteria: e.target.value }))}
              />
            </div>
            <div>
              <button
                className="btn btn-brand btn-sm"
                type="button"
                onClick={startExperiment}
                disabled={submitting || !form.questionId}
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FlaskConical size={14} />
                )}
                开启并跑基线探测
              </button>
            </div>
          </div>
        ) : null}

        {/* 实验卡片列表 */}
        <div className="grid gap-3">
          {experiments.map((exp) => (
            <ExperimentCard
              key={exp.id}
              exp={exp}
              busy={busyId === exp.id}
              onGenerate={() => generateContent(exp)}
              onApprove={() => approveContent(exp)}
              onPublish={() => recordPublication(exp)}
              onVerify={() => verify(exp.id)}
              onSavePrompt={() => savePrompt(exp)}
            />
          ))}
          {!experiments.length ? (
            loading ? (
              <div className="flex justify-center rounded-lg border bg-secondary/40 px-6 py-8 text-muted-foreground">
                <Loader2 size={20} className="animate-spin" />
              </div>
            ) : (
              <EmptyState
                icon={<FlaskConical size={28} />}
                title="还没有实验。选一个 AI 不推荐我们的问题，开启第一个闭环实验。"
              />
            )
          ) : null}
        </div>
      </div>
    </WorkspaceSection>
  );
}

function ExperimentCard({
  exp,
  busy,
  onGenerate,
  onApprove,
  onPublish,
  onVerify,
  onSavePrompt,
}: {
  exp: Experiment;
  busy: boolean;
  onGenerate: () => void;
  onApprove: () => void;
  onPublish: () => void;
  onVerify: () => void;
  onSavePrompt: () => void;
}) {
  const meta = STATUS_META[exp.status];
  const lift = exp.lift;
  const hasLift = lift !== null && lift !== undefined;
  const liftTone = !hasLift
    ? 'text-muted-foreground/70'
    : lift > 0
      ? 'text-success'
      : lift < 0
        ? 'text-destructive'
        : 'text-muted-foreground';
  const LiftIcon = !hasLift ? Minus : lift > 0 ? TrendingUp : lift < 0 ? TrendingDown : Minus;

  return (
    <article className="grid grid-cols-[4px_1fr] overflow-hidden rounded-xl border bg-secondary/40">
      {/* 状态色带 */}
      <div className={cn('opacity-85', meta.stripe)} />
      <div className="grid gap-3.5 p-4">
        {/* 头部 */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-snug font-bold">{exp.question}</p>
            {exp.hypothesis ? (
              <p className="mt-1 text-xs text-muted-foreground">假设：{exp.hypothesis}</p>
            ) : null}
          </div>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
              meta.text,
              meta.border,
              meta.bg
            )}
          >
            {meta.label}
          </span>
        </div>

        {/* before → lift → after 视觉对比 */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2.5">
          <RatePill label="基线" value={pct(exp.baselineCitedRate)} sub={fmtDate(exp.createdAt)} />
          <ArrowRight size={16} className="justify-self-center text-muted-foreground/70" />
          <div className={cn('rounded-lg px-1 py-2 text-center', hasLift && meta.bg)}>
            <div className={cn('flex items-center justify-center gap-1', liftTone)}>
              <LiftIcon size={18} />
              <span className="text-[26px] leading-none font-extrabold tabular-nums">
                {hasLift ? `${lift > 0 ? '+' : ''}${lift}` : '—'}
              </span>
              {hasLift ? <span className="mb-0.5 self-end text-[13px]">pt</span> : null}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">lift</div>
          </div>
          <ArrowRight size={16} className="justify-self-center text-muted-foreground/70" />
          <RatePill
            label="复投"
            value={pct(exp.verifyCitedRate)}
            sub={exp.contentPublishedAt ? `补内容 ${fmtDate(exp.contentPublishedAt)}` : '待补内容'}
          />
        </div>

        {/* 结论 */}
        {exp.conclusion ? (
          <p
            className={cn(
              'rounded-lg px-3 py-2 text-[13px] leading-relaxed text-muted-foreground',
              meta.bg
            )}
          >
            {exp.conclusion}
          </p>
        ) : null}

        {/* 下一步操作 */}
        <div className="flex flex-wrap items-center gap-2">
          {exp.loop?.nextAction === 'wait-for-baseline' ? (
            <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              千问基线探测进行中
            </span>
          ) : null}
          {exp.loop?.nextAction === 'generate-fact-grounded-draft' ? (
            <button
              className="btn btn-brand btn-sm"
              type="button"
              onClick={onGenerate}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}生成 D2
              事实草稿
            </button>
          ) : null}
          {exp.loop?.nextAction === 'approve-draft' ? (
            <button
              className="btn btn-brand btn-sm"
              type="button"
              onClick={onApprove}
              disabled={busy || Boolean(exp.copyAsset?.complianceFlags?.length)}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              人工核准草稿
            </button>
          ) : null}
          {exp.loop?.nextAction === 'record-publication-evidence' ? (
            <button
              className="btn btn-brand btn-sm"
              type="button"
              onClick={onPublish}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              记录公开发布 URL
            </button>
          ) : null}
          {exp.loop?.nextAction === 'verify-lift' ? (
            <button
              className="btn btn-brand btn-sm"
              type="button"
              onClick={onVerify}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              复投验证
            </button>
          ) : null}
          {exp.status === 'verifying' ? (
            <span className="flex items-center gap-1.5 text-[13px] text-primary">
              <Loader2 size={14} className="animate-spin" />
              复投探测进行中，稍后自动回填 lift
            </span>
          ) : null}
          {exp.copyAsset && !exp.copyAsset.promptTemplateId ? (
            <button
              className="btn btn-outline btn-sm"
              type="button"
              onClick={onSavePrompt}
              disabled={busy}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
              存入提示词池
            </button>
          ) : null}
          {exp.promptTemplate ? (
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                exp.promptTemplate.evidenceState === 'proven'
                  ? 'border-success/40 bg-success/10 text-success'
                  : exp.promptTemplate.evidenceState === 'negative'
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : 'border-info/40 bg-info/10 text-info'
              )}
            >
              提示词：{exp.promptTemplate.name} · 验证 {exp.promptTemplate.verifiedCount} 次 · 平均
              lift {exp.promptTemplate.averageLift > 0 ? '+' : ''}
              {exp.promptTemplate.averageLift}pp
            </span>
          ) : null}
          {exp.copyAsset ? (
            <span className="text-xs text-muted-foreground">
              内容：{exp.copyAsset.status} · {exp.copyAsset.factRefs?.length || 0} 条事实引用 ·{' '}
              {exp.copyAsset.model || exp.probeProvider || 'qwen'}
            </span>
          ) : null}
          {exp.killCriteria ? (
            <span className="ml-auto text-xs text-muted-foreground">
              杀死准则：{exp.killCriteria}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RatePill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground">{label}出现率</div>
      <div className="text-2xl leading-tight font-extrabold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
