import { Controller, Get, Headers, HttpException, Query } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import type { JwtPayload } from '../auth/auth.service';
import type { AttributionModel } from './attribution';
import { GtmDigestService } from './gtm-digest.service';

/**
 * GET /api/v2/metrics/gtm-digest — GTM 感知端点 · 供 StratOS 只读消费。
 *
 * 纪律 (对齐 StratOS perception-digest / Tandem strategy.validity_digest 姿势):
 *   - 服务令牌鉴权: Authorization: Bearer <GTM_PERCEPTION_TOKEN>;
 *     未配置令牌或租户 → 503 (诚实告知桥未启用), 令牌不符 → 401。
 *   - 不走用户 JWT (AuthGuard), 用固定租户 GTM_PERCEPTION_TENANT_ID 绑 RLS 事务,
 *     合成 actor 只读, 不产生任何写入。
 *   - 消费端 (StratOS) 自行 fail-soft: 本端点故障不应阻塞战略流程。
 */

const SERVICE_ACTOR_ID = 'stratos-perception';
const MODELS: ReadonlyArray<AttributionModel> = ['linear', 'position', 'time_decay'];

export function checkPerceptionAccess(
  env: NodeJS.ProcessEnv,
  authorizationHeader: string | undefined
): { ok: true; tenantId: string } | { ok: false; status: number; error: string } {
  const expected = (env.GTM_PERCEPTION_TOKEN || '').trim();
  const tenantId = (env.GTM_PERCEPTION_TENANT_ID || '').trim();
  if (!expected || !tenantId) {
    return {
      ok: false,
      status: 503,
      error: 'GTM perception bridge 未启用 (需 GTM_PERCEPTION_TOKEN + GTM_PERCEPTION_TENANT_ID)',
    };
  }
  const header = authorizationHeader || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token || token !== expected) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true, tenantId };
}

export function perceptionActor(tenantId: string): JwtPayload {
  return {
    userId: SERVICE_ACTOR_ID,
    tenantId,
    dealerId: null,
    storeId: null,
    customerId: null,
    role: 'service-readonly',
    permissions: [],
  };
}

@Controller('metrics')
export class GtmDigestController {
  constructor(private readonly digest: GtmDigestService) {}

  // 全局 APP_GUARD 是 deny-by-default; 本端点自带服务令牌鉴权 (checkPerceptionAccess),
  // 与其它自鉴权公开端点姿势一致, 必须 @Public() 否则用户 JWT 守卫会在进入前拦截。
  @Public()
  @Get('gtm-digest')
  async gtmDigest(
    @Headers('authorization') authorization: string | undefined,
    @Query('days') days?: string,
    @Query('period') period?: string,
    @Query('model') model?: string
  ) {
    const access = checkPerceptionAccess(process.env, authorization);
    if (!access.ok) {
      throw new HttpException({ ok: false, error: access.error }, access.status);
    }
    const parsedDays = Number(days);
    const safeModel = MODELS.includes(model as AttributionModel)
      ? (model as AttributionModel)
      : undefined;
    const result = await this.digest.buildDigest(perceptionActor(access.tenantId), {
      days: Number.isFinite(parsedDays) ? parsedDays : undefined,
      period: period || undefined,
      model: safeModel,
    });
    return { ok: true, ...result };
  }
}
