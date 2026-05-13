import { ReportsTable } from '@/components/reports/ReportsTable';
import { KpiTile } from '@/components/ui/KpiTile';
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
  const priceMatchedReports = overview.report_counts?.price_matched_reports ?? visibleReports;
  const priceMatchRate = extractedReports > 0 ? priceMatchedReports / extractedReports : null;
  const missingPriceRows =
    overview.report_counts?.excluded_missing_price ?? quality.reportExclusions.missing_price ?? 0;
  const sellOpinionRows = overview.report_counts?.excluded_sell_opinion ?? quality.reportExclusions.sell_opinion ?? 0;
  const nonExecutableRows =
    (overview.report_counts?.excluded_non_positive_upside ?? quality.reportExclusions.non_positive_upside ?? 0) +
    (overview.report_counts?.excluded_downside_target ?? quality.reportExclusions.downside_target ?? 0) +
    (overview.report_counts?.excluded_instant_target_hit ?? quality.reportExclusions.instant_target_hit ?? 0);

  return (
    <>
      <PageHero
        eyebrow="Report Validation"
        title="리포트 검증"
        subtitle="발간 이후 가격 경로, 목표가 진행률, 제외 사유를 같은 기준으로 검증합니다."
        badges={[
          { label: '리포트', value: `${stats.total}건` },
          { label: '최신 발간', value: formatDateKo(stats.latestPublicationDate) },
          { label: '활성 후보', value: `${candidates.length}개` },
          { label: '중앙 도달일', value: formatDays(stats.medianDaysToTarget) },
          { label: '제외', value: `${excludedReports}건` },
        ]}
        kpis={
          <div className="grid min-w-0 gap-3 min-[1400px]:grid-cols-2">
            <KpiTile
              label="목표가 적중률"
              value={formatPercent(stats.targetHitRate)}
              delta={`${stats.hitCount}건 / ${stats.total}건`}
              tone="good"
            />
            <KpiTile
              label="현재 플러스"
              value={stats.positiveReturnCount.toLocaleString('ko-KR')}
              delta={formatPercent(stats.positiveReturnRate)}
              tone="accent"
            />
            <KpiTile
              label="평균 현재 수익률"
              value={formatPercent(stats.averageCurrentReturn)}
              delta={`중앙값 ${formatPercent(stats.medianCurrentReturn)}`}
            />
            <KpiTile
              label="평균 목표 도달"
              value={formatDays(overview.target_stats?.avg_days_to_target)}
              delta={`중앙값 ${formatDays(stats.medianDaysToTarget)}`}
            />
            <KpiTile
              label="평균 목표 진행"
              value={formatPercent(stats.averageTargetProgress)}
              delta="현재가-진입가 / 목표가-진입가"
              tone="accent"
            />
            <KpiTile
              label="가격 매칭률"
              value={formatPercent(priceMatchRate)}
              delta={`${priceMatchedReports}건 / 전체 ${extractedReports}건`}
              tone="neutral"
            />
            <KpiTile
              label="검증 제외"
              value={`${excludedReports.toLocaleString('ko-KR')}건`}
              delta={`가격 없음 ${missingPriceRows}건 · 매도 의견 ${sellOpinionRows}건 · 비실행 ${nonExecutableRows}건`}
              tone="warn"
            />
          </div>
        }
      />

      <Section
        eyebrow="Validation Table"
        title="리포트 통합 테이블"
        caption={`가격 없음·매도 의견·상장 직후 목표 도달처럼 사후 검증이 어려운 ${excludedReports.toLocaleString('ko-KR')}건은 제외하고, 같은 컬럼 테이블에서 정렬·필터 프리셋만 바꿉니다.`}
      >
        <ReportsTable reports={reports} />
      </Section>
    </>
  );
}
