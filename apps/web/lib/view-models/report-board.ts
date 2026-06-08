import 'server-only';

import { getReportCandidateViewModel } from '@/lib/view-models/report-candidates';
import {
  getReportVerificationViewModel,
  type ReportLedgerRow,
  type ReportLedgerTableModel,
} from '@/lib/view-models/report-verification';
import type { PageHeaderModel, PageMetric } from '@/lib/view-models/shared';

export type ReportBoardViewModel = {
  header: PageHeaderModel;
  metrics: PageMetric[];
  priorityRows: ReportLedgerRow[];
  candidateRows: ReportLedgerRow[];
  reportTable: ReportLedgerTableModel;
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
    priorityRows: candidates.priorityRows,
    candidateRows: candidates.rows,
    reportTable: verification.table,
  };
}
