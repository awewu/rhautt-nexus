'use client';

/**
 * 工作区原语套件（2026-08 全页 UX 审计重构 · 解耦层）。
 *
 * 背景：31 个页面 646 处内联样式，其中大半是每页手搓的同一批结构
 * （页头/统计格/过滤签/漏斗/键值行/空态）。本套件把这些结构收编为
 * 语义化原语——页面只表达"放什么"，不再表达"怎么画"。
 *
 * 规范（Trust & Authority · density-8）：
 * - 零内联样式；全部走 Tailwind 语义 token（shadcn 映射）。
 * - 数字一律 tabular-nums；正文最小 12px。
 * - 交互 150-200ms 过渡；可见焦点环；可点元素 cursor-pointer。
 */

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/* 页头不在本套件：使用既有的 @rhautt/ui PageHeader（单一定义，勿重复造）。 */

/** 分区卡：SectionCardHeader + 内容的标准组合，统一分区节奏。 */
export function WorkspaceSection({
  icon,
  title,
  aside,
  children,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="mb-3.5 flex items-center gap-2">
          {icon}
          <span className="text-[15px] font-semibold">{title}</span>
          {aside && <span className="ml-auto text-xs text-muted-foreground">{aside}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** 过滤签组：单选 chips（带计数）。取代各页手搓的 btn 组。 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
}: {
  options: { value: T; label: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full border font-medium transition-colors duration-150',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-[13px]',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground'
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] leading-4 tabular-nums',
                  active ? 'bg-primary-foreground/20' : 'bg-secondary'
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 漏斗步：横向阶段格 + 阶段间转化率。columns 控制 md+ 列数（窄容器用 2）。 */
export function FunnelSteps({
  steps,
  columns = 4,
}: {
  steps: { label: ReactNode; value: ReactNode; hint?: ReactNode; conversion?: string }[];
  columns?: 2 | 3 | 4;
}) {
  const colsClass = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }[columns];
  return (
    <div className="grid gap-2.5">
      <div className={cn('grid grid-cols-2 gap-2.5', colsClass)}>
        {steps.map((s, i) => (
          <div key={i} className="min-w-0">
            <div className="rounded-lg border bg-secondary/60 px-3 py-3 text-center">
              <div className="text-[22px] leading-none font-bold text-primary tabular-nums">
                {s.value}
              </div>
              <div className="mt-1.5 text-xs font-semibold">{s.label}</div>
              {s.hint && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.hint}</div>}
            </div>
            {s.conversion !== undefined && (
              <div className="mt-1 text-center text-[11px] text-muted-foreground tabular-nums">
                转化 {s.conversion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 键值行列表：设置/明细面板的标准行。 */
export function KeyValueRows({
  rows,
}: {
  rows: { label: ReactNode; value: ReactNode }[];
}) {
  return (
    <div className="grid gap-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between border-t pt-2 first:border-t-0 first:pt-0">
          <span className="text-xs text-muted-foreground">{r.label}</span>
          <span className="text-xs font-bold tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** 进度统计：标签 + 百分比 + 细条。 */
export function ProgressStat({
  label,
  desc,
  percent,
}: {
  label: ReactNode;
  desc?: ReactNode;
  percent: number;
}) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className="rounded-lg border bg-secondary/60 p-3">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{label}</div>
          {desc && <div className="mt-0.5 text-[11px] text-muted-foreground">{desc}</div>}
        </div>
        <div className="text-xs font-bold text-primary tabular-nums">{p}%</div>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
        {/* 动态宽度是内联样式的合法场景（棘轮口径） */}
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/** 空态：图标 + 主句 + 提示 + 动作。取代"0 数据时一片空白"。 */
export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <div className="text-[13px] font-medium text-muted-foreground">{title}</div>
      {hint && <div className="max-w-md text-xs text-muted-foreground/70">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ── 内容生产台版式基因（2026-08 用户钦定为全站作业页范式）──────────────
   要素：任务语气 Hero（真实指标内联）+ 可点击流水线阶段（点击即筛选）。
   样式复用 globals.css 的 content-factory-* 全局类（响应式与 token 已就绪）。 */

/** 任务 Hero：执行队列语气 + 内联真实指标。 */
export function WorkQueueHero({
  eyebrow = '执行队列',
  title,
  desc,
  metrics,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  metrics: { value: ReactNode; label: string }[];
}) {
  return (
    <div className="content-factory-hero">
      <div>
        <p className="t-label">{eyebrow}</p>
        <h2 className="t-headline mt-1">{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      <div className="content-factory-metrics">
        {metrics.map((m) => (
          <span key={m.label}>
            <strong>{m.value}</strong> {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export type PipelineStage = {
  key: string;
  label: ReactNode;
  hint: ReactNode;
  value: ReactNode;
  icon: ReactNode;
  tone?: 'neutral' | 'warning' | 'info' | 'success' | 'brand' | 'danger';
  active?: boolean;
  onClick?: () => void;
};

/** 流水线阶段：可点击（点击即筛选/跳转）的阶段格。 */
export function PipelineStages({ stages, label }: { stages: PipelineStage[]; label?: string }) {
  return (
    <div className="content-factory-pipeline" aria-label={label}>
      {stages.map((stage) => (
        <button
          key={stage.key}
          type="button"
          className={cn(
            `content-factory-stage content-factory-stage--${stage.tone || 'neutral'}`,
            stage.active && 'ring-2 ring-ring',
            !stage.onClick && 'cursor-default'
          )}
          onClick={stage.onClick}
        >
          <span className="content-factory-stage__icon">{stage.icon}</span>
          <span className="content-factory-stage__body">
            <strong>{stage.label}</strong>
            <span>{stage.hint}</span>
          </span>
          <span className="content-factory-stage__value">{stage.value}</span>
        </button>
      ))}
    </div>
  );
}

/** 软标签：说明性 pill（非交互）。 */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
      {children}
    </span>
  );
}
