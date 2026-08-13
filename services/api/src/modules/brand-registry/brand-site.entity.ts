import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tenant_brand_sites')
@Index(['tenantId', 'code'], { unique: true })
export class BrandSiteEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column() code: string;
  @Column({ name: 'name_cn' }) nameCn: string;
  @Column({ name: 'name_en' }) nameEn: string;
  @Column({ name: 'app_key', type: 'varchar', nullable: true }) appKey: string | null;
  @Column({ name: 'delivery_type', default: 'self_hosted' }) deliveryType:
    'self_hosted' | 'external';
  @Column({ name: 'development_url', type: 'varchar', nullable: true }) developmentUrl:
    string | null;
  @Column({ name: 'production_url', type: 'varchar', nullable: true }) productionUrl: string | null;
  @Column({ name: 'logo_artifact_id', type: 'uuid', nullable: true }) logoArtifactId: string | null;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ default: 'active' }) status: 'active' | 'inactive';
  @Column({ name: 'site_note', type: 'text', nullable: true }) siteNote: string | null;
  @Column({ name: 'child_brand_codes', type: 'jsonb', default: () => "'[]'::jsonb" })
  childBrandCodes: string[];
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('brand_site_basic_settings')
@Index(['tenantId', 'siteId'], { unique: true })
export class BrandSiteBasicSettingsEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column({ name: 'site_code' }) @Index() siteCode: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) identity: Record<string, unknown>;
  @Column({ name: 'brand_claims', type: 'jsonb', default: () => "'{}'::jsonb" })
  brandClaims: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) stats: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) organization: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) contact: Record<string, unknown>;
  @Column({ name: 'dealer_service', type: 'jsonb', default: () => "'{}'::jsonb" })
  dealerService: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) legal: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) privacy: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) seo: Record<string, unknown>;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) analytics: Record<string, unknown>;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('site_product_assignments')
@Index(['tenantId', 'siteId', 'productId'])
export class SiteProductAssignmentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column({ name: 'product_tenant_id' }) productTenantId: string;
  @Column({ name: 'product_id' }) @Index() productId: string;
  @Column({ type: 'varchar', nullable: true }) brand: string | null;
  @Column({ name: 'public_slug' }) publicSlug: string;
  @Column({ name: 'site_product_category_id', type: 'uuid', nullable: true })
  siteProductCategoryId: string | null;
  @Column({ name: 'website_category', type: 'varchar', nullable: true }) websiteCategory:
    string | null;
  @Column({ name: 'menu_group', type: 'varchar', nullable: true }) menuGroup: string | null;
  @Column({ name: 'display_order', default: 0 }) displayOrder: number;
  @Column({ name: 'is_featured', default: false }) isFeatured: boolean;
  @Column({ default: 'draft' }) @Index() status: 'draft' | 'published' | 'hidden';
  @Column({ name: 'site_title', type: 'varchar', nullable: true }) siteTitle: string | null;
  @Column({ name: 'site_summary', type: 'text', nullable: true }) siteSummary: string | null;
  @Column({ name: 'site_meta', type: 'jsonb', default: () => "'{}'::jsonb" }) siteMeta: Record<
    string,
    unknown
  >;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('site_product_categories')
@Index(['tenantId', 'siteId', 'parentId', 'code'], { unique: true, where: 'deleted_at IS NULL' })
export class SiteProductCategoryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column({ name: 'parent_id', type: 'uuid', nullable: true }) @Index() parentId: string | null;
  @Column({ default: 1 }) level: number;
  @Column() code: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) slug: string | null;
  @Column({ name: 'menu_group', type: 'varchar', nullable: true }) menuGroup: string | null;
  @Column({ name: 'mapped_base_category_id', type: 'uuid', nullable: true }) mappedBaseCategoryId:
    string | null;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ name: 'is_visible', default: true }) isVisible: boolean;
  @Column({ name: 'is_featured', default: false }) isFeatured: boolean;
  @Column({ default: 'active' }) @Index() status: 'active' | 'inactive';
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('site_news_articles')
@Index(['tenantId', 'siteId', 'slug'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['tenantId', 'siteId', 'status'])
export class SiteNewsArticleEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column() slug: string;
  @Column() title: string;
  @Column({ type: 'text' }) summary: string;
  @Column({ type: 'text', default: '' }) body: string;
  @Column({ name: 'cover_image_artifact_id', type: 'uuid', nullable: true }) coverImageArtifactId:
    string | null;
  @Column({ name: 'cover_image_url', type: 'text', nullable: true }) coverImageUrl: string | null;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ default: 'draft' }) @Index() status: 'draft' | 'published' | 'hidden' | 'archived';
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ name: 'is_featured', default: false }) isFeatured: boolean;
  @Column({ name: 'site_meta', type: 'jsonb', default: () => "'{}'::jsonb" }) siteMeta: Record<
    string,
    unknown
  >;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('site_document_categories')
@Index(['tenantId', 'siteId', 'slug'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['tenantId', 'siteId', 'scope', 'status'])
export class SiteDocumentCategoryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column() slug: string;
  @Column() name: string;
  @Column({ default: 'all' }) scope: 'residential' | 'commercial' | 'all';
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ default: 'active' }) status: 'active' | 'inactive';
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('site_documents')
@Index(['tenantId', 'siteId', 'scope', 'status'])
@Index(['tenantId', 'siteId', 'categoryId'])
export class SiteDocumentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column({ name: 'category_id' }) @Index() categoryId: string;
  @Column({ name: 'artifact_id', type: 'uuid' }) artifactId: string;
  @Column({ name: 'display_name' }) displayName: string;
  @Column({ name: 'original_filename' }) originalFilename: string;
  @Column({ name: 'mime_type', type: 'varchar', nullable: true }) mimeType: string | null;
  @Column({ name: 'size_bytes', type: 'bigint' }) sizeBytes: number;
  @Column({ default: 'residential' }) scope: 'residential' | 'commercial';
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ default: 'draft' }) status: 'draft' | 'published' | 'hidden' | 'archived';
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('site_dealers')
@Index(['tenantId', 'siteId', 'status', 'sortOrder'])
export class SiteDealerEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column({ name: 'site_code' }) @Index() siteCode: string;
  @Column() name: string;
  @Column({ type: 'varchar', nullable: true }) province: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ type: 'varchar', nullable: true }) district: string | null;
  @Column({ type: 'text', nullable: true }) address: string | null;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ name: 'dealer_type', type: 'varchar', nullable: true }) dealerType: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) services: string[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) certifications: string[];
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true }) latitude: number | null;
  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true }) longitude: number | null;
  @Column({ name: 'sort_order', default: 0 }) sortOrder: number;
  @Column({ default: 'active' }) @Index() status: 'active' | 'inactive';
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @Column({ name: 'updated_by', type: 'uuid', nullable: true }) updatedBy: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('site_inquiries')
@Index(['tenantId', 'siteId', 'kind', 'createdAt'])
export class SiteInquiryEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'site_id' }) @Index() siteId: string;
  @Column({ name: 'site_code' }) @Index() siteCode: string;
  @Column() @Index() kind: 'customer' | 'dealer';
  @Column({ type: 'varchar', nullable: true }) name: string | null;
  @Column({ type: 'varchar', nullable: true }) phone: string | null;
  @Column({ type: 'varchar', nullable: true }) city: string | null;
  @Column({ name: 'inquiry_type', type: 'varchar', nullable: true }) inquiryType: string | null;
  @Column({ name: 'message', type: 'text', nullable: true }) message: string | null;
  @Column({ name: 'company_name', type: 'varchar', nullable: true }) companyName: string | null;
  @Column({ name: 'intended_region', type: 'varchar', nullable: true }) intendedRegion:
    string | null;
  @Column({ name: 'business_summary', type: 'text', nullable: true }) businessSummary:
    string | null;
  @Column({ name: 'source_path', type: 'text', nullable: true }) sourcePath: string | null;
  @Column({ name: 'user_agent', type: 'text', nullable: true }) userAgent: string | null;
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true }) deletedBy: string | null;
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
