import { ReportsTable } from '@/components/reports/ReportsTable';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getDataQuality, getOverview, getReportRows } from '@/lib/artifacts';
import { buildReportStats, getResearchCandidates } from '@/lib/product-model';
import { formatDateKo, formatDays, formatPercent } from '@/lib/format';

export default function ReportsPage() {
  const reports = getReportRows();
  const overview = getOverview();
  const quality = getDataQuality();
  const stats = buildReportStats(reports);
  const candidates = getResearchCandidates();
  const extractedReports = overview.report_counts?.extracted_reports ?? quality.extractedReports;
  const visibleReports = overview.report_counts?.web_report_rows ?? stats.total;
  const excludedReports =
    overview.report_counts?.excluded_reports ??
    quality.reportExclusions.excluded_reports ??
    Math.max(0, extractedReports - visibleReports);
  const excludedShare = extractedReports > 0 ? excludedReports / extractedReports : null;

  return (
    <>
      <PageHero
        eyebrow="리포트 검증"
        title="리포트 검증"
        subtitle="발간 이후 가격 경로, 목표가 진행률, 제외 사유를 같은 기준으로 검증합니다."
        badges={[
          { label: '리포트', value: `${stats.total}건` },
          { label: '최신 발간', value: formatDateKo(stats.latestPublicationDate) },
          { label: '활성 후보', value: `${candidates.length}개` },
          { label: '중앙 도달일', value: formatDays(stats.medianDaysToTarget) },
          { label: '제외', value: `${excludedReports}건` },
        ]}
        actions={
          <>
            <Button asChild size="sm">
              <Link href="/reports/validation">검증 방법 자세히 보기</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/screener">후보만 보기</Link>
            </Button>
          </>
        }
      />

      <Section
        eyebrow="검증 표"
        title="리포트 통합 테이블"
        caption={`전체 ${extractedReports.toLocaleString('ko-KR')}건 중 ${visibleReports.toLocaleString('ko-KR')}건을 같은 기준으로 비교합니다. 제외 표본 ${excludedReports.toLocaleString('ko-KR')}건${excludedShare === null ? '' : `(${formatPercent(excludedShare)})`}의 세부 사유와 목표가 검증 공식은 별도 페이지에서 설명합니다.`}
      >
        <ReportsTable reports={reports} />
      </Section>
    </>
  );
}
