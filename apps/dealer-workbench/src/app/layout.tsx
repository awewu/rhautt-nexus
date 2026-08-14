import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@rhautt/ui';
import DealerNav from '../components/DealerNav';

export const metadata: Metadata = { title: '瑞诺瓦 AI 舒适家' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body>
        <ToastProvider>
          {/* 2026-08 决策：删除全站面包屑 topbar——与侧栏高亮/二级 tab 行/PageHeader 三重重复；
              通知铃移入侧栏并接真数据（原铃铛是无事件的死按钮）。 */}
          <div className="layout">
            <DealerNav />
            <main className="content">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
