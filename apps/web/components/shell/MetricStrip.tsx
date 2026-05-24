import { MetricStrip as LedgerMetricStrip } from '@/components/ui/MetricStrip';
import type { PageMetric } from '@/lib/view-models/shared';

export function MetricStrip({ metrics }: { metrics: PageMetric[] }) {
  return <LedgerMetricStrip metrics={metrics} />;
}
