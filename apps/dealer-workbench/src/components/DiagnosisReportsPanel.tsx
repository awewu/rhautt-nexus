'use client';

/**
 * 问诊报告面板（只读）。
 * 问诊由瑞诺瓦消费端产生（AARRR"到访"环节的证据链）；此前报告只能查库。
 * 此处不做问诊管理——终端用户运营属瑞诺瓦域，这里只让总部/经销商看得见报告内容。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Stethoscope } from 'lucide-react';
import { AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
import { diagnosisReports } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

export function DiagnosisReportsPanel() {
  const list = useSWR('diag:reports', () => diagnosisReports.list());
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useSWR(openId ? ['diag:report', openId] : null, () => diagnosisReports.get(openId!));

  const rows: any[] = list.data?.data?.items || [];
  const rep: any = detail?.data?.data || null;

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope size={16} /> 问诊报告（只读 · AARRR「到访」证据链）
        </CardTitle>
        <CardDescription>
          报告由瑞诺瓦消费端问诊产生并自动喂 CDP/派单；此处只查看，不做终端用户管理（属瑞诺瓦域）。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncBoundary
          status={statusOf(list.isLoading, list.error, rows.length === 0)}
          errorMessage="问诊报告加载失败（需 API + 数据库）"
          onRetry={() => list.mutate()}
          emptyTitle="暂无问诊报告"
          emptyDescription="报告由真实终端用户问诊产生——没有问诊就没有报告，不造样本。"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>痛点</TableHead>
                <TableHead>系统</TableHead>
                <TableHead>推荐档位</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="tabular-nums text-xs">
                    {s.createdAt ? String(s.createdAt).slice(0, 16).replace('T', ' ') : '-'}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-sm">
                    {(s.pain_points || []).join('、') || '-'}
                  </TableCell>
                  <TableCell className="text-sm">{(s.systems || []).join('、') || '-'}</TableCell>
                  <TableCell>
                    {s.recommendedTier ? <Badge variant="secondary">{s.recommendedTier}</Badge> : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'outline' : 'secondary'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {s.reportId ? (
                      <Button variant="ghost" size="sm" onClick={() => setOpenId(s.reportId)}>
                        查看
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AsyncBoundary>

        <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>问诊报告</DialogTitle>
              <DialogDescription className="font-mono text-xs">{openId}</DialogDescription>
            </DialogHeader>
            {detail?.isLoading ? (
              <div className="text-sm text-muted-foreground">加载中…</div>
            ) : rep ? (
              <div className="grid gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">痛点：</span>
                  {(rep.diagnosis?.painPoints || rep.painPoints || []).join('、') || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">系统：</span>
                  {(rep.diagnosis?.systemLabels || rep.diagnosis?.systems || []).join('、') || '-'}
                </div>
                <div>
                  <span className="text-muted-foreground">推荐产品：</span>
                  {(rep.recommendedProducts || []).map((p: any) => p.name || p.sku).join('、') || '-'}
                </div>
                {rep.pricing === null && (
                  <div className="text-xs text-muted-foreground">
                    价格为空是刻意的——价格由报价域生成，问诊不臆造。
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">报告不可用。</div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
