import Link from 'next/link';
import { ReportsTable } from '@/components/reports/ReportsTable';
import { KpiTile } from '@/components/ui/KpiTile';
import { Section } from '@/components/ui/Section';
import { getOverview, getReportRankings, getReportRows, type WebReportRankingRow } from '@/lib/artifacts';
import { formatDays, formatKrw, formatPercent } from '@/lib/format';

export default function ReportsPage() {
  const reports = getReportRows();
  const rankings = getReportRankings();
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
        eyebrow="Highlights"
        title="분포의 양 끝 — 최고 수익, 최저 수익, 최대 업사이드"
        caption="평균 지표만으로는 가려지는 꼬리 사례를 먼저 보여줍니다. 사후 검증의 강한 신호와 약한 신호가 모두 여기에 노출됩니다."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <RankingPanel title="가장 수익이 큰 리포트" rows={rankings.top_winners ?? []} metric="current" tone="good" />
          <RankingPanel title="가장 손실이 큰 리포트" rows={rankings.top_losers ?? []} metric="current" tone="bad" />
        </div>
        <div className="mt-4">
          <RankingPanel title="가장 공격적인 목표가 (제시 업사이드)" rows={rankings.most_aggressive_targets ?? []} metric="upside" tone="warn" />
        </div>
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

function RankingPanel({
  title,
  rows,
  metric,
  tone,
}: {
  title: string;
  rows: WebReportRankingRow[];
  metric: 'current' | 'upside';
  tone: 'good' | 'bad' | 'warn' | 'accent';
}) {
  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-5">
        <h3 className="card-title">{title}</h3>
      </div>
      <div className="overflow-x-auto border-t border-base-300">
        <table className="table table-sm table-zebra">
          <thead>
            <tr>
              <th>회사</th>
              <th>발간일</th>
              <th>{metric === 'current' ? '현재 수익률' : '제시 업사이드'}</th>
              <th>목표가</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row) => {
              const value = metric === 'current' ? row.current_return : row.target_upside_at_pub;
              return (
                <tr key={row.report_id}>
                  <td>
                    <Link className="link link-hover font-bold" href={`/reports/${row.symbol}`}>{row.company || row.symbol}</Link>
                    <div className="mt-1 font-mono text-xs text-base-content/50">{row.symbol}</div>
                  </td>
                  <td>{row.publication_date ?? row.date ?? '—'}</td>
                  <td className={(value ?? 0) >= 0 ? 'text-success font-bold' : 'text-error font-bold'}>
                    {formatPercent(value)}
                  </td>
                  <td>{formatKrw(row.target_price_krw)}</td>
                  <td>
                    {(row.target_upside_at_pub ?? 0) <= 0 ? (
                      <span className="badge badge-warning badge-soft badge-sm">비실행</span>
                    ) : row.target_hit ? (
                      <span className={`badge badge-soft badge-sm ${tone === 'bad' ? 'badge-error' : 'badge-success'}`}>도달</span>
                    ) : (
                      <span className="badge badge-primary badge-soft badge-sm">진행</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
