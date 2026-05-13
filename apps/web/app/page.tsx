import Link from 'next/link';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { PerformanceChartPanel } from '@/components/charts/PerformanceChartPanel';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { StrategyRiskTable } from '@/components/trading/StrategyRiskTable';
import { StrategySelector } from '@/components/trading/StrategySelector';
import { KpiTile } from '@/components/ui/KpiTile';
import { MiniSparkline } from '@/components/ui/MiniSparkline';
import { Money } from '@/components/ui/Money';
import { PageHero } from '@/components/ui/PageHero';
import { Panel } from '@/components/ui/Panel';
import { Section } from '@/components/ui/Section';
import type { HoldingRow, ReportRow, TradeRow } from '@/lib/artifacts';
import { formatDateKo, formatDays, formatKrw, formatPercent, signedTextClass } from '@/lib/format';
import { currencyExposure, getDashboardViewModel, topWeight, withCashHolding } from '@/lib/dashboard-view-model';
import type { getExecutiveOverview, ResearchCandidate, StrategyLeaderboardRow } from '@/lib/product-model';

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

  return (
    <>
      <PageHero
        eyebrow="PORTFOLIO LAB"
        title="SNUSMIC Portfolio Lab"
        subtitle="리서치 발간 이후의 가격 흐름, 현재 보유, 전략 성과를 한 화면에서 확인합니다."
        badges={[
          { label: '기준일', value: overview.snapshotDate || '—' },
          { label: '리포트', value: `${overview.reportStats.total}건` },
          { label: '가격 매칭', value: `${priceMatchedReports}/${sourceReports}` },
          { label: '보유', value: `${overview.portfolio.holdingCount}개` },
          { label: '원장', value: overview.portfolio.label },
          { label: '거래', value: '실시간 매매 아님' },
        ]}
        actions={
          <>
            <Link className="btn btn-sm btn-primary" href="/portfolio">
              원장 보기
            </Link>
            <Link className="btn btn-sm btn-outline" href="/reports">
              리포트 검증
            </Link>
            <Link className="btn btn-sm btn-ghost" href="/strategies">
              전략 실험
            </Link>
          </>
        }
      />

      <CommandKpiStrip
        benchmark={benchmarkToBeat}
        chartSeries={chartSeries}
        objectiveCount={objectiveRows.length}
        overview={overview}
        selectedStrategy={selectedStrategy}
      />

      <Section
        eyebrow="Portfolio"
        title="현재 상태 대시보드"
        caption="현재 최고 전략의 평가액, 보유 구성, 현금 비중, 최근 리포트 상태를 한 번에 확인합니다. 다른 전략은 원장 화면에서 바로 전환합니다."
        actions={<StrategyPills rows={selectableRows.slice(0, 10)} selectedId={selectedPersona} />}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.55fr)_minmax(300px,.55fr)]">
          <article className="lab-panel">
            <div className="lab-panel__head">
              <div className="min-w-0">
                <div className="lab-panel__eyebrow">Portfolio</div>
                <h2 className="lab-panel__title">포트폴리오 구성</h2>
              </div>
              <span className="artifact-status">
                <span className="status-dot" aria-hidden="true" /> 기준 데이터
              </span>
            </div>
            <div className="p-3 md:p-4">
              <HoldingsTreemap
                holdings={withCashHolding(
                  overview.portfolio.holdings,
                  overview.portfolio.cashKrw,
                  overview.portfolio.persona,
                )}
                height={450}
                hrefBySymbol={reportHrefBySymbol}
              />
            </div>
          </article>
          <RiskSummary holdings={overview.portfolio.holdings} rows={strategyRows} overview={overview} />
          <RecentReportsPanel reports={overview.recentReports.slice(0, 7)} />
        </div>
      </Section>

      <Section
        eyebrow="Performance"
        title="전략 · 벤치마크 누적 수익률"
        caption="대표 전략, 벤치마크, 목표 조건 통과 전략을 한 줄의 성과 보드에서 비교합니다."
        actions={
          <div className="flex flex-wrap gap-1.5" aria-label="기간 필터">
            {['3M', '6M', 'YTD', '1Y', '전체'].map((label) => (
              <span className="snapshot-pill" key={label}>
                {label}
              </span>
            ))}
          </div>
        }
      >
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.58fr)_minmax(320px,.48fr)]">
          <PerformanceChartPanel
            benchmarkCount={benchmarkRows.length}
            series={chartSeries}
            strategyCount={selectableRows.length}
          />
          <Panel
            actions={
              <Link className="lab-panel__action" href="/strategies">
                더보기
              </Link>
            }
            bodyClassName="p-0"
            eyebrow="Strategy"
            title="전략 성과 요약"
          >
            <StrategyRiskTable rows={strategyRows.slice(0, 7)} />
          </Panel>
          <Panel eyebrow="Updates" title="최근 업데이트" bodyClassName="p-3">
            <UpdateFeed
              snapshotDate={overview.snapshotDate}
              stats={overview.reportStats}
              portfolio={overview.portfolio}
            />
          </Panel>
        </div>
      </Section>

      <Section
        eyebrow="Evidence"
        title="원장과 목표가 검증 근거"
        caption="현재 보유, 최근 매수, 목표가 진행률을 분리해 리서치 스냅샷의 근거를 추적합니다."
      >
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(340px,.5fr)_minmax(340px,.5fr)]">
          <Panel
            actions={
              <Link className="lab-panel__action" href="/portfolio">
                Portfolio
              </Link>
            }
            bodyClassName="p-3"
            eyebrow="Holdings"
            title="현재 보유 상위 종목"
          >
            <HoldingContext
              holdings={overview.portfolio.holdings.slice(0, 8)}
              reportsBySymbol={latestReportsBySymbol}
            />
          </Panel>
          <Panel
            actions={
              <Link className="lab-panel__action" href="/portfolio">
                원장
              </Link>
            }
            bodyClassName="p-3"
            eyebrow="Buy tape"
            title="최근 매수 체결"
          >
            <BuyTape trades={recentBuys} />
          </Panel>
          <Panel
            actions={
              <Link className="lab-panel__action" href="/reports">
                리포트
              </Link>
            }
            bodyClassName="p-3"
            eyebrow="Targets"
            title="목표가 검증 피드"
          >
            <TargetValidationFeed reports={overview.recentReports.slice(0, 6)} />
          </Panel>
        </div>
      </Section>

      <Section
        eyebrow="후보 탐색"
        title="리포트 기반 후보 랭킹"
        caption="아직 목표가에 도달하지 않은 리포트 중 현재 상황을 다시 확인할 만한 후보입니다."
        actions={
          <Link className="btn btn-sm btn-outline" href="/screener">
            Screener →
          </Link>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {overview.researchCandidates.slice(0, 8).map((candidate, index) => (
            <CandidateMiniCard key={candidate.report.reportId} candidate={candidate} rank={index + 1} />
          ))}
        </div>
      </Section>
    </>
  );
}

function CommandKpiStrip({
  overview,
  benchmark,
  objectiveCount,
  selectedStrategy,
  chartSeries,
}: {
  overview: ReturnType<typeof getExecutiveOverview>;
  benchmark: StrategyLeaderboardRow | undefined;
  objectiveCount: number;
  selectedStrategy: StrategyLeaderboardRow | undefined;
  chartSeries: ReturnSeries[];
}) {
  const selectedTrend = chartSeries.find((series) => series.id === overview.portfolio.persona)?.points ?? [];
  const benchmarkTrend = benchmark ? (chartSeries.find((series) => series.id === benchmark.id)?.points ?? []) : [];
  const targetProgressPoints = overview.recentReports
    .map((report) => ({ value: report.targetProgressPct }))
    .filter((point) => point.value !== null);
  const bestStrategyLabel = selectedStrategy?.shortLabel || selectedStrategy?.label || overview.portfolio.label;
  return (
    <section className="command-kpi-strip" aria-label="핵심 KPI">
      <KpiTile
        caption={`${overview.portfolio.holdingCount}개 보유 · 현금 ${formatPercent(overview.portfolio.cashWeight)}`}
        delta={`${overview.portfolio.label} 원장`}
        emphasis
        label="현재 평가액"
        tone="accent"
        value={formatKrw(overview.portfolio.finalEquityKrw)}
      >
        <MiniSparkline label="대표 전략 평가액 추세" points={selectedTrend} tone="accent" />
      </KpiTile>
      <KpiTile
        caption="입출금 반영 수익률"
        delta={selectedStrategy ? `MDD ${formatPercent(selectedStrategy.maxDrawdown)}` : undefined}
        label="Primary MWR"
        tone="good"
        value={formatPercent(overview.portfolio.moneyWeightedReturn)}
      >
        <MiniSparkline label="Primary MWR sparkline" points={selectedTrend} tone="good" />
      </KpiTile>
      <KpiTile
        caption={`${overview.portfolio.positiveHoldingCount}/${overview.portfolio.holdingCount} 수익 포지션`}
        label="현재 보유 손익"
        tone={(overview.portfolio.unrealizedPnlKrw ?? 0) >= 0 ? 'good' : 'bad'}
        value={formatKrw(overview.portfolio.unrealizedPnlKrw)}
      >
        <MiniSparkline label="보유 손익 추세" points={selectedTrend} tone="good" />
      </KpiTile>
      <KpiTile
        caption="원장 기준 최대 낙폭"
        label="Primary MDD"
        tone="bad"
        value={formatPercent(overview.portfolio.maxDrawdown)}
      >
        <MiniSparkline
          label="벤치마크 경로"
          points={benchmarkTrend.length ? benchmarkTrend : selectedTrend}
          tone="bad"
        />
      </KpiTile>
      <KpiTile
        caption={`${overview.reportStats.hitCount}/${overview.reportStats.total}건 도달`}
        label="목표가 도달률"
        tone="accent"
        value={formatPercent(overview.reportStats.targetHitRate)}
      >
        <MiniSparkline label="최근 리포트 목표 진행률" points={targetProgressPoints} tone="accent" />
      </KpiTile>
      <KpiTile
        caption={`${overview.reportStats.activeCount}건 진행 중 · 최신 ${formatDateKo(overview.reportStats.latestPublicationDate)}`}
        label="리포트"
        value={`${overview.reportStats.total.toLocaleString('ko-KR')}건`}
      >
        <MiniSparkline
          label="리포트 현재 수익률"
          points={overview.recentReports.map((report) => ({ value: report.currentReturn }))}
          tone="neutral"
        />
      </KpiTile>
      <KpiTile
        caption={objectiveCount ? `${objectiveCount}개 전략이 목표 조건 통과` : '목표 조건 통과 전략 없음'}
        delta={benchmark ? `기준선 ${benchmark.shortLabel || benchmark.label}` : undefined}
        label="최고 원장 전략"
        tone="warn"
        value={bestStrategyLabel}
      >
        <MiniSparkline label="최고 원장 전략 추세" points={selectedTrend} tone="warn" />
      </KpiTile>
    </section>
  );
}

function StrategyPills({ rows, selectedId }: { rows: StrategyLeaderboardRow[]; selectedId: string }) {
  return (
    <StrategySelector
      ariaLabel="대표 전략 선택"
      options={rows.map((row) => ({
        id: row.id,
        label: row.label,
        shortLabel: row.shortLabel,
        kind: row.kind,
        href: row.href,
      }))}
      value={selectedId}
    />
  );
}

function RiskSummary({
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
  const top10Weight = topWeight(holdings, 10);
  const currencyRows = currencyExposure(withCashHolding(holdings, cashKrw, overview.portfolio.persona), totalValue);
  const benchmarkCount = rows.filter((row) => row.kind === 'benchmark').length;
  return (
    <article className="lab-panel lab-panel--dense">
      <div className="lab-panel__head">
        <div className="min-w-0">
          <div className="lab-panel__eyebrow">Risk</div>
          <h2 className="lab-panel__title">리스크 요약</h2>
        </div>
        <Link className="lab-panel__action" href="/portfolio">
          상세 보기
        </Link>
      </div>
      <div className="grid gap-3 p-4">
        <p className="m-0 text-sm leading-6 text-base-content/62">상위 포지션 쏠림과 현금/통화 노출을 점검합니다.</p>
        <dl className="grid gap-1 text-sm">
          <FactLine label="Top 5 비중" value={formatPercent(overview.portfolio.top5Weight)} />
          <FactLine label="Top 10 비중" value={formatPercent(top10Weight)} />
          <FactLine label="현금 비중" value={formatPercent(overview.portfolio.cashWeight)} />
          <FactLine label="보유 종목" value={`${holdings.length}개`} />
          <FactLine
            label="수익 포지션"
            value={`${overview.portfolio.positiveHoldingCount}/${overview.portfolio.holdingCount}`}
            tone="text-success"
          />
          <FactLine label="원장 MDD" value={formatPercent(overview.portfolio.maxDrawdown)} tone="text-error" />
          <FactLine label="벤치마크 수" value={`${benchmarkCount}개`} />
        </dl>
        <div className="grid gap-2 pt-2">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/45">통화 노출</div>
          {currencyRows.map((row) => (
            <div className="grid grid-cols-[4rem_minmax(0,1fr)_3.5rem] items-center gap-2" key={row.currency}>
              <span className="font-mono text-xs font-bold text-base-content/65">{row.currency}</span>
              <div className="h-2 rounded-full bg-base-200">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, row.weight * 100)}%` }}
                />
              </div>
              <span className="text-right font-mono text-xs font-bold tabular-nums">{formatPercent(row.weight)}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function RecentReportsPanel({ reports }: { reports: ReportRow[] }) {
  return (
    <article className="lab-panel lab-panel--dense">
      <div className="lab-panel__head">
        <div className="min-w-0">
          <div className="lab-panel__eyebrow">Reports</div>
          <h2 className="lab-panel__title">최근 발간 리포트</h2>
        </div>
        <Link className="lab-panel__action" href="/reports">
          전체 보기
        </Link>
      </div>
      <div className="feed-list p-3">
        {reports.map((report) => (
          <Link key={report.reportId} href={`/reports/${report.symbol}`} className="feed-item">
            <div className="min-w-0">
              <div className="truncate font-bold text-sm">{report.company || report.symbol}</div>
              <div className="feed-item__meta">
                {formatDateKo(report.publicationDate)} · {report.symbol} · 진행{' '}
                {formatPercent(report.targetProgressPct)}
              </div>
            </div>
            <div className="grid justify-items-end gap-1">
              <span className={`feed-item__value ${signedTextClass(report.currentReturn)}`}>
                {formatPercent(report.currentReturn)}
              </span>
              {reportStatusBadge(report)}
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}

function HoldingContext({
  holdings,
  reportsBySymbol,
}: {
  holdings: HoldingRow[];
  reportsBySymbol: Map<string, ReportRow>;
}) {
  if (!holdings.length) {
    return <article className="lab-panel p-5 text-sm text-base-content/60">현재 보유 포지션이 없습니다.</article>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {holdings.map((holding) => {
        const report = reportsBySymbol.get(holding.symbol);
        const progress = report?.targetProgressPct ?? null;
        return (
          <Link
            key={`${holding.persona}-${holding.symbol}`}
            href={`/reports/${holding.symbol}`}
            className="lab-panel p-4"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-black">{holding.company || holding.symbol}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="badge badge-ghost badge-sm font-mono">{holding.symbol}</span>
                  <span className="badge badge-outline badge-sm">{holding.currency}</span>
                  <span className="badge badge-primary badge-soft badge-sm">{formatDays(holding.holdingDays)}</span>
                </div>
              </div>
              <div className={`font-mono text-sm font-black tabular-nums ${signedTextClass(holding.unrealizedReturn)}`}>
                {formatPercent(holding.unrealizedReturn)}
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs lg:grid-cols-3">
              <Metric label="수량" value={formatQuantity(holding.qty)} />
              <Metric label="평가액" value={formatKrw(holding.marketValueKrw)} />
              <Metric label="평단(KRW)" value={formatKrw(holding.avgCostKrw)} />
              <Metric
                label="미실현"
                value={formatKrw(holding.unrealizedPnlKrw)}
                tone={signedTextClass(holding.unrealizedPnlKrw)}
              />
              <Metric label="최신 목표가" value={report ? formatAssetTarget(report) : '—'} />
              <Metric label="목표 진행" value={formatPercent(progress)} />
            </dl>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-base-200" aria-label="목표 진행률">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(4, (progress ?? 0) * 100))}%` }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function BuyTape({ trades }: { trades: TradeRow[] }) {
  if (!trades.length)
    return <article className="lab-panel p-5 text-sm text-base-content/60">최근 매수 체결이 없습니다.</article>;
  return (
    <article className="lab-panel p-3">
      <div className="feed-list">
        {trades.map((trade, index) => (
          <Link
            key={`${trade.persona}-${trade.date}-${trade.symbol}-${index}`}
            href={`/reports/${trade.symbol}`}
            className="feed-item"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="badge badge-success badge-soft badge-sm">BUY</span>
                <span className="truncate font-bold text-sm">{trade.symbol}</span>
              </div>
              <div className="feed-item__meta">
                {formatDateKo(trade.date)} · {trade.reason || 'report-linked'} · {formatQuantity(trade.qty)}주
              </div>
            </div>
            <div className="grid justify-items-end gap-1 text-right">
              <span className="feed-item__value">{formatKrw(trade.grossKrw)}</span>
              <Money native={trade.grossNative} krw={trade.grossKrw} currency={trade.currency} layout="inline" />
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}

function UpdateFeed({
  snapshotDate,
  stats,
  portfolio,
}: {
  snapshotDate: string;
  stats: ReturnType<typeof getExecutiveOverview>['reportStats'];
  portfolio: ReturnType<typeof getExecutiveOverview>['portfolio'];
}) {
  const items = [
    { tag: '기준일', text: `${snapshotDate || '—'} 기준으로 화면을 갱신했습니다`, value: '확정' },
    {
      tag: 'Portfolio',
      text: `${portfolio.holdingCount}개 현재 보유와 원장형 손익 동기화`,
      value: formatKrw(portfolio.unrealizedPnlKrw),
    },
    {
      tag: 'Target',
      text: `목표가 도달 ${stats.hitCount}/${stats.total}건 검증`,
      value: formatPercent(stats.targetHitRate),
    },
    {
      tag: '리포트',
      text: `최근 발간 ${formatDateKo(stats.latestPublicationDate)}까지 반영`,
      value: `${stats.activeCount}건 진행 중`,
    },
    { tag: '거래', text: '실제 주문이나 실시간 매매 기능은 제공하지 않습니다', value: '읽기 전용' },
  ];
  return (
    <div className="feed-list">
      {items.map((item) => (
        <div className="feed-item" key={item.tag}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="status-dot text-primary" aria-hidden="true" />
              <span className="truncate text-sm font-bold">{item.text}</span>
            </div>
            <div className="feed-item__meta">{item.tag}</div>
          </div>
          <span className="feed-item__value text-base-content/70">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function CandidateMiniCard({ candidate, rank }: { candidate: ResearchCandidate; rank: number }) {
  const report = candidate.report;
  return (
    <Link href={`/reports/${report.symbol}`} className="lab-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-primary badge-soft badge-sm">#{rank}</span>
        <span className="badge badge-ghost badge-sm font-mono">{report.symbol}</span>
        <span className="badge badge-outline badge-sm">{candidate.rankBasis}</span>
      </div>
      <h3 className="mt-2 truncate text-lg font-black tracking-[-0.035em]">{report.company || report.symbol}</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="현재" value={formatPercent(report.currentReturn)} tone={signedTextClass(report.currentReturn)} />
        <Metric label="업사이드" value={formatPercent(report.targetUpsideAtPub)} />
        <Metric label="목표 진행" value={formatPercent(report.targetProgressPct)} />
      </div>
      <div className="mt-3 text-xs text-base-content/55">
        <Money native={report.lastCloseNative} krw={report.lastCloseKrw} currency={report.currency} layout="inline" />
      </div>
    </Link>
  );
}

function Metric({ label, value, tone = 'text-base-content' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-base-200/60 p-3">
      <div className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-base-content/45">{label}</div>
      <div className={`mt-1 break-words font-mono text-sm font-black tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}

function FactLine({ label, value, tone = 'text-base-content' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-3 border-b border-base-200 py-2 last:border-b-0">
      <dt className="min-w-0 text-base-content/55">{label}</dt>
      <dd className={`min-w-0 max-w-[260px] break-words text-right font-mono font-bold tabular-nums ${tone}`}>
        {value}
      </dd>
    </div>
  );
}

function reportStatusBadge(report: ReportRow) {
  if (report.targetDirection === 'downside')
    return <span className="badge badge-warning badge-soft badge-sm">매도 의견</span>;
  if ((report.targetUpsideAtPub ?? 0) <= 0)
    return <span className="badge badge-warning badge-soft badge-sm">비실행</span>;
  if (report.targetHit) return <span className="badge badge-success badge-soft badge-sm">도달</span>;
  if (report.expired) return <span className="badge badge-error badge-soft badge-sm">만료</span>;
  return <span className="badge badge-primary badge-soft badge-sm">진행 중</span>;
}

function TargetValidationFeed({ reports }: { reports: ReportRow[] }) {
  if (!reports.length) {
    return <div className="text-sm text-base-content/60">검증할 최근 리포트가 없습니다.</div>;
  }
  return (
    <div className="feed-list">
      {reports.map((report) => {
        const progress = Math.max(0, Math.min(1, report.targetProgressPct ?? (report.targetHit ? 1 : 0)));
        return (
          <Link key={report.reportId} href={`/reports/${report.symbol}`} className="feed-item feed-item--stacked">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-bold">{report.company || report.symbol}</span>
                <span className="badge badge-ghost badge-sm font-mono">{report.symbol}</span>
              </div>
              <div className="feed-item__meta">
                {formatDateKo(report.publicationDate)} · 현재 {formatPercent(report.currentReturn)} · 진행{' '}
                {formatPercent(report.targetProgressPct)}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-200" aria-label="목표가 진행률">
                <div
                  className={`h-full rounded-full ${report.targetHit ? 'bg-success' : report.expired ? 'bg-error' : 'bg-primary'}`}
                  style={{ width: `${Math.max(4, progress * 100)}%` }}
                />
              </div>
            </div>
            <div className="grid justify-items-end gap-1 text-right">
              {reportStatusBadge(report)}
              <span className="feed-item__value text-base-content/55">
                {report.daysToTarget !== null ? formatDays(report.daysToTarget) : report.expired ? '만료' : '진행'}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function formatAssetTarget(report: ReportRow): string {
  if (
    report.targetPriceNative === null ||
    report.targetPriceNative === undefined ||
    !Number.isFinite(report.targetPriceNative)
  ) {
    return '—';
  }
  return `${report.targetPriceNative.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} ${report.currency}`;
}

function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}
