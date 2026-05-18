import Link from 'next/link';
import { PriceEvidenceChart } from '@/components/charts/PriceEvidenceChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPriceSeries, getReportStatisticsLabSummary, type ReportRow } from '@/lib/artifacts';
import { formatDateKo, formatDays, formatPercent } from '@/lib/format';
import {
  buildPathEvidence,
  buildScenarioRows,
  formatAssetPrice,
  reportEntryPrice,
  targetMoveLabel,
  targetStatus,
  type ScenarioRow,
} from '@/lib/report-view-model';

export function ReportDetailView({ report }: { report: ReportRow }) {
  // End-cap at lastCloseDate so expired reports stop at expiry, not today.
  const prices = getPriceSeries(report.symbol, undefined, report.lastCloseDate);
  const pathEvidence = buildPathEvidence(prices, report);
  const scenarioRows = buildScenarioRows(prices, report);
  const status = targetStatus(report);
  const reportStatistics = getReportStatisticsLabSummary();
  const reportOutcome = reportStatistics.riskScatter.find((row) => row.reportId === report.reportId) ?? null;
  const markdownHref = githubBlobUrl(`data/markdown/${report.markdownFilename}`);
  const pdfHref = pdfHrefFor(report);

  const entryPrice = reportEntryPrice(report);
  const targetReturn = reportOutcome?.targetReturn ?? report.targetUpsideAtPub;
  const currentReturn = reportOutcome?.currentReturn ?? report.currentReturn;
  const peakReturn = reportOutcome?.maxFavorableExcursion ?? report.peakReturn;
  const troughReturn = reportOutcome?.maxAdverseExcursion ?? report.troughReturn;
  const captureRatio = reportOutcome?.upsideCaptureRatio ?? captureFromReport(report);
  const stage = stageLabel(reportOutcome, report);

  return (
    <div className="grid gap-5">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{report.symbol}</Badge>
          <Badge variant={badgeVariant(status.tone)}>{status.label}</Badge>
          {report.exchange ? <Badge variant="secondary">{report.exchange}</Badge> : null}
          <Badge variant="secondary">{report.currency}</Badge>
          <span className="font-mono text-xs text-slate-500">{formatDateKo(report.publicationDate)} 발간</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950 md:text-3xl">{report.company}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/reports">목록</Link>
          </Button>
          {pdfHref ? (
            <Button asChild size="sm" variant="outline">
              <a href={pdfHref}>PDF</a>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href={markdownHref}>Markdown</a>
          </Button>
        </div>
      </header>

      <FactsTable
        rows={[
          { label: '발간일', value: formatDateKo(report.publicationDate) },
          { label: '만료일', value: formatDateKo(report.expiryDate) },
          { label: '최근 가격일', value: formatDateKo(report.lastCloseDate) },
          { label: '발간가', value: formatAssetPrice(entryPrice, report) },
          {
            label: '목표가',
            value: formatAssetPrice(report.targetPriceNative, report),
            caption: targetMoveLabel(report),
          },
          { label: '현재가', value: formatAssetPrice(report.lastCloseNative, report) },
          { label: '제시 상승여력', value: formatPercent(targetReturn) },
          { label: '현재 수익률', value: formatPercent(currentReturn), tone: signedTone(currentReturn) },
          { label: '최고 수익률', value: formatPercent(peakReturn), tone: 'good' },
          { label: '최저 수익률', value: formatPercent(troughReturn), tone: 'bad' },
          { label: '목표 도달 단계', value: stage },
          {
            label: '도달 정보',
            value: report.targetHit
              ? `${formatDateKo(report.targetHitDate)} · ${formatDays(report.daysToTarget)}`
              : '미달성',
          },
          { label: '목표 포착률', value: formatCapture(captureRatio), caption: '최고 ÷ 목표' },
          {
            label: '발간 후 고점',
            value: pathEvidence.peak ? formatAssetPrice(pathEvidence.peak.value, report) : '—',
            caption: pathEvidence.peak ? formatDateKo(pathEvidence.peak.time) : undefined,
          },
          {
            label: '발간 후 저점',
            value: pathEvidence.trough ? formatAssetPrice(pathEvidence.trough.value, report) : '—',
            caption: pathEvidence.trough ? formatDateKo(pathEvidence.trough.time) : undefined,
          },
        ]}
      />

      <section className="grid gap-2" aria-labelledby="price-chart-heading">
        <h2
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
          id="price-chart-heading"
        >
          가격 경로
        </h2>
        <div className="rounded-md border border-slate-200 bg-white p-3">
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
      </section>

      <ScenarioTable rows={scenarioRows} report={report} />
    </div>
  );
}

type FactRow = {
  label: string;
  value: string;
  caption?: string;
  tone?: 'good' | 'bad';
};

function FactsTable({ rows }: { rows: FactRow[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="리포트 핵심 지표">
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 [&>div]:border-b [&>div]:border-r [&>div]:border-slate-100">
        {rows.map((row) => (
          <div className="grid min-w-0 gap-0.5 p-3" key={row.label}>
            <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
            <dd className={`truncate font-mono text-sm font-semibold tabular-nums ${toneClass(row.tone)}`}>
              {row.value}
            </dd>
            {row.caption ? <dd className="truncate text-xs text-slate-500">{row.caption}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function ScenarioTable({ rows, report }: { rows: ScenarioRow[]; report: ReportRow }) {
  if (rows.length === 0) return null;
  return (
    <section className="grid gap-2" aria-labelledby="scenario-heading">
      <h2
        className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
        id="scenario-heading"
      >
        가격대별 사후 수익률
      </h2>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">시나리오</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">일자</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">매수가</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">현재까지</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">목표까지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-3 py-2 font-medium text-slate-950">{row.label}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{row.point?.time ?? '—'}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {formatAssetPrice(row.point?.value, report)}
                </td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${signedTextClass(row.currentReturn)}`}>
                  {formatPercent(row.currentReturn)}
                </td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums ${signedTextClass(row.targetReturn)}`}>
                  {formatPercent(row.targetReturn)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function githubBlobUrl(path: string): string {
  return `https://github.com/ChoiInYeol/snusmic-portfolio-lab/blob/main/${encodeURI(path)}`;
}

function pdfHrefFor(report: { pdfFilename: string; pdfUrl: string }): string | null {
  if (report.pdfFilename) return githubBlobUrl(`data/pdfs/${report.pdfFilename}`);
  if (report.pdfUrl) return report.pdfUrl;
  return null;
}

function badgeVariant(
  tone: ReturnType<typeof targetStatus>['tone'],
): 'success' | 'warning' | 'destructive' | 'default' {
  if (tone === 'good') return 'success';
  if (tone === 'bad') return 'destructive';
  if (tone === 'warn') return 'warning';
  return 'default';
}

function captureFromReport(report: ReportRow): number | null {
  const peak = report.peakReturn;
  const target = report.targetUpsideAtPub;
  if (peak === null || target === null || !Number.isFinite(peak) || !Number.isFinite(target) || target === 0)
    return null;
  return peak / target;
}

function formatCapture(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}x`;
}

type OutcomeRow = NonNullable<ReturnType<typeof getReportStatisticsLabSummary>['riskScatter'][number] | null>;

function stageLabel(outcome: OutcomeRow | null, report: ReportRow): string {
  if (outcome?.hit10 || report.targetHit) return '1.0x 도달';
  if (outcome?.hit08) return '0.8x 도달';
  if (outcome?.hit06) return '0.6x 도달';
  return '미도달';
}

function signedTone(value: number | null | undefined): 'good' | 'bad' | undefined {
  if (value === null || value === undefined || !Number.isFinite(value)) return undefined;
  return value >= 0 ? 'good' : 'bad';
}

function signedTextClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'text-slate-950';
  return value >= 0 ? 'text-emerald-600' : 'text-rose-600';
}

function toneClass(tone?: 'good' | 'bad'): string {
  if (tone === 'good') return 'text-emerald-600';
  if (tone === 'bad') return 'text-rose-600';
  return 'text-slate-950';
}
