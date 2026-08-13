import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeDataSource, InMemoryRepository } from '../common/testing/fake-datasource';
import { productFactEntity } from '../product-catalog/product-fact-read';
import { ProductSellingPointEntity } from '../product-catalog/product-mgmt.entity';
import { FileArtifactEntity } from '../file-artifact/file-artifact.entity';
import { GrowthContentAssetEntity } from '../growth/growth.entities';
import { ContentAssetEntity, ContentPublishTaskEntity } from './content.entity';
import { ContentService } from './content.service';

const actor: any = { userId: 'u1', tenantId: 't1', role: 'hq_admin' };

function fixture(rows: any[] = []) {
  const repo = new InMemoryRepository();
  repo.seed(...rows);
  const taskRepo = new InMemoryRepository();
  const productRepo = new InMemoryRepository();
  productRepo.seed(
    { id: 'pl1', tenantId: 'product-library', name: 'Rheem library product', sku: 'SKU-L1', brandCode: 'rheem', status: 'active', recordStatus: 'active', dataReadinessStatus: 'fact_verified', published: true, deletedAt: null },
    { id: 'p1', tenantId: 't1', name: 'Rheem test product', sku: 'SKU-1', brandCode: 'rheem', status: 'active', recordStatus: 'active', dataReadinessStatus: 'fact_verified', published: true, deletedAt: null },
    { id: 'p0', tenantId: 't1', name: 'Tenant seed product', sku: 'SKU-0', brandCode: 'rheem', status: 'active', recordStatus: 'active', dataReadinessStatus: 'fact_verified', published: true, deletedAt: null },
    { id: 'p2', tenantId: 't1', name: 'Draft product', sku: 'SKU-2', brandCode: 'rheem', status: 'active', recordStatus: 'active', dataReadinessStatus: 'imported_draft', published: true, deletedAt: null },
    { id: 'p3', tenantId: 't1', name: 'Disabled product', sku: 'SKU-3', brandCode: 'rheem', status: 'inactive', recordStatus: 'active', dataReadinessStatus: 'fact_verified', published: true, deletedAt: null },
    { id: 'p4', tenantId: 't1', name: 'Unpublished product', sku: 'SKU-4', brandCode: 'rheem', status: 'active', recordStatus: 'active', dataReadinessStatus: 'fact_verified', published: false, deletedAt: null },
  );
  const sellingPointRepo = new InMemoryRepository();
  sellingPointRepo.seed(
    { id: 'sp1', tenantId: 't1', claim: '节能稳定', evidenceRef: 'doc-1' },
    { id: 'sp2', tenantId: 't1', claim: '缺少证据', evidenceRef: null },
  );
  const fileRepo = new InMemoryRepository();
  fileRepo.seed({ id: 'f1', tenantId: 't1', status: 'active', originalName: 'manual-fact.pdf', entityType: 'content_fact_source', mimeType: 'application/pdf', createdAt: new Date('2026-08-11') });
  const contentAssetRepo = new InMemoryRepository();
  contentAssetRepo.seed(
    { id: 'ca1', tenantId: 't1', status: 'active', archivedAt: null, title: 'Verified lifestyle image', assetType: '封面图', brandSlug: 'rheem', channel: 'wechat', summary: 'usable content asset', tags: ['节能'], fileArtifactId: 'f1', fileUrl: '', thumbnailUrl: '', fileFormat: 'jpg', usageScene: '文案配图', updatedAt: new Date('2026-08-12') },
    { id: 'ca3', tenantId: 't1', status: 'active', archivedAt: null, title: 'Reusable generic image', assetType: '正文配图', brandSlug: null, channel: 'seo', summary: 'generic content asset', tags: ['通用'], fileArtifactId: 'f3', fileUrl: '', thumbnailUrl: '', fileFormat: 'png', usageScene: '通用配图', updatedAt: new Date('2026-08-12') },
    { id: 'ca2', tenantId: 't1', status: 'active', archivedAt: new Date('2026-08-12'), title: 'Archived image', assetType: '封面图', brandSlug: 'rheem', channel: 'wechat', summary: 'archived', tags: [], fileArtifactId: 'f2', fileUrl: '', thumbnailUrl: '', fileFormat: 'jpg', usageScene: '文案配图', updatedAt: new Date('2026-08-11') },
  );
  const { ds } = makeFakeDataSource([
    [ContentAssetEntity, repo],
    [ContentPublishTaskEntity, taskRepo],
    [productFactEntity, productRepo],
    [ProductSellingPointEntity, sellingPointRepo],
    [FileArtifactEntity, fileRepo],
    [GrowthContentAssetEntity, contentAssetRepo],
  ]);
  return { svc: new ContentService(ds), repo, taskRepo };
}

test('createPublishTask blocks content that has not been approved', async () => {
  const { svc } = fixture([{ id: 'c1', tenantId: 't1', status: 'in_review', factRefs: [{ type: 'fact', id: 'f1', verified: true }] }]);
  await assert.rejects(() => svc.createPublishTask(actor, 'c1', { channel: 'official_site' }), /审核通过/);
});

test('createPublishTask blocks approved content without fact refs', async () => {
  const { svc } = fixture([{ id: 'c2', tenantId: 't1', status: 'approved', factRefs: [] }]);
  await assert.rejects(() => svc.createPublishTask(actor, 'c2', { channel: 'official_site' }), /无事实源/);
});

test('createPublishTask blocks approved content with unverified fact refs', async () => {
  const { svc } = fixture([{ id: 'c3', tenantId: 't1', status: 'approved', factRefs: [{ type: 'fact', id: 'f1' }] }]);
  await assert.rejects(() => svc.createPublishTask(actor, 'c3', { channel: 'official_site' }), /事实源未通过校验/);
});

test('createPublishTask creates a channel task and keeps content approved', async () => {
  const { svc, repo, taskRepo } = fixture([{ id: 'c4', tenantId: 't1', status: 'approved', factRefs: [{ type: 'fact', id: 'f1', verified: true }] }]);
  const result: any = await svc.createPublishTask(actor, 'c4', { channel: 'official_site', targetName: 'Rheem 官网', publishMode: 'manual' });
  assert.equal(result.task.status, 'manual_required');
  assert.equal(result.task.contentId, 'c4');
  assert.equal(result.task.targetName, 'Rheem 官网');
  assert.equal((repo.rows.find((x: any) => x.id === 'c4') as any).status, 'approved');
  assert.equal(taskRepo.rows.length, 1);
});

test('completePublishTask requires evidence and marks content as published', async () => {
  const { svc, repo, taskRepo } = fixture([{ id: 'c4b', tenantId: 't1', status: 'approved', factRefs: [{ type: 'fact', id: 'f1', verified: true }] }]);
  const created: any = await svc.createPublishTask(actor, 'c4b', { channel: 'wechat', targetName: '官方公众号' });
  await assert.rejects(() => svc.completePublishTask(actor, created.task.id, {}), /发布链接|发布凭证/);
  const result: any = await svc.completePublishTask(actor, created.task.id, { evidenceUrl: 'https://example.test/post/1' });
  assert.equal(result.status, 'published');
  assert.equal((taskRepo.rows.find((x: any) => x.id === created.task.id) as any).status, 'published');
  assert.equal((repo.rows.find((x: any) => x.id === 'c4b') as any).status, 'published');
});

test('rejection requires a review note and stores feedback history', async () => {
  const { svc, repo } = fixture([{ id: 'c4c', tenantId: 't1', title: '待审稿', status: 'in_review', factRefs: [{ type: 'fact', id: 'f1', verified: true }], reviewHistory: [] }]);
  await assert.rejects(() => svc.decide(actor, 'c4c', 'rejected', { rejectionReason: 'fact_missing' }), /修改意见/);
  const result: any = await svc.decide(actor, 'c4c', 'rejected', { rejectionReason: 'fact_missing', reviewNote: '缺少产品参数来源，请补充手册或产品事实。' });
  const row: any = repo.rows.find((x: any) => x.id === 'c4c');
  assert.equal(result.status, 'rejected');
  assert.equal(row.reviewNote, '缺少产品参数来源，请补充手册或产品事实。');
  assert.equal(row.rejectionReason, 'fact_missing');
  assert.equal(row.reviewHistory.length, 1);
  assert.equal(row.reviewHistory[0].decision, 'rejected');
});

test('editing rejected content returns it to draft for resubmission', async () => {
  const { svc, repo } = fixture([{ id: 'c4d', tenantId: 't1', title: '旧标题', status: 'rejected', factRefs: [], reviewNote: '请修改标题', reviewHistory: [] }]);
  const result: any = await svc.update(actor, 'c4d', { title: '新标题', body: '已按意见修改' });
  const row: any = repo.rows.find((x: any) => x.id === 'c4d');
  assert.equal(result.status, 'draft');
  assert.equal(row.status, 'draft');
  assert.equal(row.title, '新标题');
});

test('bindFactRefs validates product facts and stores verified refs', async () => {
  const { svc, repo } = fixture([{ id: 'c5', tenantId: 't1', status: 'draft', factRefs: [] }]);
  const result: any = await svc.bindFactRefs(actor, 'c5', [{ type: 'product', id: 'p1' }]);
  assert.equal(result.gate.passed, true);
  assert.equal((repo.rows.find((x: any) => x.id === 'c5') as any).factRefs[0].verified, true);
});

test('bindFactRefs stores products that are not fact verified as pending', async () => {
  const { svc, repo } = fixture([{ id: 'c6', tenantId: 't1', status: 'draft', factRefs: [] }]);
  const result: any = await svc.bindFactRefs(actor, 'c6', [{ type: 'product', id: 'p2' }]);
  assert.equal(result.gate.passed, false);
  assert.equal((repo.rows.find((x: any) => x.id === 'c6') as any).factRefs[0].verified, false);
});

test('bindFactRefs stores selling points without evidence as pending', async () => {
  const { svc, repo } = fixture([{ id: 'c7', tenantId: 't1', status: 'draft', factRefs: [] }]);
  const result: any = await svc.bindFactRefs(actor, 'c7', [{ type: 'selling-point', id: 'sp2' }]);
  assert.equal(result.gate.passed, false);
  assert.equal((repo.rows.find((x: any) => x.id === 'c7') as any).factRefs[0].verified, false);
});

test('bindFactRefs validates manual fact artifacts', async () => {
  const { svc, repo } = fixture([{ id: 'c8', tenantId: 't1', status: 'draft', factRefs: [] }]);
  const result: any = await svc.bindFactRefs(actor, 'c8', [{ type: 'manual', id: 'f1' }]);
  assert.equal(result.gate.passed, true);
  assert.equal((repo.rows.find((x: any) => x.id === 'c8') as any).factRefs[0].label, 'manual-fact.pdf');
});

test('listFactSources exposes uploaded artifacts as human-readable evidence', async () => {
  const { svc } = fixture();
  const result: any = await svc.listFactSources(actor, { query: 'manual' });
  const artifact = result.items.find((item: any) => item.type === 'manual');
  assert.equal(artifact.label, 'manual-fact.pdf');
  assert.equal(artifact.category, '资料凭证');
  assert.equal(artifact.verified, true);
});

test('productionContext exposes only enabled products and content asset library items', async () => {
  const { svc } = fixture();
  const result: any = await svc.productionContext(actor, { brandCode: 'rheem', channel: 'wechat', productTenantId: 'product-library', limit: 10 });
  assert.deepEqual(result.products.map((item: any) => item.id), ['pl1']);
  assert.equal(result.products.some((item: any) => ['p0', 'p1', 'p2', 'p3', 'p4'].includes(item.id)), false);
  assert.deepEqual(result.materials.map((item: any) => item.id), ['ca1', 'ca3']);
  assert.equal(result.materials.some((item: any) => item.id === 'f1' || item.label === 'manual-fact.pdf'), false);
  assert.equal(result.factSources.some((item: any) => item.type === 'manual' && item.id === 'f1' && item.label === 'Verified lifestyle image'), true);
});

test('productionContext can browse enabled products before a brand is selected', async () => {
  const { svc } = fixture();
  const result: any = await svc.productionContext(actor, { channel: 'xiaohongshu', productTenantId: 'product-library', limit: 10 });
  assert.deepEqual(result.products.map((item: any) => item.id), ['pl1']);
  assert.equal(result.materials.some((item: any) => item.id === 'ca3'), true);
});

test('productionContext does not filter content assets by selected brand', async () => {
  const { svc } = fixture();
  const result: any = await svc.productionContext(actor, { brandCode: 'everhot', productTenantId: 'product-library', limit: 10 });
  assert.equal(result.products.length, 0);
  assert.deepEqual(result.materials.map((item: any) => item.id), ['ca1', 'ca3']);
});

test('createPublishTask still blocks after binding pending fact refs', async () => {
  const { svc, repo } = fixture([{ id: 'c9', tenantId: 't1', status: 'approved', factRefs: [] }]);
  await svc.bindFactRefs(actor, 'c9', [{ type: 'product', id: 'p2' }]);
  assert.equal((repo.rows.find((x: any) => x.id === 'c9') as any).factRefs[0].verified, false);
  await assert.rejects(() => svc.createPublishTask(actor, 'c9', { channel: 'official_site' }), /事实源未通过校验/);
});

test('legacy publish endpoint no longer marks approved content as published', async () => {
  const { svc, repo } = fixture([{ id: 'c10', tenantId: 't1', status: 'approved', factRefs: [{ type: 'fact', id: 'f1', verified: true }] }]);
  await assert.rejects(() => svc.publish(actor, 'c10'), /创建发布任务/);
  assert.equal((repo.rows.find((x: any) => x.id === 'c10') as any).status, 'approved');
});

test('list returns production next actions for the content factory', async () => {
  const { svc } = fixture([
    { id: 'c11', tenantId: 't1', title: '缺事实源稿', status: 'draft', factRefs: [], sourceType: 'geo_gap', updatedAt: new Date('2026-08-10') },
    { id: 'c12', tenantId: 't1', title: '可发布稿', status: 'approved', factRefs: [{ type: 'manual', id: 'f1', verified: true }], updatedAt: new Date('2026-08-10') },
  ]);
  const result: any = await svc.list(actor);
  const blocked = result.contents.find((item: any) => item.id === 'c11');
  const publishable = result.contents.find((item: any) => item.id === 'c12');
  assert.equal(blocked.nextAction.key, 'bindFacts');
  assert.equal(blocked.source.label, 'GEO 缺口');
  assert.equal(publishable.nextAction.key, 'createPublishTask');
});
