import { RankingTabs } from '@/components/reports/RankingTabs';
import { ReportsTable } from '@/components/reports/ReportsTable';
import { KpiTile } from '@/components/ui/KpiTile';
import { Section } from '@/components/ui/Section';
import { getOverview, getReportRows } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';

export default function ReportsPage() {
  const reports = getReportRows();
  const overview = getOverview();
  const targetHitCount = reports.filter((report) => report.targetHit).length;
  const positiveReturnCount = reports.filter((report) => (report.currentReturn ?? -Infinity) >= 0).length;
  const latestDate = reports.reduce((latest, report) => (report.publicationDate > latest ? report.publicationDate : latest), '');

  return (
    <>
      <section className="hero overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="hero-content grid w-full max-w-none gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(360px,.9fr)] md:p-8">
          <div className="grid min-w-0 content-center gap-4">
            <span className="badge badge-primary badge-soft w-fit tracking-[0.16em]">RESEARCH ARCHIVE</span>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.06em] text-base-content md:text-6xl">SMIC 리포트는 실제 가격으로 검증됩니다.</h1>
            <p className="max-w-3xl text-lg leading-8 text-base-content/70">
              발간 시점의 목표가, 이후 가격 경로, 목표 도달 여부를 한 화면에서 비교합니다.
              리포트 아카이브가 아니라 사후 성과를 검토하는 검증 화면입니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-ghost">리포트 {reports.length}건</span>
              <span className="badge badge-ghost">최신 발간일 {latestDate || '—'}</span>
              <span className="badge badge-ghost">중앙 목표 도달일 {formatDays(overview.target_stats?.median_days_to_target)}</span>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <KpiTile
              label="목표가 적중률"
              value={<span className="display-num">{formatPercent(targetHitCount / Math.max(1, reports.length))}</span>}
              delta={`${targetHitCount.toLocaleString('ko-KR')}건 / ${reports.length.toLocaleString('ko-KR')}건`}
              tone="good"
              emphasis
            />
            <KpiTile
              label="현재 플러스"
              value={<span className="display-num">{positiveReturnCount.toLocaleString('ko-KR')}</span>}
              delta={formatPercent(positiveReturnCount / Math.max(1, reports.length))}
              tone="accent"
            />
            <KpiTile
              label="평균 현재 수익률"
              value={<span className="display-num">{formatPercent(overview.target_stats?.avg_current_return)}</span>}
              delta={`중앙값 ${formatPercent(overview.target_stats?.median_current_return)}`}
            />
            <KpiTile
              label="평균 목표 도달"
              value={<span className="display-num">{formatDays(overview.target_stats?.avg_days_to_target)}</span>}
              delta={`중앙값 ${formatDays(overview.target_stats?.median_days_to_target)}`}
            />
          </div>
        </div>
      </section>

      <Section
        eyebrow="Rankings"
        title="오늘 먼저 봐야 할 리포트"
        caption="최근 발간, 목표 도달, 현재 수익 상위, 잔여 업사이드, 리스크 플래그까지 다섯 관점에서 정렬합니다."
      >
        <RankingTabs reports={reports} />
      </Section>

      <Section
        eyebrow="Archive"
        title="리포트 전체 표"
        caption="기업/심볼 검색, 거래소 및 목표 달성 여부 필터, 열 단위 정렬, CSV 내려받기를 지원합니다."
      >
        <ReportsTable reports={reports} />
      </Section>
    </>
  );
}
