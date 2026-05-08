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
  return (
    <div className="report-evidence-grid">
      <div className="panel report-chart-panel card border border-base-300 bg-base-100 shadow-sm">
        <PriceEvidenceChart
          priceSeries={prices}
          targetPrice={report.targetPriceNative}
          currency={report.currency}
          publicationDate={report.publicationDate}
          targetHitDate={report.targetHitDate}
          evidenceMarkers={pathEvidence.markers}
        />
      </div>
      <aside className="report-side-rail" aria-label="리포트 핵심 가격 지표">
        <KpiTile
          label="발간일 진입 종가"
          value={<span className="display-num">{formatAssetPrice(reportEntryPrice(report), report)}</span>}
          caption={`${report.publicationDate} 기준`}
        />
        <KpiTile
          label="추출 목표가"
          value={<span className="display-num">{formatAssetPrice(report.targetPriceNative, report)}</span>}
          delta={`${formatPercent(report.targetUpsideAtPub)} ${targetMoveLabel(report)}`}
          tone="accent"
        />
        <KpiTile
          label="현재 수익률"
          value={<span className="display-num">{formatPercent(report.currentReturn)}</span>}
          delta={`최근 종가 ${formatAssetPrice(report.lastCloseNative, report)}`}
          tone={(report.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}
        />
        <KpiTile label="목표 상태" value={status.label} delta={status.detail} tone={status.tone} />
        <article className="dossier-card report-rail-card card border border-base-300 bg-base-100 shadow-sm">
          <span className="dossier-card__label">Path range</span>
          <dl className="definition-list">
            <dt>관측 고점</dt>
            <dd>{pathEvidence.peak ? `${formatAssetPrice(pathEvidence.peak.value, report)} (${pathEvidence.peak.time})` : '—'}</dd>
            <dt>관측 저점</dt>
            <dd>{pathEvidence.trough ? `${formatAssetPrice(pathEvidence.trough.value, report)} (${pathEvidence.trough.time})` : '—'}</dd>
            <dt>최근 종가</dt>
            <dd>{formatAssetPrice(report.lastCloseNative, report)}</dd>
            <dt>최근 종가일</dt>
            <dd>{report.lastCloseDate ?? '—'}</dd>
          </dl>
        </article>
      </aside>
    </div>
  );
}
