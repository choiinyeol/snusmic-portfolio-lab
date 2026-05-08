import { PriceEvidenceChart } from '@/components/charts/PriceEvidenceChart';
import { KpiTile } from '@/components/ui/KpiTile';
import type { PricePoint, ReportRow } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
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
  const remainingTone: 'good' | 'bad' | 'warn' | 'accent' = report.targetHit
    ? 'good'
    : report.expired
      ? 'bad'
      : report.targetRemainingPct === null
        ? 'accent'
        : 'warn';
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
  const progressLabel = report.targetProgressPct === null ? null : `달성률 ${formatPercent(report.targetProgressPct)}`;

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="card border border-base-300 bg-base-100 shadow-sm lg:col-span-3">
        <div className="card-body p-3 md:p-4">
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
      </div>
      <aside className="grid gap-3 lg:col-span-2" aria-label="리포트 핵심 가격 지표">
        <KpiTile
          label="발간가"
          value={<span className="tabular-nums">{formatAssetPrice(entryPrice, report)}</span>}
          caption={`${report.publicationDate} 종가 기준`}
        />
        <KpiTile
          label="목표가"
          value={<span className="tabular-nums">{formatAssetPrice(report.targetPriceNative, report)}</span>}
          delta={`${formatPercent(report.targetUpsideAtPub)} ${targetMoveLabel(report)}`}
          tone="accent"
        />
        <KpiTile
          label="현재가"
          value={<span className="tabular-nums">{formatAssetPrice(report.lastCloseNative, report)}</span>}
          delta={
            report.lastCloseDate
              ? `${report.lastCloseDate} · ${formatPercent(report.currentReturn)}`
              : formatPercent(report.currentReturn)
          }
          tone={(report.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}
        />
        <KpiTile
          label={remainingLabel}
          value={<span className="tabular-nums">{remainingValue}</span>}
          delta={progressLabel ?? status.label}
          tone={remainingTone}
        />
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-2 p-4">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/50">Path range</span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-base-content/60">관측 고점</dt>
              <dd className="text-right tabular-nums text-base-content">
                {pathEvidence.peak
                  ? `${formatAssetPrice(pathEvidence.peak.value, report)} · ${pathEvidence.peak.time}`
                  : '—'}
              </dd>
              <dt className="text-base-content/60">관측 저점</dt>
              <dd className="text-right tabular-nums text-base-content">
                {pathEvidence.trough
                  ? `${formatAssetPrice(pathEvidence.trough.value, report)} · ${pathEvidence.trough.time}`
                  : '—'}
              </dd>
            </dl>
          </div>
        </article>
      </aside>
    </div>
  );
}
