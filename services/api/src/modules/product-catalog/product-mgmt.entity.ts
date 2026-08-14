import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// 4.5 NPI 新品上市计划
@Entity({ schema: 'rhautt_nexus', name: 'product_launch' })
export class ProductLaunchEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId: string | null;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column() name: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) plan: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) checklist: unknown[];
  @Column({ default: 'planned' }) status: string;
  @Column({ name: 'target_date', type: 'date', nullable: true }) targetDate: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

// 4.10 per-产品卖点体系
@Entity({ schema: 'rhautt_nexus', name: 'product_selling_point' })
export class ProductSellingPointEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId: string | null;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column({ type: 'varchar', nullable: true }) segment: string | null;
  @Column() claim: string;
  @Column({ name: 'evidence_ref', type: 'varchar', nullable: true }) evidenceRef: string | null;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
}

// 4.17 定价政策（毛利闸·基座3）
@Entity({ schema: 'rhautt_nexus', name: 'pricing_policy' })
export class PricingPolicyEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId: string | null;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column({ name: 'policy_type' }) policyType: string;
  @Column({ name: 'proposed_price', type: 'numeric', default: 0 }) proposedPrice: number;
  @Column({ name: 'cost_price', type: 'numeric', default: 0 }) costPrice: number;
  @Column({ name: 'margin_calc', type: 'jsonb', default: () => "'{}'::jsonb" }) marginCalc: Record<
    string,
    unknown
  >;
  @Column({ default: 'draft' }) status: string;
  @Column({ name: 'submitted_by', type: 'varchar', nullable: true }) submittedBy: string | null;
  @Column({ type: 'varchar', nullable: true }) approver: string | null;
  @Column({ name: 'decision_note', type: 'varchar', nullable: true }) decisionNote: string | null;
  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true }) submittedAt: Date | null;
  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true }) decidedAt: Date | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

/**
 * 主销产品声明（迁移 110）·「品牌 × 品类 × 时间窗」
 *
 * 性质：**品牌方策略声明**，非市场事实断言（"哪个真好卖"需销量数据，当前不具备）。
 * 生效前须过三道闸（毛利/生命周期/卖点证据，见 focus-gate.ts），过闸快照留 gateSnapshot
 * 以便事后复算"当时凭什么判它合格"。撤销不物理删除，保留决策痕迹。
 */
@Entity({ schema: 'rhautt_nexus', name: 'product_focus_declaration' })
export class ProductFocusDeclarationEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_slug' }) brandSlug: string;
  @Column() category: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId: string | null;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column({ name: 'period_start', type: 'date' }) periodStart: string;
  @Column({ name: 'period_end', type: 'date' }) periodEnd: string;
  @Column({ default: 'active' }) status: string; // active | revoked
  /** 为什么推它：政策而非数据推导，故理由必填 */
  @Column({ type: 'text' }) rationale: string;
  @Column({ name: 'gate_snapshot', type: 'jsonb', default: () => "'{}'::jsonb" })
  gateSnapshot: Record<string, unknown>;
  @Column({ name: 'declared_by', type: 'varchar', nullable: true }) declaredBy: string | null;
  @Column({ name: 'declared_at', type: 'timestamptz', default: () => 'now()' }) declaredAt: Date;
  @Column({ name: 'revoked_by', type: 'varchar', nullable: true }) revokedBy: string | null;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @Column({ name: 'revoke_reason', type: 'text', nullable: true }) revokeReason: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}
