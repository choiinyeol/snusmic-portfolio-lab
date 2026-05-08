import type { ReportRow } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import { formatAssetPrice, type TrendSnapshot } from '@/lib/report-view-model';

type Props = {
  report: ReportRow;
  trend: TrendSnapshot;
};

export function TrendSignalCard({ report, trend }: Props) {
  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-4 p-5">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/55">Trend following</span>
        <div className={`trend-verdict tone-${trend.tone}`}>
          <strong>{trend.verdict}</strong>
          <p>{trend.detail}</p>
        </div>
        <div className="trend-ma-grid">
          {trend.movingAverages.map((ma) => (
            <div key={ma.label} className="trend-ma">
              <span>{ma.label}</span>
              <strong>{formatAssetPrice(ma.value, report)}</strong>
              <em className={(ma.distance ?? 0) >= 0 ? 'good' : 'bad'}>{formatPercent(ma.distance)}</em>
            </div>
          ))}
        </div>
        <dl className="trend-metric-list">
          {trend.metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd className={metric.tone ? metric.tone === 'good' ? 'good' : metric.tone === 'bad' ? 'bad' : 'warn' : ''}>{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}
