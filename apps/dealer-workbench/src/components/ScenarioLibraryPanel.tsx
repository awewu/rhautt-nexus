'use client';

/** 2026-08 全页 UX 重构二期 · WorkspaceKit 化 */

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Rocket,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { WorkspaceSection } from '@/components/WorkspaceKit';
import { growthGeo } from '../lib/api';

/**
 * 场景库 + 启动序列面板：GEO 选题的**上游来源**与新品牌/品类的**冷启动**入口。
 *
 * 为什么需要：选题此前无可追溯来源（拍脑袋出题）→ 精密引擎打在没瞄准的靶上。
 * 场景 = 品类 × 角色 × 痛点 × 房型 × 气候区；换品类只换填充词。
 *
 * 治理与诚实：
 *  - 启动序列是 green（只建选题 + 只读探测），可直接执行；内容生成属 yellow 不在此触发。
 *  - 未知品类不编造痛点：后端拒绝，此处如实展示错误并提示补词表。
 *  - 先"试算"（dryRun）看规划再落库，避免误建一堆场景。
 *  - 步骤状态 ok/failed/skipped 原样呈现，基线探测失败不隐藏。
 */

interface ScenarioRow {
  id: string;
  category: string;
  audience: string;
  painPoint: string;
  houseType: string | null;
  climateZone: string | null;
  intent: string;
  brandSlug: string | null;
  enabled: boolean;
}
interface BootStep {
  step: string;
  status: 'ok' | 'failed' | 'skipped';
  detail?: unknown;
  error?: string;
}
interface BootResult {
  brandSlug: string;
  category: string;
  dryRun?: boolean;
  steps: BootStep[];
  nextActions?: Array<{ actionId: string; zone: string; note: string }>;
  note?: string;
}

const AUDIENCE_LABEL: Record<string, string> = {
  owner: '业主',
  decorator: '装修公司',
  designer: '设计师',
  installer: '安装工',
};
const INTENT_LABEL: Record<string, { label: string; tone: string }> = {
  info: { label: '信息型', tone: 'text-muted-foreground' },
  compare: { label: '对比型', tone: 'text-warning' },
  decide: { label: '决策型', tone: 'text-destructive' },
};
const STEP_LABEL: Record<string, string> = {
  'seed-scenarios': '播种场景 + 派生选题',
  'baseline-probe': '基线探测（只读）',
};
const STATUS_META: Record<string, { icon: React.ReactNode; tone: string; label: string }> = {
  ok: { icon: <CheckCircle2 size={14} />, tone: 'text-success', label: '完成' },
  failed: { icon: <XCircle size={14} />, tone: 'text-destructive', label: '失败' },
  skipped: { icon: <SkipForward size={14} />, tone: 'text-muted-foreground', label: '跳过' },
};

export function ScenarioLibraryPanel({ brandSlug = 'rheem' }: { brandSlug?: string }) {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ category: '', painPoints: '', maxScenarios: 12 });
  const [running, setRunning] = useState<null | 'dry' | 'seed' | 'boot'>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<BootResult | null>(null);
  const [seedSummary, setSeedSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await growthGeo.scenarios({ brandSlug });
      const d = r?.data ?? r;
      setScenarios((d?.scenarios ?? d ?? []) as ScenarioRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [brandSlug]);
  useEffect(() => {
    load();
  }, [load]);

  const payload = () => ({
    brandSlug,
    category: form.category.trim(),
    painPoints: form.painPoints
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    maxScenarios: Number(form.maxScenarios) || 12,
  });

  async function run(mode: 'dry' | 'seed' | 'boot') {
    if (!form.category.trim()) {
      setRunError('请填写品类');
      return;
    }
    setRunning(mode);
    setRunError(null);
    setResult(null);
    setSeedSummary(null);
    try {
      const p = payload();
      if (mode === 'boot') {
        // 启动序列（green）：播种→派生选题→基线探测。基线依赖外部 AI 网关，失败会如实上报。
        const r = await growthGeo.bootstrap({ ...p, runBaseline: true });
        setResult((r?.data ?? r) as BootResult);
      } else {
        const r = await growthGeo.seedScenarios({ ...p, dryRun: mode === 'dry' });
        const d = (r?.data ?? r) as any;
        setSeedSummary(
          mode === 'dry'
            ? `试算：将建 ${d.scenariosPlanned} 个场景、派生 ${d.topicsPlanned} 个选题（未落库）`
            : `已落库：新建 ${d.scenariosCreated} 个场景、存入 ${d.questionsSaved} 个选题（重复项已跳过）`
        );
      }
      if (mode !== 'dry') await load();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : '执行失败');
    } finally {
      setRunning(null);
    }
  }

  return (
    <WorkspaceSection
      icon={<Layers size={16} className="text-primary" />}
      title="场景即 prompt · 新品类冷启动"
      aside={
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      }
    >
      <div className="grid gap-4">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground">战略分析 · 场景库</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            消费者不问「变频参数」，而问「北方老房没地暖怎么改」。场景 = 品类 × 角色 × 痛点 × 房型
            × 气候区，选题由此派生、来源可追溯。
          </p>
        </div>

        {/* 播种 / 启动序列 */}
        <div className="grid gap-2.5 rounded-lg border bg-secondary/60 p-4">
          <div className="flex items-center gap-2">
            <Rocket size={16} className="text-primary" />
            <strong className="text-sm font-semibold">播种 / 启动序列</strong>
            <span className="ml-auto rounded-full border border-current px-2 text-[10px] leading-4 text-success">
              green · 可自动
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input w-[150px]"
              placeholder="品类（如 热泵）"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <input
              className="input min-w-[220px] flex-1"
              placeholder="痛点（逗号分隔；内置品类可留空）"
              value={form.painPoints}
              onChange={(e) => setForm({ ...form, painPoints: e.target.value })}
            />
            <input
              className="input w-[90px]"
              type="number"
              min={1}
              max={50}
              placeholder="上限"
              value={form.maxScenarios}
              onChange={(e) => setForm({ ...form, maxScenarios: Number(e.target.value) })}
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => run('dry')}
              disabled={!!running}
            >
              {running === 'dry' ? <Loader2 size={14} className="animate-spin" /> : null}试算
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => run('seed')}
              disabled={!!running}
            >
              {running === 'seed' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              仅播种
            </button>
            <button
              className="btn btn-brand btn-sm"
              onClick={() => run('boot')}
              disabled={!!running}
            >
              {running === 'boot' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Rocket size={14} />
              )}
              启动序列
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            未收录品类<strong>不会编造痛点</strong>，须自行提供真实用户痛点；启动序列 = 播种 →
            派生选题 → 基线探测（只读）， 「缺口→生成内容」属 yellow，需人工核准，不在此触发。
          </p>

          {runError ? <div className="text-xs text-destructive">{runError}</div> : null}
          {seedSummary ? <div className="text-xs text-success">{seedSummary}</div> : null}

          {/* 启动序列步骤状态：原样呈现，失败不隐藏 */}
          {result ? (
            <div className="mt-1 grid gap-1.5">
              {result.steps.map((s) => {
                const m = STATUS_META[s.status] || STATUS_META.skipped;
                return (
                  <div key={s.step} className="flex items-center gap-2 text-xs">
                    <span className={`flex ${m.tone}`}>{m.icon}</span>
                    <span>{STEP_LABEL[s.step] || s.step}</span>
                    <span className={`text-[11px] ${m.tone}`}>{m.label}</span>
                    {s.error ? (
                      <span className="text-[11px] text-muted-foreground">{s.error}</span>
                    ) : null}
                  </div>
                );
              })}
              {result.nextActions?.length ? (
                <div className="mt-1.5 grid gap-1 border-t pt-2">
                  <span className="text-[11px] text-muted-foreground">后续待办</span>
                  {result.nextActions.map((a) => (
                    <div key={a.actionId} className="flex items-center gap-2 text-[11px]">
                      <code className="text-[10.5px] text-muted-foreground">{a.actionId}</code>
                      <span
                        className={`rounded-full border border-current px-2 text-[10px] leading-4 ${
                          a.zone === 'green' ? 'text-success' : 'text-warning'
                        }`}
                      >
                        {a.zone === 'green' ? '可自动' : 'AI代行需核准'}
                      </span>
                      <span className="text-muted-foreground">{a.note}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* 场景清单 */}
        <div className="grid gap-2.5 rounded-lg border bg-secondary/60 p-4">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            <strong className="text-sm font-semibold">场景清单</strong>
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {scenarios.length} 个
            </span>
          </div>
          {error ? <div className="text-xs text-destructive">{error}</div> : null}
          <div className="grid gap-1">
            {scenarios.slice(0, 40).map((s) => {
              const im = INTENT_LABEL[s.intent] || INTENT_LABEL.compare;
              return (
                <div key={s.id} className="flex items-center gap-2 border-t py-1.5 text-xs">
                  <span className="min-w-[80px]">{s.category}</span>
                  <span className="text-muted-foreground">{s.painPoint}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {[AUDIENCE_LABEL[s.audience] || s.audience, s.houseType, s.climateZone]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span
                    className={`ml-auto rounded-full border border-current px-2 text-[10px] leading-4 ${im.tone}`}
                  >
                    {im.label}
                  </span>
                </div>
              );
            })}
            {!scenarios.length && !loading ? (
              <p className="text-xs text-muted-foreground">
                暂无场景 —— 用上方播种器为品类生成初始场景与选题
              </p>
            ) : null}
            {scenarios.length > 40 ? (
              <p className="text-[11px] text-muted-foreground tabular-nums">
                仅显示前 40 个（共 {scenarios.length} 个）
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceSection>
  );
}
