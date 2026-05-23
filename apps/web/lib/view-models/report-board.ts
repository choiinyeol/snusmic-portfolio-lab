import 'server-only';

import type { ReviewBoardRow } from '@/components/review/review-table';
import { getReportVerificationViewModel } from '@/lib/view-models/report-verification';
import { getReviewQueueViewModel } from '@/lib/view-models/review-queue';
import type { DataWarning, PageHeaderModel, PageMetric, ReportVerificationTableModel } from '@/lib/view-models/shared';

export type ReportBoardViewModel = {
  header: PageHeaderModel;
  metrics: PageMetric[];
  candidateMetrics: PageMetric[];
  warnings: DataWarning[];
  priorityRows: ReviewBoardRow[];
  candidateRows: ReviewBoardRow[];
  reportTable: ReportVerificationTableModel;
};

export function getReportBoardViewModel(): ReportBoardViewModel {
  const verification = getReportVerificationViewModel();
  const queue = getReviewQueueViewModel();

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
    candidateMetrics: queue.metrics,
    warnings: [],
    priorityRows: queue.priorityRows,
    candidateRows: queue.rows,
    reportTable: verification.table,
  };
}
