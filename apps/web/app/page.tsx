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
  type EquityPoint,
  type HoldingRow,
  type ReportRow,
  type SummaryRow,
} from '@/lib/artifacts';
import { formatDateKo, formatKrw, formatNativeWithKrw, formatPercent } from '@/lib/format';

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
    .slice(0, 5);
  const verdict = strategyVerdict(personas);
  const trend = trendSnapshot(equity, holdings, persona);
  const overseasCount = holdings.filter((row) => row.currency && row.currency !== 'KRW').length;

  return (
    <>
      <section className="v2-hero" aria-labelledby="dashboard-title">
        <div className="v2-hero__main">
          <div className="v2-hero__eyebrow">SNUSMIC Portfolio v2</div>
          <h1 id="dashboard-title">오늘은 이 4가지만 보면 됩니다.</h1>
          <p>
            SMIC 리포트 기반 포트폴리오를 투자 앱처럼 요약했습니다. 현재 계좌 상태,
            추세 추종 신호, 리스크, 최근 리포트만 먼저 보여주고 상세 원장은 뒤로 숨겼습니다.
          </p>
          <div className="v2-hero__actions" aria-label="주요 페이지 이동">
            <Link className="button-link" href="/portfolio">보유 종목 보기</Link>
            <Link className="button-link secondary" href="/strategies">전략 검증</Link>
            <Link className="button-link ghost" href="/reports">리포트 탐색</Link>
          </div>
          <dl className="v2-snapshot-meta" aria-label="데이터 스냅샷">
            <div><dt>기준일</dt><dd>{formatDateKo(lastUpdated)}</dd></div>
            <div><dt>보유</dt><dd>{holdings.length}종목</dd></div>
            <div><dt>외화</dt><dd>{overseasCount}종목</dd></div>
            <div><dt>전략</dt><dd>{getPersonaLabel(PERSONA_PRIMARY)}</dd></div>
          </dl>
        </div>

        <div className="account-card" aria-label="현재 계좌 핵심 지표">
          <div className="account-card__topline">
            <span>평가금액</span>
            <span className={`signal-dot signal-dot--${trend.tone}`} />
          </div>
          <div className="account-card__value">{formatKrw(portfolio.marketValue)}</div>
          <div className={`account-card__pnl ${portfolio.unrealizedPnl >= 0 ? 'good' : 'bad'}`}>
            {formatKrw(portfolio.unrealizedPnl)} · {formatPercent(portfolio.unrealizedReturn)}
          </div>
          <Sparkline values={equitySpark} height={54} tone={trend.tone === 'bad' ? 'bad' : trend.tone === 'good' ? 'good' : 'accent'} />
          <div className="account-card__grid">
            <div><span>MWR</span><strong>{formatPercent(persona?.moneyWeightedReturn ?? persona?.irr)}</strong></div>
            <div><span>MDD</span><strong>{formatPercent(persona?.maxDrawdown)}</strong></div>
            <div><span>집중도</span><strong>{formatPercent(portfolio.top5Weight)}</strong></div>
            <div><span>목표 적중</span><strong>{formatPercent(overview.target_stats?.target_hit_rate)}</strong></div>
          </div>
        </div>
      </section>

      <section className="decision-grid" aria-label="오늘의 투자 판단 요약">
        <KpiTile label="추세 추종 모드" value={trend.mode} delta={trend.caption} tone={trend.tone} emphasis />
        <KpiTile label="90일 계좌 모멘텀" value={<span>{formatPercent(trend.return90d)}</span>} delta={`120일 ${formatPercent(trend.return120d)}`} tone={(trend.return90d ?? 0) >= 0 ? 'good' : 'bad'} />
        <KpiTile label="상승 포지션 비율" value={<span>{formatPercent(trend.positiveBreadth)}</span>} delta={`${trend.positiveCount}/${holdings.length} 종목 플러스`} tone={(trend.positiveBreadth ?? 0) >= 0.5 ? 'good' : 'warn'} />
        <KpiTile label="고점 대비 낙폭" value={<span>{formatPercent(trend.currentDrawdown)}</span>} delta="최근 계좌 수익률 기준" tone={(trend.currentDrawdown ?? 0) > -0.1 ? 'good' : 'bad'} />
      </section>

      <Section
        eyebrow="Positions"
        title="외화는 외화로, 원화는 보조로"
        caption="해외 자산은 USD·JPY 등 현지 통화를 우선 표시하고 원화 환산액은 작게 붙였습니다. 투자자가 실제 시장 가격을 바로 인지할 수 있게 했습니다."
        actions={<Link className="terminal-link" href="/portfolio">전체 원장</Link>}
      >
        <div className="asset-list">
          {holdings.slice(0, 6).map((row, index) => {
            const display = holdingValueDisplay(row);
            const target = targets[row.symbol];
            return (
              <Link key={row.symbol} href={`/reports/${row.symbol}`} className="asset-row">
                <div className="asset-row__rank">{String(index + 1).padStart(2, '0')}</div>
                <div className="asset-row__name">
                  <strong>{row.company || row.symbol}</strong>
                  <span>{row.symbol} · {row.currency || 'KRW'}</span>
                </div>
                <div className="asset-row__price">
                  <strong>{display.primary}</strong>
                  {display.secondary ? <span>{display.secondary}</span> : null}
                </div>
                <div className="asset-row__signal">
                  <span className={(row.unrealizedReturn ?? 0) >= 0 ? 'good' : 'bad'}>{formatPercent(row.unrealizedReturn)}</span>
                  <small>목표까지 {formatPercent(targetGap(row.lastCloseKrw, target?.targetPriceKrw))}</small>
                </div>
              </Link>
            );
          })}
          {!holdings.length ? <p className="muted">현재 보유 포지션이 없습니다.</p> : null}
        </div>
      </Section>

      <div className="v2-two-column">
        <Section
          eyebrow="Research"
          title="최근 리포트 — 행동 신호만"
          caption="최신 발간 순으로 현재 수익률, 목표까지 남은 거리, 실행 상태만 압축했습니다."
          actions={<Link className="terminal-link" href="/reports">전체 리포트</Link>}
        >
          <div className="brief-feed">
            {newestReports.map((report) => (
              <Link key={report.symbol + report.publicationDate} href={`/reports/${report.symbol}`} className="brief-item">
                <div>
                  <span className="brief-item__date">{formatDateKo(report.publicationDate)}</span>
                  <strong>{report.company || report.symbol}</strong>
                  <small>{report.symbol}</small>
                </div>
                <div className="brief-item__metrics">
                  <span className={(report.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}>{formatPercent(report.currentReturn)}</span>
                  {targetUpsidePill(report)}
                </div>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Validation"
          title="전략 평결"
          caption="추세 추종 모델은 수익률만 보지 않고 기준선 대비 우위와 낙폭을 같이 봐야 합니다."
          actions={<Link className="terminal-link" href="/strategies">리더보드</Link>}
        >
          <article className="verdict-card verdict-card--compact">
            <span className={`verdict-pill ${verdict.tone}`}>{verdict.headline}</span>
            <h3 className="verdict-card__title">{verdict.summary}</h3>
            <p className="verdict-card__detail">{verdict.detail}</p>
            <div className="mini-scoreboard">
              {personas
                .filter((row) => ['smic_follower_v2', 'all_weather'].includes(row.persona))
                .map((row) => (
                  <div key={row.persona}>
                    <span>{row.label || row.persona}</span>
                    <strong>{formatPercent(row.moneyWeightedReturn ?? row.irr)}</strong>
                    <small>MDD {formatPercent(row.maxDrawdown)}</small>
                  </div>
                ))}
            </div>
          </article>
        </Section>
      </div>
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

function holdingValueDisplay(row: HoldingRow): { primary: string; secondary: string | null } {
  const nativeMarketValue = row.lastCloseNative !== null && row.qty !== null ? row.lastCloseNative * row.qty : null;
  return formatNativeWithKrw(nativeMarketValue, row.marketValueKrw, row.currency);
}

function targetGap(current: number | null | undefined, target: number | null | undefined): number | null {
  if (!current || !target || current <= 0) return null;
  return target / current - 1;
}

function targetUpsidePill(report: ReportRow) {
  if ((report.targetUpsideAtPub ?? 0) <= 0) return <span className="report-card__pill skip">보류</span>;
  if (report.targetHit) return <span className="report-card__pill hit">도달</span>;
  return <span className="report-card__pill open">진행</span>;
}

function sparkPoints(equity: EquityPoint[], persona: string): number[] {
  const series = equity
    .filter((point) => point.persona === persona && point.cumulativeReturn !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => point.cumulativeReturn ?? 0);
  return series.slice(-90);
}

function equityLatestDate(equity: EquityPoint[]): string | null {
  return equity.reduce<string | null>((latest, point) => (point.date > (latest ?? '') ? point.date : latest), null);
}

function trendSnapshot(equity: EquityPoint[], holdings: HoldingRow[], persona: SummaryRow | undefined) {
  const series = equity
    .filter((point) => point.persona === PERSONA_PRIMARY && point.cumulativeReturn !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => point.cumulativeReturn ?? 0);
  const last = series.at(-1) ?? null;
  const return90d = windowReturn(series, 90);
  const return120d = windowReturn(series, 120);
  const peak = series.reduce<number | null>((max, value) => (max === null || value > max ? value : max), null);
  const currentDrawdown = last !== null && peak !== null ? (1 + last) / Math.max(0.0001, 1 + peak) - 1 : null;
  const positiveCount = holdings.filter((row) => (row.unrealizedReturn ?? 0) > 0).length;
  const positiveBreadth = holdings.length ? positiveCount / holdings.length : null;
  const score = [
    (return90d ?? 0) > 0,
    (return120d ?? 0) > 0,
    (positiveBreadth ?? 0) >= 0.5,
    (currentDrawdown ?? -1) > -0.1,
    (persona?.moneyWeightedReturn ?? persona?.irr ?? 0) > 0,
  ].filter(Boolean).length;
  if (score >= 4) return { mode: 'Risk-on', tone: 'good' as const, caption: '추세 유지 · 보유 우선', return90d, return120d, currentDrawdown, positiveBreadth, positiveCount };
  if (score >= 2) return { mode: 'Neutral', tone: 'warn' as const, caption: '선별 보유 · 신규 진입 보수적', return90d, return120d, currentDrawdown, positiveBreadth, positiveCount };
  return { mode: 'Defense', tone: 'bad' as const, caption: '현금/손절 규칙 우선 점검', return90d, return120d, currentDrawdown, positiveBreadth, positiveCount };
}

function windowReturn(series: number[], days: number): number | null {
  if (series.length < 2) return null;
  const last = series.at(-1);
  const past = series.at(Math.max(0, series.length - 1 - days));
  if (last === undefined || past === undefined) return null;
  return (1 + last) / Math.max(0.0001, 1 + past) - 1;
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
      summary: 'v2가 기준선과 v1을 모두 상회합니다.',
      detail: `v2 MWR ${formatPercent(v2Return)}는 all-weather ${formatPercent(awReturn)}와 v1 ${formatPercent(v1Return)}를 동시에 상회합니다.`,
    };
  }
  if (beatsAw) {
    return {
      tone: 'warn' as const,
      headline: '부분 신호',
      summary: 'v2는 기준선보다 낫지만 v1 대비 추가 검증이 필요합니다.',
      detail: `v2 MWR ${formatPercent(v2Return)}가 all-weather ${formatPercent(awReturn)}를 상회하지만 v1 대비 우위는 아직 충분하지 않습니다.`,
    };
  }
  return {
    tone: 'bad' as const,
    headline: '재검토 필요',
    summary: '기준선 대비 통계적 우위가 확보되지 않았습니다.',
    detail: `v2 MWR ${formatPercent(v2Return)}가 all-weather ${formatPercent(awReturn)}를 안정적으로 상회한다고 보기 어렵습니다. 리포트 선택 기준과 청산 규칙을 다시 점검해야 합니다.`,
  };
}
