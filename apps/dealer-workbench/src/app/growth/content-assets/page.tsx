import { FolderOpen } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import GrowthContentAssetsTable from '../../../components/GrowthContentAssetsTable';

export default function GrowthContentAssetsPage() {
  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container growth-copywriter-page" style={{ display: 'grid', gap: 20 }}>
        <PageHeader
          title="素材库管理"
          subtitle="文案、公众号审核和发布所用数字素材的新增、编辑、归档与复用"
          actions={
            <span className="badge badge-info">
              <FolderOpen size={13} />
              内容工厂
            </span>
          }
        />
        <GrowthContentAssetsTable />
      </div>
    </div>
  );
}
