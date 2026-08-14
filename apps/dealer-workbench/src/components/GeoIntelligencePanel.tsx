'use client';

/** 2026-08 全页 UX 重构二期 · WorkspaceKit 化 */

import { useCallback, useEffect, useState } from 'react';
import { Cpu, Layers, Loader2, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { WorkspaceSection } from '@/components/WorkspaceKit';
import { growthGeo } from '../lib/api';

/**
 * GEO 智能层面板：把本轮建成的 SOTA 能力对市场部可视化。
 * ① 研究支撑策略库（每条带论文实测增益）
 * ② 自进化权重（由实验 lift 反哺，正=提权）
 * ③ 受治理动作引擎（Foundry 式：人与 AI Agent 同一套治理闸）
 * 全部连真 API，无数据即如实空态。
 */

// 策略库画像直接来自后端 getStrategyWeights（geo-strategies.ts 单一真相源 + 实验 lift 学到的权重）
interface StrategyRow {
  key: string;
  label: string;
  evidence: string;
  kinds: string[];
  alwaysOn: boolean;
  base: number;
  learnedDelta: number;
  effective: number;
  experiments: number;
  /** 三层收缩来源：brand=学自本品牌 / category=继承品类经验 / none=尚无数据 */
  source?: 'brand' | 'category' | 'none';
  brandExperiments?: number;
  categoryExperiments?: number;
}
interface EvoSummary {
  scoredExperiments: number;
  learnedStrategies: number;
  inheritedFromCategory?: number;
}

const SOURCE_META: Record<string, { label: string; tone: string }> = {
  brand: { label: '学自本品牌', tone: 'text-success' },
  category: { label: '继承品类经验', tone: 'text-primary' },
  none: { label: '研究基线', tone: 'text-muted-foreground' },
};

const ZONE_META: Record<string, { label: string; tone: string }> = {
  green: { label: '可自动', tone: 'text-success' },
  yellow: { label: 'AI代行需核准', tone: 'text-warning' },
  red: { label: '永不自动', tone: 'text-destructive' },
};

interface ActionDef {
  id: string;
  label: string;
  objectType: string;
  zone: string;
}

export function GeoIntelligencePanel({ brandSlug = 'rheem' }: { brandSlug?: string }) {
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [summary, setSummary] = useState<EvoSummary>({
    scoredExperiments: 0,
    learnedStrategies: 0,
  });
  const [actions, setActions] = useState<ActionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, a] = await Promise.all([growthGeo.strategyWeights(brandSlug), growthGeo.actions()]);
      const d = w?.data || w || {};
      setStrategies((d.strategies || []) as StrategyRow[]);
      setSummary((d.summary || { scoredExperiments: 0, learnedStrategies: 0 }) as EvoSummary);
      setActions((a?.actions || a?.data?.actions || []) as ActionDef[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [brandSlug]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <WorkspaceSection
      icon={<Cpu size={16} className="text-primary" />}
      title="研究策略库 · 自进化 · 受治理动作"
      aside={
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      }
    >
      <div className="grid gap-4">
        <div>
          <div className="text-[11px] font-medium text-muted-foreground">
            GEO 智能层 · AgenticGEO
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            内容生成用研究实证有效的策略组合；实验 lift 反哺哪个策略更有效；AI
            与人走同一套治理闸。
          </p>
        </div>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
            {error}
          </div>
        ) : null}

        {/* ① 策略库 + 自进化权重 */}
        <div className="grid gap-2.5 rounded-lg border bg-secondary/60 p-4">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            <strong className="text-sm font-semibold">研究支撑策略库 · 自进化权重</strong>
            <span
              className={`ml-auto rounded-full border px-2 text-[10px] leading-4 tabular-nums ${
                summary.scoredExperiments
                  ? 'border-current text-success'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {summary.scoredExperiments
                ? `已从 ${summary.scoredExperiments} 个已验证实验学习 · ${summary.learnedStrategies} 策略被调权${summary.inheritedFromCategory ? ` · ${summary.inheritedFromCategory} 项继承品类经验` : ''}`
                : '尚未学习（无已验证 lift 实验）'}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {strategies.map((s) => {
              const d = s.learnedDelta;
              return (
                <div
                  key={s.key}
                  className="grid gap-1 rounded-lg border bg-background px-3 py-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold">{s.label}</span>
                    {s.alwaysOn ? (
                      <span className="rounded-full border border-current px-2 text-[10px] leading-4 text-success">
                        保底
                      </span>
                    ) : null}
                    {d !== 0 ? (
                      <span
                        className={`ml-auto inline-flex items-center gap-0.5 rounded-full border border-current px-2 text-[10px] leading-4 tabular-nums ${
                          d > 0 ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        <TrendingUp size={10} /> {d > 0 ? '+' : ''}
                        {d}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-baseline gap-1.5 tabular-nums">
                    <span className="text-[11px] text-muted-foreground">权重</span>
                    <span
                      className={`text-xs text-muted-foreground ${d !== 0 ? 'line-through' : ''}`}
                    >
                      {s.base}
                    </span>
                    {d !== 0 ? (
                      <>
                        <span className="text-[11px] text-muted-foreground">→</span>
                        <strong className="text-sm font-bold text-primary">{s.effective}</strong>
                      </>
                    ) : null}
                    {s.source && s.source !== 'none' ? (
                      <span className={`ml-auto text-[10.5px] ${SOURCE_META[s.source].tone}`}>
                        {SOURCE_META[s.source].label}
                        {s.source === 'brand' && s.brandExperiments
                          ? `(${s.brandExperiments})`
                          : null}
                        {s.source === 'category' && s.categoryExperiments
                          ? `(${s.categoryExperiments})`
                          : null}
                      </span>
                    ) : s.experiments ? (
                      <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                        {s.experiments} 实验
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{s.evidence}</span>
                </div>
              );
            })}
            {!strategies.length ? (
              <p className="text-[13px] text-muted-foreground">
                {loading ? '加载中…' : '无策略数据'}
              </p>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            有效权重 = 基础权重 + 三层收缩（研究基线 → 品类 → 品牌）学到的增减。 新品牌开局
            <strong className="text-primary">继承品类经验</strong>
            而非从零；小样本由先验主导，避免单次实验噪声冒充经验。
          </p>
        </div>

        {/* ② 受治理动作引擎 */}
        <div className="grid gap-2.5 rounded-lg border bg-secondary/60 p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            <strong className="text-sm font-semibold">受治理动作引擎（Foundry 式）</strong>
            <span className="text-xs text-muted-foreground">人与 AI Agent 走同一套治理闸</span>
          </div>
          <div className="grid gap-2">
            {actions.map((a) => {
              const zm = ZONE_META[a.zone] || { label: a.zone, tone: 'text-muted-foreground' };
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5"
                >
                  <Cpu size={14} className="text-muted-foreground" />
                  <span className="text-[13px] font-bold">{a.label}</span>
                  <code className="text-[11px] text-muted-foreground">{a.id}</code>
                  <span
                    className={`ml-auto rounded-full border border-current px-2 text-[10px] leading-4 ${zm.tone}`}
                  >
                    {zm.label}
                  </span>
                </div>
              );
            })}
            {!actions.length ? (
              <p className="text-[13px] text-muted-foreground">
                {loading ? '加载中…' : '无已注册动作'}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </WorkspaceSection>
  );
}
