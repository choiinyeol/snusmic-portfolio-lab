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
        badges={[
          { label: '리포트', value: `${stats.total}건` },
          { label: '최신 발간', value: formatDateKo(stats.latestPublicationDate) },
          { label: '활성 후보', value: `${candidates.length}개` },
          { label: '중앙 도달일', value: formatDays(stats.medianDaysToTarget) },
          {
            label: '제외',
            value: `${excludedReports}건${excludedShare === null ? '' : ` (${formatPercent(excludedShare)})`}`,
          },
        ]}
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/statistics">통계 보기</Link>
          </Button>
        }
      />

      <Section eyebrow="검증 표" title="리포트 통합 테이블">
        <ReportsTable reports={reports} />
      </Section>
    </>
  );
}
