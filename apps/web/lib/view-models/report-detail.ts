import 'server-only';

import { getPriceSeries, getReportVerificationPageBundle, type PricePoint, type ReportRow } from '@/lib/artifacts';
import { reportEntryPrice } from '@/lib/report-view-model';

export type ReportDetailViewModel = {
  report: ReportRow;
  priceSeries: PricePoint[];
  entryPrice: number | null;
  captureRatio: number | null;
  stageLabel: string;
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

function stageLabel(report: ReportRow): string {
  if (report.targetHit) return '목표 도달';
  if (report.expired) return '검증 만료';
  return '진행 중';
}
