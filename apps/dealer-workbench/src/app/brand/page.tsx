'use client';

/**
 * 品牌运营页（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 结构保持左主区（Hero/活动/培训）+ 右栏（目标/汇总/激励/直达），
 * 渲染层从 62 处内联样式收敛为 Tailwind 语义类（仅进度条动态宽度保留内联）。
 */

import useSWR from 'swr';
import { apiFetch } from '../../lib/api';
import { ArrowRight, Globe2, BookOpen, Trophy, Megaphone, ChevronRight } from 'lucide-react';
import { HeroCarousel, type HeroSlide } from '../../components/HeroCarousel';
import { BRAND_TARGETS, CAMPAIGNS, TRAININGS, brandSummary } from '../../lib/brand-data';
import { WorkbenchSectionHeader } from '../../components/WorkbenchCore';
import { MiniStat } from '@/components/StatCard';
import { cn } from '@/lib/utils';

const fmt = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `¥${v.toLocaleString()}`);
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

type ResourceLink = { label: string; href: string };
const FALLBACK_RESOURCES: ResourceLink[] = [
  { label: 'Rheem 官网首页', href: 'https://rheem.com.cn' },
  { label: '品牌新闻中心', href: 'https://rheem.com.cn/news' },
  { label: '产品中心', href: 'https://rheem.com.cn/products' },
  { label: '培训认证', href: 'https://rheem.com.cn/training' },
];

// ── Hero slides from active campaigns（bgGradient 是数据而非样式，保留）──
const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'brand-hero-1',
    eyebrow: '品牌中心',
    title: '瑞合瑞德 · 经销商品牌协同平台',
    subtitle: '活动参与 · 培训认证 · 返点追踪 · 物料下载 — 一站直达',
    bgGradient: 'linear-gradient(135deg, #1F1F1F 0%, #680014 58%, #C8202C 100%)',
    href: '/brand',
    badge: 'Rheem Partner',
  },
  ...CAMPAIGNS.filter((c) => c.status === '进行中')
    .slice(0, 2)
    .map((c, i) => ({
      id: c.id,
      eyebrow: '品牌活动',
      title: c.title,
      subtitle: c.incentive,
      bgGradient:
        i === 0
          ? 'linear-gradient(135deg, #1F1F1F 0%, #8F001B 62%, #C8202C 100%)'
          : 'linear-gradient(135deg, #101828 0%, #680014 60%, #B80023 100%)',
      href: '/brand',
      badge: c.status,
    })),
];

function SectionHeader({
  eyebrow,
  title,
  actionHref,
}: {
  eyebrow: string;
  title: string;
  actionHref?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h3 className="text-lg leading-snug font-semibold">{title}</h3>
      </div>
      {actionHref && (
        <a
          href={actionHref}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
        >
          查看全部 <ArrowRight size={14} />
        </a>
      )}
    </div>
  );
}

export default function BrandPage() {
  const { data: live } = useSWR('/api/v2/brand', apiFetch);
  const s = brandSummary();

  // 把 rheem.com.cn 新闻注入 Hero slides
  const liveNewsSlides: HeroSlide[] = (live?.news || []).slice(0, 2).map((n: any, i: number) => ({
    id: `rheem-news-${i}`,
    eyebrow: 'Rheem 品牌动态',
    title: n.title,
    subtitle: n.date || '',
    bgGradient: 'linear-gradient(135deg, #101828 0%, #680014 60%, #C8202C 100%)',
    href: n.url || '/brand',
    badge: '品牌资讯',
  }));

  // 把抓取到的真实 products/trainings/campaigns 汇成官网直达链接（此前被丢弃）
  const liveResources: ResourceLink[] = [
    ...(live?.products || [])
      .slice(0, 2)
      .map((p: any) => ({ label: `产品 · ${p.name}`, href: p.url })),
    ...(live?.trainings || [])
      .slice(0, 1)
      .map((t: any) => ({ label: `培训 · ${t.title}`, href: t.url })),
    ...(live?.campaigns || [])
      .slice(0, 1)
      .map((c: any) => ({ label: `活动 · ${c.title}`, href: c.url })),
  ].filter((r) => r.href);

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-secondary/40">
      <div className="page-container">
        <WorkbenchSectionHeader
          eyebrow="营销工作台"
          title="品牌运营"
          description="活动、培训、返点与官网物料入口，面向品牌官网和市场协同的营销控制台。"
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <a className="btn btn-brand btn-sm" href="/comfort/sites">
                <Globe2 size={14} />
                管理品牌官网
              </a>
              <a className="btn btn-outline btn-sm" href="/products?module=catalog">
                产品目录
                <ArrowRight size={14} />
              </a>
            </div>
          }
        />
        <div className="split-main">
          {/* ──────── 左主区 ──────── */}
          <div className="grid min-w-0 gap-6">
            {/* Hero Carousel — merge static + live rheem news */}
            <HeroCarousel slides={[...HERO_SLIDES, ...liveNewsSlides]} />

            {/* 品牌活动 — 新闻卡片行 */}
            <section>
              <SectionHeader eyebrow="品牌活动" title="ACTIVE CAMPAIGNS" />
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                {CAMPAIGNS.map((c) => (
                  <a
                    key={c.id}
                    href="/brand"
                    className="card-elevated surface-interactive flex items-start gap-3 p-4 no-underline"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Globe2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <span
                        className={cn(
                          'inline-block rounded px-1.5 py-px text-[10px] font-semibold',
                          c.status === '进行中'
                            ? 'bg-primary/10 text-primary'
                            : c.status === '即将开始'
                              ? 'bg-info/10 text-info'
                              : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {c.status}
                      </span>
                      <h4 className="mt-1 line-clamp-2 text-[13px] leading-snug font-semibold">
                        {c.title}
                      </h4>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {c.startAt.slice(5)} – {c.endAt.slice(5)}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* 培训认证 — 年鉴大卡 */}
            <section>
              <SectionHeader eyebrow="培训认证" title="TRAINING ARCHIVE" actionHref="/brand" />
              <div className="grid gap-2.5">
                {TRAININGS.map((t) => {
                  const prog = t.completedBy / t.totalReps;
                  const urgent = new Date(t.deadline).getTime() - Date.now() < 7 * 86400000;
                  return (
                    <a
                      key={t.id}
                      href="/brand"
                      className="card-elevated surface-interactive flex items-center gap-4 px-5 py-4 no-underline"
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]',
                          prog === 1 ? 'bg-success/10 text-success' : 'bg-info/10 text-info'
                        )}
                      >
                        <BookOpen size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{t.title}</p>
                          <span
                            className={cn(
                              'shrink-0 text-[11px]',
                              urgent ? 'text-destructive' : 'text-muted-foreground'
                            )}
                          >
                            截止 {t.deadline.slice(5)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-500',
                              prog === 1 ? 'bg-success' : 'bg-info'
                            )}
                            style={{ width: `${prog * 100}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {t.completedBy}/{t.totalReps} 人完成 · Lv.{t.level}
                          {t.required && <span className="ml-1.5 text-destructive">必修</span>}
                        </p>
                      </div>
                      <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
                    </a>
                  );
                })}
              </div>
            </section>
          </div>

          {/* ──────── 右栏 ──────── */}
          <aside className="grid gap-4">
            {/* GMV & 返点 KPI */}
            <div className="card-elevated overflow-hidden">
              <div className="border-b px-5 pt-4 pb-3">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  季度目标
                </p>
                <h3 className="text-lg font-semibold">GMV & 返点</h3>
              </div>
              <div className="grid gap-3.5 px-5 py-3">
                {BRAND_TARGETS.map((t) => {
                  const prog = Math.min(1, t.achieved / t.target);
                  return (
                    <div key={t.period}>
                      <div className="mb-1.5 flex justify-between text-[13px]">
                        <span className="font-semibold">{t.period}</span>
                        <span className="font-semibold text-primary">
                          返点 {pct(t.rebateRate)}
                        </span>
                      </div>
                      <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            prog >= 1 ? 'bg-success' : 'bg-primary'
                          )}
                          style={{ width: `${prog * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {fmt(t.achieved)} / {fmt(t.target)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 本期汇总快览 */}
            <div className="card-elevated p-4">
              <p className="mb-3 text-[13px] font-semibold">#本期汇总</p>
              <div className="grid grid-cols-2 gap-2.5">
                <MiniStat label="Q2 进度" value={pct(s.q2Progress)} accent />
                <MiniStat label="年度返点" value={fmt(s.ytdRebate)} />
                <MiniStat label="参与活动" value={String(s.activeJoined)} />
                <MiniStat label="培训完成率" value={pct(s.completedTrainings / s.totalTrainings)} />
              </div>
            </div>

            {/* 返点激励 promo (Tandem CeoWeeklyPromo pattern) */}
            <a href="/brand" className="block overflow-hidden rounded-2xl shadow-lg no-underline">
              <div className="brand-promo-gradient relative p-5 text-white">
                <div className="brand-promo-dots pointer-events-none absolute inset-0 opacity-15" />
                <div className="relative">
                  <div className="mb-2 flex items-center gap-1.5 opacity-80">
                    <Trophy size={14} />
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      返点激励计划
                    </span>
                  </div>
                  <h4 className="text-base leading-snug font-bold">
                    达标解锁季度返点
                    <br />
                    最高 {pct(Math.max(...BRAND_TARGETS.map((t) => t.rebateRate)))} 返点率
                  </h4>
                  <p className="mt-2 text-xs leading-relaxed opacity-80">
                    完成 GMV 目标即可解锁阶梯返点，本季结算后直接抵扣货款。
                  </p>
                  <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-[7px] text-[13px] font-semibold text-primary">
                    查看激励详情 <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            </a>

            {/* Rheem 官网直达 — 来自 /api/v2/brand 抓取的真实链接 */}
            <div className="card-elevated p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold">
                <Megaphone size={13} />
                Rheem 官网直达
              </p>
              {(liveResources.length ? liveResources : FALLBACK_RESOURCES).map((l, i) => (
                <a
                  key={`${l.label}-${i}`}
                  href={l.href}
                  target={l.href.startsWith('http') ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 border-b py-2 text-[13px] no-underline transition-colors duration-150 hover:text-primary"
                >
                  <span className="truncate">{l.label}</span>
                  <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
                </a>
              ))}
              {!live && (
                <p className="mt-2 text-[11px] text-muted-foreground">登录后加载官网实时内容</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
