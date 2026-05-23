import type { ReactNode } from 'react';
import { PageHero } from '@/components/ui/PageHero';
import type { PageHeaderModel } from '@/lib/view-models/shared';

export function PageHeader({
  header,
  actions,
  metrics,
}: {
  header: PageHeaderModel;
  actions?: ReactNode;
  metrics?: ReactNode;
}) {
  return (
    <PageHero
      actions={actions}
      badges={header.badges}
      eyebrow={header.eyebrow}
      kpis={metrics}
      subtitle={header.description}
      title={header.title}
    />
  );
}
