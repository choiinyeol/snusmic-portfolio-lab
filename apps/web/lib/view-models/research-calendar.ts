import 'server-only';

import type { ResearchCalendarDateSummary, ResearchCalendarRow } from '@/lib/artifacts';
import { getResearchCalendar } from '@/lib/artifacts';
import { formatDateKo, formatPercent } from '@/lib/format';
import type { PageHeaderModel, PageMetric } from '@/lib/view-models/shared';

export type ResearchCalendarViewModel = {
  header: PageHeaderModel;
  metrics: PageMetric[];
  latestDate: string;
  dates: ResearchCalendarDateSummary[];
  rows: ResearchCalendarRow[];
};

export function getResearchCalendarViewModel(): ResearchCalendarViewModel {
  const artifact = getResearchCalendar();
  const latestDate = artifact.summary.latest_date;
  const latest =
    artifact.date_summaries.find((summary) => summary.date === latestDate) ?? artifact.date_summaries.at(-1);
  const latestPositiveShare =
    latest && latest.forwardPositiveLatestSample > 0
      ? latest.forwardPositiveLatestCount / latest.forwardPositiveLatestSample
      : null;

  return {
    header: {
      title: '리포트 캘린더',
      meta: `${formatDateKo(artifact.date_range.start)} - ${formatDateKo(artifact.date_range.end)} · ${artifact.summary.date_count.toLocaleString('ko-KR')}개 관측일`,
      description:
        '과거 각 날짜에 이미 공개되어 있던 리포트 후보와 당시 가격·추세·목표가 위치를 그대로 펼쳐봅니다. 사후 수익률은 전략 판단이 아니라 검증용 기록입니다.',
      badges: [
        { label: '가격 기준', value: artifact.as_of.price_date },
        { label: '후보 행', value: artifact.summary.row_count.toLocaleString('ko-KR') },
        { label: '종목', value: artifact.summary.symbol_count.toLocaleString('ko-KR') },
      ],
    },
    metrics: [
      {
        id: 'latest-date',
        label: '최근 관측일',
        value: formatDateKo(latestDate),
        helper: latest ? `${latest.candidateCount.toLocaleString('ko-KR')}개 후보` : undefined,
        tone: 'data',
      },
      {
        id: 'fresh',
        label: '최근 1Y 리포트',
        value: `${(latest?.freshCount ?? 0).toLocaleString('ko-KR')}개`,
        helper: '선택일 기준 발간 365일 이내',
        tone: 'neutral',
      },
      {
        id: 'momentum',
        label: '추세 통과',
        value: `${(latest?.momentumCount ?? 0).toLocaleString('ko-KR')}개`,
        helper: '20·50·200MA 상회',
        tone: 'positive',
      },
      {
        id: 'near-high',
        label: '고점 근처',
        value: `${(latest?.nearHighCount ?? 0).toLocaleString('ko-KR')}개`,
        helper: '52주 고점 -10% 이내',
        tone: 'accent',
      },
      {
        id: 'forward-3m',
        label: '현재까지 상승',
        value: latestPositiveShare === null ? '사후 가격 없음' : formatPercent(latestPositiveShare),
        helper:
          latest && latest.forwardPositiveLatestSample > 0
            ? `${latest.forwardPositiveLatestSample.toLocaleString('ko-KR')}개 후보`
            : latest && latest.maxForwardObservedDays > 0
              ? `최대 ${latest.maxForwardObservedDays.toLocaleString('ko-KR')}거래일 관측`
              : '아직 사후 가격 없음',
        tone: latestPositiveShare === null ? 'neutral' : latestPositiveShare >= 0.5 ? 'positive' : 'warning',
      },
    ],
    latestDate,
    dates: artifact.date_summaries,
    rows: artifact.table.rows,
  };
}
