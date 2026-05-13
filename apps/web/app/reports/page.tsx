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
  const excludedReports = Math.max(0, extractedReports - visibleReports);
  const priceMatchedReports = overview.report_counts?.price_matched_reports ?? visibleReports;
  const priceMatchRate = extractedReports > 0 ? priceMatchedReports / extractedReports : null;
  const nonBuyRatingCount = extractionSummaryNumber(quality.extractionQuality, 'non_buy_rating');
  const sellOpinionCount = extractionRatingCount(quality.extractionQuality, 'Sell');

  return (
    <>
      <PageHero
        eyebrow="REPORTS"
        title="Reports — 리포트 검증"
        subtitle="발간 후 가격 경로, 목표가 진행률, 적중/실패 상태를 검증합니다."
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
              delta={`가격 없음 ${quality.missingPriceSymbols}종목 · 매도/중립 ${nonBuyRatingCount}건 · Sell ${sellOpinionCount}건`}
              tone="warn"
            />
          </div>
        }
      />

      <Section
        eyebrow="Reports Table"
        title="리포트 통합 테이블"
        caption="관심별 정렬은 같은 컬럼을 공유하고, 정렬·필터 프리셋만 바꿉니다. 표는 항상 검색, 정렬, 필터, 페이지네이션을 제공합니다."
      >
        <ReportsTable reports={reports} />
      </Section>
    </>
  );
}

function extractionSummaryNumber(extractionQuality: Record<string, unknown>, key: string): number {
  const summary = extractionQuality.summary;
  if (!summary || typeof summary !== 'object') return 0;
  const value = (summary as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function extractionRatingCount(extractionQuality: Record<string, unknown>, key: string): number {
  const counts = extractionQuality.rating_counts;
  if (!counts || typeof counts !== 'object') return 0;
  const value = (counts as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
