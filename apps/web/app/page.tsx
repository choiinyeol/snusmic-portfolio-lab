import Link from 'next/link';
import { KpiTile } from '@/components/ui/KpiTile';
import { Section } from '@/components/ui/Section';
import { Sparkline } from '@/components/ui/Sparkline';
import {
  getCurrentHoldings,
  getEquityDaily,
  getLatestReportTargetsBySymbol,
  getOverview,
  getPersonaLabel,
  getReportRows,
  getSummaryRows,
  type HoldingRow,
  type ReportRow,
  type SummaryRow,
} from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';

const PERSONA_PRIMARY = 'smic_follower_v2';

export default function DashboardPage() {
  const personas = getSummaryRows();
  const reports = getReportRows();
  const holdings = getCurrentHoldings()
    .filter((row) => row.persona === PERSONA_PRIMARY)
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  const targets = getLatestReportTargetsBySymbol();
  const equity = getEquityDaily();
  const overview = getOverview();

  const persona = personas.find((row) => row.persona === PERSONA_PRIMARY);
  const portfolio = summarizeHoldings(holdings);
  const equitySpark = sparkPoints(equity, PERSONA_PRIMARY);
  const lastUpdated = equityLatestDate(equity) ?? overview.simulation_window?.report_end ?? null;
  const newestReports = [...reports]
    .filter((report) => report.publicationDate)
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
    .slice(0, 6);
  const verdict = strategyVerdict(personas);

  return (
    <>
      <section className="hero-summary">
        <div className="hero-summary__lede">
          <span className="hero-summary__eyebrow">Quant Terminal</span>
          <h1 className="display-1">SMIC 리서치 기반 매매 시스템의 정량적 검증</h1>
          <p className="hero-summary__sub">
            SMIC follower 시리즈와 단순 4자산 all-weather 기준선의 누적 손익,
            보유 구성, 리스크 지표를 동일 데이터로 비교합니다. 모든 수치는
            커밋된 정적 아티팩트에서 직접 산출되며, 실시간 거래나 외부
            호출은 수반되지 않습니다.
          </p>
          <div className="hero-summary__signals">
            <span>스냅샷 기준일 {lastUpdated ?? '—'}</span>
            <span>보유 종목 {holdings.length}</span>
            <span>리포트 {reports.length}건</span>
            <span>전략 {personas.length}개</span>
          </div>
          <div className="action-row" style={{ marginTop: '.6rem' }}>
            <Link className="button-link" href="/portfolio">포트폴리오 분석</Link>
            <Link className="button-link secondary" href="/reports">리포트 아카이브</Link>
          </div>
        </div>
        <div className="hero-summary__kpis">
          <KpiTile
            label="현재 평가액"
            value={<span className="display-num">{formatKrw(portfolio.marketValue)}</span>}
            caption={`상위 5종목 집중도 ${formatPercent(portfolio.top5Weight)}`}
            tone="accent"
            emphasis
          >
            <Sparkline values={equitySpark} height={36} tone="accent" />
          </KpiTile>
          <KpiTile
            label="미실현 손익"
            value={<span className="display-num">{formatKrw(portfolio.unrealizedPnl)}</span>}
            delta={formatPercent(portfolio.unrealizedReturn)}
            tone={portfolio.unrealizedPnl >= 0 ? 'good' : 'bad'}
          />
          <KpiTile
            label="전략 누적 수익률 (MWR)"
            value={<span className="display-num">{formatPercent(persona?.moneyWeightedReturn ?? persona?.irr)}</span>}
            delta={`MDD ${formatPercent(persona?.maxDrawdown)}`}
            tone={(persona?.moneyWeightedReturn ?? 0) >= 0 ? 'good' : 'bad'}
          />
          <KpiTile
            label="리포트 목표 적중"
            value={<span className="display-num">{formatPercent(overview.target_stats?.target_hit_rate)}</span>}
            delta={`${overview.target_stats?.target_hit_count ?? 0}건 도달`}
            tone="good"
          />
        </div>
      </section>

      <Section
        eyebrow="Open positions"
        title="현재 보유 상위 종목"
        caption="평가금 기준 상위 6종목. 각 카드는 해당 종목의 리포트 근거 페이지로 연결됩니다."
        actions={<Link className="terminal-link" href="/portfolio">전체 보유 보기</Link>}
      >
        <div className="holdings-strip">
          {holdings.slice(0, 6).map((row) => (
            <Link
              key={row.symbol}
              href={`/reports/${row.symbol}`}
              className="holdings-strip__cell"
              title={`${row.company || row.symbol}`}
            >
              <span className="name">{row.company || row.symbol}</span>
              <span className="symbol">{row.symbol}</span>
              <span className="value">{formatKrw(row.marketValueKrw)}</span>
              <span className={`ret ${(row.unrealizedReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>
                {formatPercent(row.unrealizedReturn)} · 비중 {formatPercent(weight(row, portfolio.marketValue))}
              </span>
            </Link>
          ))}
          {!holdings.length ? <p className="muted">현재 보유 포지션이 없습니다.</p> : null}
        </div>
      </Section>

      <Section
        eyebrow="Latest research"
        title="최근 발간 리포트"
        caption="발간일 기준 최신 6건과 발간 이후 가격 경로의 사후 평가를 함께 보여줍니다."
        actions={<Link className="terminal-link" href="/reports">전체 아카이브</Link>}
      >
        <div className="reports-strip">
          {newestReports.map((report) => (
            <Link key={report.symbol + report.publicationDate} href={`/reports/${report.symbol}`} className="report-card">
              <span className="report-card__date">{report.publicationDate || '—'}</span>
              <strong className="report-card__title">{report.company || report.symbol}</strong>
              <span className="report-card__symbol">{report.symbol}</span>
              <div className="report-card__line">
                <span className="muted" style={{ fontSize: '.78rem' }}>현재 수익률</span>
                <span className={`report-card__metric ${(report.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}`}>
                  {formatPercent(report.currentReturn)}
                </span>
              </div>
              <div className="report-card__line">
                <span className="muted" style={{ fontSize: '.78rem' }}>목표가까지</span>
                <span className="report-card__metric">{formatPercent(targetGap(report.lastCloseKrw, targets[report.symbol]?.targetPriceKrw))}</span>
              </div>
              {targetUpsidePill(report)}
            </Link>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Strategy validation"
        title="기준선 대비 SMIC follower의 위치"
        caption="단순 4자산 all-weather와 v1을 기준선으로 두고, v2가 손절 규칙을 통해 만든 손익·낙폭의 차이를 비교합니다."
        actions={<Link className="terminal-link" href="/strategies">전략 리더보드</Link>}
      >
        <article className="verdict-card">
          <div className="verdict-card__head">
            <span className={`verdict-pill ${verdict.tone}`}>{verdict.headline}</span>
            <h3 className="verdict-card__title">{verdict.summary}</h3>
          </div>
          <p className="verdict-card__detail">{verdict.detail}</p>
          <div className="verdict-card__rows">
            {personas
              .filter((row) => ['smic_follower_v2', 'smic_follower', 'all_weather'].includes(row.persona))
              .map((row) => (
                <div className="verdict-card__row" key={row.persona}>
                  <strong>{row.label || row.persona}</strong>
                  <span>누적 손익 <b>{formatKrw(row.netProfitKrw)}</b></span>
                  <span>MWR <b>{formatPercent(row.moneyWeightedReturn ?? row.irr)}</b></span>
                  <span>MDD <b>{formatPercent(row.maxDrawdown)}</b></span>
                </div>
              ))}
          </div>
        </article>
      </Section>
    </>
  );
}

function summarizeHoldings(rows: HoldingRow[]) {
  const marketValue = rows.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const unrealizedPnl = rows.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const cost = marketValue - unrealizedPnl;
  const top5 = rows.slice(0, 5).reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  return {
    marketValue,
    unrealizedPnl,
    unrealizedReturn: cost > 0 ? unrealizedPnl / cost : null,
    top5Weight: marketValue > 0 ? top5 / marketValue : null,
  };
}

function weight(row: HoldingRow, total: number): number | null {
  if (!total) return null;
  return (row.marketValueKrw ?? 0) / total;
}

function targetGap(current: number | null | undefined, target: number | null | undefined): number | null {
  if (!current || !target || current <= 0) return null;
  return target / current - 1;
}

function targetUpsidePill(report: ReportRow) {
  if ((report.targetUpsideAtPub ?? 0) <= 0) return <span className="report-card__pill skip">목표가 비실행</span>;
  if (report.targetHit) return <span className="report-card__pill hit">목표 도달</span>;
  return <span className="report-card__pill open">진행 중</span>;
}

function sparkPoints(equity: ReturnType<typeof getEquityDaily>, persona: string): number[] {
  const series = equity
    .filter((point) => point.persona === persona && point.cumulativeReturn !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => point.cumulativeReturn ?? 0);
  return series.slice(-90);
}

function equityLatestDate(equity: ReturnType<typeof getEquityDaily>): string | null {
  return equity.reduce<string | null>((latest, point) => (point.date > (latest ?? '') ? point.date : latest), null);
}

function strategyVerdict(personas: SummaryRow[]) {
  const v2 = personas.find((row) => row.persona === 'smic_follower_v2');
  const v1 = personas.find((row) => row.persona === 'smic_follower');
  const aw = personas.find((row) => row.persona === 'all_weather');
  const v2Return = v2?.moneyWeightedReturn ?? v2?.irr ?? null;
  const awReturn = aw?.moneyWeightedReturn ?? aw?.irr ?? null;
  const v1Return = v1?.moneyWeightedReturn ?? v1?.irr ?? null;
  const beatsAw = v2Return !== null && awReturn !== null && v2Return > awReturn;
  const beatsV1 = v2Return !== null && v1Return !== null && v2Return > v1Return;
  if (beatsAw && beatsV1) {
    return {
      tone: 'good' as const,
      headline: '검증 신호',
      summary: 'v2의 MWR이 기준선과 v1을 모두 상회합니다.',
      detail: `v2 MWR ${formatPercent(v2Return)}는 all-weather ${formatPercent(awReturn)}와 v1 ${formatPercent(v1Return)}를 동시에 상회합니다. 다만 표본이 한정적이며 거래 비용과 최대 낙폭을 함께 검토할 필요가 있습니다.`,
    };
  }
  if (beatsAw) {
    return {
      tone: 'warn' as const,
      headline: '부분 신호',
      summary: '기준선은 상회하지만 v1 대비 개선 폭은 제한적입니다.',
      detail: `v2의 MWR이 all-weather ${formatPercent(awReturn)}는 상회하나 v1 ${formatPercent(v1Return)} 대비 개선 폭은 좁습니다. 손절 규칙의 기여가 수익률보다 위험 통제 측면에 있는지 점검이 필요합니다.`,
    };
  }
  return {
    tone: 'bad' as const,
    headline: '재검토 필요',
    summary: '기준선 대비 통계적 우위가 확보되지 않았습니다.',
    detail: `v2 MWR ${formatPercent(v2Return)}가 all-weather ${formatPercent(awReturn)}를 안정적으로 상회한다고 보기 어렵습니다. 리포트 선택 기준과 청산 규칙의 재검토가 권장됩니다.`,
  };
}
