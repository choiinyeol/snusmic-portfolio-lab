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
export type ReportDetailTrustStatus = {
  level: 'verified' | 'review' | 'limited';
  label: string;
  summary: string;
  evidence: string[];
};

export type ReportDetailViewModel = {
  report: ReportRow;
  priceSeries: PricePoint[];
  entryPrice: number | null;
  captureRatio: number | null;
  stageLabel: string;
  sourceMetadata: ReportDetailSourceMetadata;
  trustStatus: ReportDetailTrustStatus;
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
  const priceSeries = getPriceSeries(report.symbol);
  const entryPrice = reportEntryPrice(report);
  const source = sourceMetadata(report);
  return {
    report,
    priceSeries,
    entryPrice,
    captureRatio: captureFromReport(report),
    stageLabel: stageLabel(report),
    sourceMetadata: source,
    trustStatus: trustStatus(report, priceSeries, entryPrice, source),
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
function trustStatus(
  report: ReportRow,
  priceSeries: PricePoint[],
  entryPrice: number | null,
  source: ReportDetailSourceMetadata,
): ReportDetailTrustStatus {
  const hasSource = Boolean(source.pdfFilename || source.pdfUrl || source.markdownFilename);
  const hasPricePath = priceSeries.length > 0 && entryPrice !== null && report.targetPriceNative !== null;
  const evidence = [
    hasSource ? '원문 PDF 또는 추출 Markdown 연결됨' : '원문 연결이 부족함',
    hasPricePath
      ? `${priceSeries.length.toLocaleString('ko-KR')}개 가격 관측으로 경로 검증`
      : '가격 경로 검증에 필요한 값이 부족함',
    report.targetHit ? '목표가 도달일 확인됨' : report.expired ? '2년 평가창 종료' : '진행 중인 리포트',
  ];

  if (!hasSource) {
    return {
      level: 'limited',
      label: '원문 확인 필요',
      summary: '원문 연결이 부족해 가격 경로만으로 제한적으로 확인합니다.',
      evidence,
    };
  }
  if (!hasPricePath) {
    return {
      level: 'limited',
      label: '가격 이력 부족',
      summary: '상세 가격 경로를 만들기 위한 발간가·목표가·가격 이력이 부족합니다.',
      evidence,
    };
  }
  if (source.caveatFlags.length > 0) {
    return {
      level: 'review',
      label: '원문 확인 필요',
      summary: '추출 주의 항목이 있어 원문 PDF와 Markdown을 함께 확인하는 편이 안전합니다.',
      evidence: [...evidence, `${source.caveatFlags.length.toLocaleString('ko-KR')}개 추출 주의 항목`],
    };
  }
  return {
    level: 'verified',
    label: '검증됨',
    summary: '원문, 발간가, 목표가, 이후 가격 경로가 상세 화면에 연결되어 있습니다.',
    evidence,
  };
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
