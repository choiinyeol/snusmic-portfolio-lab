import type { ReportRow } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import { formatAssetPrice, type TrendSnapshot } from '@/lib/report-view-model';

type Props = {
  report: ReportRow;
  trend: TrendSnapshot;
};

export function TrendSignalCard({ report, trend }: Props) {
  return (
    <article className="dossier-card trend-signal-card">
      <span className="dossier-card__label">Trend following</span>
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
    </article>
  );
}
