'use client';

/**
 * 品牌涡轮（2026-08 全页 UX 重构 · WorkspaceKit 化）。
 * 重排：品牌切换改 FilterChips；核心价值收窄为强调横幅；
 * 八维辐条改 2/4 列自适应网格卡，消灭 11 处内联样式。
 */

import { useState } from 'react';
import { PageHeader } from '@rhautt/ui';
import { Sparkles } from 'lucide-react';
import { WorkspaceSection, FilterChips } from '@/components/WorkspaceKit';

type Spoke = { k: string; en: string; v: string };
type Brand = {
  code: string;
  cn: string;
  tagline: string;
  origin: string;
  core: string;
  spokes: Spoke[];
};

const BRANDS: Record<string, Brand> = {
  everhot: {
    code: 'EVERHOT',
    cn: '恒热',
    tagline: '每一台设备都有一颗恒热的心',
    origin: '大户型选恒热 · 商用级大水量',
    core: '大户型选恒热 · 商用级大水量',
    spokes: [
      {
        k: '品牌使命',
        en: 'Mission',
        v: '致力于高效能源转化技术的创新突破，以科技赋能绿色低碳生活',
      },
      {
        k: '实事/传承',
        en: 'Facts & Inheritance',
        v: '百年热水专家·商用标准；冷凝化·热泵化·智能化引领技术，360+1 全周期守护用户体验',
      },
      { k: '功能利益', en: 'Functional Benefit', v: '更大水量、更强性能、即开即热的热水热能体验' },
      {
        k: '理想用户',
        en: 'Ideal Customer',
        v: '追求生活确定性的高净值人群；大宅业主 / 精品酒店 / 民宿投资人 / 高端设计师',
      },
      { k: '品牌角色', en: 'Brand Character', v: '可持续发展的采暖热水解决方案引领者' },
      { k: '品牌个性', en: 'Brand Personality', v: '专业的 · 可靠的 · 稳定的' },
      { k: '情感利益', en: 'Emotional Benefit', v: '追求确定性的安心与信赖' },
      { k: '品牌符号', en: 'Symbol', v: '一颗恒热的心' },
    ],
  },
  rheem: {
    code: 'RHEEM',
    cn: '瑞美',
    tagline: '大户型选瑞美 · 商用级大水量',
    origin: '百年热能品牌 · 全球热水器专家',
    core: '大户型选瑞美 · 商用级大水量',
    spokes: [
      { k: '品牌使命', en: 'Mission', v: '致力于通过能源转换，为人类创造更舒适的生活空间' },
      {
        k: '实事/传承',
        en: 'Facts & Inheritance',
        v: '百年热能品牌，全球热水器专家；商用级技术标准',
      },
      {
        k: '功能利益',
        en: 'Functional Benefit',
        v: '更大水量、更强性能、即开即热；专为大 House 定制热水热能方案',
      },
      { k: '理想用户', en: 'Ideal Customer', v: '讲究生活品位、需要改善生活质量的改善型家庭' },
      { k: '品牌角色', en: 'Brand Character', v: '采暖热水解决方案引领者' },
      { k: '品牌个性', en: 'Brand Personality', v: '专业 · 舒爽 · 惬意；专业的 · 可靠的 · 亲和的' },
      { k: '情感利益', en: 'Emotional Benefit', v: '可持续发展的品质生活' },
      { k: '品牌符号', en: 'Symbol', v: '360°+1 的品质匠心' },
    ],
  },
  ruud: {
    code: 'RUUD',
    cn: '瑞德',
    tagline: '大宅空气，信赖瑞德',
    origin: '源自北美 · 适配中国',
    core: '大宅健康空气系统设备引领者',
    spokes: [
      { k: '品牌使命', en: 'Mission', v: '守护全家温润洁净呼吸，悦享大宅安心居家日常' },
      { k: '实事/传承', en: 'Facts & Inheritance', v: '承袭北美技术，引领大宅健康空气标准' },
      {
        k: '功能利益',
        en: 'Functional Benefit',
        v: '温湿独立调控杜绝结露发霉；数据化管控全屋空气质量；主机户外释放室内空间；热泵冷暖低碳节能',
      },
      {
        k: '理想用户',
        en: 'Ideal Customer',
        v: '大宅高净值业主；母婴 / 呼吸道敏感人群；高端民宿 · 私人会所 · 康养商业空间',
      },
      { k: '品牌角色', en: 'Brand Character', v: '大宅健康空气系统设备引领者' },
      { k: '品牌个性', en: 'Brand Personality', v: '严谨 · 可靠 · 温润 · 科技' },
      { k: '情感利益', en: 'Emotional Benefit', v: '悦享大宅安心居家日常' },
      { k: '品牌符号', en: 'Symbol', v: '北美健康空调' },
    ],
  },
};

export default function BrandTurbinePage() {
  const [key, setKey] = useState<'everhot' | 'rheem' | 'ruud'>('everhot');
  const b = BRANDS[key];

  return (
    <div className="page-container">
      <PageHeader
        title="品牌涡轮 · 核心价值体系"
        subtitle="以「核心价值」为轴，八维定义品牌：使命 / 传承 / 功能利益 / 理想用户 / 品牌角色 / 个性 / 情感利益 / 符号"
        actions={
          <FilterChips
            size="md"
            options={(['everhot', 'rheem', 'ruud'] as const).map((kk) => ({
              value: kk,
              label: `${BRANDS[kk].code} ${BRANDS[kk].cn}`,
            }))}
            value={key}
            onChange={setKey}
          />
        }
      />

      {/* 涡轮中心：核心价值横幅 */}
      <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 px-6 py-5 text-center">
        <div className="text-xs font-bold tracking-widest text-primary">CORE VALUE · 核心价值</div>
        <div className="mt-1.5 text-[22px] leading-tight font-extrabold text-primary">{b.core}</div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">
          {b.tagline} · {b.origin}
        </div>
      </div>

      {/* 八维价值涡轮：2/4 列自适应辐条网格 */}
      <WorkspaceSection
        icon={<Sparkles size={16} />}
        title="八维价值涡轮"
        aside={`${b.code} ${b.cn} · ${b.spokes.length} 维`}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {b.spokes.map((s) => (
            <div key={s.k} className="rounded-lg border border-t-2 border-t-primary p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-bold">{s.k}</span>
                <span className="truncate text-xs text-muted-foreground">{s.en}</span>
              </div>
              <p className="m-0 mt-2 text-xs leading-6 text-muted-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </WorkspaceSection>
    </div>
  );
}
