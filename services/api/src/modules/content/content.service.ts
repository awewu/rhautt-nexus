import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { writeAudit } from '../common/audit';
import type { JwtPayload } from '../auth/auth.service';
import { ContentAssetEntity, ContentPublishTaskEntity } from './content.entity';
import {
  productEnabled,
  productFactReady,
  productFactRepo,
} from '../product-catalog/product-fact-read';
import { ProductSellingPointEntity } from '../product-catalog/product-mgmt.entity';
import { FileArtifactEntity } from '../file-artifact/file-artifact.entity';
import { GrowthContentAssetEntity } from '../growth/growth.entities';

type ContentFactRef = { type: string; id: string; label?: string; verified?: boolean };
type CreatePublishTaskDto = {
  channel?: string;
  targetName?: string;
  publishMode?: string;
  owner?: string;
  scheduledAt?: string;
};
type CompletePublishTaskDto = { evidenceUrl?: string; evidenceNote?: string };
type ReviewDecisionDto = {
  decision?: 'approved' | 'rejected';
  rejectionReason?: string;
  reviewNote?: string;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function factRefKey(ref: ContentFactRef) {
  return `${ref.type}:${ref.id}`;
}

function artifactContentUrl(id?: string | null) {
  return id ? `/api/v2/file-artifact/${encodeURIComponent(id)}/content` : null;
}

function hasVerifiedFacts(content: ContentAssetEntity) {
  return (content.factRefs || []).some((ref) => ref.id && ref.verified);
}

function daysSince(value?: Date | string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

function sourceTypeLabel(sourceType?: string | null) {
  const labels: Record<string, string> = {
    geo_gap: 'GEO 缺口',
    geo_experiment: 'GEO 实验',
    product_fact: '产品事实发布',
    dealer_question: '经销商问题',
    sentiment: '舆情问题',
    campaign: '活动 Campaign',
    copywriter: '文案 Copilot',
    manual: '人工 Brief',
  };
  return labels[text(sourceType)] || (sourceType ? sourceType : '人工 Brief');
}

@Injectable()
export class ContentService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) {
    return { tenantId: a.tenantId, actorId: a.userId, role: a.role };
  }

  async create(
    actor: JwtPayload,
    dto: {
      title?: string;
      kind?: string;
      brandCode?: string;
      category?: string;
      body?: string;
      channel?: string;
      factRefs?: any[];
      sourceType?: string;
      sourceRef?: string;
      sourceLabel?: string;
    }
  ) {
    if (!dto.title) throw new BadRequestException('title required');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ContentAssetEntity);
        const factRefs = await this.verifyFactRefs(em, actor, dto.factRefs ?? []);
        const row = await repo.save(
          repo.create({
            tenantId: actor.tenantId,
            title: dto.title!,
            kind: dto.kind ?? 'article',
            brandCode: dto.brandCode ?? null,
            category: dto.category ?? null,
            body: dto.body ?? null,
            channel: dto.channel ?? null,
            factRefs,
            status: 'draft',
            author: actor.userId,
            sourceType: text(dto.sourceType) || null,
            sourceRef: text(dto.sourceRef) || null,
            sourceLabel: text(dto.sourceLabel) || null,
            reviewHistory: [],
          })
        );
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'content.create',
          resourceType: 'content_asset',
          resourceId: row.id,
          afterState: {
            title: dto.title,
            kind: dto.kind ?? 'article',
            channel: dto.channel ?? null,
          },
        });
        return { content: row };
      },
      this.scope(actor)
    );
  }

  async update(
    actor: JwtPayload,
    id: string,
    patch: { title?: string; kind?: string; body?: string; channel?: string; factRefs?: any[] }
  ) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ContentAssetEntity);
        const current = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
        if (!current) throw new NotFoundException('content not found');
        const upd: any = { updatedAt: new Date() };
        for (const k of ['title', 'kind', 'body', 'channel'] as const)
          if (patch[k] != null) upd[k] = patch[k];
        if (patch.factRefs) upd.factRefs = await this.verifyFactRefs(em, actor, patch.factRefs);
        if (current.status === 'rejected') upd.status = 'draft';
        await repo.update({ id, tenantId: actor.tenantId }, upd);
        return { id, updated: true, status: upd.status || current.status };
      },
      this.scope(actor)
    );
  }

  async listFactSources(
    actor: JwtPayload,
    q: { query?: string; brandCode?: string; limit?: string | number } = {}
  ) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const needle = text(q.query).toLowerCase();
        const brandCode = text(q.brandCode).toLowerCase();
        const limit = Math.min(Math.max(Number(q.limit) || 24, 1), 50);
        const products = await productFactRepo(em).find({
          where: [{ tenantId: actor.tenantId }, { tenantId: 'rhautt_shared' }],
          order: { updatedAt: 'DESC' as const },
          take: limit,
        } as any);
        const productSources = products
          .filter(
            (item) => !brandCode || text(item.brandCode || item.brand).toLowerCase() === brandCode
          )
          .filter((item) => {
            if (!needle) return true;
            return [item.name, item.sku, item.model, item.brandCode, item.category].some((value) =>
              text(value).toLowerCase().includes(needle)
            );
          })
          .slice(0, limit)
          .map((item) => ({
            type: 'product',
            id: item.id,
            label: item.name || item.sku || item.id,
            description: [item.brandCode || item.brand, item.sku, item.model, item.category]
              .map(text)
              .filter(Boolean)
              .join(' · '),
            category: '产品事实',
            verified: productFactReady(item),
          }));

        const sellingPoints = await em.getRepository(ProductSellingPointEntity).find({
          where: { tenantId: actor.tenantId },
          order: { sortOrder: 'ASC' as const },
          take: limit,
        } as any);
        const sellingPointSources = sellingPoints
          .filter((item) => {
            if (!needle) return true;
            return [item.claim, item.sku, item.segment, item.evidenceRef].some((value) =>
              text(value).toLowerCase().includes(needle)
            );
          })
          .slice(0, limit)
          .map((item) => ({
            type: 'selling-point',
            id: item.id,
            label: item.claim,
            description: [item.sku, item.segment, item.evidenceRef]
              .map(text)
              .filter(Boolean)
              .join(' · '),
            category: '卖点证据',
            verified: Boolean(item.evidenceRef),
          }));

        const artifacts = await em.getRepository(FileArtifactEntity).find({
          where: { tenantId: actor.tenantId, status: 'active' },
          order: { createdAt: 'DESC' as const },
          take: limit,
        } as any);
        const artifactSources = artifacts
          .filter((item) => {
            if (!needle) return true;
            return [item.originalName, item.entityType, item.mimeType].some((value) =>
              text(value).toLowerCase().includes(needle)
            );
          })
          .slice(0, limit)
          .map((item) => ({
            type: 'manual',
            id: item.id,
            label: item.originalName || item.id,
            description: [
              item.entityType,
              item.mimeType,
              item.createdAt ? new Date(item.createdAt).toLocaleDateString('zh-CN') : '',
            ]
              .map(text)
              .filter(Boolean)
              .join(' · '),
            category: '资料凭证',
            verified: true,
          }));

        return {
          categories: [
            { key: 'product', label: '产品事实', count: productSources.length },
            { key: 'selling-point', label: '卖点证据', count: sellingPointSources.length },
            { key: 'manual', label: '资料凭证', count: artifactSources.length },
          ],
          items: [...artifactSources, ...productSources, ...sellingPointSources],
        };
      },
      this.scope(actor)
    );
  }

  async productionContext(
    actor: JwtPayload,
    q: {
      query?: string;
      brandCode?: string;
      channel?: string;
      limit?: string | number;
      productTenantId?: string;
    } = {}
  ) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const needle = text(q.query).toLowerCase();
        const brandCode = text(q.brandCode).toLowerCase();
        const productTenantId = text(q.productTenantId) || actor.tenantId;
        const limit = Math.min(Math.max(Number(q.limit) || 18, 1), 50);
        const matches = (...values: unknown[]) =>
          !needle || values.some((value) => text(value).toLowerCase().includes(needle));

        const products = (
          await productFactRepo(em).find({
            where: { tenantId: productTenantId },
            order: { updatedAt: 'DESC' as const },
            take: limit * 2,
          } as any)
        )
          .filter(productEnabled)
          .filter(
            (item) => !brandCode || text(item.brandCode || item.brand).toLowerCase() === brandCode
          )
          .filter((item) => matches(item.name, item.sku, item.model, item.category, item.brandCode))
          .slice(0, limit)
          .map((item) => ({
            id: item.id,
            label: item.name || item.workingName || item.sku || '未命名产品',
            meta: [item.brandCode || item.brand, item.model || item.sku, item.category]
              .map(text)
              .filter(Boolean)
              .join(' · '),
            brandCode: item.brandCode || item.brand || null,
            category: item.category || null,
            verified: productFactReady(item),
            factRef: { type: 'product', id: item.id, label: item.name || item.sku || item.id },
          }));

        const selectedProductIds = new Set(products.map((item) => item.id));
        const sellingPoints = (
          await em.getRepository(ProductSellingPointEntity).find({
            where: { tenantId: actor.tenantId },
            order: { sortOrder: 'ASC' as const, createdAt: 'DESC' as const },
            take: limit * 3,
          } as any)
        )
          .filter(
            (item) =>
              !selectedProductIds.size || !item.productId || selectedProductIds.has(item.productId)
          )
          .filter((item) => matches(item.claim, item.sku, item.segment, item.evidenceRef))
          .slice(0, limit)
          .map((item) => ({
            id: item.id,
            label: item.claim,
            meta: [item.segment, item.sku, item.evidenceRef ? '有证据' : '待补证据']
              .map(text)
              .filter(Boolean)
              .join(' · '),
            productId: item.productId,
            verified: Boolean(item.evidenceRef),
            factRef: { type: 'selling-point', id: item.id, label: item.claim },
          }));

        const contentAssets = (
          await em.getRepository(GrowthContentAssetEntity).find({
            where: { tenantId: actor.tenantId, status: 'active' },
            order: { updatedAt: 'DESC' as const },
            take: limit * 2,
          } as any)
        )
          .filter((item) => !item.archivedAt)
          .filter((item) =>
            matches(
              item.title,
              item.summary,
              item.assetType,
              item.usageScene,
              item.channel,
              ...(Array.isArray(item.tags) ? item.tags : [])
            )
          )
          .slice(0, limit)
          .map((item) => ({
            id: item.id,
            label: item.title,
            type: item.assetType,
            meta: [item.assetType, item.usageScene, item.fileFormat]
              .map(text)
              .filter(Boolean)
              .join(' · '),
            fileArtifactId: item.fileArtifactId,
            thumbnailUrl: item.thumbnailUrl || artifactContentUrl(item.fileArtifactId),
            fileUrl: item.fileUrl || artifactContentUrl(item.fileArtifactId),
            verified: true,
            factRef: item.fileArtifactId
              ? { type: 'manual', id: item.fileArtifactId, label: item.title }
              : null,
          }));

        const materials = contentAssets
          .filter(
            (item, index, list) =>
              list.findIndex(
                (other) =>
                  `${other.fileArtifactId || other.id}` === `${item.fileArtifactId || item.id}`
              ) === index
          )
          .slice(0, limit);

        return {
          products,
          sellingPoints,
          materials,
          factSources: [
            ...products.map((item) => ({
              ...item.factRef,
              category: '产品事实',
              description: item.meta,
              verified: item.verified,
            })),
            ...sellingPoints.map((item) => ({
              ...item.factRef,
              category: '卖点证据',
              description: item.meta,
              verified: item.verified,
            })),
            ...materials
              .filter((item) => item.factRef)
              .map((item) => ({
                ...item.factRef!,
                category: '素材凭证',
                description: item.meta,
                verified: item.verified,
              })),
          ],
        };
      },
      this.scope(actor)
    );
  }

  async bindFactRefs(actor: JwtPayload, id: string, refs: ContentFactRef[]) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ContentAssetEntity);
        const content = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
        if (!content) throw new NotFoundException('content not found');
        const factRefs = await this.verifyFactRefs(em, actor, refs);
        await repo.update({ id, tenantId: actor.tenantId }, { factRefs, updatedAt: new Date() });
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'content.fact_refs.bind',
          resourceType: 'content_asset',
          resourceId: id,
          beforeState: { factRefs: content.factRefs?.length || 0 },
          afterState: { factRefs: factRefs.length },
        });
        return { id, factRefs, gate: this.factGate(factRefs) };
      },
      this.scope(actor)
    );
  }

  async submitReview(actor: JwtPayload, id: string) {
    return this.transition(actor, id, 'in_review');
  }

  async decide(
    actor: JwtPayload,
    id: string,
    decision: 'approved' | 'rejected',
    dto: ReviewDecisionDto = {}
  ) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ContentAssetEntity);
        const c = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
        if (!c) throw new NotFoundException('content not found');
        if (!['approved', 'rejected'].includes(decision))
          throw new BadRequestException('invalid review decision');
        const note = text(dto.reviewNote);
        const reason = text(dto.rejectionReason);
        if (decision === 'rejected' && !note) throw new BadRequestException('驳回必须填写修改意见');
        const history = Array.isArray(c.reviewHistory) ? [...c.reviewHistory] : [];
        history.push({
          decision,
          reason: decision === 'rejected' ? reason || 'other' : undefined,
          note: note || undefined,
          reviewer: actor.userId,
          at: new Date().toISOString(),
        });
        await repo.update({ id }, {
          status: decision,
          reviewer: actor.userId,
          reviewNote: note || null,
          rejectionReason: decision === 'rejected' ? reason || 'other' : null,
          reviewHistory: history,
          updatedAt: new Date(),
        } as any);
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: `content.${decision}`,
          resourceType: 'content_asset',
          resourceId: id,
          beforeState: { status: c.status },
          afterState: {
            status: decision,
            title: c.title,
            rejectionReason: decision === 'rejected' ? reason || 'other' : null,
          },
        });
        return { id, status: decision };
      },
      this.scope(actor)
    );
  }

  async createPublishTask(actor: JwtPayload, id: string, dto: CreatePublishTaskDto = {}) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const contentRepo = em.getRepository(ContentAssetEntity);
        const taskRepo = em.getRepository(ContentPublishTaskEntity);
        const c = await contentRepo.findOne({ where: { id, tenantId: actor.tenantId } });
        if (!c) throw new NotFoundException('content not found');
        if (c.status !== 'approved')
          throw new ForbiddenException('内容须先审核通过才能创建发布任务');
        const gate = this.factGate(c.factRefs || []);
        if (!gate.passed)
          throw new ForbiddenException(gate.reason || '无事实源引用不得对外发布（基座4）');
        const channel = text(dto.channel || c.channel || 'official_site');
        if (!channel) throw new BadRequestException('发布渠道必填');
        const publishMode = ['auto', 'manual'].includes(text(dto.publishMode))
          ? text(dto.publishMode)
          : 'manual';
        const row = await taskRepo.save(
          taskRepo.create({
            tenantId: actor.tenantId,
            contentId: id,
            channel,
            targetName: text(dto.targetName) || null,
            publishMode,
            status: publishMode === 'auto' ? 'queued' : 'manual_required',
            owner: text(dto.owner) || actor.userId,
            scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
            publishedAt: null,
            evidenceUrl: null,
            evidenceNote: null,
          })
        );
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'content.publish_task.create',
          resourceType: 'content_publish_task',
          resourceId: row.id,
          afterState: {
            contentId: id,
            channel,
            publishMode,
            status: row.status,
            factRefs: (c.factRefs || []).length,
          },
        });
        return { task: row, content: { id, status: c.status }, gate };
      },
      this.scope(actor)
    );
  }

  async listPublishTasks(actor: JwtPayload, q: { status?: string; contentId?: string } = {}) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const where: Record<string, unknown> = { tenantId: actor.tenantId };
        if (q.status) where.status = q.status;
        if (q.contentId) where.contentId = q.contentId;
        return {
          tasks: await em
            .getRepository(ContentPublishTaskEntity)
            .find({ where, order: { updatedAt: 'DESC' }, take: 100 } as any),
        };
      },
      this.scope(actor)
    );
  }

  async completePublishTask(actor: JwtPayload, taskId: string, dto: CompletePublishTaskDto = {}) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const taskRepo = em.getRepository(ContentPublishTaskEntity);
        const contentRepo = em.getRepository(ContentAssetEntity);
        const task = await taskRepo.findOne({ where: { id: taskId, tenantId: actor.tenantId } });
        if (!task) throw new NotFoundException('publish task not found');
        const evidenceUrl = text(dto.evidenceUrl);
        const evidenceNote = text(dto.evidenceNote);
        if (!evidenceUrl && !evidenceNote)
          throw new BadRequestException('请填写发布链接或发布凭证说明');
        const now = new Date();
        await taskRepo.update({ id: taskId, tenantId: actor.tenantId }, {
          status: 'published',
          publishedAt: now,
          evidenceUrl: evidenceUrl || null,
          evidenceNote: evidenceNote || null,
          updatedAt: now,
        } as any);
        await contentRepo.update(
          { id: task.contentId, tenantId: actor.tenantId },
          { status: 'published', updatedAt: now }
        );
        await writeAudit(em, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: 'content.publish_task.evidence',
          resourceType: 'content_publish_task',
          resourceId: taskId,
          afterState: {
            contentId: task.contentId,
            status: 'published',
            evidenceUrl: evidenceUrl || null,
          },
        });
        return { id: taskId, status: 'published', contentId: task.contentId };
      },
      this.scope(actor)
    );
  }

  // 基座4：发布前必须有事实源引用 + 已核准。实际对外动作必须通过发布任务承接。
  async publish(actor: JwtPayload, id: string) {
    void actor;
    void id;
    throw new ForbiddenException(
      '审核通过不等于已发布；请先创建发布任务，渠道发布完成后再回填发布凭证'
    );
  }

  private factGate(factRefs: ContentFactRef[]) {
    if (!factRefs.length) return { passed: false, reason: '无事实源引用不得对外发布（基座4）' };
    if (factRefs.some((ref) => !ref.verified))
      return { passed: false, reason: '事实源未通过校验，不得对外发布' };
    return { passed: true, reason: '' };
  }

  private async verifyFactRefs(
    em: any,
    actor: JwtPayload,
    refs: unknown[]
  ): Promise<ContentFactRef[]> {
    if (!Array.isArray(refs) || !refs.length) return [];
    const normalized = refs.map((raw) => {
      const item =
        typeof raw === 'string'
          ? { type: 'manual', id: raw }
          : ((raw || {}) as Record<string, unknown>);
      const type = text(item.type || 'manual');
      const id = text(item.id);
      const label = text(item.label);
      if (!id) throw new BadRequestException('fact ref id required');
      if (!['product', 'selling-point', 'manual', 'fact'].includes(type)) {
        throw new BadRequestException(`unsupported fact ref type: ${type}`);
      }
      return { type, id, label };
    });
    const unique = Array.from(new Map(normalized.map((ref) => [factRefKey(ref), ref])).values());

    const productRepo = productFactRepo(em);
    const sellingPointRepo = em.getRepository(ProductSellingPointEntity);
    const fileRepo = em.getRepository(FileArtifactEntity);
    const verified: ContentFactRef[] = [];
    for (const ref of unique) {
      if (ref.type === 'product') {
        const product = await productRepo.findOne({
          where: [
            { id: ref.id, tenantId: actor.tenantId },
            { id: ref.id, tenantId: 'rhautt_shared' },
          ],
        });
        if (!product) throw new BadRequestException(`product fact not found: ${ref.id}`);
        verified.push({
          ...ref,
          label: ref.label || product.name || product.sku || ref.id,
          verified: productFactReady(product),
        });
      } else if (ref.type === 'selling-point') {
        const point = await sellingPointRepo.findOne({
          where: { id: ref.id, tenantId: actor.tenantId },
        });
        if (!point) throw new BadRequestException(`selling point fact not found: ${ref.id}`);
        verified.push({
          ...ref,
          label: ref.label || point.claim || ref.id,
          verified: Boolean(point.evidenceRef),
        });
      } else {
        const file = await fileRepo.findOne({
          where: { id: ref.id, tenantId: actor.tenantId, status: 'active' },
        });
        verified.push({
          ...ref,
          label: ref.label || file?.originalName || ref.id,
          verified: Boolean(file),
        });
      }
    }
    return verified;
  }

  private async transition(actor: JwtPayload, id: string, status: string) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const r = await em
          .getRepository(ContentAssetEntity)
          .update({ id, tenantId: actor.tenantId }, { status, updatedAt: new Date() });
        if (!r.affected) throw new NotFoundException('content not found');
        return { id, status };
      },
      this.scope(actor)
    );
  }

  async list(actor: JwtPayload, q: { status?: string; channel?: string } = {}) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const where: Record<string, unknown> = { tenantId: actor.tenantId };
        if (q.status) where.status = q.status;
        if (q.channel) where.channel = q.channel;
        const contents = await em
          .getRepository(ContentAssetEntity)
          .find({ where, order: { updatedAt: 'DESC' }, take: 100 });
        const tasks = await em.getRepository(ContentPublishTaskEntity).find({
          where: { tenantId: actor.tenantId },
          order: { updatedAt: 'DESC' as const },
          take: 200,
        } as any);
        const taskMap = this.tasksByContent(tasks);
        return {
          contents: contents.map((item) => this.enrichContentRow(item, taskMap.get(item.id) || [])),
        };
      },
      this.scope(actor)
    );
  }

  // 审核积压计数（喂 CMO riskAlerts）。
  async reviewBacklog(actor: JwtPayload) {
    return withRlsTransaction(
      this.ds,
      async (em) => ({
        inReview: await em
          .getRepository(ContentAssetEntity)
          .count({ where: { tenantId: actor.tenantId, status: 'in_review' } }),
      }),
      this.scope(actor)
    );
  }

  private tasksByContent(tasks: ContentPublishTaskEntity[]) {
    const map = new Map<string, ContentPublishTaskEntity[]>();
    for (const task of tasks) {
      const list = map.get(task.contentId) || [];
      list.push(task);
      map.set(task.contentId, list);
    }
    for (const list of map.values())
      list.sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    return map;
  }

  private enrichContentRow(
    content: ContentAssetEntity,
    publishTasks: ContentPublishTaskEntity[] = []
  ) {
    const latestTask = publishTasks[0] || null;
    const openPublishTask =
      publishTasks.find((task) => task.status !== 'published' && task.status !== 'cancelled') ||
      null;
    const gate = this.factGate(content.factRefs || []);
    const source = {
      type: content.sourceType || 'manual',
      label: content.sourceLabel || sourceTypeLabel(content.sourceType),
      sourceRef: content.sourceRef || null,
    };
    const retrospectiveDone =
      content.status === 'published' &&
      Boolean(latestTask?.evidenceUrl || latestTask?.evidenceNote) &&
      (content.sourceType !== 'geo_experiment' || Boolean(latestTask?.evidenceUrl));

    return {
      ...content,
      source,
      factGate: {
        status: gate.passed ? 'passed' : hasVerifiedFacts(content) ? 'partial' : 'blocked',
        reason: gate.reason || '事实源已校验',
        verifiedCount: (content.factRefs || []).filter((ref) => ref.id && ref.verified).length,
        totalCount: (content.factRefs || []).filter((ref) => ref.id).length,
      },
      latestPublishTask: latestTask,
      openPublishTask,
      nextAction: this.nextActionFor(content, gate, openPublishTask),
      aging: {
        daysInCurrentStatus: daysSince(content.updatedAt),
        overdue: content.status !== 'published' && Number(daysSince(content.updatedAt) || 0) >= 3,
      },
      retrospective: {
        done: retrospectiveDone,
        evidenceUrl: latestTask?.evidenceUrl || null,
        evidenceNote: latestTask?.evidenceNote || null,
        needsGeoRetest:
          content.status === 'published' &&
          content.sourceType === 'geo_experiment' &&
          !retrospectiveDone,
      },
    };
  }

  private nextActionFor(
    content: ContentAssetEntity,
    gate: { passed: boolean; reason?: string },
    openTask?: ContentPublishTaskEntity | null
  ) {
    if (!gate.passed && content.status !== 'published')
      return { key: 'bindFacts', label: '补事实源', tone: 'danger' };
    if (content.status === 'draft') return { key: 'submitReview', label: '提交审核', tone: 'info' };
    if (content.status === 'rejected')
      return { key: 'editRework', label: '修改后重提', tone: 'warning' };
    if (content.status === 'in_review')
      return { key: 'waitReview', label: '等待审核', tone: 'neutral' };
    if (content.status === 'approved' && openTask)
      return { key: 'fillEvidence', label: '回填发布凭证', tone: 'warning' };
    if (content.status === 'approved')
      return { key: 'createPublishTask', label: '创建发布任务', tone: 'success' };
    if (content.status === 'published')
      return { key: 'retrospective', label: '查看复盘', tone: 'brand' };
    return { key: 'inspect', label: '查看内容', tone: 'neutral' };
  }
}
