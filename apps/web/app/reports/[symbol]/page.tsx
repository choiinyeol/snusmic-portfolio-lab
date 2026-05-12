import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PathScenarioPanel } from '@/components/reports/PathScenarioPanel';
import { PriceEvidencePanel } from '@/components/reports/PriceEvidencePanel';
import { ReportHero } from '@/components/reports/ReportHero';
import { ReportSourcesPanel } from '@/components/reports/ReportSourcesPanel';
import { SymbolPersonaTrades } from '@/components/reports/SymbolPersonaTrades';
import { Section } from '@/components/ui/Section';
import {
  getMarkdownSnippet,
  getPositionEpisodes,
  getPriceSeries,
  hasPriceArtifact,
  getReportBySymbol,
  getReportRows,
  getReportsBySymbol,
  getSummaryRows,
  getTrades,
} from '@/lib/artifacts';
import {
  buildKoreanInvestmentMemo,
  buildPathEvidence,
  buildScenarioRows,
  buildTrendSnapshot,
  targetStatus,
} from '@/lib/report-view-model';

type ReportParams = Promise<{ symbol: string }>;

export function generateStaticParams() {
  return Array.from(new Set(getReportRows().map((report) => report.symbol)))
    .filter((symbol) => hasPriceArtifact(symbol))
    .map((symbol) => ({ symbol }));
}

export async function generateMetadata({ params }: { params: ReportParams }): Promise<Metadata> {
  const { symbol } = await params;
  const report = getReportBySymbol(decodeURIComponent(symbol));
  return { title: report ? `${report.company} — 리포트 분석` : '리포트 분석' };
}

export default async function ReportDetailPage({ params }: { params: ReportParams }) {
  const { symbol } = await params;
  const reportSymbol = decodeURIComponent(symbol);
  const report = getReportBySymbol(reportSymbol);
  if (!report) notFound();
  const siblingReports = getReportsBySymbol(reportSymbol);
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

  return (
    <>
      <ReportHero
        report={report}
        status={status}
        markdownHref={githubBlobUrl(`data/markdown/${report.markdownFilename}`)}
        pdfHref={pdfHrefFor(report)}
      />

      <Section eyebrow="Price evidence" title="가격 경로와 목표가">
        <PriceEvidencePanel report={report} prices={prices} pathEvidence={pathEvidence} status={status} />
      </Section>

      <Section eyebrow="Path observations" title="가격대별 시나리오">
        <PathScenarioPanel report={report} scenarioRows={scenarioRows} trend={trendSnapshot} />
      </Section>

      <Section eyebrow="Trades" title="페르소나별 매매">
        <SymbolPersonaTrades
          symbol={report.symbol}
          episodes={symbolEpisodes}
          trades={symbolTrades}
          personaLabels={personaLabels}
        />
      </Section>

      <Section eyebrow="Sources" title="원문과 메타">
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
  return `https://github.com/ChoiInYeol/snusmic-quant-terminal/blob/main/${encodeURI(path)}`;
}

function pdfHrefFor(report: { pdfFilename: string; pdfUrl: string }): string | null {
  if (report.pdfFilename) return githubBlobUrl(`data/pdfs/${report.pdfFilename}`);
  if (report.pdfUrl) return report.pdfUrl;
  return null;
}
