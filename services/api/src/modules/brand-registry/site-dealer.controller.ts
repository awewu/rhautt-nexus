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
  UseGuards,
} from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';
import { Permissions } from '../common/permissions.decorator';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { Roles } from '../common/roles.decorator';
import { SiteDealerInput, SiteDealerService } from './site-dealer.service';

interface AuthRequest {
  user: JwtPayload;
}

@Controller('brand-sites/:siteCode/dealers')
export class SiteDealerController {
  constructor(private readonly service: SiteDealerService) {}

  @Get()
  @Permissions('brand.library.read')
  list(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Query() query: Record<string, unknown>
  ) {
    return this.service.list(req.user, siteCode, query);
  }

  @Get(':dealerId')
  @Permissions('brand.library.read')
  get(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('dealerId') dealerId: string
  ) {
    return this.service.get(req.user, siteCode, dealerId);
  }

  @Post()
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.create')
  create(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Body() body: SiteDealerInput
  ) {
    return this.service.create(req.user, siteCode, body);
  }

  @Patch(':dealerId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  update(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('dealerId') dealerId: string,
    @Body() body: SiteDealerInput
  ) {
    return this.service.update(req.user, siteCode, dealerId, body);
  }

  @Delete(':dealerId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.delete')
  archive(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('dealerId') dealerId: string
  ) {
    return this.service.archive(req.user, siteCode, dealerId);
  }

  @Post(':dealerId/archive')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.delete')
  archiveByPost(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('dealerId') dealerId: string
  ) {
    return this.service.archive(req.user, siteCode, dealerId);
  }
}

@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('sites/:siteCode/dealers')
export class SiteDealerPublicController {
  constructor(private readonly service: SiteDealerService) {}

  @Get()
  list(@Param('siteCode') siteCode: string, @Query() query: Record<string, unknown>) {
    return this.service.publicList(siteCode, query);
  }
}
