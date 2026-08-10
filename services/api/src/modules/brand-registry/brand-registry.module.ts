import { Module } from '@nestjs/common';
import { BrandRegistryController } from './brand-registry.controller';
import { BrandRegistryService } from './brand-registry.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BrandSiteBasicSettingsEntity,
  BrandSiteEntity,
  SiteDocumentCategoryEntity,
  SiteDocumentEntity,
  SiteDealerEntity,
  SiteInquiryEntity,
  SiteNewsArticleEntity,
  SiteProductAssignmentEntity,
} from './brand-site.entity';
import { BrandSiteController } from './brand-site.controller';
import { BrandSiteService } from './brand-site.service';
import { BrandSitePublishService } from './brand-site-publish.service';
import { FileArtifactModule } from '../file-artifact/file-artifact.module';
import { AuditLogEntity } from '../governance/governance.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import {
  SiteProductAssignmentController, SiteProductPublicController,
} from './site-product-assignment.controller';
import { SiteProductAssignmentService } from './site-product-assignment.service';
import { SiteNewsController, SiteNewsPublicController } from './site-news.controller';
import { SiteNewsService } from './site-news.service';
import { SiteInquiryController, SiteInquiryPublicController } from './site-inquiry.controller';
import { SiteInquiryService } from './site-inquiry.service';
import {
  BrandSiteBasicSettingsController,
  BrandSiteBasicSettingsPublicController,
} from './brand-site-basic-settings.controller';
import { BrandSiteBasicSettingsService } from './brand-site-basic-settings.service';
import { SiteDocumentController, SiteDocumentPublicController } from './site-document.controller';
import { SiteDocumentService } from './site-document.service';
import { SiteDealerController, SiteDealerPublicController } from './site-dealer.controller';
import { SiteDealerService } from './site-dealer.service';

/**
 * 品牌注册表模块（配置驱动的品牌基础要素 API）。
 * 与既有 `brand` 模块区分：`brand` = Rheem 官网内容抓取器；本模块 = 品牌注册表读取。
 */
@Module({
  imports: [
    FileArtifactModule,
    ProductCatalogModule,
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([
      BrandSiteEntity,
      BrandSiteBasicSettingsEntity,
      SiteProductAssignmentEntity,
      SiteNewsArticleEntity,
      SiteDocumentCategoryEntity,
      SiteDocumentEntity,
      SiteDealerEntity,
      SiteInquiryEntity,
      AuditLogEntity,
    ])]),
  ],
  controllers: [
    BrandRegistryController, BrandSiteController, SiteProductAssignmentController, SiteProductPublicController,
    SiteNewsController, SiteNewsPublicController, BrandSiteBasicSettingsController,
    BrandSiteBasicSettingsPublicController, SiteInquiryController, SiteInquiryPublicController,
    SiteDocumentController, SiteDocumentPublicController,
    SiteDealerController, SiteDealerPublicController,
  ],
  providers: [
    BrandRegistryService,
    BrandSiteService,
    BrandSitePublishService,
    BrandSiteBasicSettingsService,
    SiteProductAssignmentService,
    SiteNewsService,
    SiteDocumentService,
    SiteDealerService,
    SiteInquiryService,
    PublicRateLimitGuard,
    ...(TARGET_API_BOOT_SMOKE ? [
      bootSmokeRepositoryProvider(BrandSiteEntity),
      bootSmokeRepositoryProvider(BrandSiteBasicSettingsEntity),
      bootSmokeRepositoryProvider(SiteProductAssignmentEntity),
      bootSmokeRepositoryProvider(SiteNewsArticleEntity),
      bootSmokeRepositoryProvider(SiteDocumentCategoryEntity),
      bootSmokeRepositoryProvider(SiteDocumentEntity),
      bootSmokeRepositoryProvider(SiteDealerEntity),
      bootSmokeRepositoryProvider(SiteInquiryEntity),
      bootSmokeRepositoryProvider(AuditLogEntity),
    ] : []),
  ],
  exports: [BrandRegistryService],
})
export class BrandRegistryModule {}
