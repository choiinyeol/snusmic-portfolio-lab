import { PriceEvidenceChart } from '@/components/charts/PriceEvidenceChart';
import type { PricePoint, ReportRow } from '@/lib/artifacts';
import { formatDateKo, formatPercent } from '@/lib/format';
import {
  formatAssetPrice,
  reportEntryPrice,
  targetMoveLabel,
  type PathEvidence,
  type TargetStatus,
} from '@/lib/report-view-model';

type Props = {
  report: ReportRow;
  prices: PricePoint[];
  pathEvidence: PathEvidence;
  status: TargetStatus;
};

export function PriceEvidencePanel({ report, prices, pathEvidence, status }: Props) {
  const entryPrice = reportEntryPrice(report);
  const remainingLabel = report.targetHit
    ? '목표 도달'
    : report.targetDirection === 'downside'
      ? '목표가까지 추가 하락'
      : '목표가까지 추가 상승';
  const remainingValue = report.targetHit
    ? '도달'
    : report.targetRemainingPct === null
      ? '—'
      : `+${formatPercent(report.targetRemainingPct)}`;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
        <PriceEvidenceChart
          priceSeries={prices}
          targetPrice={report.targetPriceNative}
          entryPrice={entryPrice}
          currency={report.currency}
          publicationDate={report.publicationDate}
          targetHitDate={report.targetHitDate}
          expiryDate={report.expiryDate}
          evidenceMarkers={pathEvidence.markers}
        />
      </div>
      <aside className="grid content-start gap-3">
        <MetricLine
          label="발간가"
          value={formatAssetPrice(entryPrice, report)}
          caption={`${formatDateKo(report.publicationDate)} 종가`}
        />
        <MetricLine
          label="목표가"
          value={formatAssetPrice(report.targetPriceNative, report)}
          caption={`${formatPercent(report.targetUpsideAtPub)} ${targetMoveLabel(report)}`}
        />
        <MetricLine
          label="현재가"
          value={formatAssetPrice(report.lastCloseNative, report)}
          caption={`${formatDateKo(report.lastCloseDate)} · ${formatPercent(report.currentReturn)}`}
          tone={(report.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}
        />
        <MetricLine label={remainingLabel} value={remainingValue} caption={status.label} tone={status.tone} />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">관측 범위</div>
          <dl className="mt-3 grid gap-2">
            <RangeLine label="고점" point={pathEvidence.peak} report={report} />
            <RangeLine label="저점" point={pathEvidence.trough} report={report} />
          </dl>
        </div>
      </aside>
    </div>
  );
}

function MetricLine({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: 'good' | 'bad' | 'warn' | 'accent';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold tabular-nums ${toneClass(tone)}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{caption}</div>
    </div>
  );
}

function RangeLine({ label, point, report }: { label: string; point: PricePoint | null; report: ReportRow }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-mono text-xs font-semibold tabular-nums text-slate-950">
        {point ? `${formatAssetPrice(point.value, report)} · ${formatDateKo(point.time)}` : '—'}
      </dd>
    </div>
  );
}

function toneClass(tone?: 'good' | 'bad' | 'warn' | 'accent') {
  if (tone === 'good') return 'text-emerald-600';
  if (tone === 'bad') return 'text-red-600';
  if (tone === 'warn') return 'text-amber-600';
  if (tone === 'accent') return 'text-blue-600';
  return 'text-slate-950';
}
