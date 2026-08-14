'use client';

/**
 * 设计系统基准页（shadcn/ui + Tailwind v4 · 暖色主题映射验收物）。
 * 用途：① 新组件层的视觉/交互基准，改主题先看这页；② 迁移对照——旧页面重构时
 * 以此为组件词汇表。非业务页面，不进导航。
 */

import { useState } from 'react';
import { PageHeader } from '@rhautt/ui';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const SAMPLE_ROWS = [
  { sku: 'AP-500', name: 'Rheem AP-500 空气源热泵', quoted: 128, signed: 41, amount: 1024000 },
  { sku: 'EH-200', name: 'Everhot EH-200 电热水器', quoted: 96, signed: 28, amount: 384000 },
  { sku: 'RB-300', name: 'Ruud RB-300 壁挂炉', quoted: 54, signed: 9, amount: 216000 },
];

export default function DesignBaselinePage() {
  const [count, setCount] = useState(0);
  return (
    <div className="page-container">
      <PageHeader
        title="设计系统基准"
        subtitle="shadcn/ui + Tailwind v4 · 暖色主题映射 · 组件词汇表（非业务页）"
      />

      <div className="grid gap-5">
        {/* 按钮与徽章 */}
        <Card>
          <CardHeader>
            <CardTitle>按钮 · 徽章 · 输入</CardTitle>
            <CardDescription>
              所有微状态（hover/focus/disabled）由组件层统一雕琢，页面不再手写。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setCount((c) => c + 1)}>主操作 {count > 0 ? count : ''}</Button>
            <Button variant="secondary">次操作</Button>
            <Button variant="outline">描边</Button>
            <Button variant="ghost">幽灵</Button>
            <Button variant="destructive">危险</Button>
            <Button disabled>禁用</Button>
            <Separator orientation="vertical" className="h-6" />
            <Badge>默认</Badge>
            <Badge variant="secondary">次级</Badge>
            <Badge variant="outline">描边</Badge>
            <Badge variant="destructive">告警</Badge>
            <Separator orientation="vertical" className="h-6" />
            <Input placeholder="输入框（焦点环用品牌色）" className="max-w-56" />
          </CardContent>
        </Card>

        {/* 数据表：tabular numerics 是工程级质感的关键细节 */}
        <Card>
          <CardHeader>
            <CardTitle>数据表 · 等宽数字</CardTitle>
            <CardDescription>
              金额与计数使用 tabular-nums——数字列对齐是数据产品「专业感」的最小代价来源。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>产品</TableHead>
                  <TableHead className="text-right">报价</TableHead>
                  <TableHead className="text-right">成交</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_ROWS.map((r) => (
                  <TableRow key={r.sku}>
                    <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.quoted}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.signed}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ¥{r.amount.toLocaleString('zh-CN')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 标签页与对话框 */}
        <Card>
          <CardHeader>
            <CardTitle>标签页 · 对话框</CardTitle>
            <CardDescription>键盘导航与 ARIA 由 Radix primitives 保证，不再自research。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Tabs defaultValue="a">
              <TabsList>
                <TabsTrigger value="a">概览</TabsTrigger>
                <TabsTrigger value="b">明细</TabsTrigger>
                <TabsTrigger value="c">审计</TabsTrigger>
              </TabsList>
              <TabsContent value="a" className="text-sm text-muted-foreground pt-2">
                标签切换 150ms 过渡；焦点态可用 Tab 键验证。
              </TabsContent>
              <TabsContent value="b" className="text-sm text-muted-foreground pt-2">
                明细内容。
              </TabsContent>
              <TabsContent value="c" className="text-sm text-muted-foreground pt-2">
                审计内容。
              </TabsContent>
            </Tabs>
            <div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">打开对话框</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>确认操作</DialogTitle>
                    <DialogDescription>
                      Esc 关闭 / 焦点圈定在框内 / 遮罩点击关闭——全部来自 Radix，零自研成本。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost">取消</Button>
                    <Button>确认</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
