import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'rhautt_nexus', name: 'content_asset' })
export class ContentAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_code', type: 'varchar', nullable: true }) brandCode: string | null;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ default: 'article' }) kind: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) body: string | null;
  @Column({ name: 'fact_refs', type: 'jsonb', default: () => "'[]'::jsonb" }) factRefs: Array<{
    type: string;
    id: string;
    label?: string;
    verified?: boolean;
  }>;
  @Column({ type: 'varchar', nullable: true }) channel: string | null;
  @Column({ name: 'compliance_flags', type: 'jsonb', default: () => "'[]'::jsonb" })
  complianceFlags: string[];
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'varchar', nullable: true }) author: string | null;
  @Column({ type: 'varchar', nullable: true }) reviewer: string | null;
  @Column({ name: 'source_type', type: 'varchar', nullable: true }) sourceType: string | null;
  @Column({ name: 'source_ref', type: 'varchar', nullable: true }) sourceRef: string | null;
  @Column({ name: 'source_label', type: 'varchar', nullable: true }) sourceLabel: string | null;
  @Column({ name: 'review_note', type: 'text', nullable: true }) reviewNote: string | null;
  @Column({ name: 'rejection_reason', type: 'varchar', nullable: true }) rejectionReason:
    string | null;
  @Column({ name: 'review_history', type: 'jsonb', default: () => "'[]'::jsonb" })
  reviewHistory: Array<{
    decision: string;
    reason?: string;
    note?: string;
    reviewer?: string;
    at?: string;
  }>;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}

@Entity({ schema: 'rhautt_nexus', name: 'content_publish_task' })
export class ContentPublishTaskEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'content_id' }) @Index() contentId: string;
  @Column({ type: 'varchar' }) channel: string;
  @Column({ name: 'target_name', type: 'varchar', nullable: true }) targetName: string | null;
  @Column({ name: 'publish_mode', type: 'varchar', default: 'manual' }) publishMode: string;
  @Column({ default: 'manual_required' }) status: string;
  @Column({ type: 'varchar', nullable: true }) owner: string | null;
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true }) scheduledAt: Date | null;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ name: 'evidence_url', type: 'varchar', nullable: true }) evidenceUrl: string | null;
  @Column({ name: 'evidence_note', type: 'text', nullable: true }) evidenceNote: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' }) createdAt: Date;
  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' }) updatedAt: Date;
}
