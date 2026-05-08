import type { ReportRow } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import { formatAssetPrice, type TrendSnapshot } from '@/lib/report-view-model';

type Props = {
  report: ReportRow;
  trend: TrendSnapshot;
};

const verdictTone: Record<string, string> = {
  good: 'border-success/30 bg-success/5',
  bad: 'border-error/30 bg-error/5',
  warn: 'border-warning/30 bg-warning/5',
  neutral: 'border-base-300 bg-base-200/40',
};

const metricTone: Record<string, string> = {
  good: 'text-success',
  bad: 'text-error',
  warn: 'text-warning',
};

export function TrendSignalCard({ report, trend }: Props) {
  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4 p-5">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/55">Trend following</span>
        <div className={`rounded-md border p-4 ${verdictTone[trend.tone] ?? verdictTone.neutral}`}>
          <strong className="block text-base font-bold tracking-tight">{trend.verdict}</strong>
          <p className="mt-1 text-sm leading-relaxed text-base-content/75">{trend.detail}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {trend.movingAverages.map((ma) => (
            <div key={ma.label} className="grid gap-0.5 rounded-md border border-base-200 bg-base-100 px-3 py-2.5">
              <span className="text-xs uppercase tracking-[0.14em] text-base-content/55">{ma.label}</span>
              <strong className="tabular-nums text-base-content">{formatAssetPrice(ma.value, report)}</strong>
              <em
                className={`not-italic text-xs tabular-nums ${(ma.distance ?? 0) >= 0 ? 'text-success' : 'text-error'}`}
              >
                {formatPercent(ma.distance)}
              </em>
            </div>
          ))}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          {trend.metrics.map((metric) => (
            <div key={metric.label} className="contents">
              <dt className="text-base-content/60">{metric.label}</dt>
              <dd
                className={`text-right tabular-nums font-semibold ${metric.tone ? (metricTone[metric.tone] ?? '') : 'text-base-content'}`}
              >
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
