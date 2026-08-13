import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ConflictException } from '@nestjs/common';
import { InMemoryRepository, makeFakeDataSource } from '../common/testing/fake-datasource';
import { AuditLogEntity } from '../governance/governance.entity';
import {
  PriceListItemEntity,
  ProductContentEntity,
  ProductContentEventEntity,
  ProductEntity,
  ProductBrandBindingEntity,
  ProductSkuEntity,
  ProductWebsitePricingEntity,
} from './product-catalog.entity';
import { ProductCatalogService } from './product-catalog.service';

const TENANT_ID = '4aee0000-0000-4000-8000-000000000001';
const ACTOR = { userId: 'operator-1', role: 'brand_admin' };

test('identity guarded upsert creates product and first SKU when brand model is new', async () => {
  const { service, products, skus, brandBindings } = serviceFixture();

  const result = await service.upsertWithIdentityGuard(
    {
      tenantId: TENANT_ID,
      brandCode: 'everhot',
      model: 'RGS-A',
      sku: 'MAT-001',
      name: 'Everhot RGS-A',
    },
    ACTOR
  );

  assert.equal(result.success, true);
  assert.equal(result.meta.operation, 'created_product');
  assert.equal(result.meta.skuOperation, 'created_sku');
  assert.equal(products.rows.length, 1);
  assert.equal(skus.rows.length, 1);
  assert.equal(products.rows[0].brandCode, 'everhot');
  assert.deepEqual(
    brandBindings.rows.map((row) => row.brandCode),
    ['everhot']
  );
  assert.equal(products.rows[0].model, 'RGS-A');
  assert.equal(products.rows[0].normalizedModel, 'rgs-a');
  assert.equal(skus.rows[0].productId, products.rows[0].id);
  assert.equal(skus.rows[0].skuCode, 'MAT-001');
});

test('identity guarded upsert persists optional website pricing projection', async () => {
  const { service, products, websitePricing } = serviceFixture();

  const result = await service.upsertWithIdentityGuard(
    {
      tenantId: TENANT_ID,
      brandCode: 'everhot',
      model: 'RGS-C',
      sku: 'MAT-003',
      name: 'Everhot RGS-C',
      listPrice: 12000,
      currency: 'CNY',
      websitePricing: {
        siteCode: 'everhot',
        locale: 'zh-CN',
        priceDisplayMode: 'show_price',
        websitePrice: 11800,
        priceUnit: '台',
        priceLabel: '官网参考价',
        taxIncluded: true,
      },
    },
    ACTOR
  );

  assert.equal(result.meta.websitePricing?.priceDisplayMode, 'show_price');
  assert.equal(products.rows[0].listPrice, 12000);
  assert.equal(websitePricing.rows.length, 1);
  assert.equal(websitePricing.rows[0].productId, products.rows[0].id);
  assert.equal(websitePricing.rows[0].brandCode, 'everhot');
  assert.equal(websitePricing.rows[0].siteCode, 'everhot');
  assert.equal(websitePricing.rows[0].priceDisplayMode, 'show_price');
  assert.equal(websitePricing.rows[0].websitePrice, 11800);
  assert.equal(websitePricing.rows[0].priceUnit, '台');
});

test('identity guarded upsert returns duplicate prompt before updating existing brand model', async () => {
  const { service } = serviceFixture({
    products: [product('product-1', { sku: 'MAT-001', model: 'RGS-A', normalizedModel: 'rgs-a' })],
    skus: [sku('sku-1', 'product-1', 'MAT-001')],
  });

  await assert.rejects(
    () =>
      service.upsertWithIdentityGuard(
        {
          tenantId: TENANT_ID,
          brandCode: 'everhot',
          model: 'RGS-A',
          sku: 'MAT-002',
          name: 'Everhot RGS-A 新文案',
        },
        ACTOR
      ),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      const response = error.getResponse() as any;
      assert.equal(response.code, 'PRODUCT_MODEL_EXISTS');
      assert.equal(response.data.existingProduct.id, 'product-1');
      assert.equal(response.data.proposedSku.skuCode, 'MAT-002');
      assert.equal(response.data.proposedSku.alreadyExists, false);
      assert.equal(response.data.resolution.confirmField, 'confirmExistingProduct');
      return true;
    }
  );
});

test('identity guarded upsert updates product and appends SKU after explicit confirmation', async () => {
  const { service, products, skus } = serviceFixture({
    products: [
      product('product-1', {
        sku: 'MAT-001',
        model: 'RGS-A',
        normalizedModel: 'rgs-a',
        name: 'Old name',
      }),
    ],
    skus: [sku('sku-1', 'product-1', 'MAT-001')],
  });

  const result = await service.upsertWithIdentityGuard(
    {
      tenantId: TENANT_ID,
      brandCode: 'everhot',
      model: 'RGS-A',
      sku: 'MAT-002',
      name: 'New name',
      confirmExistingProduct: true,
    },
    ACTOR
  );

  assert.equal(result.meta.operation, 'updated_existing_product');
  assert.equal(result.meta.skuOperation, 'created_sku');
  assert.equal(products.rows.length, 1);
  assert.equal(products.rows[0].id, 'product-1');
  assert.equal(products.rows[0].name, 'New name');
  assert.equal(products.rows[0].sku, 'MAT-001');
  assert.deepEqual(skus.rows.map((row) => row.skuCode).sort(), ['MAT-001', 'MAT-002']);
  assert.ok(skus.rows.every((row) => row.productId === 'product-1'));
});

test('identity guarded upsert stores one common product with multiple brand bindings', async () => {
  const { service, products, skus, brandBindings } = serviceFixture();

  const result = await service.upsertWithIdentityGuard(
    {
      tenantId: TENANT_ID,
      brandCode: 'everhot',
      brandCodes: ['everhot', 'ruud'],
      model: 'RGS-MULTI',
      sku: 'MAT-MULTI-001',
      name: 'Common RGS Multi',
    },
    ACTOR
  );

  assert.equal(result.meta.operation, 'created_product');
  assert.equal(products.rows.length, 1);
  assert.equal(skus.rows.length, 1);
  assert.deepEqual(brandBindings.rows.map((row) => row.brandCode).sort(), ['everhot', 'ruud']);
  assert.ok(brandBindings.rows.every((row) => row.productId === products.rows[0].id));
});

test('identity guarded upsert rejects SKU already bound to another product', async () => {
  const { service } = serviceFixture({
    products: [
      product('product-1', { sku: 'MAT-001', model: 'RGS-A', normalizedModel: 'rgs-a' }),
      product('product-2', { sku: 'MAT-002', model: 'RGS-B', normalizedModel: 'rgs-b' }),
    ],
    skus: [sku('sku-2', 'product-2', 'MAT-002')],
  });

  await assert.rejects(
    () =>
      service.upsertWithIdentityGuard(
        {
          tenantId: TENANT_ID,
          brandCode: 'everhot',
          model: 'RGS-A',
          sku: 'MAT-002',
          confirmExistingProduct: true,
        },
        ACTOR
      ),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      const response = error.getResponse() as any;
      assert.equal(response.code, 'SKU_ALREADY_BOUND_TO_ANOTHER_PRODUCT');
      assert.equal(response.data.existingSku.productId, 'product-2');
      assert.equal(response.data.targetProduct.id, 'product-1');
      assert.equal(response.data.boundProduct.id, 'product-2');
      return true;
    }
  );
});

function serviceFixture({
  products: initialProducts = [],
  skus: initialSkus = [],
}: {
  products?: ProductEntity[];
  skus?: ProductSkuEntity[];
} = {}) {
  const productRepo = new InMemoryRepository<ProductEntity>().seed(...initialProducts);
  const skuRepo = new InMemoryRepository<ProductSkuEntity>().seed(...initialSkus);
  const websitePricingRepo = new InMemoryRepository<ProductWebsitePricingEntity>();
  const brandBindingRepo = new InMemoryRepository<ProductBrandBindingEntity>();
  const priceRepo = new InMemoryRepository<PriceListItemEntity>();
  const contentRepo = new InMemoryRepository<ProductContentEntity>();
  const eventRepo = new InMemoryRepository<ProductContentEventEntity>();
  const auditRepo = new InMemoryRepository<AuditLogEntity>();
  const { ds } = makeFakeDataSource([
    [ProductEntity, productRepo],
    [ProductSkuEntity, skuRepo],
    [ProductWebsitePricingEntity, websitePricingRepo],
    [ProductBrandBindingEntity, brandBindingRepo],
    [PriceListItemEntity, priceRepo],
    [ProductContentEntity, contentRepo],
    [ProductContentEventEntity, eventRepo],
    [AuditLogEntity, auditRepo],
  ]);
  const eventBus = { publishInTx: async () => undefined };
  const fileArtifacts = {};
  const service = new ProductCatalogService(
    ds,
    productRepo as any,
    priceRepo as any,
    contentRepo as any,
    eventBus as any,
    fileArtifacts as any
  );
  return {
    service,
    products: productRepo,
    skus: skuRepo,
    websitePricing: websitePricingRepo,
    brandBindings: brandBindingRepo,
  };
}

function product(id: string, overrides: Partial<ProductEntity> = {}): ProductEntity {
  return {
    id,
    tenantId: TENANT_ID,
    sku: id,
    name: id,
    brand: 'everhot',
    brandCode: 'everhot',
    model: id,
    normalizedModel: id.toLowerCase(),
    workingName: id,
    category: null,
    spec: {},
    positioning: {} as any,
    assetRefs: [],
    productKey: null,
    listPrice: 0,
    costPrice: 0,
    currency: 'CNY',
    status: 'active',
    recordStatus: 'active',
    dataReadinessStatus: 'imported_draft',
    readinessCheckedAt: null,
    factsVerifiedBy: null,
    factsVerifiedAt: null,
    sourceSystem: 'test',
    sourceRecordKey: id,
    rowVersion: 1,
    lifecycleStage: 'intro',
    published: true,
    meta: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

function sku(id: string, productId: string, skuCode: string): ProductSkuEntity {
  return {
    id,
    tenantId: TENANT_ID,
    productId,
    skuCode,
    normalizedSkuCode: skuCode.toLowerCase(),
    materialCode: skuCode,
    gtin: null,
    mpn: null,
    recordStatus: 'active',
    sourceSystem: 'test',
    sourceRecordKey: skuCode,
    createdBy: null,
    updatedBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
  };
}
