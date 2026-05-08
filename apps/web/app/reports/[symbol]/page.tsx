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
  oneYearBefore,
  targetStatus,
} from '@/lib/report-view-model';

type ReportParams = Promise<{ symbol: string }>;

export function generateStaticParams() {
  return Array.from(new Set(getReportRows().map((report) => report.symbol))).map((symbol) => ({ symbol }));
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
  const prices = getPriceSeries(report.symbol, oneYearBefore(report.publicationDate), report.lastCloseDate);
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
        pdfHref={report.pdfFilename ? githubBlobUrl(`data/pdfs/${report.pdfFilename}`) : null}
      />

      <Section
        eyebrow="Price evidence"
        title="가격 경로와 추출 목표가"
        caption="차트는 자산의 표시 통화 그대로 보여주고, 목표가·관측 고저점·현재가를 한 화면에서 검증합니다."
      >
        <PriceEvidencePanel report={report} prices={prices} pathEvidence={pathEvidence} status={status} />
      </Section>

      <Section
        eyebrow="Path observations"
        title="가격대별 매수 시나리오와 추세 신호"
        caption="발간 이후 시간 경과가 아니라, 관측 저점~고점 사이의 가격 수준과 추세 지표를 함께 비교합니다."
      >
        <PathScenarioPanel report={report} scenarioRows={scenarioRows} trend={trendSnapshot} />
      </Section>

      <Section
        eyebrow="Trades"
        title="페르소나별 매매 기록"
        caption="해당 종목에 대해 각 전략이 언제 진입하고, 언제 청산했는지 체결 단위로 검토합니다."
      >
        <SymbolPersonaTrades
          symbol={report.symbol}
          episodes={symbolEpisodes}
          trades={symbolTrades}
          personaLabels={personaLabels}
        />
      </Section>

      <Section
        eyebrow="Sources"
        title="원문과 메타 정보"
        caption="투자 메모, 추출된 마크다운 발췌, 동일 종목의 다른 발간 이력을 함께 제공합니다."
      >
        <ReportSourcesPanel
          siblingReports={siblingReports}
          memo={memo}
          snippet={snippet}
          markdownHref={githubBlobUrl(`data/markdown/${report.markdownFilename}`)}
          pdfHref={report.pdfFilename ? githubBlobUrl(`data/pdfs/${report.pdfFilename}`) : null}
        />
      </Section>
    </>
  );
}

function githubBlobUrl(path: string): string {
  return `https://github.com/ChoiInYeol/snusmic-quant-terminal/blob/main/${encodeURI(path)}`;
}
