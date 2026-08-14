'use client';

/**
 * 产品目录治理面板：疑似重复 + 产品关系。
 * - 疑似重复：同 productKey（名称+品类归一）多条 → 目录污染候选，人工裁决（此处只展示不合并——
 *   合并是破坏性操作，须走目录编辑流程）。
 * - 产品关系：配件/替代/升级等关系图谱的查看与维护（D2 事实基座的边）。
 * 新代码规范：全部使用 @/components/ui/*（shadcn 层），不手写 style。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { GitBranch, CopyX } from 'lucide-react';
import { AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { productGovernance, products } from '../lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

const RELATION_TYPES = ['accessory', 'alternative', 'upgrade', 'bundle'];

export default function ProductGovernancePanel() {
  const { toast } = useToast();
  const dedupe = useSWR('pg:dedupe', () => productGovernance.dedupeCandidates());
  const catalog = useSWR('pg:devices', () => products.list({ pageSize: '100' }));
  const [productId, setProductId] = useState('');
  const relations = useSWR(productId ? ['pg:rel', productId] : null, () =>
    productGovernance.listRelations(productId)
  );
  const [form, setForm] = useState({ relationType: 'accessory', targetProductId: '' });

  const groups: any[] = dedupe.data?.data?.groups || [];
  const deviceItems: any[] = catalog.data?.data?.items || catalog.data?.items || [];
  const relRows: any[] = relations?.data?.data?.items || [];

  async function addRelation() {
    if (!productId || !form.targetProductId) return toast('先选主产品与目标产品', 'error');
    try {
      await productGovernance.upsertRelation(productId, {
        relationType: form.relationType,
        targetProductId: form.targetProductId,
      });
      toast('关系已保存', 'success');
      relations?.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function removeRelation(relId: string) {
    try {
      await productGovernance.removeRelation(relId);
      toast('关系已删除', 'success');
      relations?.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <Card className="mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch size={16} /> 产品目录治理 · 疑似重复与关系图谱
        </CardTitle>
        <CardDescription>
          重复条目污染事实基座与 GEO 结构化数据；关系（配件/替代/升级）是 D2 的边。
          此处只裁决与维护关系——合并重复是破坏性操作，须走目录编辑流程。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="dedupe">
          <TabsList>
            <TabsTrigger value="dedupe">
              <CopyX size={14} className="mr-1" />
              疑似重复 {groups.length > 0 ? <Badge variant="destructive" className="ml-1">{groups.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="relations">
              <GitBranch size={14} className="mr-1" />
              产品关系
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dedupe" className="pt-3">
            <AsyncBoundary
              status={statusOf(dedupe.isLoading, dedupe.error, groups.length === 0)}
              errorMessage="重复候选加载失败（需 API + 数据库）"
              onRetry={() => dedupe.mutate()}
              emptyTitle="无疑似重复"
              emptyDescription="按 productKey（名称+品类归一）扫描，未发现同键多条。"
            >
              <div className="grid gap-3">
                {groups.map((g: any) => (
                  <div key={g.productKey} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Badge variant="outline">{g.count} 条同键</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{g.productKey}</span>
                    </div>
                    <Table>
                      <TableBody>
                        {g.members.map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs">{m.sku || '-'}</TableCell>
                            <TableCell>{m.name}</TableCell>
                            <TableCell className="text-muted-foreground">{m.brand}</TableCell>
                            <TableCell className="text-muted-foreground">{m.category}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            </AsyncBoundary>
          </TabsContent>

          <TabsContent value="relations" className="pt-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select
                className="input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">选择主产品…</option>
                {deviceItems.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.sku ? `[${p.sku}] ` : ''}
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={form.relationType}
                onChange={(e) => setForm({ ...form, relationType: e.target.value })}
              >
                {RELATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={form.targetProductId}
                onChange={(e) => setForm({ ...form, targetProductId: e.target.value })}
              >
                <option value="">目标产品…</option>
                {deviceItems
                  .filter((p: any) => p.id !== productId)
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.sku ? `[${p.sku}] ` : ''}
                      {p.name}
                    </option>
                  ))}
              </select>
              <Button onClick={addRelation} disabled={!productId || !form.targetProductId}>
                添加关系
              </Button>
            </div>
            {!productId ? (
              <div className="text-sm text-muted-foreground">选择主产品后显示其关系。</div>
            ) : (
              <AsyncBoundary
                status={statusOf(!!relations?.isLoading, relations?.error, relRows.length === 0)}
                errorMessage="关系加载失败（需 API + 数据库）"
                onRetry={() => relations?.mutate()}
                emptyTitle="该产品暂无关系"
                emptyDescription="添加配件/替代/升级等关系，喂给推荐与 GEO 结构化数据。"
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>类型</TableHead>
                      <TableHead>目标产品</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relRows.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant="secondary">{r.relationType}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.targetProductId || r.targetSku || '-'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeRelation(r.id)}>
                            删除
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AsyncBoundary>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
