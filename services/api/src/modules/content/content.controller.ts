import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { ContentService } from './content.service';

@Controller('content')
@UseGuards(AuthGuard)
export class ContentController {
  constructor(private readonly svc: ContentService) {}

  @Post() create(@Req() r: any, @Body() b: any) { return this.svc.create(r.user, b); }
  @Get() list(@Req() r: any, @Query() q: any) { return this.svc.list(r.user, q); }
  @Get('production-context') productionContext(@Req() r: any, @Query() q: any) { return this.svc.productionContext(r.user, q); }
  @Get('fact-sources') factSources(@Req() r: any, @Query() q: any) { return this.svc.listFactSources(r.user, q); }
  @Patch(':id') update(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.update(r.user, id, b); }
  @Post(':id/fact-refs') bindFactRefs(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.bindFactRefs(r.user, id, Array.isArray(b?.factRefs) ? b.factRefs : []); }
  @Post(':id/submit') submit(@Req() r: any, @Param('id') id: string) { return this.svc.submitReview(r.user, id); }
  @Post(':id/decision') decide(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.decide(r.user, id, b?.decision, b); }
  @Get('publish-tasks') publishTasks(@Req() r: any, @Query() q: any) { return this.svc.listPublishTasks(r.user, q); }
  @Post(':id/publish-tasks') createPublishTask(@Req() r: any, @Param('id') id: string, @Body() b: any) { return this.svc.createPublishTask(r.user, id, b); }
  @Post('publish-tasks/:taskId/evidence') completePublishTask(@Req() r: any, @Param('taskId') taskId: string, @Body() b: any) { return this.svc.completePublishTask(r.user, taskId, b); }
  @Post(':id/publish') publish(@Req() r: any, @Param('id') id: string) { return this.svc.publish(r.user, id); }
}
