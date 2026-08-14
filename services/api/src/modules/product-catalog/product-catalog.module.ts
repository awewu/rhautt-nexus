import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProductEntity,
  ProductSkuEntity,
  ProductWebsitePricingEntity,
  ProductBrandBindingEntity,
  PriceListItemEntity,
  ProductContentEntity,
  ProductContentEventEntity,
  ProductRelationEntity,
  BrandPublishGrantEntity,
} from './product-catalog.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BrandProductCategoryEntity } from '../brand-product-category/brand-product-category.entity';
import { ProductCatalogController } from './product-catalog.controller';
import { BrandPublicController } from './product-catalog.public.controller';
import { ProductCatalogService } from './product-catalog.service';
import { ProductMgmtService } from './product-mgmt.service';
import {
  ProductLaunchEntity,
  ProductSellingPointEntity,
  PricingPolicyEntity,
  ProductFocusDeclarationEntity,
} from './product-mgmt.entity';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';
import { FileArtifactModule } from '../file-artifact/file-artifact.module';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE
      ? []
      : [
          TypeOrmModule.forFeature([
            ProductEntity,
            ProductSkuEntity,
            ProductWebsitePricingEntity,
            ProductBrandBindingEntity,
            PriceListItemEntity,
            ProductContentEntity,
            ProductContentEventEntity,
            ProductRelationEntity,
            BrandProductCategoryEntity,
            BrandPublishGrantEntity,
            ProductLaunchEntity,
            ProductSellingPointEntity,
            PricingPolicyEntity,
            ProductFocusDeclarationEntity,
          ]),
        ]),
    AuthModule,
    FileArtifactModule,
  ],
  controllers: [ProductCatalogController, BrandPublicController],
  providers: [
    ProductCatalogService,
    ProductMgmtService,
    PublicRateLimitGuard,
    ...(TARGET_API_BOOT_SMOKE
      ? [
          bootSmokeRepositoryProvider(ProductEntity),
          bootSmokeRepositoryProvider(ProductSkuEntity),
          bootSmokeRepositoryProvider(ProductWebsitePricingEntity),
          bootSmokeRepositoryProvider(ProductBrandBindingEntity),
          bootSmokeRepositoryProvider(PriceListItemEntity),
          bootSmokeRepositoryProvider(ProductContentEntity),
          bootSmokeRepositoryProvider(ProductContentEventEntity),
          bootSmokeRepositoryProvider(ProductRelationEntity),
          bootSmokeRepositoryProvider(BrandProductCategoryEntity),
          bootSmokeRepositoryProvider(BrandPublishGrantEntity),
          bootSmokeRepositoryProvider(ProductLaunchEntity),
          bootSmokeRepositoryProvider(ProductSellingPointEntity),
          bootSmokeRepositoryProvider(PricingPolicyEntity),
          bootSmokeRepositoryProvider(ProductFocusDeclarationEntity),
        ]
      : []),
  ],
  exports: [ProductCatalogService, ProductMgmtService], // 供消费方模块（问诊 recommend / CMO 舱产品组合）注入
})
export class ProductCatalogModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class ProductCatalogBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('product-catalog');
    return {
      tenantScope: spec.requiresTenantScope,
      auditLog: spec.requiresAuditLog,
      openApiContract: spec.requiresOpenApiContract,
    };
  }
}
@Controller('product-catalog')
export class ProductCatalogBoundaryController {
  constructor(private readonly s: ProductCatalogBoundaryService) {}
  @Get('boundary') boundary() {
    return this.s.boundary();
  }
}
