import 'server-only';

import { getPriceSeries, getReportVerificationPageBundle, type PricePoint, type ReportRow } from '@/lib/artifacts';
import { reportEntryPrice } from '@/lib/report-view-model';

export type ReportDetailSourceMetadata = {
  reportId: string;
  title: string;
  markdownFilename: string | null;
  markdownRepositoryPath: string | null;
  pdfFilename: string | null;
  pdfRepositoryPath: string | null;
  pdfUrl: string | null;
  caveatFlags: string[];
};

export type ReportDetailViewModel = {
  report: ReportRow;
  priceSeries: PricePoint[];
  entryPrice: number | null;
  captureRatio: number | null;
  stageLabel: string;
  sourceMetadata: ReportDetailSourceMetadata;
};

export function getReportDetailStaticParams(): Array<{ symbol: string; reportId: string }> {
  return getReportVerificationPageBundle().table.rows.map((report) => ({
    symbol: report.symbol,
    reportId: report.reportId,
  }));
}

export function getReportDetailViewModel(symbol: string, reportId: string): ReportDetailViewModel | undefined {
  const normalized = symbol.toUpperCase();
  const report = getReportVerificationPageBundle().table.rows.find(
    (report) => report.reportId === reportId && report.symbol.toUpperCase() === normalized,
  );
  if (!report) return undefined;
  return {
    report,
    priceSeries: getPriceSeries(report.symbol),
    entryPrice: reportEntryPrice(report),
    captureRatio: captureFromReport(report),
    stageLabel: stageLabel(report),
    sourceMetadata: sourceMetadata(report),
  };
}

function captureFromReport(report: ReportRow): number | null {
  const peak = report.peakReturn;
  const target = report.targetUpsideAtPub;
  if (peak === null || target === null || !Number.isFinite(peak) || !Number.isFinite(target) || target === 0) {
    return null;
  }
  return peak / target;
}

function sourceMetadata(report: ReportRow): ReportDetailSourceMetadata {
  const markdownFilename = nonEmptyString(report.markdownFilename);
  const pdfFilename = nonEmptyString(report.pdfFilename);

  return {
    reportId: report.reportId,
    title: report.title,
    markdownFilename,
    markdownRepositoryPath: markdownFilename ? `data/markdown/${markdownFilename}` : null,
    pdfFilename,
    pdfRepositoryPath: pdfFilename ? `data/pdfs/${pdfFilename}` : null,
    pdfUrl: nonEmptyString(report.pdfUrl),
    caveatFlags: report.caveatFlags,
  };
}

function nonEmptyString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function stageLabel(report: ReportRow): string {
  if (report.targetHit) return '목표 도달';
  if (report.expired) return '검증 만료';
  return '진행 중';
}
