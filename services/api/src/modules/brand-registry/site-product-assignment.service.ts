import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { AuditLogEntity } from '../governance/governance.entity';
import { ProductCatalogService } from '../product-catalog/product-catalog.service';
import {
  BrandSiteEntity,
  SiteProductAssignmentEntity,
  SiteProductCategoryEntity,
} from './brand-site.entity';

const CODE_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GROUP_SITE_CODE = 'rhautt-group';
const PRODUCT_IMAGE_PLACEHOLDER = {
  role: 'placeholder',
  url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"%3E%3Crect width="640" height="360" fill="%23f4f6f8"/%3E%3Cpath d="M238 212h164l-50-62-42 46-28-30-44 46Z" fill="%23ccd3da"/%3E%3Ccircle cx="250" cy="135" r="18" fill="%23ccd3da"/%3E%3C/svg%3E',
};

export interface SiteProductAssignmentInput {
  productId?: string;
  productTenantId?: string;
  publicSlug?: string;
  siteProductCategoryId?: string | null;
  websiteCategory?: string | null;
  menuGroup?: string | null;
  displayOrder?: number;
  isFeatured?: boolean;
  siteTitle?: string | null;
  siteSummary?: string | null;
  siteMeta?: Record<string, unknown>;
}

export interface SiteProductAssignmentBatchItem extends SiteProductAssignmentInput {
  assignmentId?: string;
  sku?: string;
}

export interface SiteProductAssignmentBatchInput {
  items?: SiteProductAssignmentBatchItem[];
}

export interface SiteProductCategoryUpdateInput {
  fromCategory?: string;
  toCategory?: string;
  menuGroup?: string | null;
  status?: 'draft' | 'published' | 'hidden';
}

export interface SiteProductShelfCategoryInput {
  parentId?: string | null;
  code?: string;
  name?: string;
  slug?: string | null;
  menuGroup?: string | null;
  mappedBaseCategoryId?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  isFeatured?: boolean;
  status?: 'active' | 'inactive';
  description?: string | null;
}

type SiteProductCategoryMatchReason =
  'mapped_base_category_id' | 'first_and_leaf_name' | 'name_fallback' | 'none';

export interface SiteProductPublishingSuggestionInput {
  productId?: string;
  productTenantId?: string;
}

export function normalizeSiteCode(value: unknown): string {
  const code = String(value || '')
    .trim()
    .toLowerCase();
  if (!CODE_RE.test(code)) throw new BadRequestException('网站代码格式无效');
  return code;
}

export function normalizePublicSlug(value: unknown): string {
  const slug = String(value || '')
    .trim()
    .toLowerCase();
  if (!CODE_RE.test(slug))
    throw new BadRequestException('公开 slug 只能使用小写字母、数字和连字符');
  return slug;
}

export function resolvePublicSiteTenant(siteCode: string): string | undefined {
  const key = normalizeSiteCode(siteCode).toUpperCase().replace(/-/g, '_');
  return process.env[`SITE_${key}_TENANT_ID`] || process.env[`${key}_TENANT_ID`];
}

export function assertSiteProductBrandAllowed(
  siteCodeInput: unknown,
  productBrandInput: unknown,
  supportedBrandInputs: readonly string[] = ['rheem', 'ruud', 'everhot']
) {
  const siteCode = normalizeSiteCode(siteCodeInput);
  const productBrand = String(productBrandInput || '')
    .trim()
    .toLowerCase();
  const supportedBrands = supportedBrandInputs.map(normalizeSiteCode);
  if (siteCode === GROUP_SITE_CODE && !supportedBrands.includes(productBrand)) {
    const label = supportedBrands.length ? supportedBrands.join(', ') : 'configured child-brand';
    throw new BadRequestException(
      `Invalid site/product brand combination: ${GROUP_SITE_CODE} only accepts ${label} products`
    );
  }
  if (!isSiteProductBrandAllowed(siteCode, productBrand, supportedBrands)) {
    throw new BadRequestException(
      'Invalid site/product brand combination: product brand is required for site publishing'
    );
  }
}

function isSiteProductBrandAllowed(
  siteCode: string,
  productBrand: string,
  supportedBrands: readonly string[] = ['rheem', 'ruud', 'everhot']
) {
  if (siteCode === GROUP_SITE_CODE) return supportedBrands.includes(productBrand);
  return Boolean(productBrand);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value: unknown): string | null {
  const v = text(value);
  return v || null;
}

function slug(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveInteger(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Website shelf batch operation failed';
}

type LegacyEverhotProduct = {
  slug?: string;
  sku?: string;
  model?: string;
  name?: string;
  websiteCategory?: string;
  categoryPath?: string;
  category?: string;
  sys?: string;
  menuGroup?: string;
  displayOrder?: number;
};

const PUBLIC_SITE_PRODUCT_FIELDS = [
  'brand',
  'category',
  'slug',
  'sku',
  'displayOrder',
  'model',
  'name',
  'categoryLevel1Id',
  'categoryLevel2Id',
  'categoryLevel3Id',
  'categoryPath',
  'websiteCategory',
  'cat',
  'sys',
  'series',
  'tagline',
  'tags',
  'badges',
  'en',
  'icon',
  'image',
  'mainImage',
  'gallery',
  'specImage',
  'specs',
  'features',
  'highlights',
  'certs',
  'faqs',
  'locale',
  'positioning',
  'marketing',
  'seo',
  'jsonLd',
  'officialDetailHtml',
  'manualPdfs',
] as const;

function publicProductFields(product: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    PUBLIC_SITE_PRODUCT_FIELDS.filter((field) => product[field] !== undefined).map((field) => [
      field,
      product[field],
    ])
  );
}

function pathLeaf(value: string): string {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[parts.length - 1] || '';
}

export function projectSiteProductDisplay(
  siteCode: string,
  assignment: Partial<SiteProductAssignmentEntity>,
  product: Record<string, unknown>
) {
  const safeProduct = publicProductFields(product);
  const assignmentMeta = record(assignment.siteMeta);
  const assignmentCategory = record(assignmentMeta.siteProductCategory);
  const mainImage = record(safeProduct.mainImage);
  const mainImageUrl = text(mainImage.url);
  const brandMetaImage = text(safeProduct.image);
  const resolvedMainImage = mainImageUrl
    ? { ...mainImage, url: mainImageUrl }
    : brandMetaImage
      ? { role: 'main', url: brandMetaImage }
      : PRODUCT_IMAGE_PLACEHOLDER;
  const siteCategoryPath =
    text(assignmentCategory.path) || text(assignmentMeta.websiteCategoryPath);
  const productCategoryPath =
    text(safeProduct.categoryPath) ||
    text(safeProduct.websiteCategory) ||
    text(safeProduct.category);
  const websiteCategoryPath =
    siteCategoryPath || text(assignment.websiteCategory) || productCategoryPath;
  const websiteCategory =
    text(assignmentCategory.name) ||
    pathLeaf(siteCategoryPath) ||
    text(assignment.websiteCategory) ||
    pathLeaf(productCategoryPath) ||
    text(safeProduct.categoryPath) ||
    text(safeProduct.websiteCategory) ||
    text(safeProduct.cat) ||
    text(safeProduct.category);
  const displayOrder =
    positiveInteger(assignment.displayOrder) ?? positiveInteger(safeProduct.displayOrder) ?? 0;

  return {
    ...safeProduct,
    siteCode,
    slug: text(assignment.publicSlug) || text(safeProduct.slug) || text(safeProduct.sku),
    name: text(assignment.siteTitle) || text(safeProduct.name),
    summary:
      text(assignment.siteSummary) || text(safeProduct.tagline) || text(safeProduct.category),
    websiteCategory,
    websiteCategoryPath,
    menuGroup: text(assignment.menuGroup) || text(safeProduct.sys),
    displayOrder,
    image: mainImageUrl || brandMetaImage || PRODUCT_IMAGE_PLACEHOLDER.url,
    mainImage: resolvedMainImage,
    isFeatured: Boolean(assignment.isFeatured),
    siteMeta: record(assignment.siteMeta),
  };
}

@Injectable()
export class SiteProductAssignmentService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly products: ProductCatalogService
  ) {}

  list(user: JwtPayload, siteCode: string, includeArchived = false) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const items = await em.getRepository(SiteProductAssignmentEntity).find({
          where: includeArchived
            ? ({ tenantId: user.tenantId, siteId: site.id } as any)
            : ({ tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any),
          order: { displayOrder: 'ASC', createdAt: 'ASC' },
        });
        return { items, total: items.length };
      },
      this.scope(user)
    );
  }

  listWebsiteCategories(user: JwtPayload, siteCode: string, selectable = false) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const assignmentRows = await em.getRepository(SiteProductAssignmentEntity).find({
          where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
          order: { displayOrder: 'ASC', createdAt: 'ASC' },
          take: 2000,
        });
        const categoryRows = await em.getRepository(SiteProductCategoryEntity).find({
          where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
          order: { level: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
          take: 1000,
        });
        const legacyRows = this.websiteCategoryRows(assignmentRows);
        const effectiveCategoryRows = selectable
          ? this.selectableSiteCategoryRows(categoryRows)
          : categoryRows;
        const categories = categoryRows.length
          ? this.siteShelfCategoryRows(effectiveCategoryRows, assignmentRows)
          : legacyRows;
        return {
          siteCode: site.code,
          total: categories.length,
          productCount: assignmentRows.length,
          items: categories,
          tree: this.siteShelfCategoryTree(categories as any),
          legacyItems: legacyRows,
        };
      },
      this.scope(user)
    );
  }

  createShelfCategory(user: JwtPayload, siteCode: string, input: SiteProductShelfCategoryInput) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const repo = em.getRepository(SiteProductCategoryEntity);
        const parentId = nullableText(input.parentId);
        const level = parentId
          ? ((
              await repo.findOneBy({
                id: parentId,
                tenantId: user.tenantId,
                siteId: site.id,
                deletedAt: null,
              } as any)
            )?.level ?? 0) + 1
          : 1;
        if (parentId && level === 1) throw new NotFoundException('上级官网分类不存在');
        const patch = this.shelfCategoryPatch(input, true);
        const saved = await repo.save(
          repo.create({
            tenantId: user.tenantId,
            siteId: site.id,
            parentId,
            level,
            ...patch,
            createdBy: user.userId,
            updatedBy: user.userId,
          } as Partial<SiteProductCategoryEntity>)
        );
        return { success: true, data: saved };
      },
      this.scope(user)
    );
  }

  updateShelfCategory(
    user: JwtPayload,
    siteCode: string,
    id: string,
    input: SiteProductShelfCategoryInput
  ) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findShelfCategory(em, user.tenantId, siteCode, id);
        const beforeName = row.name;
        if (input.parentId !== undefined) {
          const parentId = nullableText(input.parentId);
          if (parentId === row.id) throw new BadRequestException('官网分类不能移动到自己下面');
          row.parentId = parentId;
          if (parentId) {
            const parent = await em.getRepository(SiteProductCategoryEntity).findOneBy({
              id: parentId,
              tenantId: row.tenantId,
              siteId: row.siteId,
              deletedAt: null,
            } as any);
            if (!parent) throw new NotFoundException('上级官网分类不存在');
            row.level = parent.level + 1;
          } else {
            row.level = 1;
          }
        }
        Object.assign(row, this.shelfCategoryPatch(input, false), { updatedBy: user.userId });
        const saved = await em.getRepository(SiteProductCategoryEntity).save(row);
        if (input.name && beforeName !== saved.name) {
          await this.renameAssignmentWebsiteCategory(
            em,
            row.tenantId,
            row.siteId,
            beforeName,
            saved.name,
            row.menuGroup
          );
        }
        return { success: true, data: saved };
      },
      this.scope(user)
    );
  }

  deleteShelfCategory(user: JwtPayload, siteCode: string, id: string, moveTo?: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findShelfCategory(em, user.tenantId, siteCode, id);
        const repo = em.getRepository(SiteProductCategoryEntity);
        const childCount = await repo.count({
          where: {
            tenantId: row.tenantId,
            siteId: row.siteId,
            parentId: row.id,
            deletedAt: null,
          } as any,
        });
        if (childCount > 0) throw new ConflictException('请先删除或迁移下级官网分类');
        await this.renameAssignmentWebsiteCategory(
          em,
          row.tenantId,
          row.siteId,
          row.name,
          nullableText(moveTo),
          row.menuGroup
        );
        row.deletedAt = new Date();
        row.deletedBy = user.userId;
        row.updatedBy = user.userId;
        await repo.save(row);
        return { success: true, data: { id, movedTo: nullableText(moveTo), deleted: true } };
      },
      this.scope(user)
    );
  }

  async importEverhotWebsiteCategories(user: JwtPayload, siteCode: string) {
    if (normalizeSiteCode(siteCode) !== 'everhot')
      throw new BadRequestException('当前只支持导入恒热官网分类');
    const sourceProducts = await this.readEverhotWebsiteProducts();
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const supportedBrands = await this.assignmentBrandCodes(em, user.tenantId, site);
        const assignmentRepo = em.getRepository(SiteProductAssignmentEntity);
        const existingRows = await assignmentRepo.find({
          where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
          take: 2000,
        });
        const existingBySkuOrSlug = new Map<string, SiteProductAssignmentEntity>();
        const existingByProductId = new Map<string, SiteProductAssignmentEntity>();
        for (const row of existingRows) {
          existingBySkuOrSlug.set(row.publicSlug.toLowerCase(), row);
          existingByProductId.set(row.productId, row);
        }

        const productTenantIdForImport = process.env.EVERHOT_TENANT_ID || user.tenantId;
        const catalog = await this.products.list({
          tenantId: productTenantIdForImport,
          brand: 'everhot',
          pageSize: 500,
        });
        const catalogItems = Array.isArray(catalog?.data?.items)
          ? (catalog.data.items as Record<string, unknown>[])
          : [];
        const productByKey = new Map<string, Record<string, unknown>>();
        for (const product of catalogItems) {
          const meta =
            product.meta && typeof product.meta === 'object' && !Array.isArray(product.meta)
              ? (product.meta as Record<string, unknown>)
              : {};
          const brandMeta =
            meta.everhot && typeof meta.everhot === 'object' && !Array.isArray(meta.everhot)
              ? (meta.everhot as Record<string, unknown>)
              : {};
          [
            product.sku,
            product.slug,
            product.model,
            product.publicSlug,
            brandMeta.slug,
            brandMeta.model,
          ]
            .map((value) => text(value).toLowerCase())
            .filter(Boolean)
            .forEach((key) => productByKey.set(key, product));
        }

        const imported: Array<{
          sku: string;
          category: string;
          assignmentId: string;
          action: 'created' | 'updated';
        }> = [];
        const skipped: Array<{ sku: string; reason: string }> = [];
        const upsertAssignment = async (
          product: Record<string, unknown>,
          categoryInput: unknown,
          options: {
            sourceKey?: string;
            publicSlug?: unknown;
            menuGroup?: unknown;
            displayOrder?: unknown;
          } = {}
        ) => {
          const category = text(categoryInput);
          if (!category) return null;
          assertSiteProductBrandAllowed(
            site.code,
            product.brand || product.brandCode || 'everhot',
            supportedBrands
          );
          const productId = text(product.id || product.productId);
          if (!productId) return null;
          const productTenantId = text(product.tenantId || productTenantIdForImport);
          const publicSlug = normalizePublicSlug(
            options.publicSlug ||
              product.slug ||
              product.publicSlug ||
              product.sku ||
              product.model ||
              productId
          );
          const displayOrder = Number.isInteger(Number(options.displayOrder))
            ? Number(options.displayOrder)
            : 0;
          let row = existingBySkuOrSlug.get(publicSlug) || existingByProductId.get(productId);
          const action: 'created' | 'updated' = row ? 'updated' : 'created';
          if (!row) {
            row = assignmentRepo.create({
              tenantId: user.tenantId,
              siteId: site.id,
              productTenantId,
              productId,
              brand: 'everhot',
              publicSlug,
              websiteCategory: category,
              menuGroup: nullableText(options.menuGroup),
              displayOrder,
              isFeatured: false,
              status: text(product.status) === 'active' ? 'draft' : 'hidden',
              siteTitle: null,
              siteSummary: null,
              siteMeta: {},
              createdBy: user.userId,
              updatedBy: user.userId,
            } as Partial<SiteProductAssignmentEntity>);
          } else {
            row.websiteCategory = category;
            row.menuGroup = nullableText(options.menuGroup) || row.menuGroup;
            row.displayOrder = displayOrder || row.displayOrder;
            row.updatedBy = user.userId;
          }
          row = await assignmentRepo.save(row);
          existingBySkuOrSlug.set(row.publicSlug.toLowerCase(), row);
          existingByProductId.set(row.productId, row);
          return {
            sku: text(options.sourceKey || product.sku || product.model || publicSlug),
            category,
            assignmentId: row.id,
            action,
          };
        };
        for (const source of sourceProducts) {
          const key = text(source.sku || source.slug || source.model).toLowerCase();
          const category = text(source.websiteCategory || source.categoryPath || source.category);
          if (!key || !category) {
            skipped.push({ sku: key, reason: '缺少产品标识或官网分类' });
            continue;
          }
          const product = productByKey.get(key);
          if (!product) {
            skipped.push({ sku: key, reason: '产品库中未找到对应恒热产品' });
            continue;
          }
          const saved = await upsertAssignment(product, category, {
            sourceKey: key,
            publicSlug: source.slug || source.sku || source.model || key,
            menuGroup: source.menuGroup || source.sys,
            displayOrder: source.displayOrder,
          });
          if (saved) imported.push(saved);
        }
        for (const product of catalogItems) {
          const productId = text(product.id || product.productId);
          if (!productId || existingByProductId.has(productId)) continue;
          const meta =
            product.meta && typeof product.meta === 'object' && !Array.isArray(product.meta)
              ? (product.meta as Record<string, unknown>)
              : {};
          const brandMeta =
            meta.everhot && typeof meta.everhot === 'object' && !Array.isArray(meta.everhot)
              ? (meta.everhot as Record<string, unknown>)
              : {};
          const category = text(
            brandMeta.websiteCategory || brandMeta.categoryPath || product.category || brandMeta.cat
          );
          if (!category) continue;
          const saved = await upsertAssignment(product, category, {
            publicSlug: brandMeta.slug || product.slug || product.sku || product.model || productId,
            menuGroup: brandMeta.menuGroup || brandMeta.sys,
            displayOrder: brandMeta.displayOrder,
          });
          if (saved) imported.push(saved);
        }
        await this.ensureShelfCategoriesFromAssignments(
          em,
          user,
          site,
          await assignmentRepo.find({
            where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
            take: 2000,
          })
        );
        const latest = await assignmentRepo.find({
          where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
          order: { displayOrder: 'ASC', createdAt: 'ASC' },
          take: 2000,
        });
        return {
          siteCode: site.code,
          importedCount: imported.length,
          skippedCount: skipped.length,
          imported,
          skipped,
          items: this.siteShelfCategoryRows(
            await em.getRepository(SiteProductCategoryEntity).find({
              where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
              order: { level: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
              take: 1000,
            }),
            latest
          ),
        };
      },
      this.scope(user)
    );
  }

  updateWebsiteCategory(user: JwtPayload, siteCode: string, input: SiteProductCategoryUpdateInput) {
    const fromCategory = text(input.fromCategory);
    const toCategory = text(input.toCategory);
    if (!fromCategory) throw new BadRequestException('原官网分类不能为空');
    if (!toCategory) throw new BadRequestException('新官网分类不能为空');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const repo = em.getRepository(SiteProductAssignmentEntity);
        const rows = await repo.find({
          where: {
            tenantId: user.tenantId,
            siteId: site.id,
            websiteCategory: fromCategory,
            deletedAt: null,
          } as any,
          take: 1000,
        });
        for (const row of rows) {
          row.websiteCategory = toCategory;
          if (input.menuGroup !== undefined) row.menuGroup = nullableText(input.menuGroup);
          if (input.status && ['draft', 'published', 'hidden'].includes(input.status))
            row.status = input.status;
          row.updatedBy = user.userId;
        }
        await repo.save(rows);
        return { siteCode: site.code, fromCategory, toCategory, updatedCount: rows.length };
      },
      this.scope(user)
    );
  }

  clearWebsiteCategory(
    user: JwtPayload,
    siteCode: string,
    categoryInput: string,
    moveToInput?: string
  ) {
    const category = text(categoryInput);
    const moveTo = text(moveToInput);
    if (!category) throw new BadRequestException('官网分类不能为空');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const repo = em.getRepository(SiteProductAssignmentEntity);
        const rows = await repo.find({
          where: {
            tenantId: user.tenantId,
            siteId: site.id,
            websiteCategory: category,
            deletedAt: null,
          } as any,
          take: 1000,
        });
        for (const row of rows) {
          row.websiteCategory = moveTo || null;
          row.updatedBy = user.userId;
        }
        await repo.save(rows);
        return { siteCode: site.code, category, moveTo: moveTo || null, updatedCount: rows.length };
      },
      this.scope(user)
    );
  }

  async batchPublish(user: JwtPayload, siteCode: string, input: SiteProductAssignmentBatchInput) {
    const items = Array.isArray(input.items) ? input.items : [];
    const success: Array<{ productId: string; assignmentId: string; sku?: string }> = [];
    const failed: Array<{
      productId?: string;
      assignmentId?: string;
      sku?: string;
      error: string;
    }> = [];
    for (const item of items) {
      const productId = text(item.productId);
      const sku = text(item.sku);
      try {
        let assignmentId = text(item.assignmentId);
        if (!assignmentId) {
          const created = await this.create(user, siteCode, item);
          assignmentId = created.id;
        }
        await this.setStatus(user, siteCode, assignmentId, 'published');
        success.push({ productId, assignmentId, sku });
      } catch (error) {
        failed.push({
          productId,
          assignmentId: text(item.assignmentId),
          sku,
          error: errorMessage(error),
        });
      }
    }
    return {
      success,
      failed,
      total: items.length,
      successCount: success.length,
      failureCount: failed.length,
    };
  }

  async batchHide(user: JwtPayload, siteCode: string, input: SiteProductAssignmentBatchInput) {
    const items = Array.isArray(input.items) ? input.items : [];
    const success: Array<{
      productId?: string;
      assignmentId?: string;
      sku?: string;
      skipped?: boolean;
    }> = [];
    const failed: Array<{
      productId?: string;
      assignmentId?: string;
      sku?: string;
      error: string;
    }> = [];
    for (const item of items) {
      const productId = text(item.productId);
      const assignmentId = text(item.assignmentId);
      const sku = text(item.sku);
      if (!assignmentId) {
        success.push({ productId, sku, skipped: true });
        continue;
      }
      try {
        await this.setStatus(user, siteCode, assignmentId, 'hidden');
        success.push({ productId, assignmentId, sku });
      } catch (error) {
        failed.push({ productId, assignmentId, sku, error: errorMessage(error) });
      }
    }
    return {
      success,
      failed,
      total: items.length,
      successCount: success.length,
      failureCount: failed.length,
    };
  }

  async create(user: JwtPayload, siteCode: string, input: SiteProductAssignmentInput) {
    const productId = String(input.productId || '').trim();
    const productTenantId = String(input.productTenantId || user.tenantId).trim();
    if (!UUID_RE.test(productId) || !UUID_RE.test(productTenantId)) {
      throw new BadRequestException('产品和产品租户必须使用 UUID');
    }
    this.assertProductTenantAccess(user, productTenantId);
    const publicSlug = normalizePublicSlug(input.publicSlug);
    const product = await this.findActiveProduct(productTenantId, productId);
    if (!product) throw new NotFoundException('Product does not exist or is not active');
    const productBrand = text(product.brand);
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        assertSiteProductBrandAllowed(
          site.code,
          productBrand,
          await this.assignmentBrandCodes(em, user.tenantId, site)
        );
        const repo = em.getRepository(SiteProductAssignmentEntity);
        const existing = await repo
          .createQueryBuilder('assignment')
          .where('assignment.tenantId = :tenantId', { tenantId: user.tenantId })
          .andWhere('assignment.siteId = :siteId', { siteId: site.id })
          .andWhere('assignment.deletedAt IS NULL')
          .andWhere(
            '(assignment.productId = :productId OR lower(assignment.publicSlug) = :publicSlug)',
            { productId, publicSlug }
          )
          .getOne();
        if (existing) throw new ConflictException('该产品或公开 slug 已经分配到当前网站');
        const patch = this.assignmentPatch(input);
        Object.assign(
          patch,
          await this.assignmentSiteCategoryPatch(em, user.tenantId, site, input, patch.siteMeta)
        );
        const saved = await repo.save(
          repo.create({
            tenantId: user.tenantId,
            siteId: site.id,
            productTenantId,
            productId,
            brand: productBrand,
            publicSlug,
            ...patch,
            status: 'draft',
            publishedAt: null,
            createdBy: user.userId,
            updatedBy: user.userId,
          } as Partial<SiteProductAssignmentEntity>)
        );
        await this.audit(em, user, 'site-product-assignment.create', saved.id, null, { ...saved });
        return saved;
      },
      this.scope(user)
    );
  }

  update(user: JwtPayload, siteCode: string, id: string, input: SiteProductAssignmentInput) {
    if (input.productId !== undefined || input.productTenantId !== undefined) {
      throw new BadRequestException('产品关联创建后不可修改；请归档后重新分配');
    }
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findAssignment(em, user.tenantId, siteCode, id);
        const site = await this.findSite(em, user.tenantId, siteCode);
        const patch = this.assignmentPatch(input);
        if (input.publicSlug !== undefined)
          patch.publicSlug = normalizePublicSlug(input.publicSlug);
        Object.assign(
          patch,
          await this.assignmentSiteCategoryPatch(
            em,
            user.tenantId,
            site,
            input,
            patch.siteMeta || row.siteMeta
          )
        );
        if (!Object.keys(patch).length) throw new BadRequestException('没有可更新字段');
        const before = { ...row };
        Object.assign(row, patch, { updatedBy: user.userId });
        const saved = await em.getRepository(SiteProductAssignmentEntity).save(row);
        await this.audit(em, user, 'site-product-assignment.update', id, before, { ...saved });
        return saved;
      },
      this.scope(user)
    );
  }

  setStatus(user: JwtPayload, siteCode: string, id: string, status: 'published' | 'hidden') {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findAssignment(em, user.tenantId, siteCode, id);
        if (status === 'published') {
          const product = await this.findActiveProduct(row.productTenantId, row.productId);
          if (!product) throw new NotFoundException('Product does not exist or is not active');
          const site = await this.findSite(em, user.tenantId, siteCode);
          assertSiteProductBrandAllowed(
            site.code,
            product.brand,
            await this.assignmentBrandCodes(em, user.tenantId, site)
          );
          if (row.siteProductCategoryId) {
            await this.findActiveShelfCategory(
              em,
              user.tenantId,
              site.id,
              row.siteProductCategoryId
            );
          }
        }
        const before = { ...row };
        row.status = status;
        row.publishedAt = status === 'published' ? row.publishedAt || new Date() : null;
        row.updatedBy = user.userId;
        const saved = await em.getRepository(SiteProductAssignmentEntity).save(row);
        await this.audit(em, user, `site-product-assignment.${status}`, id, before, { ...saved });
        return saved;
      },
      this.scope(user)
    );
  }

  archive(user: JwtPayload, siteCode: string, id: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findAssignment(em, user.tenantId, siteCode, id);
        const before = { ...row };
        row.deletedAt = new Date();
        row.deletedBy = user.userId;
        row.updatedBy = user.userId;
        await em.getRepository(SiteProductAssignmentEntity).save(row);
        await this.audit(em, user, 'site-product-assignment.archive', id, before, { ...row });
        return { archived: true, id };
      },
      this.scope(user)
    );
  }

  async publicList(siteCodeInput: string, locale?: string, filters: Record<string, unknown> = {}) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    const productIdFilter = text(filters.productId).toLowerCase();
    const publicSlugFilter = text(filters.slug).toLowerCase();
    const assignments = await withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, tenantId, siteCode);
        return em.getRepository(SiteProductAssignmentEntity).find({
          where: { tenantId, siteId: site.id, status: 'published', deletedAt: null } as any,
          order: { displayOrder: 'ASC', createdAt: 'ASC' },
          take: 500,
        });
      },
      { tenantId }
    );
    const narrowedAssignments = assignments.filter((assignment) => {
      if (productIdFilter && assignment.productId.toLowerCase() !== productIdFilter) return false;
      if (publicSlugFilter && text(assignment.publicSlug).toLowerCase() !== publicSlugFilter)
        return false;
      return true;
    });
    const items = await this.hydrate(siteCode, narrowedAssignments, locale);
    const filtered = items.filter((item) => this.matches(item, filters));
    return {
      success: true,
      data: { items: filtered, total: filtered.length, locale: String(locale || 'zh-CN') },
    };
  }

  async publicDetail(siteCodeInput: string, publicSlugInput: string, locale?: string) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const publicSlug = normalizePublicSlug(publicSlugInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    const assignments = await withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, tenantId, siteCode);
        return em
          .getRepository(SiteProductAssignmentEntity)
          .createQueryBuilder('assignment')
          .where('assignment.tenantId = :tenantId', { tenantId })
          .andWhere('assignment.siteId = :siteId', { siteId: site.id })
          .andWhere('assignment.status = :status', { status: 'published' })
          .andWhere('assignment.deletedAt IS NULL')
          .orderBy('assignment.displayOrder', 'ASC')
          .addOrderBy('assignment.createdAt', 'ASC')
          .take(500)
          .getMany();
      },
      { tenantId }
    );
    const assignment = assignments[0];
    if (!assignment) throw new NotFoundException('产品不存在');
    const items = await this.hydrate(siteCode, assignments, locale);
    const item = items.find((row) => String(row.slug || '').toLowerCase() === publicSlug);
    if (!item) throw new NotFoundException('产品不存在或已归档');
    return { success: true, data: item };
  }

  async publicWebsiteCategories(siteCodeInput: string) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId))
      throw new NotFoundException('缃戠珯鏈厤缃叕寮€绉熸埛');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, tenantId, siteCode);
        const categories = await em.getRepository(SiteProductCategoryEntity).find({
          where: {
            tenantId,
            siteId: site.id,
            deletedAt: null,
            status: 'active',
            isVisible: true,
          } as any,
          order: { level: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
          take: 1000,
        });
        const items = this.siteShelfCategoryRows(categories, []);
        return {
          success: true,
          data: {
            siteCode: site.code,
            total: items.length,
            items,
            tree: this.siteShelfCategoryTree(items as any),
          },
        };
      },
      { tenantId }
    );
  }

  async publishingSuggestion(
    user: JwtPayload,
    siteCode: string,
    input: SiteProductPublishingSuggestionInput
  ) {
    const productId = text(input.productId);
    const productTenantId = text(input.productTenantId) || user.tenantId;
    if (!UUID_RE.test(productId) || !UUID_RE.test(productTenantId)) {
      throw new BadRequestException('productId and productTenantId must be UUID');
    }
    this.assertProductTenantAccess(user, productTenantId);
    const product = await this.findActiveProduct(productTenantId, productId);
    if (!product) throw new NotFoundException('Product does not exist or is not active');
    const productBrand = text(product.brand);
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        assertSiteProductBrandAllowed(
          site.code,
          productBrand,
          await this.assignmentBrandCodes(em, user.tenantId, site)
        );
        const categories = await em.getRepository(SiteProductCategoryEntity).find({
          where: {
            tenantId: user.tenantId,
            siteId: site.id,
            deletedAt: null,
            status: 'active',
            isVisible: true,
          } as any,
          order: { level: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
          take: 1000,
        });
        const categoryById = new Map(categories.map((row) => [row.id, row]));
        const baseCategory = this.productBaseCategory(product);
        const categoryIds = [
          baseCategory.categoryLevel3Id,
          baseCategory.categoryLevel2Id,
          baseCategory.categoryLevel1Id,
          baseCategory.primaryCategoryId,
        ].filter((id, index, arr): id is string => Boolean(id) && arr.indexOf(id) === index);
        const productPathParts = baseCategory.pathLabel
          .split('/')
          .map((part) => part.trim())
          .filter(Boolean);
        const productFirstName = productPathParts[0] || '';
        const leafName = productPathParts[productPathParts.length - 1] || text(product.category);
        const requiresPathMatch = Boolean(productFirstName && leafName);
        const categoryPath = (row: SiteProductCategoryEntity) =>
          this.siteCategoryPath(row, categoryById);
        const categoryPathParts = (row: SiteProductCategoryEntity) =>
          categoryPath(row)
            .split('/')
            .map((part) => part.trim())
            .filter(Boolean);
        const firstAndLeafMatches = (row: SiteProductCategoryEntity) => {
          const parts = categoryPathParts(row);
          const first = parts[0] || '';
          const leaf = parts[parts.length - 1] || text(row.name);
          return (
            Boolean(leafName) &&
            leaf === leafName &&
            (!productFirstName || first === productFirstName)
          );
        };
        const deepest = (rows: SiteProductCategoryEntity[]) =>
          rows.sort(
            (a, b) =>
              b.level - a.level ||
              a.sortOrder - b.sortOrder ||
              a.createdAt.getTime() - b.createdAt.getTime()
          )[0];
        const mappedRows = categories.filter(
          (row) => row.mappedBaseCategoryId && categoryIds.includes(row.mappedBaseCategoryId)
        );
        const mappedCandidate = deepest(
          requiresPathMatch ? mappedRows.filter(firstAndLeafMatches) : mappedRows
        );
        const firstAndLeafCandidate = deepest(categories.filter(firstAndLeafMatches));
        const nameCandidate = requiresPathMatch
          ? undefined
          : [leafName, ...[...productPathParts].reverse()]
              .map(text)
              .filter((value, index, arr) => Boolean(value) && arr.indexOf(value) === index)
              .map((candidate) => categories.find((row) => text(row.name) === candidate))
              .find(Boolean);
        let suggested = mappedCandidate || firstAndLeafCandidate || nameCandidate;
        let matchedBaseCategoryId = mappedCandidate?.mappedBaseCategoryId || null;
        let matchReason: SiteProductCategoryMatchReason = mappedCandidate
          ? 'mapped_base_category_id'
          : firstAndLeafCandidate
            ? 'first_and_leaf_name'
            : nameCandidate
              ? 'name_fallback'
              : 'none';
        if (mappedCandidate && firstAndLeafCandidate && !firstAndLeafMatches(mappedCandidate)) {
          suggested = firstAndLeafCandidate;
          matchedBaseCategoryId =
            firstAndLeafCandidate.mappedBaseCategoryId || matchedBaseCategoryId;
          matchReason = 'first_and_leaf_name';
        } else if (
          mappedCandidate &&
          nameCandidate &&
          productPathParts.length > 1 &&
          mappedCandidate.level < productPathParts.length
        ) {
          suggested = nameCandidate;
          matchedBaseCategoryId = nameCandidate.mappedBaseCategoryId || matchedBaseCategoryId;
          matchReason = 'name_fallback';
        }
        const suggestedPath = suggested ? categoryPath(suggested) : '';
        const series = this.productSeriesForSite(product, site.code);
        return {
          siteCode: site.code,
          productId,
          productTenantId,
          productCategory: {
            ...baseCategory,
            matchedBaseCategoryId,
          },
          suggestedWebsiteCategory: suggested
            ? {
                id: suggested.id,
                name: suggested.name,
                path: suggestedPath,
                level: suggested.level,
                mappedBaseCategoryId: suggested.mappedBaseCategoryId,
                matchReason,
              }
            : null,
          suggestedSeries: {
            value: series,
            source: series ? 'productLibrary' : 'none',
          },
        };
      },
      this.scope(user)
    );
  }

  private async hydrate(
    siteCode: string,
    assignments: SiteProductAssignmentEntity[],
    locale?: string
  ) {
    const groups = new Map<string, SiteProductAssignmentEntity[]>();
    for (const row of assignments)
      groups.set(row.productTenantId, [...(groups.get(row.productTenantId) || []), row]);
    const hydrated = new Map<string, Record<string, unknown>>();
    await Promise.all(
      [...groups.entries()].map(async ([tenantId, rows]) => {
        const products = await this.products.listPublicLocalizedByIds(
          rows.map((row) => row.productId),
          locale,
          tenantId
        );
        for (const product of products) hydrated.set(String(product.productId), product);
      })
    );
    return assignments.flatMap((assignment) => {
      const product = hydrated.get(assignment.productId);
      if (!product) return [];
      if (!isSiteProductBrandAllowed(siteCode, text(product.brand))) return [];
      const { productId: _productId, ...publicProduct } = product;
      return [projectSiteProductDisplay(siteCode, assignment, publicProduct)];
    });
  }

  private productBaseCategory(product: Record<string, unknown>) {
    const meta = record(product.meta);
    const brand = text(product.brand);
    const brandMeta = record(meta[brand]);
    const categoryAncestry = Array.isArray(product.categoryAncestry)
      ? product.categoryAncestry.filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        )
      : [];
    const ancestryPath = categoryAncestry
      .map((item) => text(item.nameCn || item.name || item.label))
      .filter(Boolean)
      .join(' / ');
    const productPath =
      text(product.categoryPath || brandMeta.categoryPath || meta.categoryPath) ||
      ancestryPath ||
      text(product.category);
    return {
      primaryCategoryId:
        text(
          product.primaryCategoryId ||
            brandMeta.primaryCategoryId ||
            meta.primaryCategoryId ||
            product.categoryLevel3Id ||
            product.categoryLevel2Id ||
            product.categoryLevel1Id
        ) || null,
      categoryLevel1Id:
        text(
          product.categoryLevel1Id ||
            brandMeta.categoryLevel1Id ||
            meta.categoryLevel1Id ||
            categoryAncestry[0]?.id
        ) || null,
      categoryLevel2Id:
        text(
          product.categoryLevel2Id ||
            brandMeta.categoryLevel2Id ||
            meta.categoryLevel2Id ||
            categoryAncestry[1]?.id
        ) || null,
      categoryLevel3Id:
        text(
          product.categoryLevel3Id ||
            brandMeta.categoryLevel3Id ||
            meta.categoryLevel3Id ||
            categoryAncestry[2]?.id
        ) || null,
      pathLabel: productPath,
    };
  }

  private productSeriesForSite(product: Record<string, unknown>, siteCode: string) {
    const meta = record(product.meta);
    const siteMeta = record(meta[siteCode]);
    const brandMeta = record(meta[text(product.brand)]);
    const libraryMeta = record(meta.productLibrary);
    return text(siteMeta.series || brandMeta.series || libraryMeta.series || product.series);
  }

  private siteCategoryPath(
    row: SiteProductCategoryEntity,
    byId: Map<string, SiteProductCategoryEntity>
  ) {
    const parts: string[] = [];
    for (
      let cursor: SiteProductCategoryEntity | undefined = row;
      cursor;
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    ) {
      parts.unshift(cursor.name);
    }
    return parts.join(' / ');
  }

  private selectableSiteCategoryRows(rows: SiteProductCategoryEntity[]) {
    const byId = new Map(rows.map((row) => [row.id, row]));
    const isSelectable = (row: SiteProductCategoryEntity, seen = new Set<string>()): boolean => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      if (row.deletedAt || row.status !== 'active' || row.isVisible === false) return false;
      if (!row.parentId) return true;
      const parent = byId.get(row.parentId);
      return Boolean(parent && isSelectable(parent, seen));
    };
    return rows.filter((row) => isSelectable(row));
  }

  private matches(item: Record<string, unknown>, filters: Record<string, unknown>) {
    if (filters.brand && item.brand !== String(filters.brand)) return false;
    if (filters.category && item.category !== String(filters.category)) return false;
    if (filters.websiteCategory && item.websiteCategory !== String(filters.websiteCategory))
      return false;
    if (
      filters.websiteCategoryPath &&
      item.websiteCategoryPath !== String(filters.websiteCategoryPath)
    )
      return false;
    if (
      filters.slug &&
      String(item.slug || '').toLowerCase() !== String(filters.slug).trim().toLowerCase()
    )
      return false;
    if (
      filters.sku &&
      String(item.sku || '').toLowerCase() !== String(filters.sku).trim().toLowerCase()
    )
      return false;
    if (filters.featured === 'true' && item.isFeatured !== true) return false;
    const keyword = String(filters.keyword || '')
      .trim()
      .toLowerCase();
    if (!keyword) return true;
    return [item.sku, item.name, item.slug, item.summary].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(keyword)
    );
  }

  private assignmentPatch(input: SiteProductAssignmentInput): Partial<SiteProductAssignmentEntity> {
    const patch: Partial<SiteProductAssignmentEntity> = {};
    const text = (key: 'websiteCategory' | 'menuGroup' | 'siteTitle' | 'siteSummary') => {
      if (input[key] === undefined) return;
      patch[key] =
        input[key] == null || !String(input[key]).trim() ? null : String(input[key]).trim();
    };
    text('websiteCategory');
    text('menuGroup');
    text('siteTitle');
    text('siteSummary');
    if (input.displayOrder !== undefined) {
      const order = Number(input.displayOrder);
      if (!Number.isInteger(order) || order < 0 || order > 999999)
        throw new BadRequestException('排序必须是非负整数');
      patch.displayOrder = order;
    }
    if (input.isFeatured !== undefined) patch.isFeatured = Boolean(input.isFeatured);
    if (input.siteMeta !== undefined)
      patch.siteMeta = input.siteMeta && typeof input.siteMeta === 'object' ? input.siteMeta : {};
    return patch;
  }

  private async assignmentSiteCategoryPatch(
    em: EntityManager,
    tenantId: string,
    site: BrandSiteEntity,
    input: SiteProductAssignmentInput,
    existingMeta?: Record<string, unknown>
  ): Promise<Partial<SiteProductAssignmentEntity>> {
    if (input.siteProductCategoryId === undefined) return {};
    const categoryId = nullableText(input.siteProductCategoryId);
    if (!categoryId) {
      return {
        siteProductCategoryId: null,
        websiteCategory: null,
        siteMeta: {
          ...record(existingMeta),
          websiteCategoryPath: null,
          websiteCategoryCode: null,
          siteProductCategory: null,
        },
      };
    }
    const category = await this.findActiveShelfCategory(em, tenantId, site.id, categoryId);
    const categories = await em.getRepository(SiteProductCategoryEntity).find({
      where: { tenantId, siteId: site.id, deletedAt: null } as any,
      take: 1000,
    });
    const byId = new Map(categories.map((row) => [row.id, row]));
    const pathLabel = this.siteCategoryPath(category, byId);
    const patch: Partial<SiteProductAssignmentEntity> = {
      siteProductCategoryId: category.id,
      websiteCategory: category.name,
      siteMeta: {
        ...record(existingMeta),
        websiteCategoryPath: pathLabel,
        websiteCategoryCode: category.code,
        siteProductCategory: {
          id: category.id,
          code: category.code,
          name: category.name,
          path: pathLabel,
          slug: category.slug,
          level: category.level,
          mappedBaseCategoryId: category.mappedBaseCategoryId,
        },
      },
    };
    if (input.menuGroup === undefined && category.menuGroup) patch.menuGroup = category.menuGroup;
    return patch;
  }

  private websiteCategoryRows(rows: SiteProductAssignmentEntity[]) {
    const groups = new Map<
      string,
      {
        websiteCategory: string;
        menuGroups: Set<string>;
        assignmentIds: string[];
        productCount: number;
        publishedCount: number;
        hiddenCount: number;
        draftCount: number;
        featuredCount: number;
        minDisplayOrder: number;
      }
    >();
    for (const row of rows) {
      const category = text(row.websiteCategory) || '未设置官网分类';
      if (!groups.has(category)) {
        groups.set(category, {
          websiteCategory: category,
          menuGroups: new Set(),
          assignmentIds: [],
          productCount: 0,
          publishedCount: 0,
          hiddenCount: 0,
          draftCount: 0,
          featuredCount: 0,
          minDisplayOrder: Number.MAX_SAFE_INTEGER,
        });
      }
      const group = groups.get(category)!;
      if (row.menuGroup) group.menuGroups.add(row.menuGroup);
      group.assignmentIds.push(row.id);
      group.productCount += 1;
      if (row.status === 'published') group.publishedCount += 1;
      else if (row.status === 'hidden') group.hiddenCount += 1;
      else group.draftCount += 1;
      if (row.isFeatured) group.featuredCount += 1;
      group.minDisplayOrder = Math.min(group.minDisplayOrder, row.displayOrder ?? 0);
    }
    return [...groups.values()]
      .map((item) => ({
        websiteCategory: item.websiteCategory,
        menuGroups: [...item.menuGroups].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
        assignmentIds: item.assignmentIds,
        productCount: item.productCount,
        publishedCount: item.publishedCount,
        hiddenCount: item.hiddenCount,
        draftCount: item.draftCount,
        featuredCount: item.featuredCount,
        displayOrder: item.minDisplayOrder === Number.MAX_SAFE_INTEGER ? 0 : item.minDisplayOrder,
      }))
      .sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          a.websiteCategory.localeCompare(b.websiteCategory, 'zh-Hans-CN')
      );
  }

  private siteShelfCategoryRows(
    categories: SiteProductCategoryEntity[],
    assignments: SiteProductAssignmentEntity[]
  ) {
    const stats = new Map<
      string,
      ReturnType<SiteProductAssignmentService['websiteCategoryRows']>[number]
    >();
    for (const row of this.websiteCategoryRows(assignments)) stats.set(row.websiteCategory, row);
    return categories.map((category) => {
      const stat = stats.get(category.name);
      return {
        id: category.id,
        parentId: category.parentId,
        level: category.level,
        code: category.code,
        name: category.name,
        slug: category.slug,
        websiteCategory: category.name,
        menuGroup: category.menuGroup,
        menuGroups: category.menuGroup ? [category.menuGroup] : [],
        mappedBaseCategoryId: category.mappedBaseCategoryId,
        sortOrder: category.sortOrder,
        displayOrder: category.sortOrder,
        isVisible: category.isVisible,
        isFeatured: category.isFeatured,
        status: category.status,
        description: category.description,
        assignmentIds: stat?.assignmentIds || [],
        productCount: stat?.productCount || 0,
        publishedCount: stat?.publishedCount || 0,
        hiddenCount: stat?.hiddenCount || 0,
        draftCount: stat?.draftCount || 0,
        featuredCount: stat?.featuredCount || 0,
        children: [] as any[],
      };
    });
  }

  private siteShelfCategoryTree(rows: Array<Record<string, any>>) {
    const byId = new Map<string, any>(
      rows.map((row) => [String(row.id || row.websiteCategory), { ...row, children: [] as any[] }])
    );
    const roots: any[] = [];
    for (const row of byId.values()) {
      if (row.parentId && byId.has(row.parentId)) byId.get(row.parentId)!.children.push(row);
      else roots.push(row);
    }
    const sort = (items: any[]) => {
      items.sort(
        (a, b) =>
          Number(a.sortOrder || a.displayOrder || 0) - Number(b.sortOrder || b.displayOrder || 0) ||
          String(a.name || a.websiteCategory).localeCompare(
            String(b.name || b.websiteCategory),
            'zh-Hans-CN'
          )
      );
      items.forEach((item) => sort(item.children || []));
    };
    sort(roots);
    return roots;
  }

  private shelfCategoryPatch(
    input: SiteProductShelfCategoryInput,
    creating: boolean
  ): Partial<SiteProductCategoryEntity> {
    const patch: Partial<SiteProductCategoryEntity> = {};
    if (creating || input.name !== undefined) {
      const name = text(input.name);
      if (!name) throw new BadRequestException('官网分类名称必填');
      patch.name = name;
    }
    if (creating || input.code !== undefined) {
      const code = normalizeSiteCode(
        slug(input.code) || slug(input.name) || `category-${Date.now()}`
      );
      patch.code = code;
    }
    if (input.slug !== undefined) patch.slug = input.slug ? normalizePublicSlug(input.slug) : null;
    if (input.menuGroup !== undefined) patch.menuGroup = nullableText(input.menuGroup);
    if (input.mappedBaseCategoryId !== undefined)
      patch.mappedBaseCategoryId = nullableText(input.mappedBaseCategoryId);
    if (input.sortOrder !== undefined) patch.sortOrder = Math.max(0, Number(input.sortOrder) || 0);
    if (input.isVisible !== undefined) patch.isVisible = input.isVisible !== false;
    if (input.isFeatured !== undefined) patch.isFeatured = input.isFeatured === true;
    if (input.status !== undefined)
      patch.status = input.status === 'inactive' ? 'inactive' : 'active';
    if (input.description !== undefined) patch.description = nullableText(input.description);
    return patch;
  }

  private async findShelfCategory(
    em: EntityManager,
    tenantId: string,
    siteCode: string,
    id: string
  ) {
    const site = await this.findSite(em, tenantId, siteCode);
    const row = await em.getRepository(SiteProductCategoryEntity).findOneBy({
      id,
      tenantId,
      siteId: site.id,
      deletedAt: null,
    } as any);
    if (!row) throw new NotFoundException('官网分类不存在');
    return row;
  }

  private async findActiveShelfCategory(
    em: EntityManager,
    tenantId: string,
    siteId: string,
    id: string
  ) {
    if (!UUID_RE.test(id)) throw new BadRequestException('官网目录 ID 必须使用 UUID');
    const row = await em.getRepository(SiteProductCategoryEntity).findOneBy({
      id,
      tenantId,
      siteId,
      deletedAt: null,
      status: 'active',
      isVisible: true,
    } as any);
    if (!row) throw new NotFoundException('官网目录不存在、已停用或不可见');
    return row;
  }

  private async renameAssignmentWebsiteCategory(
    em: EntityManager,
    tenantId: string,
    siteId: string,
    fromCategory: string,
    toCategory: string | null,
    menuGroup?: string | null
  ) {
    const repo = em.getRepository(SiteProductAssignmentEntity);
    const rows = await repo.find({
      where: { tenantId, siteId, websiteCategory: fromCategory, deletedAt: null } as any,
      take: 1000,
    });
    for (const row of rows) {
      row.websiteCategory = toCategory;
      if (menuGroup !== undefined) row.menuGroup = menuGroup;
    }
    if (rows.length) await repo.save(rows);
    return rows.length;
  }

  private async ensureShelfCategoriesFromAssignments(
    em: EntityManager,
    user: JwtPayload,
    site: BrandSiteEntity,
    assignments: SiteProductAssignmentEntity[]
  ) {
    const repo = em.getRepository(SiteProductCategoryEntity);
    const existing = await repo.find({
      where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
      take: 1000,
    });
    const byPath = new Map<string, SiteProductCategoryEntity>();
    for (const row of existing) byPath.set(row.name, row);
    for (const categoryRow of this.websiteCategoryRows(assignments)) {
      const parts = text(categoryRow.websiteCategory)
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean);
      let parent: SiteProductCategoryEntity | null = null;
      for (
        let index = 0;
        index < (parts.length ? parts : [categoryRow.websiteCategory]).length;
        index += 1
      ) {
        const part = (parts.length ? parts : [categoryRow.websiteCategory])[index];
        const pathValue = parts.length ? parts.slice(0, index + 1).join(' / ') : part;
        if (!byPath.has(pathValue)) {
          const saved = await repo.save(
            repo.create({
              tenantId: user.tenantId,
              siteId: site.id,
              parentId: parent?.id || null,
              level: index + 1,
              code: normalizeSiteCode(slug(pathValue) || `category-${byPath.size + 1}`),
              name: pathValue,
              slug: slug(pathValue) || null,
              menuGroup: categoryRow.menuGroups[0] || null,
              sortOrder: categoryRow.displayOrder || 0,
              isVisible: true,
              isFeatured: categoryRow.featuredCount > 0,
              status: 'active',
              description: null,
              createdBy: user.userId,
              updatedBy: user.userId,
            } as Partial<SiteProductCategoryEntity>)
          );
          byPath.set(pathValue, saved);
        }
        parent = byPath.get(pathValue)!;
      }
    }
  }

  private async readEverhotWebsiteProducts(): Promise<LegacyEverhotProduct[]> {
    const candidates = [
      path.join(process.cwd(), 'apps', 'everhot-cn', 'public', 'js', 'products-data.js'),
      path.join(process.cwd(), '..', 'everhot-cn', 'public', 'js', 'products-data.js'),
    ];
    let source = '';
    for (const candidate of candidates) {
      try {
        source = await readFile(candidate, 'utf8');
        break;
      } catch {
        // try next known local checkout shape
      }
    }
    if (!source) throw new NotFoundException('未找到恒热官网旧产品数据文件');
    const assignIndex = source.indexOf('window.EVERHOT_PRODUCTS');
    const arrayStart = source.indexOf('[', assignIndex);
    const catalogIndex = source.indexOf('window.EVERHOT_CATALOG', arrayStart);
    const arrayEnd = source.lastIndexOf('];', catalogIndex > arrayStart ? catalogIndex : undefined);
    if (assignIndex < 0 || arrayStart < 0 || arrayEnd <= arrayStart) return [];
    const parsed = JSON.parse(source.slice(arrayStart, arrayEnd + 1));
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
  }

  private assertProductTenantAccess(user: JwtPayload, productTenantId: string) {
    if (!['platform_admin', 'hq_admin'].includes(user.role) && productTenantId !== user.tenantId) {
      throw new ForbiddenException('品牌账号不可分配其他品牌租户的产品');
    }
  }

  private async findActiveProduct(productTenantId: string, productId: string) {
    const result = await this.products.get(productId, productTenantId);
    const product = result.data;
    return product.status === 'active' ? product : null;
  }

  private async findSite(em: EntityManager, tenantId: string, siteCode: string) {
    const site = await em.getRepository(BrandSiteEntity).findOneBy({
      tenantId,
      code: normalizeSiteCode(siteCode),
      status: 'active',
      deletedAt: null,
    } as any);
    if (!site) throw new NotFoundException('网站不存在或未启用');
    return site;
  }

  private async assignmentBrandCodes(
    em: EntityManager,
    tenantId: string,
    site?: BrandSiteEntity
  ): Promise<string[]> {
    if (site?.code === GROUP_SITE_CODE) {
      return (site.childBrandCodes || []).map(normalizeSiteCode);
    }
    const rows = await em.getRepository(BrandSiteEntity).find({
      where: { tenantId, status: 'active', deletedAt: null } as any,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
      take: 500,
    });
    return rows
      .map((row) => normalizeSiteCode(row.code))
      .filter((code) => code !== GROUP_SITE_CODE);
  }

  private async findAssignment(em: EntityManager, tenantId: string, siteCode: string, id: string) {
    const site = await this.findSite(em, tenantId, siteCode);
    const row = await em.getRepository(SiteProductAssignmentEntity).findOneBy({
      id,
      tenantId,
      siteId: site.id,
      deletedAt: null,
    } as any);
    if (!row) throw new NotFoundException('网站产品分配不存在');
    return row;
  }

  private scope(user: JwtPayload) {
    return { tenantId: user.tenantId, actorId: user.userId, role: user.role };
  }

  private async audit(
    em: EntityManager,
    user: JwtPayload,
    action: string,
    id: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown>
  ) {
    const repo = em.getRepository(AuditLogEntity);
    await repo.save(
      repo.create({
        tenantId: user.tenantId,
        actorUserId: user.userId,
        action,
        resourceType: 'site-product-assignment',
        resourceId: id,
        beforeState: before,
        afterState: after,
        requestId: null,
        traceId: null,
        ipHash: null,
      })
    );
  }
}
