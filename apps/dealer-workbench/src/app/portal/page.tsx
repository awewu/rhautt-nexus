'use client';

/**
 * 经销商门户预留页（2026-08 全页 UX 重构二期 · WorkspaceKit 化）。
 * 信息架构：EmptyState 承载「建设中」主态 + 四大规划能力密排卡（sm 2 列 / lg 4 列）。
 * 原版问题：11 处内联样式、手搓 CSSProperties 卡对象；本版收编为 Tailwind + WorkspaceKit 原语。
 */

import { FolderOpen, Megaphone, Inbox, GraduationCap, HardHat } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import { EmptyState, Pill } from '@/components/WorkspaceKit';

// 经销商门户 —— 端口预留(Under Construction)。数据将按 RBAC scope(dealerId)隔离。
// 承接北极星副指标「经销商成交率」;规划中的四大自助能力见下方预览。
const PLANNED = [
  {
    icon: <FolderOpen size={18} />,
    title: '营销物料库',
    desc: '按品牌/品类自助领取海报、单页、视频、话术',
  },
  {
    icon: <Megaphone size={18} />,
    title: '政策与返利',
    desc: '渠道政策、返利进度与到账查询(过毛利闸后可见)',
  },
  {
    icon: <Inbox size={18} />,
    title: '我的线索',
    desc: 'GEO/活动派发到本网点的高意向线索,认领与跟进',
  },
  {
    icon: <GraduationCap size={18} />,
    title: '培训与认证',
    desc: '产品/技术/安装认证,认证等级联动返利资格',
  },
];

export default function DealerPortalPage() {
  return (
    <div className="page-container">
      <PageHeader
        title="经销商门户 · 自助赋能"
        subtitle="B端赋能自助前台 —— 承接北极星副指标「经销商成交率」"
      />

      <div className="mb-4">
        <EmptyState
          icon={<HardHat size={26} />}
          title="门户建设中 · Under Construction"
          hint="经销商自助门户入口已预留。将开放:物料领取、政策返利查询、线索认领、培训认证 —— 数据按网点(RBAC scope)隔离,动作与成交回流总部驾驶舱。敬请期待。"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANNED.map((s) => (
          <div
            key={s.title}
            className="rounded-lg border bg-card p-5 opacity-70 shadow-sm transition-opacity duration-200 hover:opacity-100"
          >
            <div className="mb-2 flex items-center gap-2.5">
              <span className="text-primary">{s.icon}</span>
              <span className="text-[13px] font-bold text-foreground">{s.title}</span>
              <span className="ml-auto">
                <Pill>规划中</Pill>
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
