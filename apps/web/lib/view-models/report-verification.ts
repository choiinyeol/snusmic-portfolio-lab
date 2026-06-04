import 'server-only';

import { getReportHealth, getReportVerificationPageBundle, type ReportRow } from '@/lib/artifacts';
import { formatDateKo, formatDays, formatPercent } from '@/lib/format';
import type {
  DataWarning,
  PageHeaderModel,
  PageMetric,
  ReportVerificationDisplayRow,
  ReportVerificationTableModel,
  TableViewPreset,
} from '@/lib/view-models/shared';

export type ReportVerificationViewModel = {
  header: PageHeaderModel;
  asOf: string | null;
  metrics: PageMetric[];
  dataWarnings: DataWarning[];
  table: ReportVerificationTableModel;
};

export function getReportVerificationViewModel(): ReportVerificationViewModel {
  const bundle = getReportVerificationPageBundle();
  const reportHealth = getReportHealth();
  const reports = bundle.table.rows;
  const latestPublicationDate = bundle.as_of.report_date;
  const priceAsOf = bundle.as_of.price_date;

  return {
    header: {
      eyebrow: 'Report Verification',
      title: '리포트 성과 검증',
      description: '발간일, 목표가, 가격 흐름을 같은 기준으로 놓고 리포트 신호의 사후 성과를 추적합니다.',
      badges: [
        { label: '최신 발간', value: formatDateKo(latestPublicationDate) },
        { label: '가격 기준', value: priceAsOf ? formatDateKo(priceAsOf) : null },
        { label: '리포트', value: `${reports.length.toLocaleString('ko-KR')}건` },
      ],
    },
    asOf: priceAsOf,
    metrics: buildMetrics(bundle.metrics, reports),
    dataWarnings: buildDataWarnings(reportHealth),
    table: {
      rows: reports.map(toReportVerificationDisplayRow),
      sourceRows: reports,
      defaultView: 'all',
      views: buildViewPresets(bundle.views, reports),
    },
  };
}

function buildDataWarnings(reportHealth: ReturnType<typeof getReportHealth>): DataWarning[] {
  const warnings: DataWarning[] = [];
  if (reportHealth.summary.needs_review > 0) {
    warnings.push({
      id: 'needs-review',
      level: 'warning',
      message: `전사/추출 재검토 ${reportHealth.summary.needs_review.toLocaleString('ko-KR')}건: 목표가 문장 또는 핵심 필드를 원문에서 확인해야 합니다.`,
    });
  }
  if (reportHealth.summary.extraction_review > 0) {
    warnings.push({
      id: 'extraction-review',
      level: 'info',
      message: `추출 참고사항 ${reportHealth.summary.extraction_review.toLocaleString('ko-KR')}건: rating 누락, 모호한 목표가, non-buy 의견 등이 기록되어 있습니다.`,
    });
  }
  if (reportHealth.summary.web_excluded > 0) {
    const reasons = Object.entries(reportHealth.summary.exclusion_reasons)
      .map(([reason, count]) => `${exclusionReasonLabel(reason)} ${count.toLocaleString('ko-KR')}건`)
      .join(' · ');
    warnings.push({
      id: 'web-excluded',
      level: 'info',
      message: `웹 검증 표본 제외 ${reportHealth.summary.web_excluded.toLocaleString('ko-KR')}건: ${reasons}`,
    });
  }
  return warnings;
}

function exclusionReasonLabel(reason: string): string {
  if (reason === 'missing_price') return '가격누락';
  if (reason === 'non_positive_upside') return '무상승';
  if (reason === 'downside_target') return '하락목표';
  if (reason === 'instant_target_hit') return '즉시도달';
  if (reason === 'missing_performance') return '성과누락';
  if (reason === 'sell_opinion') return '매도/비매수';
  return reason;
}

function buildMetrics(
  metrics: ReturnType<typeof getReportVerificationPageBundle>['metrics'],
  reports: ReportRow[],
): PageMetric[] {
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  const reportCount = Number(byId.get('reports')?.value ?? reports.length);
  const active = Number(byId.get('active')?.value ?? reports.filter((report) => isReportBoardCandidate(report)).length);
  const hitRate =
    nullableNumber(byId.get('target_hit_rate')?.value) ??
    safeRatio(reports.filter((report) => report.targetHit).length, reports.length);
  const medianReturn =
    nullableNumber(byId.get('median_current_return')?.value) ?? median(reports.map((r) => r.currentReturn));
  const medianDays =
    nullableNumber(byId.get('median_days_to_target')?.value) ??
    median(reports.filter((r) => r.targetHit).map((r) => r.daysToTarget));
  const excluded = Number(byId.get('excluded')?.value ?? 0);

  return [
    {
      id: 'reports',
      label: '전체 리포트',
      value: `${reportCount.toLocaleString('ko-KR')}건`,
      helper: '성과 검증 가능 표본',
      tone: 'neutral',
    },
    {
      id: 'active',
      label: '검토 후보',
      value: `${active.toLocaleString('ko-KR')}개`,
      helper: '목표가 검증 진행 중',
      tone: active > 0 ? 'positive' : 'neutral',
    },
    {
      id: 'hit-rate',
      label: '목표 도달률',
      value: formatPercent(hitRate),
      helper: `${reports.filter((report) => report.targetHit).length.toLocaleString('ko-KR')}건 도달`,
      tone: 'positive',
    },
    {
      id: 'median-return',
      label: '중앙 수익률',
      value: formatPercent(medianReturn),
      helper: '현재 평가 구간',
      tone: (medianReturn ?? 0) >= 0 ? 'positive' : 'negative',
    },
    {
      id: 'excluded',
      label: '제외',
      value: `${excluded.toLocaleString('ko-KR')}건`,
      helper: '원천/가격/성과 조건 제외',
      tone: excluded > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'median-days',
      label: '중앙 도달일',
      value: formatDays(medianDays),
      helper: '목표 도달 리포트 기준',
      tone: 'neutral',
    },
  ];
}

function toReportVerificationDisplayRow(report: ReportRow): ReportVerificationDisplayRow {
  return {
    id: report.reportId,
    symbol: report.symbol,
    company: report.company,
    exchange: report.exchange,
    publicationDate: report.publicationDate,
    entryPrice: report.entryPriceNative,
    targetPrice: report.targetPriceNative,
    targetUpside: report.targetUpsideAtPub,
    currentReturn: report.currentReturn,
    targetRemaining: report.targetRemainingPct,
    targetProgress: report.targetProgressPct,
    peakReturn: report.peakReturn,
    troughReturn: report.troughReturn,
    status: report.targetHit ? 'hit' : report.expired ? 'expired' : 'open',
    statusLabel: report.targetHit ? '도달' : report.expired ? '만료' : '진행 중',
    href: `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`,
  };
}

function buildViewPresets(
  views: ReturnType<typeof getReportVerificationPageBundle>['views'],
  reports: ReportRow[],
): TableViewPreset[] {
  const bundleCounts = new Map(views.map((view) => [view.id, view.count ?? 0]));
  return [
    {
      id: 'candidate',
      label: '검토 후보',
      count: bundleCounts.get('candidate') ?? reports.filter((report) => isReportBoardCandidate(report)).length,
      description: '아직 목표가에 닿지 않았고 만료되지 않은 후보',
    },
    {
      id: 'all',
      label: '전체',
      count: reports.length,
      description: '검증 가능한 전체 리포트 표본',
    },
    {
      id: 'target-hit',
      label: '목표 도달',
      count: bundleCounts.get('target-hit') ?? reports.filter((report) => report.targetHit).length,
      description: '발간 후 목표가를 한 번 이상 도달',
    },
    {
      id: 'open',
      label: '진행 중',
      count: reports.filter((report) => !report.targetHit && !report.expired).length,
      description: '목표 도달 전이고 아직 만료되지 않음',
    },
    {
      id: 'upside',
      label: '업사이드',
      count: reports.filter((report) => (report.targetUpsideAtPub ?? 0) > 0).length,
      description: '발간 시점 상승여력이 남아 있던 리포트',
    },
  ];
}

function isReportBoardCandidate(report: ReportRow): boolean {
  return !report.targetHit && !report.expired && (report.targetUpsideAtPub ?? 0) > 0;
}

function nullableNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function safeRatio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function median(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (finite.length === 0) return null;
  finite.sort((a, b) => a - b);
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[mid - 1] + finite[mid]) / 2 : finite[mid];
}
