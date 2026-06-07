import 'server-only';

import type { ReportBoardRow } from '@/components/report-board/report-board-table';
import { getReportVerificationViewModel } from '@/lib/view-models/report-verification';
import { getReportCandidateViewModel } from '@/lib/view-models/report-candidates';
import type { DataWarning, PageHeaderModel, PageMetric, ReportVerificationTableModel } from '@/lib/view-models/shared';

export type ReportDiagnosticItem = {
  id: string;
  company: string;
  symbol: string;
  date: string | null;
  status: string;
  reason: string;
  action: string;
  href: string | null;
};

export type ReportBoardViewModel = {
  header: PageHeaderModel;
  metrics: PageMetric[];
  candidateMetrics: PageMetric[];
  warnings: DataWarning[];
  diagnostics: ReportDiagnosticItem[];
  priorityRows: ReportBoardRow[];
  candidateRows: ReportBoardRow[];
  reportTable: ReportVerificationTableModel;
};

export function getReportBoardViewModel(): ReportBoardViewModel {
  const verification = getReportVerificationViewModel();
  const candidates = getReportCandidateViewModel();

  return {
    header: {
      eyebrow: 'Signal Verification Board',
      title: '신호 검증 보드',
      description: '오늘 점검할 후보와 전체 리포트의 현재 수익률, 진행률, 가격 흐름을 한 화면에서 비교합니다.',
      badges: verification.header.badges,
    },
    metrics: verification.metrics.filter((metric) =>
      ['active', 'hit-rate', 'median-return', 'median-days'].includes(metric.id),
    ),
    candidateMetrics: candidates.metrics,
    warnings: verification.dataWarnings,
    diagnostics: buildDiagnostics(verification.reportHealth.rows),
    priorityRows: candidates.priorityRows,
    candidateRows: candidates.rows,
    reportTable: verification.table,
  };
}

function buildDiagnostics(
  rows: ReturnType<typeof getReportVerificationViewModel>['reportHealth']['rows'],
): ReportDiagnosticItem[] {
  const priority = (row: (typeof rows)[number]) => {
    if (row.extraction_status === 'needs_review') return 0;
    if (row.web_exclusion_reason === 'missing_price') return 1;
    if (row.web_status === 'excluded') return 2;
    if (row.extraction_reasons.length > 0) return 3;
    return 4;
  };

  return rows
    .filter(
      (row) =>
        row.extraction_status === 'needs_review' || row.web_status === 'excluded' || row.extraction_reasons.length > 0,
    )
    .sort(
      (left, right) =>
        priority(left) - priority(right) || String(right.date || '').localeCompare(String(left.date || '')),
    )
    .slice(0, 8)
    .map((row) => ({
      id: row.report_id,
      company: row.company ?? '-',
      symbol: row.symbol ?? row.ticker ?? '-',
      date: row.date,
      status:
        row.extraction_status === 'needs_review'
          ? '전사 재검토'
          : row.web_status === 'excluded'
            ? '웹 제외'
            : '추출 참고',
      reason: row.web_exclusion_reason ?? row.extraction_reasons[0] ?? 'review',
      action: row.action,
      href: row.symbol ? `/reports/${encodeURIComponent(row.symbol)}/${encodeURIComponent(row.report_id)}` : null,
    }));
}
