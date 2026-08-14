import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { writeAudit } from '../common/audit';
import { computeMargin } from './pricing-gate';
import type { JwtPayload } from '../auth/auth.service';
import { ProductEntity } from './product-catalog.entity';
import {
  ProductLaunchEntity,
  ProductSellingPointEntity,
  PricingPolicyEntity,
  ProductFocusDeclarationEntity,
} from './product-mgmt.entity';
import { evaluateFocusEligibility } from './focus-gate';

const LIFECYCLE_STAGES = ['intro', 'growth', 'mature', 'eol'];
const MARGIN_FLOOR = Number(process.env.PRICING_MARGIN_FLOOR || 0.15); // 毛利闸阈值（基座3）

@Injectable()
export class ProductMgmtService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private scope(actor: JwtPayload) {
    return { tenantId: actor.tenantId, actorId: actor.userId, role: actor.role };
  }

  // 4.4 生命周期阶段流转
  async setLifecycleStage(actor: JwtPayload, productId: string, stage: string) {
    if (!LIFECYCLE_STAGES.includes(stage)) throw new BadRequestException('invalid lifecycle_stage');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const res = await em
          .getRepository(ProductEntity)
          .update({ id: productId }, { lifecycleStage: stage } as any);
        if (!res.affected) throw new NotFoundException('product not found');
        return { productId, lifecycleStage: stage };
      },
      this.scope(actor)
    );
  }

  // 4.5 NPI 上市
  async createLaunch(
    actor: JwtPayload,
    dto: {
      name?: string;
      productId?: string;
      sku?: string;
      plan?: Record<string, unknown>;
      checklist?: unknown[];
      targetDate?: string;
    }
  ) {
    if (!dto.name) throw new BadRequestException('launch name is required');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ProductLaunchEntity);
        const row = await repo.save(
          repo.create({
            tenantId: actor.tenantId,
            name: dto.name!,
            productId: dto.productId ?? null,
            sku: dto.sku ?? null,
            plan: dto.plan ?? {},
            checklist: dto.checklist ?? [],
            targetDate: dto.targetDate ?? null,
            status: 'planned',
          })
        );
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'product.launch.create',
          resourceType: 'product_launch',
          resourceId: row.id,
          afterState: { name: dto.name, sku: dto.sku ?? null, targetDate: dto.targetDate ?? null },
        });
        return { launch: row };
      },
      this.scope(actor)
    );
  }

  async listLaunches(actor: JwtPayload) {
    return withRlsTransaction(
      this.ds,
      async (em) => ({
        launches: await em
          .getRepository(ProductLaunchEntity)
          .find({ where: { tenantId: actor.tenantId }, order: { updatedAt: 'DESC' } }),
      }),
      this.scope(actor)
    );
  }

  async updateLaunchStatus(actor: JwtPayload, id: string, status: string) {
    if (!['planned', 'launching', 'launched', 'cancelled'].includes(status))
      throw new BadRequestException('invalid status');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        await em
          .getRepository(ProductLaunchEntity)
          .update({ id, tenantId: actor.tenantId }, { status, updatedAt: new Date() });
        return { id, status };
      },
      this.scope(actor)
    );
  }

  // 4.10 卖点（基座4：建议带 evidenceRef 事实依据）
  async addSellingPoint(
    actor: JwtPayload,
    dto: {
      productId?: string;
      sku?: string;
      segment?: string;
      claim?: string;
      evidenceRef?: string;
      sortOrder?: number;
    }
  ) {
    if (!dto.claim) throw new BadRequestException('claim is required');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ProductSellingPointEntity);
        const row = await repo.save(
          repo.create({
            tenantId: actor.tenantId,
            productId: dto.productId ?? null,
            sku: dto.sku ?? null,
            segment: dto.segment ?? null,
            claim: dto.claim!,
            evidenceRef: dto.evidenceRef ?? null,
            sortOrder: dto.sortOrder ?? 0,
          })
        );
        return { sellingPoint: row, evidenceMissing: !dto.evidenceRef };
      },
      this.scope(actor)
    );
  }

  async listSellingPoints(actor: JwtPayload, productId?: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const where: Record<string, unknown> = { tenantId: actor.tenantId };
        if (productId) where.productId = productId;
        return {
          sellingPoints: await em
            .getRepository(ProductSellingPointEntity)
            .find({ where, order: { sortOrder: 'ASC' } }),
        };
      },
      this.scope(actor)
    );
  }

  // 4.17 定价政策提报 → 毛利测算闸（基座3，纯逻辑见 pricing-gate.ts）
  async submitPricingPolicy(
    actor: JwtPayload,
    dto: {
      productId?: string;
      sku?: string;
      policyType?: string;
      proposedPrice?: number;
      costPrice?: number;
    }
  ) {
    if (!['list', 'promo', 'rebate'].includes(String(dto.policyType)))
      throw new BadRequestException('invalid policy_type');
    const marginCalc = computeMargin(
      Number(dto.proposedPrice) || 0,
      Number(dto.costPrice) || 0,
      MARGIN_FLOOR
    );
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(PricingPolicyEntity);
        const row = await repo.save(
          repo.create({
            tenantId: actor.tenantId,
            productId: dto.productId ?? null,
            sku: dto.sku ?? null,
            policyType: dto.policyType!,
            proposedPrice: Number(dto.proposedPrice) || 0,
            costPrice: Number(dto.costPrice) || 0,
            marginCalc: marginCalc as any,
            status: 'submitted',
            submittedBy: actor.userId,
            submittedAt: new Date(),
          })
        );
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'pricing.policy.submit',
          resourceType: 'pricing_policy',
          resourceId: row.id,
          afterState: {
            sku: dto.sku ?? null,
            policyType: dto.policyType,
            proposedPrice: Number(dto.proposedPrice) || 0,
            gatePassed: marginCalc.gatePassed,
          },
        });
        return {
          policy: row,
          gatePassed: marginCalc.gatePassed,
          warning: marginCalc.gatePassed
            ? null
            : `毛利率 ${(marginCalc.marginRate * 100).toFixed(1)}% 低于阈值 ${(MARGIN_FLOOR * 100).toFixed(0)}%，审批将被阻断（基座3）`,
        };
      },
      this.scope(actor)
    );
  }

  async decidePricingPolicy(
    actor: JwtPayload,
    id: string,
    decision: 'approved' | 'rejected',
    note?: string
  ) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(PricingPolicyEntity);
        const row = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
        if (!row) throw new NotFoundException('policy not found');
        if (decision === 'approved') {
          const gate = (row.marginCalc as any)?.gatePassed;
          if (!gate) throw new ForbiddenException('毛利闸未通过，不得批准发布（基座3）');
        }
        await repo.update(
          { id },
          {
            status: decision,
            approver: actor.userId,
            decisionNote: note ?? null,
            decidedAt: new Date(),
            updatedAt: new Date(),
          }
        );
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: `pricing.policy.${decision}`,
          resourceType: 'pricing_policy',
          resourceId: id,
          beforeState: { status: row.status },
          afterState: { status: decision, marginCalc: row.marginCalc, note: note ?? null },
        });
        return { id, status: decision };
      },
      this.scope(actor)
    );
  }

  async listPricingPolicies(actor: JwtPayload) {
    return withRlsTransaction(
      this.ds,
      async (em) => ({
        policies: await em
          .getRepository(PricingPolicyEntity)
          .find({ where: { tenantId: actor.tenantId }, order: { updatedAt: 'DESC' } }),
      }),
      this.scope(actor)
    );
  }

  // 定价毛利闸风险计数（喂 CMO riskAlerts）：提报中但毛利闸未过的政策数。
  async pricingRiskCount(actor: JwtPayload) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const rows: Array<{ n: string }> = await em
          .query(
            `SELECT COUNT(*) n FROM rhautt_nexus.pricing_policy
          WHERE tenant_id = $1 AND status = 'submitted' AND COALESCE((margin_calc->>'gatePassed')::boolean, true) = false`,
            [actor.tenantId]
          )
          .catch(() => []);
        return Number(rows[0]?.n || 0);
      },
      this.scope(actor)
    );
  }

  // 产品组合健康：按生命周期阶段分布 + 在途上市数（喂 CMO 舱 productPortfolio 屏）。
  async portfolioSummary(actor: JwtPayload) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const rows: Array<{ lifecycle_stage: string; n: string }> = await em
          .query(
            `SELECT lifecycle_stage, COUNT(*) AS n FROM rhautt_nexus.products GROUP BY lifecycle_stage`
          )
          .catch(() => []);
        const byStage: Record<string, number> = {};
        for (const r of rows) byStage[r.lifecycle_stage] = Number(r.n) || 0;
        const launches = await em
          .getRepository(ProductLaunchEntity)
          .count({ where: { tenantId: actor.tenantId } })
          .catch(() => 0);
        return { byStage, activeLaunches: launches };
      },
      this.scope(actor)
    );
  }

  // ── 主销产品声明（迁移 110）· 品牌 × 品类 × 时间窗 ──────────────────────
  // 「主销」是品牌方**策略声明**，不是市场事实断言。软件在此处的职责不是让人填名单，
  // 而是让这个声明**必须过三道闸**（毛利/生命周期/卖点证据，见 focus-gate.ts），
  // 否则推一个亏钱、停产或无事实依据的型号，代价由渠道和品牌承担。

  /** 取某产品的过闸输入：生命周期 + 已批准定价 + 带证据卖点。 */
  private async loadFocusGateInput(em: EntityManager, tenantId: string, productId: string) {
    const product = await em
      .getRepository(ProductEntity)
      .findOne({ where: { id: productId } as any });
    if (!product) throw new NotFoundException('product not found');
    // 毛利以「最近一条已批准的定价政策」为准；未批准的价格不得据以设主销。
    const pricing = await em.getRepository(PricingPolicyEntity).findOne({
      where: { tenantId, productId, status: 'approved' } as any,
      order: { decidedAt: 'DESC' } as any,
    });
    const sellingPoints = await em
      .getRepository(ProductSellingPointEntity)
      .find({ where: { tenantId, productId } as any, take: 50 });
    return {
      product,
      input: {
        lifecycleStage: (product as any).lifecycleStage ?? null,
        pricing: pricing
          ? {
              proposedPrice: Number(pricing.proposedPrice),
              costPrice: Number(pricing.costPrice),
              status: pricing.status,
            }
          : null,
        sellingPoints: sellingPoints.map((p) => ({ claim: p.claim, evidenceRef: p.evidenceRef })),
        marginFloor: MARGIN_FLOOR,
      },
    };
  }

  /**
   * 主销资格预检（只读，不落库）。供前端在声明前先看能不能过、卡在哪一闸。
   */
  async checkFocusEligibility(actor: JwtPayload, productId: string) {
    if (!productId) throw new BadRequestException('productId is required');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const { product, input } = await this.loadFocusGateInput(em, actor.tenantId, productId);
        const eligibility = evaluateFocusEligibility(input);
        return {
          productId,
          sku: (product as any).sku ?? null,
          eligibility,
          note: '主销是策略声明而非市场事实；过闸只保证该声明不明显自伤，不代表该型号真的好卖。',
        };
      },
      this.scope(actor)
    );
  }

  /**
   * 声明主销。三闸全过才落 active；任一不过则**拒绝并如实返回原因**，
   * 不静默降级为「已生效」。理由(rationale)必填——政策必须留下"为什么"。
   */
  async declareFocusProduct(
    actor: JwtPayload,
    dto: {
      brandSlug?: string;
      category?: string;
      productId?: string;
      periodStart?: string;
      periodEnd?: string;
      rationale?: string;
    }
  ) {
    const brandSlug = String(dto.brandSlug || '').trim();
    const category = String(dto.category || '').trim();
    const productId = String(dto.productId || '').trim();
    const rationale = String(dto.rationale || '').trim();
    if (!brandSlug || !category || !productId)
      throw new BadRequestException('brandSlug, category, productId are required');
    if (!rationale)
      throw new BadRequestException('rationale is required（主销是政策，必须写明为什么推它）');
    const periodStart = String(dto.periodStart || '').trim();
    const periodEnd = String(dto.periodEnd || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd))
      throw new BadRequestException('periodStart/periodEnd required as YYYY-MM-DD（暖通季节性强，主销须带生效期）');
    if (periodEnd < periodStart) throw new BadRequestException('periodEnd must be >= periodStart');

    return withRlsTransaction(
      this.ds,
      async (em) => {
        const { product, input } = await this.loadFocusGateInput(em, actor.tenantId, productId);
        const eligibility = evaluateFocusEligibility(input);
        if (!eligibility.eligible) {
          // 审计"被拦下"本身：谁想推什么、为什么没过，都要留痕
          await writeAudit(em, {
            tenantId: actor.tenantId,
            actorUserId: actor.userId,
            action: 'product.focus.blocked',
            resourceType: 'product_focus_declaration',
            resourceId: productId,
            afterState: { brandSlug, category, blockedBy: eligibility.blockedBy },
          });
          throw new ForbiddenException(
            `主销资格未通过（${eligibility.blockedBy.join('/')}）：` +
              eligibility.checks
                .filter((c) => !c.passed)
                .map((c) => c.reason)
                .join('；')
          );
        }

        const repo = em.getRepository(ProductFocusDeclarationEntity);
        const existing = await repo.findOne({
          where: { tenantId: actor.tenantId, brandSlug, category, productId, status: 'active' } as any,
        });
        if (existing)
          throw new BadRequestException(
            '该产品在此品牌/品类下已有生效中的主销声明（如需调整请先撤销）'
          );

        const row = await repo.save(
          repo.create({
            tenantId: actor.tenantId,
            brandSlug,
            category,
            productId,
            sku: (product as any).sku ?? null,
            periodStart,
            periodEnd,
            status: 'active',
            rationale,
            gateSnapshot: { ...eligibility, marginFloor: MARGIN_FLOOR, evaluatedAt: new Date().toISOString() } as any,
            declaredBy: actor.userId ?? null,
          })
        );
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'product.focus.declare',
          resourceType: 'product_focus_declaration',
          resourceId: row.id,
          afterState: { brandSlug, category, productId, periodStart, periodEnd, rationale },
        });
        return { declaration: row, eligibility };
      },
      this.scope(actor)
    );
  }

  /** 列主销声明。默认只列「当前日期落在生效期内且未撤销」的，过期自然失效。 */
  async listFocusProducts(
    actor: JwtPayload,
    q: { brandSlug?: string; category?: string; includeInactive?: boolean } = {}
  ) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const params: unknown[] = [actor.tenantId];
        let sql = `SELECT * FROM rhautt_nexus.product_focus_declaration WHERE tenant_id = $1`;
        if (q.brandSlug) {
          params.push(q.brandSlug);
          sql += ` AND brand_slug = $${params.length}`;
        }
        if (q.category) {
          params.push(q.category);
          sql += ` AND category = $${params.length}`;
        }
        if (!q.includeInactive) {
          sql += ` AND status = 'active' AND CURRENT_DATE BETWEEN period_start AND period_end`;
        }
        sql += ` ORDER BY period_end DESC, declared_at DESC LIMIT 200`;
        const rows = await em.query(sql, params).catch(() => []);
        return {
          declarations: rows,
          basis: 'policy-declaration' as const,
          note: '主销为品牌方策略声明（已过毛利/生命周期/卖点证据三闸），非销量事实；是否真好卖须由渠道报价与成交数据后验校验。',
        };
      },
      this.scope(actor)
    );
  }

  /** 撤销主销声明（不物理删除，保留决策痕迹）。 */
  async revokeFocusProduct(actor: JwtPayload, id: string, reason?: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ProductFocusDeclarationEntity);
        const row = await repo.findOne({ where: { id, tenantId: actor.tenantId } as any });
        if (!row) throw new NotFoundException('focus declaration not found');
        if (row.status === 'revoked') return { id, status: 'revoked', alreadyRevoked: true };
        await repo.update(
          { id },
          {
            status: 'revoked',
            revokedBy: actor.userId ?? null,
            revokedAt: new Date(),
            revokeReason: reason ?? null,
            updatedAt: new Date(),
          } as any
        );
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'product.focus.revoke',
          resourceType: 'product_focus_declaration',
          resourceId: id,
          beforeState: { status: row.status },
          afterState: { status: 'revoked', reason: reason ?? null },
        });
        return { id, status: 'revoked' };
      },
      this.scope(actor)
    );
  }

  /**
   * 主销后验校验（只读分析）——给总部的镜子：你声明推 A，渠道实际在报/在签什么？
   *
   * 数据口径（每条都如实标注，不冒充更强的口径）：
   * - 渠道报价 = quotations.bom 行级展开（quotation-bom）：渠道行为的**领先信号**，非成交事实。
   * - 成交 = opportunities.stage='signed' 关联报价的 BOM 行（signed-quotation-bom）：
   *   以报价 created_at 落生效期内为近似时间口径（签单时刻未单独建模，如实注明）。
   * - BOM 的 sku 是自由文本，与产品目录按 sku 精确匹配；匹配不上的行**如实计入 unmatched**，
   *   不猜测归属。
   *
   * 分歧信号（只报事实，不下结论"主销定错了"——季节/铺货/激励都可能是原因）：
   * - declared-but-not-quoted：主销型号在生效期内一条报价都没有。
   * - channel-prefers-nonfocus：同品类非主销型号的报价量超过了所有主销型号。
   */
  async focusRealityCheck(actor: JwtPayload, q: { brandSlug?: string; category?: string } = {}) {
    const brandSlug = String(q.brandSlug || '').trim();
    if (!brandSlug) throw new BadRequestException('brandSlug is required');
    const category = String(q.category || '').trim() || null;
    return withRlsTransaction(
      this.ds,
      async (em) => {
        // ① 生效中的主销声明
        const fParams: unknown[] = [actor.tenantId, brandSlug];
        let fSql = `
          SELECT f.product_id, f.sku, f.category, f.period_start, f.period_end, p.name AS product_name
            FROM rhautt_nexus.product_focus_declaration f
            JOIN rhautt_nexus.products p ON p.id = f.product_id
           WHERE f.tenant_id = $1 AND f.brand_slug = $2 AND f.status = 'active'
             AND CURRENT_DATE BETWEEN f.period_start AND f.period_end`;
        if (category) {
          fParams.push(category);
          fSql += ` AND f.category = $${fParams.length}`;
        }
        const focus: Array<{
          product_id: string;
          sku: string | null;
          category: string;
          period_start: string;
          period_end: string;
          product_name: string;
        }> = await em.query(fSql, fParams);
        if (!focus.length) {
          return {
            focus: [],
            topNonFocus: [],
            signals: [],
            note: '无生效中的主销声明，无从对比——先声明主销再做后验校验。',
          };
        }

        // 观察窗 = 各声明生效期的并集（分析窗口，不改变声明各自的生效期语义）
        const windowStart = focus.map((f) => f.period_start).sort()[0];
        const windowEnd = focus
          .map((f) => f.period_end)
          .sort()
          .at(-1)!;
        const categories = [...new Set(focus.map((f) => f.category))];

        // ② 报价 BOM 行级聚合（含成交子口径），限本租户 + 观察窗 + 主销涉及的品类
        const aggParams: unknown[] = [actor.tenantId, windowStart, windowEnd, categories];
        const agg: Array<{
          sku: string;
          category: string | null;
          product_name: string | null;
          quote_lines: string;
          quoted_qty: string;
          quoted_amount: string;
          signed_lines: string;
          signed_qty: string;
          signed_amount: string;
        }> = await em.query(
          `
          WITH lines AS (
            SELECT COALESCE(item->>'sku', item->>'model') AS sku,
                   COALESCE((item->>'quantity')::numeric, 1) AS qty,
                   COALESCE((item->>'unitPrice')::numeric, (item->>'price')::numeric, 0) AS unit_price,
                   EXISTS (
                     SELECT 1 FROM rhautt_nexus.opportunities o
                      WHERE o.quotation_id::text = q.id::text AND o.stage = 'signed'
                   ) AS signed
              FROM rhautt_nexus.quotations q, jsonb_array_elements(q.bom) item
             WHERE q.tenant_id = $1 AND q.created_at::date BETWEEN $2 AND $3
               AND COALESCE(item->>'sku', item->>'model') IS NOT NULL
          )
          SELECT l.sku, p.category, p.name AS product_name,
                 COUNT(*) AS quote_lines,
                 SUM(l.qty) AS quoted_qty,
                 SUM(l.qty * l.unit_price) AS quoted_amount,
                 COUNT(*) FILTER (WHERE l.signed) AS signed_lines,
                 COALESCE(SUM(l.qty) FILTER (WHERE l.signed), 0) AS signed_qty,
                 COALESCE(SUM(l.qty * l.unit_price) FILTER (WHERE l.signed), 0) AS signed_amount
            FROM lines l
            LEFT JOIN rhautt_nexus.products p ON p.sku = l.sku
           WHERE p.category = ANY($4) OR p.category IS NULL
           GROUP BY l.sku, p.category, p.name
           ORDER BY quoted_qty DESC
           LIMIT 200`,
          aggParams
        );

        const num = (v: unknown) => Number(v) || 0;
        const bySku = new Map(agg.map((r) => [r.sku, r]));
        const focusSkus = new Set(focus.map((f) => f.sku).filter(Boolean) as string[]);

        const focusItems = focus.map((f) => {
          const r = f.sku ? bySku.get(f.sku) : undefined;
          return {
            sku: f.sku,
            productName: f.product_name,
            category: f.category,
            period: { start: f.period_start, end: f.period_end },
            quotedLines: num(r?.quote_lines),
            quotedQty: num(r?.quoted_qty),
            quotedAmount: num(r?.quoted_amount),
            signedQty: num(r?.signed_qty),
            signedAmount: num(r?.signed_amount),
          };
        });
        const topNonFocus = agg
          .filter((r) => !focusSkus.has(r.sku) && r.category)
          .slice(0, 10)
          .map((r) => ({
            sku: r.sku,
            productName: r.product_name,
            category: r.category,
            quotedLines: num(r.quote_lines),
            quotedQty: num(r.quoted_qty),
            quotedAmount: num(r.quoted_amount),
            signedQty: num(r.signed_qty),
            signedAmount: num(r.signed_amount),
          }));
        const unmatched = agg
          .filter((r) => !r.category)
          .reduce((s, r) => s + num(r.quote_lines), 0);

        // ③ 分歧信号（只报事实）
        const signals: Array<{ kind: string; detail: string }> = [];
        for (const f of focusItems) {
          if (f.quotedQty === 0)
            signals.push({
              kind: 'declared-but-not-quoted',
              detail: `主销「${f.productName}」(${f.sku ?? '无SKU'}) 在生效期内没有任何渠道报价`,
            });
        }
        const maxFocusQty = Math.max(0, ...focusItems.map((f) => f.quotedQty));
        for (const r of topNonFocus) {
          if (r.quotedQty > maxFocusQty)
            signals.push({
              kind: 'channel-prefers-nonfocus',
              detail: `非主销「${r.productName ?? r.sku}」报价量 ${r.quotedQty} 超过全部主销型号（最高 ${maxFocusQty}）`,
            });
        }

        return {
          window: { start: windowStart, end: windowEnd },
          categories,
          focus: focusItems,
          topNonFocus,
          unmatchedQuoteLines: unmatched,
          signals,
          basis: {
            quoted: 'quotation-bom（渠道报价行为，领先信号非成交事实）',
            signed:
              'signed-quotation-bom（商机 stage=signed 关联报价的 BOM；时间口径为报价创建日落窗内的近似）',
            matching: 'BOM sku 与产品目录精确匹配；匹配不上的行计入 unmatchedQuoteLines，不猜测归属',
          },
          note: '分歧信号只报事实，不判定"主销定错了"——季节、铺货、渠道激励都可能是原因；处置属经营决策。',
        };
      },
      this.scope(actor)
    );
  }
}
