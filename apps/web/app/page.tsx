import Link from 'next/link';
import { PerformanceChartPanel } from '@/components/charts/PerformanceChartPanel';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { StrategyRiskTable } from '@/components/trading/StrategyRiskTable';
import type { HoldingRow, ReportRow, TradeRow } from '@/lib/artifacts';
import { currencyExposure, getDashboardViewModel, topWeight, withCashHolding } from '@/lib/dashboard-view-model';
import { formatDateKo, formatDays, formatKrw, formatPercent, signedTextClass } from '@/lib/format';
import type { getExecutiveOverview, StrategyLeaderboardRow } from '@/lib/product-model';

export default function OverviewPage() {
  const {
    strategyRows,
    overview,
    priceMatchedReports,
    sourceReports,
    latestReportsBySymbol,
    reportHrefBySymbol,
    benchmarkRows,
    selectableRows,
    selectedStrategy,
    chartSeries,
    objectiveRows,
    benchmarkToBeat,
    recentBuys,
  } = getDashboardViewModel();

  const treemapHoldings = withCashHolding(
    overview.portfolio.holdings,
    overview.portfolio.cashKrw,
    overview.portfolio.persona,
  );

  return (
    <div className="archive-page">
      <header className="archive-command" aria-labelledby="archive-title">
        <div className="archive-command__identity">
          <span className="archive-command__kicker">SNUSMIC / STATIC RESEARCH LEDGER</span>
          <h1 id="archive-title">원장 요약</h1>
          <p>리포트, 보유, 전략 성과를 기준 스냅샷으로 대조합니다. 주문·호가·실시간 매매 화면이 아닙니다.</p>
        </div>
        <dl className="archive-factbar" aria-label="스냅샷 핵심 수치">
          <Fact label="SNAPSHOT" value={overview.snapshotDate || '—'} />
          <Fact label="EQUITY" value={formatKrw(overview.portfolio.finalEquityKrw)} strong />
          <Fact label="MWR" value={formatPercent(overview.portfolio.moneyWeightedReturn)} tone="good" />
          <Fact label="MDD" value={formatPercent(overview.portfolio.maxDrawdown)} tone="bad" />
          <Fact label="TARGET HIT" value={formatPercent(overview.reportStats.targetHitRate)} />
          <Fact label="REPORTS" value={`${overview.reportStats.total.toLocaleString('ko-KR')}건`} />
          <Fact label="MATCHED" value={`${priceMatchedReports}/${sourceReports}`} />
          <Fact label="BOOK" value={selectedStrategy?.shortLabel || overview.portfolio.label} />
        </dl>
      </header>

      <section className="archive-layout archive-layout--primary" aria-label="포트폴리오와 전략 요약">
        <ArchivePane
          action={<Link href="/portfolio">원장</Link>}
          className="archive-pane--treemap"
          eyebrow="COMPOSITION"
          title="포트폴리오 비중"
        >
          <PortfolioComposition
            holdings={overview.portfolio.holdings}
            overview={overview}
            reportHrefBySymbol={reportHrefBySymbol}
            treemapHoldings={treemapHoldings}
          />
        </ArchivePane>

        <ArchivePane action={<Link href="/strategies">전략</Link>} eyebrow="STRATEGY" title="전략 순위">
          <StrategyLedger
            benchmark={benchmarkToBeat}
            objectiveCount={objectiveRows.length}
            rows={strategyRows.slice(0, 9)}
          />
        </ArchivePane>
      </section>

      <section className="archive-layout archive-layout--secondary" aria-label="리스크와 최근 리포트">
        <ArchivePane action={<Link href="/portfolio">상세</Link>} eyebrow="RISK" title="노출 점검">
          <RiskLedger holdings={overview.portfolio.holdings} overview={overview} rows={strategyRows} />
        </ArchivePane>

        <ArchivePane action={<Link href="/reports">전체</Link>} eyebrow="REPORTS" title="최근 리포트">
          <ReportLedger reports={overview.recentReports.slice(0, 8)} />
        </ArchivePane>

        <ArchivePane action={<Link href="/screener">후보</Link>} eyebrow="CANDIDATES" title="재검토 후보">
          <CandidateLedger reports={overview.researchCandidates.slice(0, 7).map((candidate) => candidate.report)} />
        </ArchivePane>
      </section>

      <section className="archive-layout archive-layout--performance" aria-label="성과와 이벤트">
        <ArchivePane
          action={
            <div className="archive-segments" aria-label="기간 필터">
              {['3M', '6M', 'YTD', '1Y', 'ALL'].map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          }
          className="archive-pane--chart"
          eyebrow="PERFORMANCE"
          title="전략 / 벤치마크 누적 수익률"
        >
          <PerformanceChartPanel
            benchmarkCount={benchmarkRows.length}
            objectiveLabel="목표: MDD 15% 이하 · KODEX 200 초과"
            series={chartSeries}
            strategyCount={selectableRows.length}
          />
        </ArchivePane>

        <ArchivePane action={<Link href="/reports">검증</Link>} eyebrow="ACTIVITY" title="검증 테이프">
          <ActivityTape buys={recentBuys} reports={overview.recentReports.slice(0, 5)} />
        </ArchivePane>
      </section>

      <section className="archive-layout archive-layout--evidence" aria-label="보유와 목표가 검증 근거">
        <ArchivePane action={<Link href="/portfolio">보유</Link>} eyebrow="HOLDINGS" title="상위 보유">
          <HoldingLedger holdings={overview.portfolio.holdings.slice(0, 10)} reportsBySymbol={latestReportsBySymbol} />
        </ArchivePane>

        <ArchivePane action={<Link href="/strategies">매트릭스</Link>} eyebrow="MATRIX" title="전략 성과 표">
          <StrategyRiskTable rows={strategyRows.slice(0, 8)} />
        </ArchivePane>
      </section>
    </div>
  );
}

function PortfolioComposition({
  holdings,
  overview,
  reportHrefBySymbol,
  treemapHoldings,
}: {
  holdings: HoldingRow[];
  overview: ReturnType<typeof getExecutiveOverview>;
  reportHrefBySymbol: Record<string, string>;
  treemapHoldings: HoldingRow[];
}) {
  if (holdings.length > 0) {
    return (
      <HoldingsTreemap
        caption="면적은 평가액, 색상은 미실현 수익률입니다. CASH는 남은 현금입니다."
        height={505}
        holdings={treemapHoldings}
        hrefBySymbol={reportHrefBySymbol}
        showToolbar={false}
      />
    );
  }

  return (
    <div className="archive-cash-state">
      <div className="archive-cash-state__header">
        <span>NO ACTIVE POSITIONS</span>
        <strong>{overview.portfolio.label}</strong>
      </div>
      <dl className="archive-cash-grid">
        <Row label="평가액" value={formatKrw(overview.portfolio.finalEquityKrw)} />
        <Row label="현금" value={formatKrw(overview.portfolio.cashKrw)} />
        <Row label="현금 비중" value={formatPercent(overview.portfolio.cashWeight)} />
        <Row label="MWR" tone="good" value={formatPercent(overview.portfolio.moneyWeightedReturn)} />
        <Row label="MDD" tone="bad" value={formatPercent(overview.portfolio.maxDrawdown)} />
        <Row label="미실현 손익" value={formatKrw(overview.portfolio.unrealizedPnlKrw)} />
      </dl>
      <div className="archive-cash-block" aria-label="현금 비중 블록">
        <span>CASH RESERVE</span>
        <strong>{formatPercent(overview.portfolio.cashWeight)}</strong>
        <i style={{ width: `${Math.max(3, Math.min(100, (overview.portfolio.cashWeight ?? 0) * 100))}%` }} />
      </div>
      <div className="archive-cash-state__note">
        이 원장은 기준일 현재 보유 종목이 없습니다. 포트폴리오 비중 대신 현금·성과·낙폭을 원장 상태로 표시합니다.
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
  strong?: boolean;
}) {
  return (
    <div className="archive-fact" data-strong={strong || undefined} data-tone={tone}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ArchivePane({
  eyebrow,
  title,
  action,
  className = '',
  children,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`archive-pane ${className}`}>
      <div className="archive-pane__head">
        <div>
          <div className="archive-pane__eyebrow">{eyebrow}</div>
          <h2>{title}</h2>
        </div>
        {action ? <div className="archive-pane__action">{action}</div> : null}
      </div>
      <div className="archive-pane__body">{children}</div>
    </article>
  );
}

function StrategyLedger({
  rows,
  benchmark,
  objectiveCount,
}: {
  rows: StrategyLeaderboardRow[];
  benchmark: StrategyLeaderboardRow | undefined;
  objectiveCount: number;
}) {
  return (
    <div className="archive-stack">
      <dl className="archive-mini-summary">
        <div>
          <dt>기준선</dt>
          <dd>{benchmark?.shortLabel || benchmark?.label || '—'}</dd>
        </div>
        <div>
          <dt>목표 통과</dt>
          <dd>{objectiveCount.toLocaleString('ko-KR')}개</dd>
        </div>
      </dl>
      <div className="archive-table-wrap">
        <table className="archive-table">
          <thead>
            <tr>
              <th>전략</th>
              <th className="num">MWR</th>
              <th className="num">MDD</th>
              <th className="num">Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={row.href}>
                    <strong>{row.shortLabel || row.label}</strong>
                    <span>{kindLabel(row.kind)}</span>
                  </Link>
                </td>
                <td className={`num ${signedTextClass(row.returnPct)}`}>{formatPercent(row.returnPct)}</td>
                <td className="num text-error">{formatPercent(row.maxDrawdown)}</td>
                <td className="num">{formatNumber(row.sharpe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskLedger({
  holdings,
  rows,
  overview,
}: {
  holdings: HoldingRow[];
  rows: StrategyLeaderboardRow[];
  overview: ReturnType<typeof getExecutiveOverview>;
}) {
  const cashKrw = overview.portfolio.cashKrw ?? 0;
  const totalValue = Math.max(
    overview.portfolio.finalEquityKrw ?? 0,
    holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0) + cashKrw,
  );
  const currencyRows = currencyExposure(withCashHolding(holdings, cashKrw, overview.portfolio.persona), totalValue);
  const benchmarkCount = rows.filter((row) => row.kind === 'benchmark').length;

  return (
    <div className="archive-stack">
      <dl className="archive-ledger">
        <Row label="현금 비중" value={formatPercent(overview.portfolio.cashWeight)} />
        <Row label="Top 5 비중" value={formatPercent(overview.portfolio.top5Weight)} />
        <Row label="Top 10 비중" value={formatPercent(topWeight(holdings, 10))} />
        <Row label="보유 종목" value={`${holdings.length.toLocaleString('ko-KR')}개`} />
        <Row
          label="수익 포지션"
          tone="good"
          value={`${overview.portfolio.positiveHoldingCount}/${overview.portfolio.holdingCount}`}
        />
        <Row label="벤치마크" value={`${benchmarkCount.toLocaleString('ko-KR')}개`} />
      </dl>
      <div className="archive-bars" aria-label="통화 노출">
        {currencyRows.map((row) => (
          <div className="archive-bar" key={row.currency}>
            <span>{row.currency}</span>
            <div>
              <i style={{ width: `${Math.min(100, row.weight * 100)}%` }} />
            </div>
            <strong>{formatPercent(row.weight)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportLedger({ reports }: { reports: ReportRow[] }) {
  if (!reports.length) return <EmptyState label="최근 리포트가 없습니다." />;
  return (
    <div className="archive-row-list">
      {reports.map((report) => (
        <Link className="archive-row" href={`/reports/${encodeURIComponent(report.symbol)}`} key={report.reportId}>
          <div className="archive-row__main">
            <strong>{report.company || report.symbol}</strong>
            <span>
              {formatDateKo(report.publicationDate)} · {report.symbol} · {statusText(report)}
            </span>
          </div>
          <div className="archive-row__meta">
            <b className={signedTextClass(report.currentReturn)}>{formatPercent(report.currentReturn)}</b>
            <span>{formatPercent(report.targetProgressPct)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CandidateLedger({ reports }: { reports: ReportRow[] }) {
  if (!reports.length) return <EmptyState label="재검토 후보가 없습니다." />;
  return (
    <div className="archive-row-list">
      {reports.map((report, index) => (
        <Link className="archive-row" href={`/reports/${encodeURIComponent(report.symbol)}`} key={report.reportId}>
          <div className="archive-rank">{String(index + 1).padStart(2, '0')}</div>
          <div className="archive-row__main">
            <strong>{report.company || report.symbol}</strong>
            <span>
              {report.symbol} · 잔여 {formatPercent(report.targetRemainingPct)}
            </span>
          </div>
          <div className="archive-progress" aria-label="목표 진행률">
            <i style={{ width: `${progressWidth(report)}%` }} />
          </div>
        </Link>
      ))}
    </div>
  );
}

function ActivityTape({ buys, reports }: { buys: TradeRow[]; reports: ReportRow[] }) {
  const items = [
    ...buys.slice(0, 5).map((trade, index) => ({
      id: `buy-${trade.date}-${trade.symbol}-${index}`,
      href: `/reports/${encodeURIComponent(trade.symbol)}`,
      type: 'BUY',
      date: trade.date,
      title: trade.symbol,
      caption: `${formatQuantity(trade.qty)}주 · ${trade.reason || 'report-linked'}`,
      value: formatKrw(trade.grossKrw),
      tone: undefined as 'good' | 'bad' | undefined,
    })),
    ...reports.slice(0, 5).map((report) => ({
      id: `report-${report.reportId}`,
      href: `/reports/${encodeURIComponent(report.symbol)}`,
      type: statusText(report).toUpperCase(),
      date: report.publicationDate,
      title: report.company || report.symbol,
      caption: `${report.symbol} · 진행 ${formatPercent(report.targetProgressPct)}`,
      value: formatPercent(report.currentReturn),
      tone: (report.currentReturn ?? 0) >= 0 ? ('good' as const) : ('bad' as const),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  if (!items.length) return <EmptyState label="검증 이벤트가 없습니다." />;
  return (
    <div className="archive-row-list archive-row-list--tape">
      {items.slice(0, 10).map((item) => (
        <Link className="archive-row" href={item.href} key={item.id}>
          <span className="archive-token">{item.type}</span>
          <div className="archive-row__main">
            <strong>{item.title}</strong>
            <span>
              {formatDateKo(item.date)} · {item.caption}
            </span>
          </div>
          <div className="archive-row__meta">
            <b data-tone={item.tone}>{item.value}</b>
          </div>
        </Link>
      ))}
    </div>
  );
}

function HoldingLedger({
  holdings,
  reportsBySymbol,
}: {
  holdings: HoldingRow[];
  reportsBySymbol: Map<string, ReportRow>;
}) {
  if (!holdings.length) return <EmptyState label="현재 보유 포지션이 없습니다." />;
  return (
    <div className="archive-table-wrap">
      <table className="archive-table">
        <thead>
          <tr>
            <th>종목</th>
            <th className="num">평가액</th>
            <th className="num">미실현</th>
            <th className="num">목표 진행</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => {
            const report = reportsBySymbol.get(holding.symbol);
            return (
              <tr key={`${holding.persona}-${holding.symbol}`}>
                <td>
                  <Link href={`/reports/${encodeURIComponent(holding.symbol)}`}>
                    <strong>{holding.symbol}</strong>
                    <span>{holding.company || formatDays(holding.holdingDays)}</span>
                  </Link>
                </td>
                <td className="num">{formatKrw(holding.marketValueKrw)}</td>
                <td className={`num ${signedTextClass(holding.unrealizedReturn)}`}>
                  {formatPercent(holding.unrealizedReturn)}
                </td>
                <td className="num">{formatPercent(report?.targetProgressPct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div data-tone={tone}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="archive-empty">{label}</div>;
}

function kindLabel(kind: StrategyLeaderboardRow['kind']): string {
  if (kind === 'strategy') return '전략';
  if (kind === 'oracle') return '상한선';
  return '벤치마크';
}

function statusText(report: ReportRow): string {
  if (report.targetDirection === 'downside') return '매도 의견';
  if ((report.targetUpsideAtPub ?? 0) <= 0) return '비실행';
  if (report.targetHit) return '도달';
  if (report.expired) return '만료';
  return '진행';
}

function progressWidth(report: ReportRow): number {
  const progress = report.targetProgressPct ?? (report.targetHit ? 1 : 0);
  return Math.max(3, Math.min(100, progress * 100));
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}
