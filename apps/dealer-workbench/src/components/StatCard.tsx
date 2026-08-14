'use client';

/**
 * 统计卡组件族（Phase 2 旗舰页统一视觉词汇）。
 * - StatCard：主 KPI 卡——大号 tabular-nums 数值、图标+标签、脚注。
 * - MiniStat：段内小统计（闭环/分配等 5 连格）。
 * 规范：零内联样式；数字一律等宽（数据产品"专业感"的最小代价来源）。
 */

import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function StatCard({
  icon,
  label,
  value,
  hint,
  emphasis = false,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <Card
      className={cn(
        'transition-shadow duration-200 hover:shadow-sm',
        emphasis && 'border-primary/30 bg-primary/[0.03]'
      )}
    >
      <CardContent className="px-5 py-4">
        <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div
          className={cn(
            'mt-2 text-[28px] leading-none font-bold tracking-tight tabular-nums',
            emphasis && 'text-primary'
          )}
        >
          {value}
        </div>
        {hint && <div className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function MiniStat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-secondary/60 px-3.5 py-3 transition-colors duration-200 hover:bg-secondary">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-1 text-[22px] leading-none font-bold tabular-nums',
          accent && 'text-primary'
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground/80">{hint}</div>}
    </div>
  );
}

/** 段落卡头：图标 + 标题 + 右侧说明，统一各旗舰页的分区节奏。 */
export function SectionCardHeader({
  icon,
  title,
  aside,
}: {
  icon?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <span className="text-[15px] font-semibold">{title}</span>
      {aside && <span className="ml-auto text-xs text-muted-foreground">{aside}</span>}
    </div>
  );
}
