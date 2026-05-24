import type { PageMetric } from '@/lib/view-models/shared';

const toneClass: Record<PageMetric['tone'], string> = {
  neutral: 'text-slate-950',
  positive: 'text-emerald-600',
  negative: 'text-rose-600',
  warning: 'text-amber-600',
  accent: 'text-blue-600',
  data: 'text-blue-600',
};

export function MetricStrip({ metrics }: { metrics: PageMetric[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="핵심 지표">
      <dl className="grid grid-cols-2 divide-x divide-y divide-slate-100 md:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
        {metrics.map((metric) => (
          <div className="grid min-w-0 gap-1 px-3 py-2.5" key={metric.id}>
            <dt className="truncate text-xs font-medium text-slate-500">{metric.label}</dt>
            <dd className={`truncate font-mono text-lg font-semibold tabular-nums ${toneClass[metric.tone]}`}>
              {metric.value}
            </dd>
            {metric.helper ? <dd className="truncate text-[11px] leading-5 text-slate-400">{metric.helper}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}
