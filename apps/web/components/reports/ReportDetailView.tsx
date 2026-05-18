import { PathScenarioPanel } from '@/components/reports/PathScenarioPanel';
import { PriceEvidencePanel } from '@/components/reports/PriceEvidencePanel';
import { ReportHero } from '@/components/reports/ReportHero';
import { ReportOutcomePanel } from '@/components/reports/ReportOutcomePanel';
import { ReportSourcesPanel } from '@/components/reports/ReportSourcesPanel';
import { SymbolPersonaTrades } from '@/components/reports/SymbolPersonaTrades';
import { Section } from '@/components/ui/Section';
import {
  getMarkdownSnippet,
  getPositionEpisodes,
  getPriceSeries,
  getReportStatisticsLabSummary,
  getReportsBySymbol,
  getSummaryRows,
  getTrades,
  type ReportRow,
} from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';
import {
  buildKoreanInvestmentMemo,
  buildPathEvidence,
  buildScenarioRows,
  buildTrendSnapshot,
  targetStatus,
} from '@/lib/report-view-model';

export function ReportDetailView({ report }: { report: ReportRow }) {
  const siblingReports = getReportsBySymbol(report.symbol);
  // End-cap at lastCloseDate so expired reports stop at expiry, not today.
  const prices = getPriceSeries(report.symbol, undefined, report.lastCloseDate);
  const snippet = getMarkdownSnippet(report);
  const pathEvidence = buildPathEvidence(prices, report);
  const scenarioRows = buildScenarioRows(prices, report);
  const trendSnapshot = buildTrendSnapshot(prices, report);
  const memo = buildKoreanInvestmentMemo(report);
  const personaLabels = Object.fromEntries(getSummaryRows().map((row) => [row.persona, row.label ?? row.persona]));
  const symbolEpisodes = getPositionEpisodes().filter((row) => row.symbol === report.symbol);
  const symbolTrades = getTrades().filter((row) => row.symbol === report.symbol);
  const status = targetStatus(report);
  const reportStatistics = getReportStatisticsLabSummary();
  const reportOutcome = reportStatistics.riskScatter.find((row) => row.reportId === report.reportId) ?? null;

  return (
    <>
      <ReportHero
        report={report}
        status={status}
        markdownHref={githubBlobUrl(`data/markdown/${report.markdownFilename}`)}
        pdfHref={pdfHrefFor(report)}
      />

      <ReportEvidenceStrip report={report} outcome={reportOutcome} sample={reportStatistics.riskScatter} />

      <ReportOutcomePanel report={report} outcome={reportOutcome} />

      <Section eyebrow="가격 근거" title="가격 경로와 목표가">
        <PriceEvidencePanel report={report} prices={prices} pathEvidence={pathEvidence} status={status} />
      </Section>

      <Section eyebrow="진입 비교" title="가격대별 결과 비교">
        <PathScenarioPanel report={report} scenarioRows={scenarioRows} trend={trendSnapshot} />
      </Section>

      <Section eyebrow="매매내역" title="전략별 매매">
        <SymbolPersonaTrades
          symbol={report.symbol}
          episodes={symbolEpisodes}
          trades={symbolTrades}
          personaLabels={personaLabels}
        />
      </Section>

      <Section eyebrow="원본" title="자료와 발간 이력">
        <ReportSourcesPanel
          siblingReports={siblingReports}
          memo={memo}
          snippet={snippet}
          markdownHref={githubBlobUrl(`data/markdown/${report.markdownFilename}`)}
          pdfHref={pdfHrefFor(report)}
        />
      </Section>
    </>
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

type ReportOutcomeRow = ReturnType<typeof getReportStatisticsLabSummary>['riskScatter'][number];

function ReportEvidenceStrip({
  report,
  outcome,
  sample,
}: {
  report: ReportRow;
  outcome: ReportOutcomeRow | null;
  sample: ReportOutcomeRow[];
}) {
  const currentReturn = outcome?.currentReturn ?? report.currentReturn;
  const rank = currentReturnRank(currentReturn, sample);
  const stage =
    outcome?.hit10 || report.targetHit
      ? '1.0x 도달'
      : outcome?.hit08
        ? '0.8x 도달'
        : outcome?.hit06
          ? '0.6x 도달'
          : '미도달';
  const capture = outcome?.upsideCaptureRatio ?? null;
  return (
    <section className="grid gap-5 border-b border-slate-200 pb-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="min-w-0">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">한 장 요약</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-slate-950">
          이 리포트는 전체 표본 안에서 어디에 있나
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
          개별 리포트 화면은 원문 요약보다 검증 결과를 먼저 봅니다. 발간가에서 목표가까지의 약속, 실제 가격 경로, 중간
          낙폭, 현재 수익률 순위를 한 줄로 묶어 전체 통계 페이지와 같은 기준으로 읽게 했습니다.
        </p>
      </div>
      <dl className="grid min-w-0 divide-y divide-slate-200 border-y border-slate-200 bg-white/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        <EvidenceMetric
          label="목표 단계"
          value={stage}
          caption={
            report.targetHit
              ? `${report.targetHitDate} · ${formatDays(report.daysToTarget)}`
              : '원 목표가 일부 도달 포함'
          }
        />
        <EvidenceMetric
          label="현재 수익률"
          value={formatPercent(currentReturn)}
          caption={rank ? `전체 ${rank.total}건 중 상위 ${rank.percentileLabel}` : '가격 매칭 없음'}
          tone={(currentReturn ?? 0) >= 0 ? 'good' : 'bad'}
        />
        <EvidenceMetric
          label="중간 최대 손실"
          value={formatPercent(outcome?.maxAdverseExcursion ?? report.troughReturn)}
          caption="발간 이후 저점 기준"
          tone="bad"
        />
        <EvidenceMetric
          label="목표 포착률"
          value={
            capture === null || capture === undefined
              ? '—'
              : `${capture.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}x`
          }
          caption="최대상승폭 ÷ 목표수익률"
        />
      </dl>
    </section>
  );
}

function EvidenceMetric({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <div className="min-w-0 p-4">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className={`mt-2 truncate font-mono text-xl font-semibold tabular-nums ${tone === 'good' ? 'text-blue-600' : tone === 'bad' ? 'text-rose-600' : 'text-slate-950'}`}
      >
        {value}
      </dd>
      <dd className="mt-1 truncate text-xs text-slate-500">{caption}</dd>
    </div>
  );
}

function currentReturnRank(
  value: number | null | undefined,
  sample: ReportOutcomeRow[],
): { total: number; percentileLabel: string } | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const values = sample
    .map((row) => row.currentReturn)
    .filter((item): item is number => item !== null && item !== undefined && Number.isFinite(item));
  if (!values.length) return null;
  const betterOrEqual = values.filter((item) => item >= value).length;
  const percentile = Math.max(1, Math.round((betterOrEqual / values.length) * 100));
  return { total: values.length, percentileLabel: `${percentile}%` };
}
