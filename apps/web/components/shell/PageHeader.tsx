import type { ReactNode } from 'react';
import { PageHeader as LedgerPageHeader } from '@/components/ui/PageHeader';
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
  return <LedgerPageHeader actions={actions} header={header} metrics={metrics} />;
}
