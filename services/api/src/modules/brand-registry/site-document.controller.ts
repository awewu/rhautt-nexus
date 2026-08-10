import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';
import { Permissions } from '../common/permissions.decorator';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { Roles } from '../common/roles.decorator';
import {
  SiteDocumentCategoryInput,
  SiteDocumentInput,
  SiteDocumentService,
} from './site-document.service';

interface AuthRequest {
  user: JwtPayload;
}

@Controller('brand-sites/:siteCode')
export class SiteDocumentController {
  constructor(private readonly service: SiteDocumentService) {}

  @Get('document-categories')
  @Permissions('site.documentation.read')
  listCategories(@Req() req: AuthRequest, @Param('siteCode') siteCode: string) {
    return this.service.listCategories(req.user, siteCode);
  }

  @Post('document-categories')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('site.documentation.create')
  createCategory(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Body() body: SiteDocumentCategoryInput
  ) {
    return this.service.createCategory(req.user, siteCode, body);
  }

  @Patch('document-categories/:categoryId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('site.documentation.update')
  updateCategory(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('categoryId') categoryId: string,
    @Body() body: SiteDocumentCategoryInput
  ) {
    return this.service.updateCategory(req.user, siteCode, categoryId, body);
  }

  @Delete('document-categories/:categoryId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('site.documentation.delete')
  deleteCategory(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('categoryId') categoryId: string
  ) {
    return this.service.deleteCategory(req.user, siteCode, categoryId);
  }

  @Get('documents')
  @Permissions('site.documentation.read')
  listDocuments(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Query() query: Record<string, unknown>
  ) {
    return this.service.listDocuments(req.user, siteCode, query);
  }

  @Post('documents')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('site.documentation.create')
  createDocument(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Body() body: SiteDocumentInput
  ) {
    return this.service.createDocument(req.user, siteCode, body);
  }

  @Patch('documents/:documentId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('site.documentation.update')
  updateDocument(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('documentId') documentId: string,
    @Body() body: SiteDocumentInput
  ) {
    return this.service.updateDocument(req.user, siteCode, documentId, body);
  }

  @Post('documents/:documentId/publish')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('site.documentation.publish')
  publishDocument(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('documentId') documentId: string
  ) {
    return this.service.setDocumentStatus(req.user, siteCode, documentId, 'published');
  }

  @Post('documents/:documentId/hide')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('site.documentation.update')
  hideDocument(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('documentId') documentId: string
  ) {
    return this.service.setDocumentStatus(req.user, siteCode, documentId, 'hidden');
  }

  @Delete('documents/:documentId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('site.documentation.delete')
  archiveDocument(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('documentId') documentId: string
  ) {
    return this.service.archiveDocument(req.user, siteCode, documentId);
  }
}

@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('sites/:siteCode/documents')
export class SiteDocumentPublicController {
  constructor(private readonly service: SiteDocumentService) {}

  @Get()
  list(@Param('siteCode') siteCode: string, @Query() query: Record<string, unknown>) {
    return this.service.publicList(siteCode, query);
  }

  @Get(':documentId/download')
  async download(@Param('siteCode') siteCode: string, @Param('documentId') documentId: string) {
    const artifact = await this.service.publicDownload(siteCode, documentId);
    const filename = artifact.row.originalName || documentId;
    return new StreamableFile(artifact.stream, {
      type: artifact.row.mimeType || 'application/octet-stream',
      disposition: `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
  }
}
