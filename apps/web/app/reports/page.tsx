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
      <section className="hero-summary">
        <div className="hero-summary__lede">
          <span className="hero-summary__eyebrow">Research archive</span>
          <h1 className="display-1">SMIC 리포트의 사후 적중률과 가격 경로</h1>
          <p className="hero-summary__sub">
            SMIC가 발행한 모든 리포트의 발간 시점 목표가, 발간 이후 실제
            가격 경로, 도달 여부를 정량 지표로 제공합니다. 상단의 핵심
            지표 이후 표 단위로 행마다 깊이 검토할 수 있습니다.
          </p>
          <div className="hero-summary__signals">
            <span>리포트 {reports.length}건</span>
            <span>최신 발간일 {latestDate || '—'}</span>
            <span>중앙 목표 도달일 {formatDays(overview.target_stats?.median_days_to_target)}</span>
          </div>
        </div>
        <div className="hero-summary__kpis">
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
      </section>

      <Section
        eyebrow="Highlights"
        title="분포의 양 끝 — 최고 수익, 최저 수익, 최대 업사이드"
        caption="평균 지표만으로는 가려지는 꼬리 사례를 먼저 보여줍니다. 사후 검증의 강한 신호와 약한 신호가 모두 여기에 노출됩니다."
      >
        <div className="grid two-col">
          <RankingPanel title="가장 수익이 큰 리포트" rows={rankings.top_winners ?? []} metric="current" tone="good" />
          <RankingPanel title="가장 손실이 큰 리포트" rows={rankings.top_losers ?? []} metric="current" tone="bad" />
        </div>
        <div style={{ marginTop: '1rem' }}>
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
    <article className="panel">
      <h3>{title}</h3>
      <div className="table-wrap" style={{ marginTop: '.65rem' }}>
        <table>
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
                    <Link href={`/reports/${row.symbol}`}>{row.company || row.symbol}</Link>
                    <div className="muted" style={{ fontFamily: 'var(--mono)', fontSize: '.7rem' }}>{row.symbol}</div>
                  </td>
                  <td>{row.publication_date ?? row.date ?? '—'}</td>
                  <td className={(value ?? 0) >= 0 ? 'good' : 'bad'} style={{ fontWeight: 700 }}>
                    {formatPercent(value)}
                  </td>
                  <td>{formatKrw(row.target_price_krw)}</td>
                  <td>
                    {(row.target_upside_at_pub ?? 0) <= 0 ? (
                      <span className="pill tone-warn">비실행</span>
                    ) : row.target_hit ? (
                      <span className={`pill tone-${tone === 'bad' ? 'bad' : 'good'}`}>도달</span>
                    ) : (
                      <span className="pill tone-accent">진행</span>
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
