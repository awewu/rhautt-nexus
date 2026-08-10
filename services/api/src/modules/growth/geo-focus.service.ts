import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import type { JwtPayload } from '../auth/auth.service';
import { GeoTargetEntity, GeoCognitionAssetEntity } from './geo-focus.entity';

/**
 * GEO 进化服务（借鉴分众智投）：
 *  选点(selectTargets) · 千问千面(variantStrategy) · 认知资产漏斗(cognitionFunnel) · 按 lift 重分配(reallocate)。
 */
@Injectable()
export class GeoFocusService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  async upsertTarget(actor: JwtPayload, dto: { id?: string; category?: string; query?: string; brandCode?: string; segment?: string; scenario?: string; engine?: string; priorityScore?: number; variantStrategy?: Record<string, unknown>; intentStage?: string; probeType?: string; region?: string; assetGaps?: string[]; probeStrategy?: Record<string, unknown> }) {
    if (!dto.category || !dto.query) throw new BadRequestException('category and query required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GeoTargetEntity);
      const probeType = normalizeProbeType(dto.probeType);
      const intentStage = normalizeIntentStage(dto.intentStage);
      const assetGaps = normalizeAssetGaps(dto.assetGaps, probeType);
      if (dto.id) {
        await repo.update({ id: dto.id, tenantId: actor.tenantId }, {
          query: dto.query!, category: dto.category!, brandCode: dto.brandCode ?? null, segment: dto.segment ?? null,
          scenario: dto.scenario ?? null, engine: dto.engine ?? null, priorityScore: Number(dto.priorityScore) || 0,
          intentStage, probeType, region: dto.region ?? null, assetGaps, probeStrategy: (dto.probeStrategy ?? {}) as any,
          variantStrategy: (dto.variantStrategy ?? {}) as any, updatedAt: new Date(),
        } as any);
        return { id: dto.id, updated: true };
      }
      const row = await repo.save(repo.create({
        tenantId: actor.tenantId, category: dto.category!, query: dto.query!, brandCode: dto.brandCode ?? null,
        segment: dto.segment ?? null, scenario: dto.scenario ?? null, engine: dto.engine ?? null,
        intentStage, probeType, region: dto.region ?? null, assetGaps, probeStrategy: (dto.probeStrategy ?? {}) as any,
        priorityScore: Number(dto.priorityScore) || 0, variantStrategy: (dto.variantStrategy ?? {}) as any, status: 'candidate',
      }));
      return { target: row };
    }, this.scope(actor));
  }

  // 选点：按潜客浓度×价值 优先级排序（分众"选楼"的 GEO 版）。
  async selectTargets(actor: JwtPayload, category: string, opts: { segment?: string; limit?: number } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(GeoTargetEntity).createQueryBuilder('t')
        .where('t.tenant_id = :tn AND t.category = :c', { tn: actor.tenantId, c: category })
        .andWhere("t.status IN ('candidate','active')");
      if (opts.segment) qb.andWhere('t.segment = :s', { s: opts.segment });
      qb.orderBy('t.priority_score', 'DESC').limit(Math.min(Number(opts.limit) || 20, 100));
      return { category, targets: await qb.getMany() };
    }, this.scope(actor));
  }

  async listTargets(actor: JwtPayload, category?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (category) where.category = category;
      return { targets: await em.getRepository(GeoTargetEntity).find({ where, order: { priorityScore: 'DESC' }, take: 200 }) };
    }, this.scope(actor));
  }

  async listProbePool(actor: JwtPayload, query: { category?: string; probeType?: string; segment?: string; engine?: string } = {}) {
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(GeoTargetEntity).createQueryBuilder('t')
        .where('t.tenant_id = :tn', { tn: actor.tenantId });
      if (query.category) qb.andWhere('t.category = :category', { category: query.category });
      if (query.probeType) qb.andWhere('t.probe_type = :probeType', { probeType: normalizeProbeType(query.probeType) });
      if (query.segment) qb.andWhere('t.segment = :segment', { segment: query.segment });
      if (query.engine) qb.andWhere('t.engine = :engine', { engine: query.engine });
      const targets = await qb.orderBy('t.priority_score', 'DESC').addOrderBy('t.created_at', 'DESC').limit(300).getMany();
      return { category: query.category ?? 'all', targets, summary: summarizeProbePool(targets) };
    }, this.scope(actor));
  }

  async seedProbePool(actor: JwtPayload, dto: { category?: string; brandCode?: string; engine?: string; region?: string; segment?: string }) {
    if (!dto.category) throw new BadRequestException('category required');
    const categoryLabel = categoryName(dto.category);
    const seeds = buildProbeSeeds(categoryLabel, dto);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GeoTargetEntity);
      const created: GeoTargetEntity[] = [];
      let skipped = 0;
      for (const seed of seeds) {
        const exists = await repo.findOne({
          where: {
            tenantId: actor.tenantId,
            category: dto.category,
            query: seed.query,
            probeType: seed.probeType,
            segment: seed.segment ?? null,
            engine: seed.engine ?? null,
          } as any,
        });
        if (exists) { skipped += 1; continue; }
        const entity = repo.create({
          tenantId: actor.tenantId,
          brandCode: dto.brandCode ?? null,
          category: dto.category!,
          query: seed.query,
          segment: seed.segment ?? dto.segment ?? null,
          scenario: seed.scenario,
          engine: seed.engine ?? dto.engine ?? null,
          intentStage: seed.intentStage,
          probeType: seed.probeType,
          region: seed.region ?? dto.region ?? null,
          assetGaps: seed.assetGaps,
          probeStrategy: seed.probeStrategy,
          priorityScore: seed.priorityScore,
          variantStrategy: {},
          status: 'candidate',
        });
        const row = await repo.save(entity);
        created.push(row);
      }
      const all = await repo.find({ where: { tenantId: actor.tenantId, category: dto.category } as any, order: { priorityScore: 'DESC' }, take: 300 });
      return { category: dto.category, created: created.length, skipped, targets: all, summary: summarizeProbePool(all) };
    }, this.scope(actor));
  }

  // 认知资产漏斗累积（AI-AIPL）：increment 触达/引用/推荐/线索。
  async recordCognition(actor: JwtPayload, dto: { brandCode?: string; category?: string; engine?: string; period?: string; reach?: number; cited?: number; recommended?: number; lead?: number }) {
    if (!dto.brandCode || !dto.category) throw new BadRequestException('brandCode and category required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GeoCognitionAssetEntity);
      const where = { tenantId: actor.tenantId, brandCode: dto.brandCode!, category: dto.category!, engine: dto.engine ?? null, period: dto.period ?? null };
      const existing = await repo.findOne({ where: where as any });
      if (existing) {
        await repo.update({ id: existing.id }, {
          reach: existing.reach + (Number(dto.reach) || 0), cited: existing.cited + (Number(dto.cited) || 0),
          recommended: existing.recommended + (Number(dto.recommended) || 0), lead: existing.lead + (Number(dto.lead) || 0),
          updatedAt: new Date(),
        });
        return { id: existing.id, updated: true };
      }
      const row = await repo.save(repo.create({
        ...where, reach: Number(dto.reach) || 0, cited: Number(dto.cited) || 0,
        recommended: Number(dto.recommended) || 0, lead: Number(dto.lead) || 0,
      } as any));
      return { asset: row };
    }, this.scope(actor));
  }

  // 认知资产漏斗读取 + 转化率（触达→引用→推荐→线索）。
  async cognitionFunnel(actor: JwtPayload, category?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const params: any[] = [actor.tenantId];
      let sql = `SELECT COALESCE(SUM(reach),0) reach, COALESCE(SUM(cited),0) cited, COALESCE(SUM(recommended),0) recommended, COALESCE(SUM(lead),0) lead
                   FROM rhautt_nexus.geo_cognition_asset WHERE tenant_id = $1`;
      if (category) { sql += ' AND category = $2'; params.push(category); }
      const rows: Array<{ reach: string; cited: string; recommended: string; lead: string }> = await em.query(sql, params).catch(() => []);
      const r = rows[0] || { reach: '0', cited: '0', recommended: '0', lead: '0' };
      const reach = Number(r.reach), cited = Number(r.cited), recommended = Number(r.recommended), lead = Number(r.lead);
      return {
        category: category ?? 'all',
        funnel: { reach, cited, recommended, lead },
        rates: {
          citeRate: reach ? cited / reach : 0,
          recommendRate: cited ? recommended / cited : 0,
          leadRate: recommended ? lead / recommended : 0,
        },
      };
    }, this.scope(actor));
  }

  // 可优化：按 lift 把优先级火力重分配到高增益目标（分众"预算重分配到高转化城市"的 GEO 版）。
  async reallocate(actor: JwtPayload, adjustments: Array<{ id: string; deltaPriority: number }>) {
    if (!Array.isArray(adjustments) || !adjustments.length) throw new BadRequestException('adjustments required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(GeoTargetEntity);
      for (const a of adjustments) {
        const t = await repo.findOne({ where: { id: a.id, tenantId: actor.tenantId } });
        if (t) await repo.update({ id: t.id }, { priorityScore: Number(t.priorityScore) + Number(a.deltaPriority || 0), status: 'active', updatedAt: new Date() });
      }
      return { reallocated: adjustments.length };
    }, this.scope(actor));
  }
}

const PROBE_TYPES = ['category', 'scenario', 'comparison', 'selection', 'pain_point', 'region', 'role'];
const INTENT_STAGES = ['awareness', 'compare', 'selection', 'quote', 'after_sales'];

function normalizeProbeType(v?: string) {
  return PROBE_TYPES.includes(String(v || '')) ? String(v) : 'category';
}

function normalizeIntentStage(v?: string) {
  return INTENT_STAGES.includes(String(v || '')) ? String(v) : 'compare';
}

function normalizeAssetGaps(v: unknown, probeType: string) {
  if (Array.isArray(v) && v.length) return v.map(String).filter(Boolean).slice(0, 8);
  if (probeType === 'comparison') return ['对比解释资产', '案例证明资产'];
  if (probeType === 'selection') return ['产品事实资产', '技术权威资产'];
  if (probeType === 'region') return ['区域承接页', '经销商承接路径'];
  if (probeType === 'pain_point') return ['FAQ 问答资产', '技术解释资产'];
  return ['机器可读资产', '场景方案资产'];
}

export function summarizeProbePool(targets: GeoTargetEntity[]) {
  const byType = Object.fromEntries(PROBE_TYPES.map((type) => [type, 0])) as Record<string, number>;
  const byStage = Object.fromEntries(INTENT_STAGES.map((stage) => [stage, 0])) as Record<string, number>;
  let highPriority = 0;
  let probed = 0;
  for (const target of targets) {
    byType[target.probeType || 'category'] = (byType[target.probeType || 'category'] || 0) + 1;
    if (target.intentStage) byStage[target.intentStage] = (byStage[target.intentStage] || 0) + 1;
    if (Number(target.priorityScore || 0) >= 70) highPriority += 1;
    if (target.lastProbedAt) probed += 1;
  }
  return {
    total: targets.length,
    highPriority,
    probed,
    byType,
    byStage,
    coverageRate: targets.length ? probed / targets.length : 0,
  };
}

function categoryName(category: string) {
  const map: Record<string, string> = {
    'central-hot-water': '中央热水',
    'wall-hung-boiler': '壁挂炉',
    'water-cooled-ac': '水机空调',
  };
  return map[category] || category;
}

export function buildProbeSeeds(categoryLabel: string, dto: { engine?: string; region?: string; segment?: string }) {
  const region = dto.region || '华东';
  const segment = dto.segment || '终端用户';
  return [
    seed('category', `${categoryLabel}哪个品牌好`, 'awareness', 'topic', segment, 88),
    seed('category', `${categoryLabel}怎么选`, 'selection', 'faq', segment, 82),
    seed('scenario', `别墅${categoryLabel}方案怎么做`, 'selection', 'topic', '别墅业主', 86),
    seed('scenario', `酒店${categoryLabel}系统怎么设计`, 'selection', 'topic', '酒店工程', 84),
    seed('comparison', `Rheem 和国产${categoryLabel}品牌有什么区别`, 'compare', 'compare', segment, 90),
    seed('comparison', `${categoryLabel}空气能和燃气方案怎么比`, 'compare', 'compare', '设计师', 78),
    seed('selection', `${categoryLabel}容量怎么计算`, 'selection', 'faq', '设计师', 80),
    seed('selection', `多大面积适合用${categoryLabel}`, 'selection', 'faq', segment, 72),
    seed('pain_point', `${categoryLabel}忽冷忽热怎么解决`, 'after_sales', 'faq', '终端用户', 70),
    seed('pain_point', `${categoryLabel}能耗高是什么原因`, 'after_sales', 'faq', '终端用户', 68),
    seed('region', `${region}${categoryLabel}品牌推荐`, 'compare', 'topic', segment, 76, region),
    seed('role', `经销商怎么讲清${categoryLabel}技术优势`, 'quote', 'topic', '经销商', 74),
  ].map((item) => ({ ...item, engine: dto.engine || null }));
}

function seed(probeType: string, query: string, intentStage: string, scenario: string, segment: string, priorityScore: number, region: string | null = null) {
  return {
    probeType,
    query,
    intentStage,
    scenario,
    segment,
    region,
    priorityScore,
    assetGaps: normalizeAssetGaps([], probeType),
    probeStrategy: { cadence: 'weekly', expansion: ['原始问题', '语义改写', '角色视角', '多引擎复测'] },
  };
}
