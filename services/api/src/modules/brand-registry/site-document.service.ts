import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import path from 'node:path';
import { DataSource, EntityManager } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { FileArtifactService } from '../file-artifact/file-artifact.service';
import { AuditLogEntity } from '../governance/governance.entity';
import {
  BrandSiteEntity,
  SiteDocumentCategoryEntity,
  SiteDocumentEntity,
} from './brand-site.entity';
import {
  normalizePublicSlug,
  normalizeSiteCode,
  resolvePublicSiteTenant,
} from './site-product-assignment.service';

type DocumentScope = 'residential' | 'commercial';
type CategoryScope = DocumentScope | 'all';
export type DocumentStatus = 'draft' | 'published' | 'hidden' | 'archived';

export interface SiteDocumentCategoryInput {
  name?: string;
  slug?: string;
  scope?: CategoryScope;
  sortOrder?: number;
  status?: 'active' | 'inactive';
}

export interface SiteDocumentInput {
  categoryId?: string;
  displayName?: string;
  filename?: string;
  mimeType?: string;
  dataBase64?: string;
  scope?: DocumentScope;
  sortOrder?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOCUMENT_SCOPES = new Set<DocumentScope>(['residential', 'commercial']);
const CATEGORY_SCOPES = new Set<CategoryScope>(['residential', 'commercial', 'all']);
const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.zip',
  '.dwg',
  '.dxf',
  '.rfa',
]);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatDocumentSize(sizeBytes: number): string {
  const bytes = Math.max(Number(sizeBytes) || 0, 0);
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${trimSize(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${trimSize(mb)} MB`;
  return `${trimSize(mb / 1024)} GB`;
}

function trimSize(value: number): string {
  return value.toFixed(value >= 10 ? 1 : 2).replace(/\.0+$|(?<=\.[0-9])0$/g, '');
}

function documentFormat(filename: string): string {
  return path.extname(filename).replace(/^\./, '').toUpperCase() || 'FILE';
}

export function documentPublicationAfterEdit(
  status: DocumentStatus,
  publishedAt: Date | null,
  input: SiteDocumentInput
): { status: DocumentStatus; publishedAt: Date | null } {
  const hasPublicChanges =
    input.categoryId !== undefined ||
    input.displayName !== undefined ||
    input.scope !== undefined ||
    input.sortOrder !== undefined;
  if (status === 'published' && hasPublicChanges) return { status: 'draft', publishedAt: null };
  return { status, publishedAt };
}

@Injectable()
export class SiteDocumentService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly files: FileArtifactService
  ) {}

  listCategories(user: JwtPayload, siteCode: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        return em.getRepository(SiteDocumentCategoryEntity).find({
          where: { tenantId: user.tenantId, siteId: site.id, deletedAt: null } as any,
          order: { sortOrder: 'ASC', createdAt: 'ASC' },
        });
      },
      this.scope(user)
    );
  }

  createCategory(user: JwtPayload, siteCode: string, input: SiteDocumentCategoryInput) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const repo = em.getRepository(SiteDocumentCategoryEntity);
        const patch = this.categoryPatch(input, true);
        const saved = await repo.save(
          repo.create({
            tenantId: user.tenantId,
            siteId: site.id,
            ...patch,
            createdBy: user.userId,
            updatedBy: user.userId,
          })
        );
        await this.audit(
          em,
          user,
          'site-document-category.create',
          'site-document-category',
          saved.id,
          null,
          { ...saved }
        );
        return saved;
      },
      this.scope(user)
    );
  }

  updateCategory(user: JwtPayload, siteCode: string, id: string, input: SiteDocumentCategoryInput) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findCategory(em, user.tenantId, siteCode, id);
        const before = { ...row };
        Object.assign(row, this.categoryPatch(input, false), { updatedBy: user.userId });
        const saved = await em.getRepository(SiteDocumentCategoryEntity).save(row);
        await this.audit(
          em,
          user,
          'site-document-category.update',
          'site-document-category',
          saved.id,
          before,
          { ...saved }
        );
        return saved;
      },
      this.scope(user)
    );
  }

  deleteCategory(user: JwtPayload, siteCode: string, id: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findCategory(em, user.tenantId, siteCode, id);
        const used = await em.getRepository(SiteDocumentEntity).count({
          where: {
            tenantId: user.tenantId,
            siteId: row.siteId,
            categoryId: row.id,
            deletedAt: null,
          } as any,
        });
        if (used) throw new BadRequestException('请先删除或移动该分类下的文档');
        const before = { ...row };
        row.deletedAt = new Date();
        row.deletedBy = user.userId;
        row.updatedBy = user.userId;
        await em.getRepository(SiteDocumentCategoryEntity).save(row);
        await this.audit(
          em,
          user,
          'site-document-category.delete',
          'site-document-category',
          row.id,
          before,
          { ...row }
        );
        return { ok: true, id };
      },
      this.scope(user)
    );
  }

  listDocuments(user: JwtPayload, siteCode: string, query: Record<string, unknown> = {}) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, user.tenantId, siteCode);
        const qb = em
          .getRepository(SiteDocumentEntity)
          .createQueryBuilder('document')
          .where('document.tenantId = :tenantId', { tenantId: user.tenantId })
          .andWhere('document.siteId = :siteId', { siteId: site.id })
          .andWhere('document.deletedAt IS NULL');
        const scope = text(query.scope);
        if (DOCUMENT_SCOPES.has(scope as DocumentScope))
          qb.andWhere('document.scope = :scope', { scope });
        const status = text(query.status);
        if (status && status !== 'all') qb.andWhere('document.status = :status', { status });
        const categoryId = text(query.categoryId);
        if (categoryId) qb.andWhere('document.categoryId = :categoryId', { categoryId });
        const keyword = text(query.q || query.keyword).toLowerCase();
        if (keyword)
          qb.andWhere('lower(document.displayName) LIKE :keyword', { keyword: `%${keyword}%` });
        const items = await qb
          .orderBy('document.sortOrder', 'ASC')
          .addOrderBy('document.createdAt', 'DESC')
          .getMany();
        return { items, total: items.length };
      },
      this.scope(user)
    );
  }

  async createDocument(user: JwtPayload, siteCode: string, input: SiteDocumentInput) {
    const filename = text(input.filename);
    this.assertDocumentFile(filename, input.dataBase64);
    const site = await withRlsTransaction(
      this.ds,
      (em) => this.findSite(em, user.tenantId, siteCode),
      this.scope(user)
    );
    const artifactResult = await this.files.saveBase64(user, {
      entityType: 'site-document',
      entityId: site.id,
      filename,
      mimeType: text(input.mimeType) || 'application/octet-stream',
      dataBase64: text(input.dataBase64),
    });
    const artifact = artifactResult.data;
    if (!artifact?.id) throw new BadRequestException('文档文件保存失败');

    try {
      return await withRlsTransaction(
        this.ds,
        async (em) => {
          const category = await this.findCategory(
            em,
            user.tenantId,
            siteCode,
            text(input.categoryId)
          );
          const scope = this.documentScope(input.scope);
          if (category.scope !== 'all' && category.scope !== scope) {
            throw new BadRequestException('文档范围与分类范围不一致');
          }
          const repo = em.getRepository(SiteDocumentEntity);
          const saved = await repo.save(
            repo.create({
              tenantId: user.tenantId,
              siteId: site.id,
              categoryId: category.id,
              artifactId: artifact.id,
              displayName: text(input.displayName) || filename,
              originalFilename: filename,
              mimeType: text(input.mimeType) || null,
              sizeBytes: Number(artifact.sizeBytes) || 0,
              scope,
              sortOrder: this.sortOrder(input.sortOrder),
              status: 'draft',
              publishedAt: null,
              createdBy: user.userId,
              updatedBy: user.userId,
            })
          );
          await this.audit(em, user, 'site-document.create', 'site-document', saved.id, null, {
            ...saved,
          });
          return saved;
        },
        this.scope(user)
      );
    } catch (error) {
      await this.files.remove(user, artifact.id).catch(() => undefined);
      throw error;
    }
  }

  updateDocument(user: JwtPayload, siteCode: string, id: string, input: SiteDocumentInput) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findDocument(em, user.tenantId, siteCode, id);
        const before = { ...row };
        if (input.categoryId !== undefined) {
          const category = await this.findCategory(
            em,
            user.tenantId,
            siteCode,
            text(input.categoryId)
          );
          row.categoryId = category.id;
        }
        if (input.displayName !== undefined) {
          const name = text(input.displayName);
          if (!name) throw new BadRequestException('文档名称不能为空');
          row.displayName = name;
        }
        if (input.scope !== undefined) row.scope = this.documentScope(input.scope);
        if (input.sortOrder !== undefined) row.sortOrder = this.sortOrder(input.sortOrder);
        const category = await em.getRepository(SiteDocumentCategoryEntity).findOneBy({
          id: row.categoryId,
          tenantId: user.tenantId,
          siteId: row.siteId,
          deletedAt: null,
        } as any);
        if (!category) throw new NotFoundException('文档分类不存在');
        if (category.scope !== 'all' && category.scope !== row.scope) {
          throw new BadRequestException('文档范围与分类范围不一致');
        }
        const publication = documentPublicationAfterEdit(row.status, row.publishedAt, input);
        row.status = publication.status;
        row.publishedAt = publication.publishedAt;
        row.updatedBy = user.userId;
        const saved = await em.getRepository(SiteDocumentEntity).save(row);
        await this.audit(em, user, 'site-document.update', 'site-document', saved.id, before, {
          ...saved,
        });
        return saved;
      },
      this.scope(user)
    );
  }

  setDocumentStatus(
    user: JwtPayload,
    siteCode: string,
    id: string,
    status: Extract<DocumentStatus, 'published' | 'hidden'>
  ) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const row = await this.findDocument(em, user.tenantId, siteCode, id);
        const before = { ...row };
        row.status = status;
        row.publishedAt = status === 'published' ? row.publishedAt || new Date() : row.publishedAt;
        row.updatedBy = user.userId;
        const saved = await em.getRepository(SiteDocumentEntity).save(row);
        await this.audit(em, user, `site-document.${status}`, 'site-document', saved.id, before, {
          ...saved,
        });
        return saved;
      },
      this.scope(user)
    );
  }

  async archiveDocument(user: JwtPayload, siteCode: string, id: string) {
    const row = await withRlsTransaction(
      this.ds,
      async (em) => {
        const document = await this.findDocument(em, user.tenantId, siteCode, id);
        const before = { ...document };
        document.status = 'archived';
        document.deletedAt = new Date();
        document.deletedBy = user.userId;
        document.updatedBy = user.userId;
        await em.getRepository(SiteDocumentEntity).save(document);
        await this.audit(em, user, 'site-document.archive', 'site-document', document.id, before, {
          ...document,
        });
        return document;
      },
      this.scope(user)
    );
    await this.files.remove(user, row.artifactId);
    return { ok: true, id };
  }

  publicList(siteCodeInput: string, query: Record<string, unknown> = {}) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    const scope = this.documentScope(query.scope);
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, tenantId, siteCode);
        const categories = await em
          .getRepository(SiteDocumentCategoryEntity)
          .createQueryBuilder('category')
          .where('category.tenantId = :tenantId', { tenantId })
          .andWhere('category.siteId = :siteId', { siteId: site.id })
          .andWhere('category.deletedAt IS NULL')
          .andWhere('category.status = :status', { status: 'active' })
          .andWhere('category.scope IN (:...scopes)', { scopes: [scope, 'all'] })
          .orderBy('category.sortOrder', 'ASC')
          .addOrderBy('category.createdAt', 'ASC')
          .getMany();
        const documents = await em.getRepository(SiteDocumentEntity).find({
          where: { tenantId, siteId: site.id, scope, status: 'published', deletedAt: null } as any,
          order: { sortOrder: 'ASC', publishedAt: 'DESC', createdAt: 'DESC' },
        });
        const categoryById = new Map(categories.map((category) => [category.id, category]));
        const items = documents.flatMap((document) => {
          const category = categoryById.get(document.categoryId);
          if (!category) return [];
          return [
            {
              id: document.id,
              title: document.displayName,
              filename: document.originalFilename,
              categoryId: category.id,
              category: category.name,
              type: category.name,
              scope: document.scope,
              fmt: documentFormat(document.originalFilename),
              sizeBytes: Number(document.sizeBytes),
              size: formatDocumentSize(Number(document.sizeBytes)),
              url: `/api/v2/sites/${encodeURIComponent(siteCode)}/documents/${encodeURIComponent(document.id)}/download`,
              sortOrder: document.sortOrder,
            },
          ];
        });
        return {
          success: true,
          data: {
            categories: categories.map((category) => ({
              id: category.id,
              name: category.name,
              slug: category.slug,
              scope: category.scope,
              sortOrder: category.sortOrder,
            })),
            items,
            total: items.length,
          },
        };
      },
      { tenantId }
    );
  }

  async publicDownload(siteCodeInput: string, documentId: string) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('网站未配置公开租户');
    const document = await withRlsTransaction(
      this.ds,
      async (em) => {
        const site = await this.findSite(em, tenantId, siteCode);
        const row = await em
          .getRepository(SiteDocumentEntity)
          .createQueryBuilder('document')
          .innerJoin(
            SiteDocumentCategoryEntity,
            'category',
            'category.id = document.categoryId AND category.tenantId = document.tenantId'
          )
          .where('document.id = :documentId', { documentId })
          .andWhere('document.tenantId = :tenantId', { tenantId })
          .andWhere('document.siteId = :siteId', { siteId: site.id })
          .andWhere('document.status = :status', { status: 'published' })
          .andWhere('document.deletedAt IS NULL')
          .andWhere('category.siteId = :siteId', { siteId: site.id })
          .andWhere('category.status = :categoryStatus', { categoryStatus: 'active' })
          .andWhere('category.deletedAt IS NULL')
          .getOne();
        if (!row) throw new NotFoundException('文档不存在或未发布');
        return row;
      },
      { tenantId }
    );
    const artifact = await this.files.getPublicActiveArtifact(tenantId, document.artifactId);
    if (!artifact) throw new NotFoundException('文档文件不存在');
    return artifact;
  }

  private categoryPatch(
    input: SiteDocumentCategoryInput,
    creating: boolean
  ): Partial<SiteDocumentCategoryEntity> {
    const patch: Partial<SiteDocumentCategoryEntity> = {};
    if (creating || input.name !== undefined) {
      const name = text(input.name);
      if (!name) throw new BadRequestException('分类名称不能为空');
      patch.name = name.slice(0, 80);
      if (creating && input.slug === undefined) {
        patch.slug = normalizePublicSlug(
          name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `category-${Date.now()}`
        );
      }
    }
    if (creating || input.slug !== undefined) {
      patch.slug = normalizePublicSlug(text(input.slug) || patch.slug || 'category');
    }
    if (creating || input.scope !== undefined) {
      const scope = text(input.scope) || 'all';
      if (!CATEGORY_SCOPES.has(scope as CategoryScope))
        throw new BadRequestException('分类范围无效');
      patch.scope = scope as CategoryScope;
    }
    if (creating || input.sortOrder !== undefined)
      patch.sortOrder = this.sortOrder(input.sortOrder);
    if (creating || input.status !== undefined) {
      const status = text(input.status) || 'active';
      if (status !== 'active' && status !== 'inactive')
        throw new BadRequestException('分类状态无效');
      patch.status = status;
    }
    return patch;
  }

  private documentScope(value: unknown): DocumentScope {
    const scope = text(value) || 'residential';
    if (!DOCUMENT_SCOPES.has(scope as DocumentScope)) throw new BadRequestException('文档范围无效');
    return scope as DocumentScope;
  }

  private sortOrder(value: unknown): number {
    const order = Number(value || 0);
    if (!Number.isInteger(order) || order < 0 || order > 999999) {
      throw new BadRequestException('排序必须是非负整数');
    }
    return order;
  }

  private assertDocumentFile(filename: string, dataBase64: unknown) {
    if (!filename) throw new BadRequestException('请选择文档文件');
    if (!DOCUMENT_EXTENSIONS.has(path.extname(filename).toLowerCase())) {
      throw new BadRequestException('不支持该文档格式');
    }
    if (!text(dataBase64)) throw new BadRequestException('文档文件内容不能为空');
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

  private async findCategory(em: EntityManager, tenantId: string, siteCode: string, id: string) {
    const site = await this.findSite(em, tenantId, siteCode);
    const row = await em.getRepository(SiteDocumentCategoryEntity).findOneBy({
      id,
      tenantId,
      siteId: site.id,
      deletedAt: null,
    } as any);
    if (!row) throw new NotFoundException('文档分类不存在');
    return row;
  }

  private async findDocument(em: EntityManager, tenantId: string, siteCode: string, id: string) {
    const site = await this.findSite(em, tenantId, siteCode);
    const row = await em.getRepository(SiteDocumentEntity).findOneBy({
      id,
      tenantId,
      siteId: site.id,
      deletedAt: null,
    } as any);
    if (!row) throw new NotFoundException('文档不存在或已归档');
    return row;
  }

  private scope(user: JwtPayload) {
    return { tenantId: user.tenantId, actorId: user.userId, role: user.role };
  }

  private async audit(
    em: EntityManager,
    user: JwtPayload,
    action: string,
    resourceType: string,
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
        resourceType,
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
