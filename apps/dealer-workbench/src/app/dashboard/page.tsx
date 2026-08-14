'use client';

/**
 * 营销控制台首页（2026-08 全页 UX 重构 · WorkspaceKit 化 · 内容生产台范式对齐）。
 * 重排思路：任务 Hero + 运营路径流水线（点击即跳转）+ 控制台卡与快捷入口双列。
 * 顺带更正陈旧数字：品牌官网原写死 3，主数据已是 5 站（rhautt-group/rheem/ruud/everhot/lithnova）。
 */

import {
  ArrowRight,
  Boxes,
  FileText,
  Globe2,
  Megaphone,
  Rocket,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkQueueHero, PipelineStages } from '@/components/WorkspaceKit';

type ConsoleCard = {
  href: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: 'brand' | 'info' | 'success' | 'neutral';
};

const CONSOLE_CARDS: ConsoleCard[] = [
  {
    href: '/comfort/sites',
    label: '品牌官网',
    value: '5',
    hint: '集团站 + Rheem / Ruud / Everhot / Lithnova 官网与内容资产',
    icon: Globe2,
    tone: 'brand',
  },
  {
    href: '/growth',
    label: '市场增长',
    value: '5',
    hint: 'GEO、文案、舆情与自动化营销工具',
    icon: Rocket,
    tone: 'info',
  },
  {
    href: '/products?module=catalog',
    label: '产品',
    value: '目录',
    hint: '产品目录、产品资料与目录底座',
    icon: Boxes,
    tone: 'success',
  },
  {
    href: '/accounts',
    label: '账号权限',
    value: '权限',
    hint: '营销账号、角色权限与启停维护',
    icon: UsersRound,
    tone: 'neutral',
  },
];

const QUICK_LINKS = [
  { href: '/comfort/sites', label: '全部站点', icon: Globe2, primary: true },
  { href: '/brand', label: '品牌运营', icon: Megaphone, primary: false },
  { href: '/growth/geo', label: 'GEO', icon: Rocket, primary: false },
  { href: '/growth/materials', label: '营销物料', icon: FileText, primary: false },
  { href: '/products?module=catalog', label: '产品目录', icon: Boxes, primary: false },
  { href: '/accounts', label: '账号权限', icon: ShieldCheck, primary: false },
];

const TONE_CLASS: Record<ConsoleCard['tone'], string> = {
  brand: 'bg-primary/10 text-primary',
  info: 'bg-blue-600/10 text-blue-600',
  success: 'bg-green-600/10 text-green-600',
  neutral: 'bg-secondary text-muted-foreground',
};

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function ConsoleCardItem({ card }: { card: ConsoleCard }) {
  const Icon = card.icon;
  return (
    <a
      href={card.href}
      className="block rounded-xl border bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">{card.label}</span>
        <span className={cn('flex rounded-lg p-1.5', TONE_CLASS[card.tone])}>
          <Icon size={14} />
        </span>
      </div>
      <div className="mt-3 text-[34px] leading-tight font-bold tracking-tight tabular-nums">
        {card.value}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{card.hint}</p>
    </a>
  );
}

export default function Dashboard() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="min-h-full">
      <div className="page-container grid gap-7">
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary-foreground uppercase">
            <Megaphone size={10} /> 营销系统
          </span>
          <span className="flex-1 text-[13px]">{dateStr}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            瑞合瑞德 · 品牌官网与市场增长控制台
          </span>
        </div>

        {/* 内容生产台范式：任务 Hero + 运营路径流水线（点击即跳转） */}
        <section className="card-elevated content-factory-workbench">
          <WorkQueueHero
            title="今天从哪里开始"
            desc="品牌官网内容 → 增长动作 → 产品资料 → 账号权限，按运营路径推进。"
            metrics={[
              { value: CONSOLE_CARDS.length, label: '控制台' },
              { value: QUICK_LINKS.length, label: '快捷入口' },
            ]}
          />
          <PipelineStages
            label="运营路径"
            stages={CONSOLE_CARDS.map((card, index) => {
              const Icon = card.icon;
              return {
                key: card.href,
                label: `${String(index + 1).padStart(2, '0')} ${card.label}`,
                hint: card.hint,
                value: card.value,
                icon: <Icon size={16} />,
                tone: card.tone === 'neutral' ? 'neutral' : card.tone,
                onClick: () => {
                  window.location.href = card.href;
                },
              };
            })}
          />
        </section>

        <div className="grid items-start gap-7 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <SectionHeader title="营销控制台" subtitle="品牌官网 · 市场增长 · 产品 · 账号权限" />
            <div className="grid grid-cols-2 gap-3">
              {CONSOLE_CARDS.map((card) => (
                <ConsoleCardItem key={card.href} card={card} />
              ))}
            </div>
          </section>

          <section>
            <SectionHeader title="快捷入口" subtitle="常用营销入口" />
            <div className="grid grid-cols-3 gap-2">
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3.5 text-center text-xs leading-snug font-semibold transition-colors duration-150',
                      link.primary
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border-border bg-secondary hover:bg-secondary/70'
                    )}
                  >
                    <Icon size={14} className={link.primary ? 'opacity-90' : 'opacity-45'} />
                    {link.label}
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        {/* 原「运营路径」段已上移为 Hero 下的流水线，不再重复 */}
      </div>
    </div>
  );
}
