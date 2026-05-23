import { KpiTile } from '@/components/ui/KpiTile';
import { metricToneToKpiTone, type PageMetric } from '@/lib/view-models/shared';

export function MetricStrip({ metrics }: { metrics: PageMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <KpiTile
          compact
          key={metric.id}
          label={metric.label}
          value={metric.value}
          meta={metric.helper}
          tone={metricToneToKpiTone(metric.tone)}
          valueClassName="text-lg"
        />
      ))}
    </div>
  );
}
