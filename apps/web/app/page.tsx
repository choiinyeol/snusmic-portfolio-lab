import Link from 'next/link';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { KpiTile } from '@/components/ui/KpiTile';
import { MiniSparkline } from '@/components/ui/MiniSparkline';
import { Money } from '@/components/ui/Money';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import {
  getEquityDaily,
  getPersonaLabel,
  getReportRows,
  getTrades,
  type EquityPoint,
  type HoldingRow,
  type ReportRow,
  type TradeRow,
} from '@/lib/artifacts';
import { formatDateKo, formatDays, formatKrw, formatPercent, signedTextClass } from '@/lib/format';
import {
  BENCHMARK_IDS,
  compactStrategyLabel,
  getBenchmarkRows,
  getExecutiveOverview,
  getObjectivePassingRows,
  getSelectableStrategyRows,
  getStrategyLeaderboard,
  OBJECTIVE_MAX_DRAWDOWN,
  PRIMARY_PERSONA,
  TARGET_BENCHMARK_ID,
  type ResearchCandidate,
  type StrategyLeaderboardRow,
} from '@/lib/product-model';

const DASHBOARD_SERIES = [...BENCHMARK_IDS, 'smic_mtt_strategy_top1', 'smic_mtt_strategy_top2'] as const;
const SERIES_COLORS = [
  '#64748b',
  '#7c3aed',
  '#0ea5e9',
  '#f59e0b',
  '#2563eb',
  '#16a368',
  '#ef4444',
  '#111827',
  '#14b8a6',
  '#a855f7',
];

export default function OverviewPage() {
  const overview = getExecutiveOverview();
  const strategyRows = getStrategyLeaderboard();
  const trades = getTrades();
  const reports = getReportRows();
  const latestReportsBySymbol = latestReportBySymbol(reports);
  const equity = getEquityDaily();
  const chartSeries = buildDashboardSeries(equity);
  const primarySeries = chartSeries.find((series) => series.id === PRIMARY_PERSONA)?.points ?? [];
  const benchmarkRows = getBenchmarkRows(strategyRows);
  const selectableRows = getSelectableStrategyRows(strategyRows);
  const objectiveRows = getObjectivePassingRows(strategyRows);
  const benchmarkToBeat = benchmarkRows.find((row) => row.id === TARGET_BENCHMARK_ID);
  const recentBuys = trades
    .filter((trade) => trade.persona === PRIMARY_PERSONA && trade.side === 'buy')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return (
    <>
      <PageHero
        eyebrow="PORTFOLIO LAB"
        title="SNUSMIC Portfolio Lab"
        subtitle="리서치 추천, 포트폴리오 원장, 전략 검증을 한 곳에서 추적하는 정적 스냅샷 기반 투자 리서치 대시보드입니다."
        badges={[
          { label: 'Snapshot', value: overview.snapshotDate || '—' },
          { label: 'Reports', value: `${overview.reportStats.total}건` },
          { label: 'Price matched', value: 'Canonical artifacts' },
          { label: 'Primary book', value: overview.portfolio.label },
          { label: 'Mode', value: 'Static Artifacts' },
          { label: 'Trading', value: 'No live trading' },
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
        kpis={
          <div className="metric-strip">
            <KpiTile
              compact
              label="현재 평가액"
              value={formatKrw(overview.portfolio.finalEquityKrw)}
              delta={`${overview.portfolio.holdingCount}개 보유`}
              tone="accent"
              showToneBadge={false}
            >
              <MiniSparkline points={primarySeries} tone="accent" label="Primary portfolio trend" />
            </KpiTile>
            <KpiTile
              compact
              label="Primary MWR"
              value={formatPercent(overview.portfolio.moneyWeightedReturn)}
              delta={`MDD ${formatPercent(overview.portfolio.maxDrawdown)}`}
              tone={(overview.portfolio.moneyWeightedReturn ?? 0) >= 0 ? 'good' : 'bad'}
              showToneBadge={false}
            />
            <KpiTile
              compact
              label="현재 보유 손익"
              value={formatKrw(overview.portfolio.unrealizedPnlKrw)}
              delta={`${overview.portfolio.positiveHoldingCount}/${overview.portfolio.holdingCount} 수익 포지션`}
              tone={(overview.portfolio.unrealizedPnlKrw ?? 0) >= 0 ? 'good' : 'bad'}
              showToneBadge={false}
            />
            <KpiTile
              compact
              label="KOSPI 기준선"
              value={benchmarkToBeat?.label ?? '—'}
              delta={`수익률 ${formatPercent(benchmarkToBeat?.returnPct)} · MDD ${formatPercent(benchmarkToBeat?.maxDrawdown)}`}
              tone="neutral"
              valueClassName="text-base"
            />
            <KpiTile
              compact
              label="목표가 도달률"
              value={formatPercent(overview.reportStats.targetHitRate)}
              delta={`${overview.reportStats.hitCount}/${overview.reportStats.total}`}
              tone="good"
              showToneBadge={false}
            />
            <KpiTile
              compact
              label="목표 게이트"
              value={objectiveRows.length ? `${objectiveRows.length}개 통과` : '통과 없음'}
              delta={`MDD ≤ ${formatPercent(OBJECTIVE_MAX_DRAWDOWN)} · KOSPI 초과`}
              tone={objectiveRows.length ? 'good' : 'warn'}
              valueClassName="truncate text-base"
              showToneBadge={false}
            />
          </div>
        }
      />

      <Section
        eyebrow="Snapshot Board"
        title="현재 상태 대시보드"
        caption="YASUN식 정보 밀도는 빌리되, 실시간 매매가 아닌 정적 리서치 검증 흐름으로 재구성했습니다."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.55fr)_minmax(300px,.55fr)]">
          <article className="lab-panel">
            <div className="lab-panel__head">
              <div className="min-w-0">
                <div className="lab-panel__eyebrow">Portfolio</div>
                <h2 className="lab-panel__title">포트폴리오 구성</h2>
              </div>
              <span className="artifact-status">
                <span className="status-dot" aria-hidden="true" /> 정적 스냅샷
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
              />
            </div>
          </article>
          <RiskSummary holdings={overview.portfolio.holdings} rows={strategyRows} overview={overview} />
          <RecentReportsPanel reports={overview.recentReports.slice(0, 7)} />
        </div>
      </Section>

      <Section
        eyebrow="Performance"
        title="벤치마크 세트와 선택 가능 전략의 누적 경로"
        caption="All-Weather, SMIC Follower, KOSPI/QQQ/SPY/GLD/Weak Prophet은 기준선이고, SMIC MTT 계열은 별도 선택 가능 전략입니다."
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
        <article className="lab-panel p-3 md:p-4">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="snapshot-pill">벤치마크 {benchmarkRows.length}</span>
            <span className="snapshot-pill">선택 전략 {selectableRows.length}</span>
            <span className="snapshot-pill">목표: MDD 15% 이하 · KOSPI 초과</span>
          </div>
          <CumulativeReturnChart series={chartSeries} />
        </article>
      </Section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.72fr)]">
        <Section
          eyebrow="Holdings"
          title="현재 보유와 최신 목표가 컨텍스트"
          actions={
            <Link className="btn btn-sm btn-outline" href="/portfolio">
              Portfolio →
            </Link>
          }
        >
          <HoldingContext holdings={overview.portfolio.holdings.slice(0, 8)} reportsBySymbol={latestReportsBySymbol} />
        </Section>

        <Section
          eyebrow="Tape"
          title="최근 매수 체결"
          actions={
            <Link className="btn btn-sm btn-outline" href="/portfolio">
              원장 →
            </Link>
          }
        >
          <BuyTape trades={recentBuys} />
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.72fr)]">
        <Section
          eyebrow="Strategy"
          title="전략 성과 요약"
          actions={
            <Link className="btn btn-sm btn-outline" href="/strategies">
              Strategy →
            </Link>
          }
        >
          <StrategyLeaderboard rows={strategyRows.slice(0, 7)} />
        </Section>

        <Section eyebrow="Updates" title="최근 업데이트">
          <UpdateFeed
            snapshotDate={overview.snapshotDate}
            stats={overview.reportStats}
            portfolio={overview.portfolio}
          />
        </Section>
      </div>

      <Section
        eyebrow="Screener"
        title="리포트 기반 후보 랭킹"
        caption="블랙박스 점수가 아니라 최근성, 목표 업사이드, 목표 진행률, 미도달·미만료 상태로 설명 가능한 후보입니다."
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
          <FactLine label="Primary MDD" value={formatPercent(overview.portfolio.maxDrawdown)} tone="text-error" />
          <FactLine label="벤치마크 수" value={`${benchmarkCount}개`} />
        </dl>
        <div className="grid gap-2 pt-2">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/45">Currency exposure</div>
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

function StrategyLeaderboard({ rows }: { rows: StrategyLeaderboardRow[] }) {
  return (
    <article className="board-table-wrap">
      <table className="board-table table table-sm table-density-compact w-full">
        <thead>
          <tr>
            <th>전략</th>
            <th className="text-right">수익률</th>
            <th className="text-right">Sharpe</th>
            <th className="text-right">Sortino</th>
            <th className="text-right">MDD</th>
            <th className="text-right">KOSPI 초과</th>
            <th className="text-right">목표</th>
            <th className="text-right">거래</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="min-w-[210px] max-w-[320px] truncate font-bold">
                <Link href={row.href}>{row.label}</Link>
                <div className="mt-1">
                  <span
                    className={`badge badge-sm ${row.kind === 'benchmark' ? 'badge-ghost' : 'badge-primary badge-soft'}`}
                  >
                    {strategyKindLabel(row.kind)}
                  </span>
                </div>
              </td>
              <td className={`text-right font-mono font-black tabular-nums ${signedTextClass(row.returnPct)}`}>
                {formatPercent(row.returnPct)}
              </td>
              <td className="text-right font-mono tabular-nums">{formatNumber(row.sharpe)}</td>
              <td className="text-right font-mono tabular-nums">{formatNumber(row.sortino)}</td>
              <td className="text-right font-mono tabular-nums text-error">{formatPercent(row.maxDrawdown)}</td>
              <td className={`text-right font-mono font-bold tabular-nums ${signedTextClass(row.benchmarkExcess)}`}>
                {formatPercent(row.benchmarkExcess)}
              </td>
              <td className="text-right">
                {row.kind === 'benchmark' ? (
                  <span className="badge badge-ghost badge-xs">기준선</span>
                ) : row.objectivePassed ? (
                  <span className="badge badge-success badge-soft badge-xs">통과</span>
                ) : (
                  <span className="badge badge-warning badge-soft badge-xs">미달</span>
                )}
              </td>
              <td className="text-right font-mono tabular-nums">{row.tradeCount?.toLocaleString('ko-KR') ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function strategyKindLabel(kind: StrategyLeaderboardRow['kind']): string {
  if (kind === 'benchmark') return '벤치마크';
  return '고유 전략';
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
    { tag: 'Snapshot', text: `기준일 ${snapshotDate || '—'} 정적 스냅샷 반영`, value: 'Artifact' },
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
      tag: 'Reports',
      text: `최신 발간 ${formatDateKo(stats.latestPublicationDate)} 기준 후보 갱신`,
      value: `${stats.activeCount} active`,
    },
    { tag: 'Artifact', text: '외부 실시간 호출 없이 canonical data/web 산출물 사용', value: 'No live' },
  ];
  return (
    <article className="lab-panel p-3">
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
    </article>
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

function buildDashboardSeries(equity: EquityPoint[]): ReturnSeries[] {
  return DASHBOARD_SERIES.map((persona, index) => ({
    id: persona,
    label: compactStrategyLabel(persona, getPersonaLabel(persona)),
    shortLabel: compactStrategyLabel(persona, getPersonaLabel(persona)),
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: equity
      .filter((point) => point.persona === persona && point.cumulativeReturn !== null)
      .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
  })).filter((series) => series.points.length > 0);
}

function withCashHolding(holdings: HoldingRow[], cashKrw: number | null | undefined, persona: string): HoldingRow[] {
  if (!cashKrw || cashKrw <= 0) return holdings;
  return [
    ...holdings,
    {
      persona,
      symbol: 'CASH',
      company: '현금',
      qty: null,
      avgCostKrw: null,
      lastCloseKrw: 1,
      lastCloseNative: 1,
      currency: 'KRW',
      marketValueKrw: cashKrw,
      unrealizedPnlKrw: 0,
      unrealizedReturn: 0,
      holdingDays: null,
      firstBuyDate: null,
    },
  ];
}

function latestReportBySymbol(reports: ReportRow[]): Map<string, ReportRow> {
  const map = new Map<string, ReportRow>();
  for (const report of reports) {
    const current = map.get(report.symbol);
    if (!current || report.publicationDate > current.publicationDate) map.set(report.symbol, report);
  }
  return map;
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

function topWeight(holdings: HoldingRow[], count: number): number | null {
  const total = holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  if (total <= 0) return null;
  return holdings.slice(0, count).reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0) / total;
}

function currencyExposure(holdings: HoldingRow[], totalValue: number): Array<{ currency: string; weight: number }> {
  if (totalValue <= 0) return [];
  const grouped = new Map<string, number>();
  for (const holding of holdings) {
    grouped.set(
      holding.currency || 'Other',
      (grouped.get(holding.currency || 'Other') ?? 0) + (holding.marketValueKrw ?? 0),
    );
  }
  return [...grouped.entries()]
    .map(([currency, value]) => ({ currency, weight: value / totalValue }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}
