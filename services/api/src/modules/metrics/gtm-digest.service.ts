import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';
import { MetricsService } from './metrics.service';
import type { AttributionModel } from './attribution';

/**
 * GTM 感知摘要 (perception digest) — 供 StratOS GtmStack 只读消费 (跨仓感知桥)。
 *
 * 对齐 StratOS→Tandem 的 perception-digest 姿势:
 *   - 纯只读: 只聚合已有读模型 (metric_daily_rollup / metric_channel_attribution), 不触发刷新、不写库。
 *   - 服务令牌鉴权 + 固定租户 (GTM_PERCEPTION_TENANT_ID), 由 controller 层把关。
 *   - 输出保持紧凑 (北极星漏斗 + 渠道归因 Top), 便于 StratOS 侧直接绑到 GtmBet/前提校验。
 */

export interface GtmFunnelSummary {
  from: string;
  to: string;
  reach: number;
  lead: number;
  visit: number;
  proposal: number;
  revenue: number;
  referral: number;
  /** lead→revenue 转化率 (0-1); lead=0 时为 null (区分"没线索"与"没转化") */
  leadToRevenueRate: number | null;
  /** 参与聚合的 (日×渠道) 行数, 供消费端判断数据充分性 */
  rollupRows: number;
}

export interface GtmChannelCredit {
  channel: string;
  creditedConversions: number;
  share: number;
  touches: number;
}

export interface GtmDigest {
  generatedAt: string;
  window: { days: number; period: string; model: AttributionModel };
  funnel: GtmFunnelSummary;
  attribution: { period: string; model: AttributionModel; channels: GtmChannelCredit[] };
  dataSource: 'metrics-read-model';
}

const DAY_MS = 24 * 3600 * 1000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultPeriod(now: Date): string {
  return now.toISOString().slice(0, 7);
}

@Injectable()
export class GtmDigestService {
  constructor(private readonly metrics: MetricsService) {}

  async buildDigest(
    actor: JwtPayload,
    opts: { days?: number; period?: string; model?: AttributionModel } = {},
  ): Promise<GtmDigest> {
    const now = new Date();
    const days = Math.min(Math.max(opts.days ?? 30, 1), 180);
    const period = opts.period || defaultPeriod(now);
    const model: AttributionModel = opts.model || 'position';
    const from = isoDate(new Date(now.getTime() - days * DAY_MS));
    const to = isoDate(now);

    const [{ rollup }, attribution] = await Promise.all([
      this.metrics.getDailyRollup(actor, { from, to }),
      this.metrics.getChannelAttribution(actor, period, model),
    ]);

    const funnel: GtmFunnelSummary = {
      from,
      to,
      reach: 0,
      lead: 0,
      visit: 0,
      proposal: 0,
      revenue: 0,
      referral: 0,
      leadToRevenueRate: null,
      rollupRows: rollup.length,
    };
    for (const row of rollup as Array<Record<string, unknown>>) {
      funnel.reach += Number(row.reach) || 0;
      funnel.lead += Number(row.lead) || 0;
      funnel.visit += Number(row.visit) || 0;
      funnel.proposal += Number(row.proposal) || 0;
      funnel.revenue += Number(row.revenue) || 0;
      funnel.referral += Number(row.referral) || 0;
    }
    funnel.leadToRevenueRate = funnel.lead > 0 ? Number((funnel.revenue / funnel.lead).toFixed(4)) : null;

    return {
      generatedAt: now.toISOString(),
      window: { days, period, model },
      funnel,
      attribution: {
        period: attribution.period,
        model: attribution.model,
        channels: attribution.channels.slice(0, 20),
      },
      dataSource: 'metrics-read-model',
    };
  }
}
