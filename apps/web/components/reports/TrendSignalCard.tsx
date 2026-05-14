import type { ReportRow } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import { formatAssetPrice, type TrendSnapshot } from '@/lib/report-view-model';

type Props = {
  report: ReportRow;
  trend: TrendSnapshot;
};

export function TrendSignalCard({ report, trend }: Props) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Trend</div>
      <div className={`mt-3 rounded-lg border p-4 ${verdictClass(trend.tone)}`}>
        <strong className="block text-base font-semibold tracking-tight text-slate-950">{trend.verdict}</strong>
        <p className="mt-1 text-sm leading-6 text-slate-600">{trend.detail}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {trend.movingAverages.map((ma) => (
          <div key={ma.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <span className="text-xs font-medium text-slate-500">{ma.label}</span>
            <strong className="mt-1 block truncate font-mono text-sm font-semibold tabular-nums text-slate-950">
              {formatAssetPrice(ma.value, report)}
            </strong>
            <em className={`not-italic text-xs tabular-nums ${signedClass(ma.distance)}`}>
              {formatPercent(ma.distance)}
            </em>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid gap-2 text-sm">
        {trend.metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
            <dt className="text-slate-500">{metric.label}</dt>
            <dd className={`font-mono font-semibold tabular-nums ${metricTextClass(metric.tone)}`}>{metric.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function verdictClass(tone: TrendSnapshot['tone']): string {
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50';
  if (tone === 'bad') return 'border-red-200 bg-red-50';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50';
  return 'border-blue-200 bg-blue-50';
}

function metricTextClass(tone: TrendSnapshot['metrics'][number]['tone']): string {
  if (tone === 'good') return 'text-emerald-600';
  if (tone === 'bad') return 'text-red-600';
  if (tone === 'warn') return 'text-amber-600';
  if (tone === 'accent') return 'text-blue-600';
  return 'text-slate-950';
}

function signedClass(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'text-slate-400';
  return value >= 0 ? 'text-emerald-600' : 'text-red-600';
}
