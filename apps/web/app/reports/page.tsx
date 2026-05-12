import { RankingTabs } from '@/components/reports/RankingTabs';
import { ReportsTable } from '@/components/reports/ReportsTable';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getOverview, getReportRows } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';

export default function ReportsPage() {
  const reports = getReportRows();
  const overview = getOverview();
  const targetHitCount = reports.filter((report) => report.targetHit).length;
  const positiveReturnCount = reports.filter((report) => (report.currentReturn ?? -Infinity) >= 0).length;
  const latestDate = reports.reduce(
    (latest, report) => (report.publicationDate > latest ? report.publicationDate : latest),
    '',
  );

  return (
    <>
      <PageHero
        eyebrow="RESEARCH"
        title="리서치 — 리포트 성과"
        badges={[
          { label: '리포트', value: `${reports.length}건` },
          { label: '최신 발간', value: latestDate || '—' },
          { label: '중앙 도달일', value: formatDays(overview.target_stats?.median_days_to_target) },
        ]}
        kpis={
          <div className="grid min-w-0 gap-3 min-[1400px]:grid-cols-2">
            <KpiTile
              label="목표가 적중률"
              value={formatPercent(targetHitCount / Math.max(1, reports.length))}
              delta={`${targetHitCount}건 / ${reports.length}건`}
              tone="good"
            />
            <KpiTile
              label="현재 플러스"
              value={positiveReturnCount.toLocaleString('ko-KR')}
              delta={formatPercent(positiveReturnCount / Math.max(1, reports.length))}
              tone="accent"
            />
            <KpiTile
              label="평균 현재 수익률"
              value={formatPercent(overview.target_stats?.avg_current_return)}
              delta={`중앙값 ${formatPercent(overview.target_stats?.median_current_return)}`}
            />
            <KpiTile
              label="평균 목표 도달"
              value={formatDays(overview.target_stats?.avg_days_to_target)}
              delta={`중앙값 ${formatDays(overview.target_stats?.median_days_to_target)}`}
            />
          </div>
        }
      />

      <Section eyebrow="Rankings" title="관점별 정렬">
        <RankingTabs reports={reports} />
      </Section>

      <Section eyebrow="Archive" title="전체 표">
        <ReportsTable reports={reports} />
      </Section>
    </>
  );
}
