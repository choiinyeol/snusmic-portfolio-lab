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
