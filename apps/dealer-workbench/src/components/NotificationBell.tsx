'use client';

/**
 * 侧栏通知铃（真数据）。
 * 前身是全站顶栏里的死按钮（无事件、无数据源）——假可供性比没有更糟。
 * 现接 GET /api/v2/notification（RLS 按用户隔离），未读数角标 + 对话框列表 + 标记已读。
 */

import { useState } from 'react';
import useSWR from 'swr';
import { Bell } from 'lucide-react';
import { useToast } from '@rhautt/ui';
import { notifications } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function NotificationBell() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const list = useSWR('notif:list', () => notifications.list(), { refreshInterval: 60000 });
  const rows: any[] = Array.isArray(list.data) ? list.data : [];
  const unread = rows.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    try {
      await notifications.markRead(id);
      list.mutate();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={unread ? `通知（${unread} 条未读）` : '通知'}
        onClick={() => setOpen(true)}
        className="relative mx-auto mb-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>站内通知</DialogTitle>
            <DialogDescription>
              {rows.length ? `${unread} 条未读 / 共 ${rows.length} 条` : '事件驱动的站内通知；没有事件就没有通知，不造样本。'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-96 gap-2 overflow-y-auto">
            {rows.length === 0 && <div className="text-sm text-muted-foreground">暂无通知。</div>}
            {rows.slice(0, 50).map((n: any) => (
              <div key={n.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{n.title}</div>
                  {!n.readAt ? (
                    <Badge>未读</Badge>
                  ) : (
                    <Badge variant="secondary">已读</Badge>
                  )}
                </div>
                {n.body && <div className="mt-1 text-xs text-muted-foreground">{n.body}</div>}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {n.createdAt ? String(n.createdAt).slice(0, 16).replace('T', ' ') : ''}
                  </span>
                  {!n.readAt && (
                    <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}>
                      标记已读
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
