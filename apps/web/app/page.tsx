import Link from 'next/link';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { KpiTile } from '@/components/ui/KpiTile';
import { Money } from '@/components/ui/Money';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getEquityDaily, getPersonaLabel, type EquityPoint, type HoldingRow, type ReportRow } from '@/lib/artifacts';
import { formatDateKo, formatDays, formatKrw, formatPercent, signedTextClass } from '@/lib/format';
import {
  getExecutiveOverview,
  getStrategyLeaderboard,
  PRIMARY_PERSONA,
  type ResearchCandidate,
  type StrategyLeaderboardRow,
} from '@/lib/product-model';

const DASHBOARD_SERIES = ['benchmark_kodex200', 'benchmark_qqq', 'benchmark_spy', 'all_weather', PRIMARY_PERSONA];
const SERIES_COLORS = ['#64748b', '#7c3aed', '#0ea5e9', '#f59e0b', '#2563eb'];

export default function OverviewPage() {
  const overview = getExecutiveOverview();
  const strategyRows = getStrategyLeaderboard();
  const equity = getEquityDaily();
  const chartSeries = buildDashboardSeries(equity);
  const primarySeries = chartSeries.find((series) => series.id === PRIMARY_PERSONA)?.points ?? [];
  const benchmarkToBeat = strategyRows.find((row) => row.id.startsWith('benchmark_') || row.id === 'all_weather');
  const bestCandidate = strategyRows.find((row) => row.kind === 'candidate');

  return (
    <>
      <PageHero
        eyebrow="OVERVIEW"
        title="30초 안에 보는 Portfolio Lab"
        subtitle="정적 리서치 아티팩트로 포트폴리오, 전략 성과, 리포트 후보를 검증합니다."
        badges={[
          { label: 'Snapshot', value: overview.snapshotDate || '—' },
          { label: 'Mode', value: 'Static artifacts' },
          { label: 'Trading', value: 'No live orders' },
          { label: 'Primary book', value: overview.portfolio.label },
        ]}
        actions={
          <>
            <Link className="btn btn-sm btn-primary" href="/portfolio">
              원장 보기
            </Link>
            <Link className="btn btn-sm btn-outline" href="/strategies">
              전략 비교
            </Link>
            <Link className="btn btn-sm btn-ghost" href="/screener">
              후보 탐색
            </Link>
          </>
        }
        kpis={
          <div className="grid min-w-0 gap-3 min-[1400px]:grid-cols-2">
            <KpiTile
              label="현재 평가액"
              value={formatKrw(overview.portfolio.finalEquityKrw)}
              delta={`${overview.portfolio.holdingCount}개 보유`}
              tone="accent"
            >
              <MiniSparkline points={primarySeries} tone="accent" />
            </KpiTile>
            <KpiTile
              label="Primary MWR"
              value={formatPercent(overview.portfolio.moneyWeightedReturn)}
              delta={`MDD ${formatPercent(overview.portfolio.maxDrawdown)}`}
              tone={(overview.portfolio.moneyWeightedReturn ?? 0) >= 0 ? 'good' : 'bad'}
            />
            <KpiTile
              label="리포트 적중률"
              value={formatPercent(overview.reportStats.targetHitRate)}
              delta={`${overview.reportStats.hitCount}/${overview.reportStats.total}`}
              tone="good"
            />
            <KpiTile
              label="활성 후보"
              value={`${overview.researchCandidates.length}개`}
              delta="리포트 기반 Screener"
              tone="warn"
            />
          </div>
        }
      />

      <Section
        eyebrow="Executive Board"
        title="핵심 상태 네 가지"
        caption="프로젝트 개요 → 포트폴리오 상태 → 우수 전략 → 최근 리포트 순서로 읽히도록 고정했습니다."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(260px,.85fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(300px,.9fr)]">
          <ProjectBrief snapshotDate={overview.snapshotDate} />
          <PortfolioBrief holdings={overview.portfolio.holdings} />
          <StrategyBrief bestCandidate={bestCandidate} benchmark={benchmarkToBeat} />
          <RecentReportBrief reports={overview.recentReports.slice(0, 4)} />
        </div>
      </Section>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.12fr)_minmax(420px,.88fr)]">
        <Section
          eyebrow="Portfolio"
          title="현재 보유 구성"
          actions={
            <Link className="btn btn-sm btn-outline" href="/portfolio">
              Portfolio →
            </Link>
          }
        >
          <article className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <HoldingsTreemap holdings={overview.portfolio.holdings} />
          </article>
        </Section>

        <Section
          eyebrow="Strategy"
          title="수익률·리스크 리더보드"
          actions={
            <Link className="btn btn-sm btn-outline" href="/strategies">
              Strategy →
            </Link>
          }
        >
          <StrategyLeaderboard rows={strategyRows.slice(0, 6)} />
        </Section>
      </div>

      <Section eyebrow="Performance" title="포트폴리오와 벤치마크 누적 경로">
        <article className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm md:p-5">
          <CumulativeReturnChart series={chartSeries} />
        </article>
      </Section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.72fr)]">
        <Section
          eyebrow="Screener"
          title="리포트 기반 후보"
          actions={
            <Link className="btn btn-sm btn-outline" href="/screener">
              Screener →
            </Link>
          }
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {overview.researchCandidates.slice(0, 6).map((candidate, index) => (
              <CandidateMiniCard key={candidate.report.reportId} candidate={candidate} rank={index + 1} />
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Research Stats"
          title="리포트 검증 통계"
          actions={
            <Link className="btn btn-sm btn-outline" href="/reports">
              Research →
            </Link>
          }
        >
          <article className="rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
            <dl className="grid gap-3 text-sm">
              <FactLine label="총 리포트" value={`${overview.reportStats.total.toLocaleString('ko-KR')}건`} />
              <FactLine
                label="목표가 도달"
                value={`${overview.reportStats.hitCount.toLocaleString('ko-KR')}건`}
                tone="text-success"
              />
              <FactLine label="진행 중 후보" value={`${overview.reportStats.activeCount.toLocaleString('ko-KR')}건`} />
              <FactLine
                label="현재 플러스"
                value={formatPercent(overview.reportStats.positiveReturnRate)}
                tone="text-success"
              />
              <FactLine
                label="평균 현재 수익률"
                value={formatPercent(overview.reportStats.averageCurrentReturn)}
                tone={signedTextClass(overview.reportStats.averageCurrentReturn)}
              />
              <FactLine label="중앙 목표 도달일" value={formatDays(overview.reportStats.medianDaysToTarget)} />
            </dl>
          </article>
        </Section>
      </div>
    </>
  );
}

function ProjectBrief({ snapshotDate }: { snapshotDate: string }) {
  return (
    <article className="rounded-box border border-primary/20 bg-primary/5 p-5 shadow-sm">
      <div className="badge badge-primary badge-soft badge-sm">Project</div>
      <h2 className="mt-3 text-xl font-black tracking-[-0.04em]">정적 스냅샷 검증 랩</h2>
      <p className="mt-2 text-sm leading-6 text-base-content/65">
        리서치 추천, 원장 기반 포트폴리오, 전략 백테스트를 한 흐름에서 검증합니다. 실시간 시세·주문·브로커 연동은
        없습니다.
      </p>
      <dl className="mt-4 grid gap-2 text-xs">
        <FactLine label="Snapshot" value={snapshotDate || '—'} />
        <FactLine label="IA" value="Overview → Portfolio → Research → Strategy → Screener" />
      </dl>
    </article>
  );
}

function PortfolioBrief({ holdings }: { holdings: HoldingRow[] }) {
  const totalValue = holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const top = holdings[0];
  const topWeight = top?.marketValueKrw && totalValue > 0 ? top.marketValueKrw / totalValue : null;
  const pnl = holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  return (
    <article className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="badge badge-primary badge-soft badge-sm">Portfolio</div>
      <div className="mt-3 text-sm text-base-content/55">현재 보유 손익</div>
      <div className={`mt-1 break-words font-mono text-2xl font-black tabular-nums ${signedTextClass(pnl)}`}>
        {formatKrw(pnl)}
      </div>
      <dl className="mt-4 grid gap-2 text-xs">
        <FactLine label="보유 종목" value={`${holdings.length}개`} />
        <FactLine label="최대 보유" value={top ? `${top.company} · ${formatPercent(topWeight)}` : '—'} />
        <FactLine
          label="수익 포지션"
          value={`${holdings.filter((row) => (row.unrealizedReturn ?? 0) > 0).length}/${holdings.length}`}
        />
      </dl>
    </article>
  );
}

function StrategyBrief({
  bestCandidate,
  benchmark,
}: {
  bestCandidate?: StrategyLeaderboardRow;
  benchmark?: StrategyLeaderboardRow;
}) {
  return (
    <article className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="badge badge-success badge-soft badge-sm">Strategy</div>
      <div className="mt-3 text-sm text-base-content/55">최고 후보 vs 기준선</div>
      <h2 className="mt-1 truncate text-xl font-black tracking-[-0.04em]">{bestCandidate?.label ?? '—'}</h2>
      <dl className="mt-4 grid gap-2 text-xs">
        <FactLine
          label="후보 수익률"
          value={formatPercent(bestCandidate?.returnPct)}
          tone={signedTextClass(bestCandidate?.returnPct)}
        />
        <FactLine label="MDD" value={formatPercent(bestCandidate?.maxDrawdown)} tone="text-error" />
        <FactLine label="기준선" value={`${benchmark?.label ?? '—'} · ${formatPercent(benchmark?.returnPct)}`} />
        <FactLine
          label="초과수익"
          value={formatPercent(bestCandidate?.benchmarkExcess)}
          tone={signedTextClass(bestCandidate?.benchmarkExcess)}
        />
      </dl>
    </article>
  );
}

function RecentReportBrief({ reports }: { reports: ReportRow[] }) {
  return (
    <article className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="badge badge-primary badge-soft badge-sm">Research</span>
        <Link className="text-xs font-bold text-primary" href="/reports">
          전체 →
        </Link>
      </div>
      <div className="grid gap-2">
        {reports.map((report) => (
          <Link
            key={report.reportId}
            href={`/reports/${report.symbol}`}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl bg-base-200/55 p-3 text-sm transition hover:bg-primary/10"
          >
            <span className="min-w-0 truncate font-bold">{report.company || report.symbol}</span>
            <span className={`font-mono font-black tabular-nums ${signedTextClass(report.currentReturn)}`}>
              {formatPercent(report.currentReturn)}
            </span>
            <span className="text-xs text-base-content/50">{formatDateKo(report.publicationDate)}</span>
            <span className="text-xs text-base-content/50">진행 {formatPercent(report.targetProgressPct)}</span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function StrategyLeaderboard({ rows }: { rows: StrategyLeaderboardRow[] }) {
  return (
    <article className="overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
      <table className="table table-sm w-full">
        <thead>
          <tr>
            <th>전략</th>
            <th className="text-right">수익률</th>
            <th className="text-right">Sharpe</th>
            <th className="text-right">Sortino</th>
            <th className="text-right">MDD</th>
            <th className="text-right">초과</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="min-w-[180px] max-w-[260px] truncate font-bold">
                <Link href={row.href}>{row.label}</Link>
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
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function CandidateMiniCard({ candidate, rank }: { candidate: ResearchCandidate; rank: number }) {
  const report = candidate.report;
  return (
    <Link
      href={`/reports/${report.symbol}`}
      className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-primary badge-soft badge-sm">#{rank}</span>
        <span className="badge badge-ghost badge-sm font-mono">{report.symbol}</span>
        <span className="badge badge-outline badge-sm">{candidate.rankBasis}</span>
      </div>
      <h3 className="mt-2 truncate text-lg font-black tracking-[-0.035em]">{report.company || report.symbol}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Metric label="현재" value={formatPercent(report.currentReturn)} tone={signedTextClass(report.currentReturn)} />
        <Metric label="업사이드" value={formatPercent(report.targetUpsideAtPub)} />
        <Metric label="진행" value={formatPercent(report.targetProgressPct)} />
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

function buildDashboardSeries(equity: EquityPoint[]): ReturnSeries[] {
  return DASHBOARD_SERIES.map((persona, index) => ({
    id: persona,
    label: getPersonaLabel(persona),
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: equity
      .filter((point) => point.persona === persona && point.cumulativeReturn !== null)
      .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
  })).filter((series) => series.points.length > 0);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
