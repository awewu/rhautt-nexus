import { Library } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import GrowthPromptLibrary from '../../../components/GrowthPromptLibrary';

export default function GrowthPromptsPage() {
  return (
    <div
      style={{
        background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)',
        minHeight: '100%',
      }}
    >
      <div className="page-container" style={{ display: 'grid', gap: 20 }}>
        <PageHeader
          title="提示词库"
          subtitle="沉淀高质量提示词，并用真实 GEO 实验反馈持续排序"
          actions={
            <span className="badge badge-success">
              <Library size={13} />
              GEO 反馈已接通
            </span>
          }
        />
        <GrowthPromptLibrary />
      </div>
    </div>
  );
}
