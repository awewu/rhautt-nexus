'use client';

/**
 * Hero 轮播（2026-08 全页 UX 重构三期 · Tailwind 化）。
 * 唯一保留内联样式 = slide 背景渐变（数据驱动，来自 HeroSlide.bgGradient）。
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  bgGradient: string;
  href?: string;
  badge?: string;
}

export function HeroCarousel({ slides, autoMs = 6000 }: { slides: HeroSlide[]; autoMs?: number }) {
  const [idx, setIdx] = useState(0);

  const prev = useCallback(
    () => setIdx((i) => (i - 1 + slides.length) % slides.length),
    [slides.length]
  );
  const next = useCallback(() => setIdx((i) => (i + 1) % slides.length), [slides.length]);

  useEffect(() => {
    const t = setInterval(next, autoMs);
    return () => clearInterval(t);
  }, [next, autoMs]);

  const s = slides[idx];

  return (
    <div className="relative h-[280px] overflow-hidden rounded-2xl">
      {/* Slide（背景渐变为数据驱动：内联样式的合法例外） */}
      <a
        href={s.href || '#'}
        className="relative block h-full w-full px-7 py-8 no-underline"
        style={{ background: s.bgGradient }}
      >
        {/* Subtle grid texture (rheem-grid-bg equivalent) */}
        <div className="hero-carousel-grid pointer-events-none absolute inset-0" />
        <div className="relative z-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-full bg-white/18 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white/90 uppercase">
              {s.eyebrow}
            </span>
            {s.badge && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                {s.badge}
              </span>
            )}
          </div>
          <h2 className="max-w-[480px] text-[28px] leading-tight font-bold tracking-tight text-white">
            {s.title}
          </h2>
          {s.subtitle && <p className="mt-2 max-w-[420px] text-sm text-white/75">{s.subtitle}</p>}
        </div>
      </a>

      {/* Prev / Next */}
      {slides.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              prev();
            }}
            aria-label="上一张"
            className="absolute top-1/2 left-3 z-2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-black/30 text-white"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              next();
            }}
            aria-label="下一张"
            className="absolute top-1/2 right-3 z-2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-black/30 text-white"
          >
            <ChevronRight size={16} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-3.5 left-1/2 z-2 flex -translate-x-1/2 gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`第 ${i + 1} 张`}
                className={`h-1.5 cursor-pointer rounded-full border-0 transition-all duration-250 ${
                  i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/45'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
