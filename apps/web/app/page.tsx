import Link from 'next/link';
import { PerformanceChartPanel } from '@/components/charts/PerformanceChartPanel';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { StrategyRiskTable } from '@/components/trading/StrategyRiskTable';
import type { HoldingRow, ReportRow, TradeRow } from '@/lib/artifacts';
import { currencyExposure, getDashboardViewModel, topWeight, withCashHolding } from '@/lib/dashboard-view-model';
import { formatDateKo, formatKrw, formatPercent, signedTextClass } from '@/lib/format';
import type { getExecutiveOverview, StrategyLeaderboardRow } from '@/lib/product-model';

export default function OverviewPage() {
  const {
    strategyRows,
    selectedPersona,
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
  const topHolding = overview.portfolio.holdings[0];
  const portfolioCaption = topHolding
    ? `상위 보유: ${topHolding.company || topHolding.symbol} · 현금 ${formatPercent(overview.portfolio.cashWeight)}`
    : `현재 열린 보유 종목 없음 · 현금 ${formatPercent(overview.portfolio.cashWeight)}`;
  const conclusion = buildConclusion({
    objectiveRows,
    selectedStrategy,
    benchmarkToBeat,
    overview,
  });

  return (
    <main className="v2-home">
      <section className="v2-decision" aria-labelledby="snapshot-decision-title">
        <div className="v2-decision__copy">
          <p className="v2-kicker">SNAPSHOT JUDGMENT</p>
          <h1 id="snapshot-decision-title">오늘 이 스냅샷은 이렇게 읽습니다.</h1>
          <p className="v2-decision__lead">{conclusion}</p>
          <div className="v2-decision__actions">
            <Link className="btn btn-primary" href={`/portfolio?strategy=${encodeURIComponent(selectedPersona)}`}>
              원장 검토
            </Link>
            <Link className="btn btn-outline" href="/compare">
              V1/V2 최종 비교
            </Link>
          </div>
        </div>
        <div className="v2-decision__numbers" aria-label="핵심 판단 수치">
          <HeroNumber
            label="평가액"
            value={formatKrw(overview.portfolio.finalEquityKrw)}
            caption={overview.portfolio.label}
          />
          <HeroNumber
            label="MWR"
            value={formatPercent(overview.portfolio.moneyWeightedReturn)}
            caption={`MDD ${formatPercent(overview.portfolio.maxDrawdown)}`}
            tone={signedTextClass(overview.portfolio.moneyWeightedReturn)}
          />
          <HeroNumber
            label="목표 도달"
            value={formatPercent(overview.reportStats.targetHitRate)}
            caption={`${overview.reportStats.hitCount}/${overview.reportStats.total}개 리포트`}
          />
        </div>
      </section>

      <section className="v2-board v2-board--portfolio" aria-labelledby="portfolio-title">
        <div className="v2-board__main">
          <BoardHeader
            eyebrow="PORTFOLIO"
            titleId="portfolio-title"
            title="보유 구성은 집중됐는가, 분산됐는가"
            caption={portfolioCaption}
            href="/portfolio"
          />
          <HoldingsTreemap
            holdings={withCashHolding(
              overview.portfolio.holdings,
              overview.portfolio.cashKrw,
              overview.portfolio.persona,
            )}
            height={430}
            hrefBySymbol={reportHrefBySymbol}
          />
        </div>
        <aside className="v2-board__rail">
          <RiskLens overview={overview} strategyRows={strategyRows} />
          <RecentReports reports={overview.recentReports.slice(0, 6)} />
        </aside>
      </section>

      <section className="v2-board v2-board--performance" aria-labelledby="performance-title">
        <div className="v2-board__main">
          <BoardHeader
            eyebrow="STRATEGY"
            titleId="performance-title"
            title="수익률보다 먼저, 기준선과 낙폭을 같이 봅니다"
            caption={`${benchmarkRows.length}개 벤치마크 · ${selectableRows.length}개 고유 전략 · ${objectiveRows.length}개 목표 조건 통과`}
            href="/strategies"
          />
          <PerformanceChartPanel
            benchmarkCount={benchmarkRows.length}
            series={chartSeries}
            strategyCount={selectableRows.length}
          />
        </div>
        <aside className="v2-board__rail v2-board__rail--wide">
          <StrategyRiskTable rows={strategyRows.slice(0, 6)} />
        </aside>
      </section>

      <section className="v2-evidence" aria-labelledby="evidence-title">
        <BoardHeader
          eyebrow="EVIDENCE"
          titleId="evidence-title"
          title="판단의 근거"
          caption={`${priceMatchedReports}/${sourceReports}개 리포트 가격 매칭 · 최신 발간 ${formatDateKo(overview.reportStats.latestPublicationDate)}`}
        />
        <div className="v2-evidence__grid">
          <HoldingsList holdings={overview.portfolio.holdings.slice(0, 5)} reportsBySymbol={latestReportsBySymbol} />
          <BuyTape trades={recentBuys.slice(0, 5)} />
          <TargetFeed reports={overview.recentReports.slice(0, 5)} />
        </div>
      </section>
    </main>
  );
}

function buildConclusion({
  objectiveRows,
  selectedStrategy,
  benchmarkToBeat,
  overview,
}: {
  objectiveRows: StrategyLeaderboardRow[];
  selectedStrategy: StrategyLeaderboardRow | undefined;
  benchmarkToBeat: StrategyLeaderboardRow | undefined;
  overview: ReturnType<typeof getExecutiveOverview>;
}) {
  if (!selectedStrategy) return '아직 선택 가능한 고유 전략이 없어 벤치마크와 리포트 검증 상태를 먼저 확인해야 합니다.';
  const benchmarkText = benchmarkToBeat ? `${benchmarkToBeat.shortLabel || benchmarkToBeat.label} 대비` : '기준선 대비';
  const objectiveText = objectiveRows.length
    ? `${objectiveRows.length}개 고유 전략이 목표 조건을 통과했습니다.`
    : '목표 조건을 통과한 고유 전략은 아직 없습니다.';
  return `${selectedStrategy.shortLabel || selectedStrategy.label}가 현재 대표 원장입니다. ${benchmarkText} ${formatPercent(selectedStrategy.benchmarkExcess)}이고, 리포트 목표 도달률은 ${formatPercent(overview.reportStats.targetHitRate)}입니다. ${objectiveText}`;
}

function HeroNumber({
  label,
  value,
  caption,
  tone = '',
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: string;
}) {
  return (
    <article className="v2-hero-number">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {caption ? <p>{caption}</p> : null}
    </article>
  );
}

function BoardHeader({
  eyebrow,
  titleId,
  title,
  caption,
  href,
}: {
  eyebrow: string;
  titleId?: string;
  title: string;
  caption?: string;
  href?: string;
}) {
  return (
    <header className="v2-board-head">
      <div>
        <p className="v2-kicker">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        {caption ? <p>{caption}</p> : null}
      </div>
      {href ? <Link href={href}>자세히</Link> : null}
    </header>
  );
}

function RiskLens({
  overview,
  strategyRows,
}: {
  overview: ReturnType<typeof getExecutiveOverview>;
  strategyRows: StrategyLeaderboardRow[];
}) {
  const holdings = overview.portfolio.holdings;
  const totalValue = overview.portfolio.finalEquityKrw ?? 0;
  const exposure = currencyExposure(
    withCashHolding(holdings, overview.portfolio.cashKrw, overview.portfolio.persona),
    totalValue,
  );
  const facts = [
    ['Top 5', formatPercent(overview.portfolio.top5Weight)],
    ['Top 10', formatPercent(topWeight(holdings, 10))],
    ['현금', formatPercent(overview.portfolio.cashWeight)],
    [
      '수익 포지션',
      overview.portfolio.holdingCount > 0
        ? `${overview.portfolio.positiveHoldingCount}/${overview.portfolio.holdingCount}`
        : '보유 없음',
    ],
    ['전략 수', `${strategyRows.length.toLocaleString('ko-KR')}개`],
  ];
  return (
    <article className="v2-lens">
      <h3>리스크 렌즈</h3>
      <dl>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="v2-exposure">
        {exposure.map((row) => (
          <div key={row.currency}>
            <span>{row.currency}</span>
            <i>
              <b style={{ width: `${Math.min(100, row.weight * 100)}%` }} />
            </i>
            <strong>{formatPercent(row.weight)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function RecentReports({ reports }: { reports: ReportRow[] }) {
  return (
    <article className="v2-lens">
      <h3>최근 리포트</h3>
      <div className="v2-list">
        {reports.map((report) => (
          <Link href={`/reports/${encodeURIComponent(report.symbol)}`} key={report.reportId}>
            <span>{report.company || report.symbol}</span>
            <strong className={signedTextClass(report.currentReturn)}>{formatPercent(report.currentReturn)}</strong>
            <small>
              {formatDateKo(report.publicationDate)} · {reportStatus(report)}
            </small>
          </Link>
        ))}
      </div>
    </article>
  );
}

function HoldingsList({
  holdings,
  reportsBySymbol,
}: {
  holdings: HoldingRow[];
  reportsBySymbol: Map<string, ReportRow>;
}) {
  return (
    <article className="v2-evidence-card">
      <h3>상위 보유</h3>
      {holdings.length ? (
        <div className="v2-list">
          {holdings.map((holding) => {
            const report = reportsBySymbol.get(holding.symbol);
            const body = (
              <>
                <span>{holding.company || holding.symbol}</span>
                <strong className={signedTextClass(holding.unrealizedReturn)}>
                  {formatPercent(holding.unrealizedReturn)}
                </strong>
                <small>
                  {formatKrw(holding.marketValueKrw)} · 목표 진행 {formatPercent(report?.targetProgressPct)}
                </small>
              </>
            );
            return report ? (
              <Link
                href={`/reports/${encodeURIComponent(holding.symbol)}`}
                key={`${holding.persona}-${holding.symbol}`}
              >
                {body}
              </Link>
            ) : (
              <div className="v2-list__row" key={`${holding.persona}-${holding.symbol}`}>
                {body}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="v2-empty">
          현재 열린 보유 종목이 없습니다. 이 원장은 현금 보유 또는 최근 청산 상태로 해석합니다.
        </p>
      )}
    </article>
  );
}

function BuyTape({ trades }: { trades: TradeRow[] }) {
  return (
    <article className="v2-evidence-card">
      <h3>최근 매수</h3>
      {trades.length ? (
        <div className="v2-list">
          {trades.map((trade, index) => (
            <Link href={`/reports/${encodeURIComponent(trade.symbol)}`} key={`${trade.persona}-${trade.date}-${index}`}>
              <span>{trade.symbol}</span>
              <strong>{formatKrw(trade.grossKrw)}</strong>
              <small>
                {formatDateKo(trade.date)} · {trade.qty?.toLocaleString('ko-KR') ?? '—'}주 ·{' '}
                {trade.reason || 'report-linked'}
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <p className="v2-empty">최근 매수 체결이 없습니다. 이 스냅샷은 신규 진입보다 보유·현금 상태를 먼저 봅니다.</p>
      )}
    </article>
  );
}

function TargetFeed({ reports }: { reports: ReportRow[] }) {
  return (
    <article className="v2-evidence-card">
      <h3>목표가 진행</h3>
      <div className="v2-targets">
        {reports.map((report) => {
          const progress = Math.max(0, Math.min(1, report.targetProgressPct ?? (report.targetHit ? 1 : 0)));
          return (
            <Link href={`/reports/${encodeURIComponent(report.symbol)}`} key={report.reportId}>
              <span>{report.symbol}</span>
              <i>
                <b style={{ width: `${Math.max(4, progress * 100)}%` }} />
              </i>
              <strong>{formatPercent(report.targetProgressPct)}</strong>
            </Link>
          );
        })}
      </div>
    </article>
  );
}

function reportStatus(report: ReportRow): string {
  if (report.targetHit) return '도달';
  if (report.expired) return '만료';
  return '진행';
}
