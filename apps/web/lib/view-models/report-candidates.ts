import 'server-only';

import { formatDateKo, formatPercent } from '@/lib/format';
import {
  getReportVerificationViewModel,
  rankReportCandidates,
  type ReportLedgerRow,
} from '@/lib/view-models/report-verification';
import type { PageHeaderModel, PageMetric } from '@/lib/view-models/shared';

export type ReportCandidateViewModel = {
  header: PageHeaderModel;
  metrics: PageMetric[];
  priorityRows: ReportLedgerRow[];
  rows: ReportLedgerRow[];
};

export function getReportCandidateViewModel(): ReportCandidateViewModel {
  const verification = getReportVerificationViewModel();
  const rows = rankReportCandidates(verification.table.rows);
  const latestPublicationDate = rows.map((row) => row.publicationDate).sort((a, b) => b.localeCompare(a))[0];
  const positiveCurrentReturnCount = rows.filter((row) => (row.currentReturn ?? Number.NEGATIVE_INFINITY) >= 0).length;
  const positiveCurrentReturnShare = rows.length ? positiveCurrentReturnCount / rows.length : null;
  const aboveAllMaCount = rows.filter((row) => row.maStack).length;
  const priorityRows = rows.slice(0, 5);

  return {
    header: {
      eyebrow: 'Report Candidates',
      title: '리포트 후보',
      description: '오늘 먼저 볼 후보를 점수, 가격 위치, 리포트 맥락으로 정렬합니다.',
      badges: [
        { label: '최신 발간', value: formatDateKo(latestPublicationDate) },
        { label: '가격 기준', value: verification.asOf ? formatDateKo(verification.asOf) : null },
        { label: '리포트', value: `${verification.table.rows.length.toLocaleString('ko-KR')}건` },
      ],
    },
    metrics: [
      {
        id: 'candidates',
        label: '후보 리포트',
        value: `${rows.length.toLocaleString('ko-KR')}개`,
        helper: '전체 리포트 표본에서 추림',
        tone: 'neutral',
      },
      {
        id: 'positive',
        label: '현재 플러스',
        value: `${positiveCurrentReturnCount.toLocaleString('ko-KR')}개`,
        helper: formatPercent(positiveCurrentReturnShare, 1),
        tone: positiveCurrentReturnCount > 0 ? 'positive' : 'neutral',
      },
      {
        id: 'ma-stack',
        label: '정배열',
        value: `${aboveAllMaCount.toLocaleString('ko-KR')}개`,
        helper: '20/50/200 SMA 기준',
        tone: aboveAllMaCount > 0 ? 'positive' : 'neutral',
      },
      {
        id: 'priority',
        label: '오늘 우선순위',
        value: `${priorityRows.length.toLocaleString('ko-KR')}개`,
        helper: '상단 카드 표시',
        tone: 'accent',
      },
    ],
    priorityRows,
    rows,
  };
}
