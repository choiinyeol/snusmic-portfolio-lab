import Link from 'next/link';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { Money } from '@/components/ui/Money';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import {
  getCurrentHoldings,
  getDataQuality,
  getEquityDaily,
  getReportTargetsById,
  getLatestReportTargetsBySymbol,
  getPersonaLabel,
  getReportRows,
  getSummaryRows,
  getTrades,
  type EquityPoint,
  type HoldingRow,
  type ReportRow,
  type SummaryRow,
} from '@/lib/artifacts';
import { formatDateKo, formatDays, formatKrw, formatPercent } from '@/lib/format';

const PERSONA_PRIMARY = 'smic_follower_v2';
const DASHBOARD_SERIES = ['benchmark_kodex200', 'all_weather', 'smic_follower_v2', 'smic_mtt_strategy_optuna_top2'];
const SERIES_COLORS = ['#22c55e', '#7c3aed', '#2563eb', '#ef4444'];

export default function DashboardPage() {
  const reports = getReportRows();
  const summaries = getSummaryRows();
  const quality = getDataQuality();
  const equity = getEquityDaily();
  const trades = getTrades();
  const holdings = getCurrentHoldings()
    .filter((row) => row.persona === PERSONA_PRIMARY)
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  const targets = getLatestReportTargetsBySymbol();
  const targetsByReportId = getReportTargetsById();
  const latestDate = reports.reduce(
    (latest, report) => (report.publicationDate > latest ? report.publicationDate : latest),
    '',
  );
  const primarySummary = summaries.find((summary) => summary.persona === PERSONA_PRIMARY);
  const bestStrategy = summaries
    .filter((summary) => summary.persona.startsWith('smic_mtt_strategy_optuna_top'))
    .sort((a, b) => (b.moneyWeightedReturn ?? -999) - (a.moneyWeightedReturn ?? -999))[0];
  const strongestBenchmark = summaries
    .filter((summary) => !summary.persona.startsWith('smic_mtt_strategy_optuna_top'))
    .sort((a, b) => (b.moneyWeightedReturn ?? -999) - (a.moneyWeightedReturn ?? -999))[0];
  const newestReports = [...reports]
    .filter((report) => report.publicationDate)
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
    .slice(0, 8);
  const recentBuys = trades.filter((trade) => trade.persona === PERSONA_PRIMARY && trade.side === 'buy').slice(0, 6);
  const chartSeries = buildDashboardSeries(equity, summaries);
  const primarySeries = chartSeries.find((series) => series.id === PERSONA_PRIMARY)?.points ?? [];

  return (
    <>
      <PageHero
        eyebrow="PORTFOLIO LAB"
        title="SNUSMIC Portfolio Lab"
        subtitle="리서치 추천, 포트폴리오 원장, 전략 검증을 한 곳에서 추적하는 정적 스냅샷 기반 투자 리서치 대시보드입니다."
        badges={[
          { label: 'Snapshot', value: latestDate || '—' },
          { label: 'Reports', value: `${reports.length}건` },
          { label: 'Price matched', value: `${quality.reportsWithPrices}건` },
          { label: 'Primary book', value: getPersonaLabel(PERSONA_PRIMARY) },
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile
          label="현재 평가액"
          value={formatKrw(primarySummary?.finalEquityKrw ?? null)}
          delta={`${holdings.length}개 보유 · 체결 ${trades.filter((trade) => trade.persona === PERSONA_PRIMARY).length.toLocaleString('ko-KR')}건`}
          tone="accent"
        >
          <MiniSparkline points={primarySeries} tone="accent" />
        </KpiTile>
        <KpiTile
          label="Primary MWR"
          value={formatPercent(primarySummary?.moneyWeightedReturn ?? null)}
          delta={`MDD ${formatPercent(primarySummary?.maxDrawdown ?? null)}`}
          tone={(primarySummary?.moneyWeightedReturn ?? 0) >= 0 ? 'good' : 'bad'}
        >
          <MiniSparkline
            points={primarySeries}
            tone={(primarySummary?.moneyWeightedReturn ?? 0) >= 0 ? 'good' : 'bad'}
          />
        </KpiTile>
        <KpiTile
          label="현재 보유 손익"
          value={formatKrw(holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0))}
          delta={`상위 5 비중 ${formatPercent(topWeight(holdings, 5))}`}
          tone={holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0) >= 0 ? 'good' : 'bad'}
        >
          <MiniSparkline
            points={holdings.map((row, index) => ({
              time: row.symbol || String(index),
              value: row.unrealizedReturn ?? 0,
            }))}
            tone={holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0) >= 0 ? 'good' : 'bad'}
          />
        </KpiTile>
        <KpiTile
          label="최강 벤치마크"
          value={strongestBenchmark?.label ?? '—'}
          delta={strongestBenchmark ? formatPercent(strongestBenchmark.moneyWeightedReturn) : '—'}
          tone="warn"
        >
          <MiniSparkline points={seriesPoints(equity, strongestBenchmark?.persona)} tone="warn" />
        </KpiTile>
        <KpiTile
          label="목표가 도달률"
          value={formatPercent(quality.targetHitRate)}
          delta={`${quality.reportsWithPrices}/${quality.totalReports} 가격 매칭`}
          tone="accent"
        >
          <MiniSparkline
            points={reports.map((report, index) => ({
              time: report.publicationDate || String(index),
              value: report.targetHit ? 1 : 0,
            }))}
            tone="accent"
          />
        </KpiTile>
        <KpiTile
          label="최고 원장 전략"
          value={bestStrategy?.label ?? '—'}
          delta={bestStrategy ? formatPercent(bestStrategy.moneyWeightedReturn) : '—'}
          tone="good"
        >
          <MiniSparkline points={seriesPoints(equity, bestStrategy?.persona)} tone="good" />
        </KpiTile>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.16fr)_minmax(320px,.84fr)]">
        <Section eyebrow="Portfolio" title="포트폴리오 구성">
          <article className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <HoldingsTreemap holdings={holdings} />
          </article>
        </Section>
        <div className="grid min-w-0 gap-4">
          <RiskSummaryPanel holdings={holdings} summaries={summaries} primarySummary={primarySummary} />
          <RecentReportsPanel reports={newestReports.slice(0, 5)} />
        </div>
      </div>

      <Section eyebrow="Board" title="전략·벤치마크 누적 경로">
        <article className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm md:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3 px-1">
            <div>
              <div className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-base-content/45">
                Cumulative return path
              </div>
              <div className="text-sm text-base-content/55">벤치마크·전략 누적 수익률 · static artifact</div>
            </div>
            <span className="rounded-full border border-base-300 bg-base-200/60 px-2.5 py-1 font-mono text-[0.7rem] text-base-content/60">
              {chartSeries[0]?.points.length ?? 0} pts
            </span>
          </div>
          <CumulativeReturnChart series={chartSeries} />
        </article>
      </Section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)]">
        <Section
          eyebrow="Holdings"
          title={`현재 보유와 최신 목표가 컨텍스트 (${getPersonaLabel(PERSONA_PRIMARY)})`}
          actions={
            <Link className="btn btn-sm btn-outline" href="/portfolio">
              전체 원장 →
            </Link>
          }
        >
          <div className="grid gap-3">
            {holdings.slice(0, 6).map((row) => (
              <HoldingTapeItem key={row.symbol} row={row} report={targets[row.symbol]} />
            ))}
          </div>
        </Section>

        <Section eyebrow="Tape" title="최근 매수 체결">
          <div className="grid gap-2">
            {recentBuys.map((trade) => {
              const tradeTarget = trade.reportId ? (targetsByReportId[trade.reportId] ?? null) : null;
              const latestTarget = targets[trade.symbol];
              const displayTarget = tradeTarget ?? latestTarget;
              return (
                <Link
                  key={`${trade.date}-${trade.symbol}-${trade.qty}-${trade.grossKrw}`}
                  href={`/reports/${trade.symbol}`}
                  className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm transition hover:border-primary/30"
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(132px,auto)] sm:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="min-w-0 truncate">{displayTarget?.company ?? trade.symbol}</strong>
                        <span className="badge badge-ghost badge-sm font-mono">{trade.symbol}</span>
                      </div>
                      <div className="mt-1 text-xs text-base-content/55">
                        {formatDateKo(trade.date)} · {humanReason(trade.reason)} ·{' '}
                        {trade.qty?.toLocaleString('ko-KR') ?? '—'}주
                      </div>
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <Money native={trade.grossNative} krw={trade.grossKrw} currency={trade.currency} />
                      <div className="mt-0.5 text-xs leading-snug text-base-content/55">
                        {tradeTarget ? `리포트 근거 ${tradeTarget.publicationDate}` : '원장 체결 · 최신 리포트 참고'}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,.92fr)_minmax(320px,.58fr)]">
        <StrategyPerformancePanel summaries={summaries} />
        <RecentUpdatesPanel quality={quality} holdings={holdings} strongestBenchmark={strongestBenchmark} />
      </div>

      <Section
        eyebrow="Research"
        title="최근 리포트 검증 피드"
        actions={
          <Link className="btn btn-sm btn-outline" href="/reports">
            전체 보기 →
          </Link>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {newestReports.map((report) => (
            <ReportFeedCard key={`${report.symbol}-${report.publicationDate}`} report={report} />
          ))}
        </div>
      </Section>
    </>
  );
}

function RiskSummaryPanel({
  holdings,
  summaries,
  primarySummary,
}: {
  holdings: HoldingRow[];
  summaries: SummaryRow[];
  primarySummary?: SummaryRow;
}) {
  const totalValue = holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const top5 = topWeight(holdings, 5);
  const positiveCount = holdings.filter((row) => (row.unrealizedReturn ?? 0) > 0).length;
  const benchmarkCount = summaries.filter(
    (summary) => !summary.persona.startsWith('smic_mtt_strategy_optuna_top'),
  ).length;
  const exposureBars = buildExposureBars(holdings, totalValue);
  return (
    <Section eyebrow="Risk" title="리스크 요약">
      <article className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <dl className="grid gap-3 text-sm">
          <RiskLine label="Top 5 비중" value={formatPercent(top5)} />
          <RiskLine label="보유 종목" value={`${holdings.length.toLocaleString('ko-KR')}개`} />
          <RiskLine label="수익 포지션" value={`${positiveCount}/${holdings.length}`} />
          <RiskLine label="Primary MDD" value={formatPercent(primarySummary?.maxDrawdown ?? null)} tone="text-error" />
          <RiskLine label="비교 기준" value={`${benchmarkCount}개 벤치마크`} />
        </dl>
        <div className="mt-4 border-t border-base-300 pt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-base-content/45">Exposure</div>
          <div className="grid gap-2">
            {exposureBars.map((item) => (
              <div key={item.label} className="grid gap-1">
                <div className="flex justify-between gap-2 text-xs font-semibold text-base-content/65">
                  <span>{item.label}</span>
                  <span className="tabular-nums">{formatPercent(item.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-base-200">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.min(100, item.value * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </article>
    </Section>
  );
}

function RecentReportsPanel({ reports }: { reports: ReportRow[] }) {
  return (
    <Section
      eyebrow="Research"
      title="최근 발간 리포트"
      actions={
        <Link className="btn btn-sm btn-ghost" href="/reports">
          전체 보기
        </Link>
      }
    >
      <article className="grid gap-2 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        {reports.map((report) => (
          <Link
            key={`${report.symbol}-${report.publicationDate}-compact`}
            href={`/reports/${report.symbol}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 border-b border-base-200 px-3 py-2.5 transition last:border-b-0 hover:bg-base-200/45"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-black">{report.company || report.symbol}</div>
              <div className="text-xs text-base-content/55">{formatDateKo(report.publicationDate)}</div>
            </div>
            <strong
              className={`text-xs tabular-nums ${(report.currentReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}
            >
              {formatPercent(report.currentReturn)}
            </strong>
          </Link>
        ))}
      </article>
    </Section>
  );
}

function StrategyPerformancePanel({ summaries }: { summaries: SummaryRow[] }) {
  const rows = [
    'smic_follower_v2',
    'smic_follower_v1',
    'benchmark_kodex200',
    'benchmark_qqq',
    'benchmark_spy',
    'all_weather',
    'smic_mtt_strategy_optuna_top1',
    'smic_mtt_strategy_optuna_top2',
  ]
    .map((persona) => summaries.find((summary) => summary.persona === persona))
    .filter((summary): summary is SummaryRow => Boolean(summary));

  return (
    <Section eyebrow="Strategy" title="전략 성과 요약">
      <article className="overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
        <table className="table table-sm w-full">
          <thead>
            <tr>
              <th>전략</th>
              <th className="text-right">MWR</th>
              <th className="text-right">MDD</th>
              <th className="text-right">거래</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.persona}>
                <td className="truncate font-bold">{row.label ?? getPersonaLabel(row.persona)}</td>
                <td
                  className={`text-right font-mono font-bold ${(row.moneyWeightedReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}
                >
                  {formatPercent(row.moneyWeightedReturn ?? null)}
                </td>
                <td className="text-right font-mono text-error">{formatPercent(row.maxDrawdown)}</td>
                <td className="text-right font-mono">{row.tradeCount?.toLocaleString('ko-KR') ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </Section>
  );
}

function RecentUpdatesPanel({
  quality,
  holdings,
  strongestBenchmark,
}: {
  quality: ReturnType<typeof getDataQuality>;
  holdings: HoldingRow[];
  strongestBenchmark?: SummaryRow;
}) {
  const updates = [
    {
      tag: 'Snapshot',
      text: `${quality.totalReports.toLocaleString('ko-KR')}개 리포트 중 ${quality.reportsWithPrices.toLocaleString('ko-KR')}개 가격 매칭`,
    },
    {
      tag: 'Portfolio',
      text: `현재 ${holdings.length.toLocaleString('ko-KR')}개 포지션을 원장 기준으로 보유`,
    },
    { tag: 'Benchmark', text: `최강 기준선: ${strongestBenchmark?.label ?? '—'}` },
    { tag: 'Target', text: `목표가 도달률 ${formatPercent(quality.targetHitRate)}` },
  ];
  return (
    <Section eyebrow="Updates" title="최근 업데이트">
      <article className="grid gap-2 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        {updates.map((item) => (
          <div
            key={item.tag}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-base-200 px-1 py-2.5 text-sm last:border-b-0"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <div className="min-w-0 truncate">{item.text}</div>
            <span className="badge badge-primary badge-soft badge-sm shrink-0">{item.tag}</span>
          </div>
        ))}
      </article>
    </Section>
  );
}

function RiskLine({ label, value, tone = 'text-base-content' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-base-200 px-1 py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <dt className="text-base-content/60">{label}</dt>
      <dd className={`min-w-0 text-right font-mono font-bold ${tone}`}>{value}</dd>
    </div>
  );
}

function buildExposureBars(holdings: HoldingRow[], totalValue: number) {
  if (totalValue <= 0) return [];
  const buckets = new Map<string, number>();
  for (const row of holdings) {
    const label = row.currency === 'KRW' ? 'KR' : row.currency === 'USD' ? 'US' : row.currency || 'Other';
    buckets.set(label, (buckets.get(label) ?? 0) + (row.marketValueKrw ?? 0));
  }
  return [...buckets.entries()]
    .map(([label, value]) => ({ label, value: value / totalValue }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function seriesPoints(equity: EquityPoint[], persona?: string): ReturnSeries['points'] {
  if (!persona) return [];
  return equity
    .filter((point) => point.persona === persona && point.cumulativeReturn !== null)
    .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 }));
}

function MiniSparkline({
  points,
  tone,
}: {
  points: { value: number | null }[];
  tone: 'good' | 'bad' | 'warn' | 'accent';
}) {
  const values = points.map((point) => point.value).filter((value): value is number => Number.isFinite(value));
  if (values.length < 2) return <div className="h-8 rounded-xl bg-base-200/70" />;
  const sampled = values.filter((_, index) => index % Math.max(1, Math.floor(values.length / 36)) === 0).slice(-36);
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;
  const d = sampled
    .map((value, index) => {
      const x = (index / Math.max(1, sampled.length - 1)) * 100;
      const y = 28 - ((value - min) / span) * 24;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  const color = tone === 'bad' ? '#ef4444' : tone === 'warn' ? '#f59e0b' : tone === 'good' ? '#16a368' : '#4f7cff';
  return (
    <svg className="h-8 w-full overflow-visible" viewBox="0 0 100 32" role="img" aria-label="mini trend">
      <path d={`${d} L 100 32 L 0 32 Z`} fill={color} fillOpacity="0.08" stroke="none" />
      <path d={d} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function HoldingTapeItem({
  row,
  report,
}: {
  row: HoldingRow;
  report?: ReturnType<typeof getLatestReportTargetsBySymbol>[string];
}) {
  const gap =
    report?.targetPriceKrw && row.lastCloseKrw && row.lastCloseKrw > 0
      ? report.targetPriceKrw / row.lastCloseKrw - 1
      : null;
  const progress = progressFromHolding(row, report);
  const nativeMarketValue = row.lastCloseNative !== null && row.qty !== null ? row.lastCloseNative * row.qty : null;
  return (
    <Link
      href={`/reports/${row.symbol}`}
      className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(150px,auto)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="min-w-0 truncate text-base">{row.company || row.symbol}</strong>
            <span className="badge badge-ghost badge-sm font-mono">{row.symbol}</span>
            <span className="badge badge-outline badge-sm">{row.currency}</span>
          </div>
          <div className="mt-2 grid gap-2 text-xs text-base-content/60 sm:grid-cols-3">
            <span>
              수량 <b className="text-base-content">{row.qty?.toLocaleString('ko-KR') ?? '—'}</b>
            </span>
            <span>
              평단 <b className="text-base-content">{formatKrw(row.avgCostKrw)}</b>
            </span>
            <span>
              보유 <b className="text-base-content">{formatDays(row.holdingDays)}</b>
            </span>
          </div>
        </div>
        <div className="min-w-0 text-left lg:text-right">
          <Money native={nativeMarketValue} krw={row.marketValueKrw} currency={row.currency} />
          <div
            className={`mt-0.5 text-xs font-bold leading-snug ${(row.unrealizedReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}
          >
            {formatPercent(row.unrealizedReturn)} · 손익 {formatKrw(row.unrealizedPnlKrw)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <span className="badge badge-ghost badge-sm">최신 목표가 참고</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-base-200">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(0, Math.min(100, (progress ?? 0) * 100))}%` }}
          />
        </div>
        <span className="text-xs font-bold tabular-nums text-base-content/70 sm:text-right">
          목표 {progress === null ? '—' : formatPercent(progress)}
          {gap !== null ? ` · ${formatPercent(gap)}` : ''}
        </span>
      </div>
    </Link>
  );
}

function ReportFeedCard({ report }: { report: ReportRow }) {
  return (
    <Link
      href={`/reports/${report.symbol}`}
      className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/50">
            {formatDateKo(report.publicationDate)}
          </div>
          <h3 className="mt-1 truncate text-base font-black">{report.company || report.symbol}</h3>
        </div>
        {statusBadge(report)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <span className="badge badge-ghost badge-sm font-mono">{report.symbol}</span>
          {report.exchange ? <span className="badge badge-outline badge-sm">{report.exchange}</span> : null}
        </div>
        <strong className={`tabular-nums ${(report.currentReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
          {formatPercent(report.currentReturn)}
        </strong>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-base-200">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, (report.targetProgressPct ?? 0) * 100))}%` }}
        />
      </div>
      <div className="mt-1 text-right text-xs font-semibold text-base-content/50">
        목표 진행 {formatPercent(report.targetProgressPct)}
      </div>
    </Link>
  );
}

function buildDashboardSeries(equity: EquityPoint[], summaries: SummaryRow[]): ReturnSeries[] {
  const available = new Set(summaries.map((summary) => summary.persona));
  return DASHBOARD_SERIES.filter((persona) => available.has(persona)).map((persona, index) => ({
    id: persona,
    label: getPersonaLabel(persona),
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: equity
      .filter((point) => point.persona === persona && point.cumulativeReturn !== null)
      .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
  }));
}

function progressFromHolding(
  row: HoldingRow,
  report: ReturnType<typeof getLatestReportTargetsBySymbol>[string] | undefined,
): number | null {
  if (!report?.targetPriceKrw || !row.avgCostKrw || !row.lastCloseKrw) return null;
  const targetMove = report.targetPriceKrw - row.avgCostKrw;
  if (targetMove === 0) return null;
  return Math.max(0, Math.min(1, (row.lastCloseKrw - row.avgCostKrw) / targetMove));
}

function topWeight(rows: HoldingRow[], count: number): number | null {
  const total = rows.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  if (total <= 0) return null;
  const top = rows.slice(0, count).reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  return top / total;
}

function statusBadge(report: ReportRow) {
  if (report.targetDirection === 'downside') {
    if (report.targetHit) return <span className="badge badge-success badge-soft badge-sm">매도 적중</span>;
    if (report.expired) return <span className="badge badge-error badge-soft badge-sm">매도 만료</span>;
    return <span className="badge badge-warning badge-soft badge-sm">매도 의견</span>;
  }
  if ((report.targetUpsideAtPub ?? 0) <= 0) {
    return <span className="badge badge-warning badge-soft badge-sm">비실행</span>;
  }
  if (report.targetHit) {
    return <span className="badge badge-success badge-soft badge-sm">도달</span>;
  }
  if (report.expired) {
    return <span className="badge badge-error badge-soft badge-sm">만료</span>;
  }
  return <span className="badge badge-primary badge-soft badge-sm">진행</span>;
}

function humanReason(reason: string): string {
  if (reason.includes('target_hit')) return '목표가 도달';
  if (reason.includes('stop')) return '손절/리스크 제한';
  if (reason.includes('rebalance_buy')) return '리밸런싱 매수';
  if (reason.includes('rebalance_sell')) return '리밸런싱 매도';
  if (reason.includes('deposit_buy')) return '입금 후 매수';
  if (reason.includes('top_up')) return '추가 매수';
  if (reason.includes('time')) return '시간 기준 청산';
  return reason.replace(/[()']/g, '') || '—';
}
