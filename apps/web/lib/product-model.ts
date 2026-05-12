import 'server-only';
import {
  getCurrentHoldings,
  getEquityDaily,
  getOverview,
  getPersonaLabel,
  getReportRows,
  getStrategyExperiment,
  getStrategyRuns,
  getSummaryRows,
  type EquityPoint,
  type HoldingRow,
  type PricePoint,
  type ReportRow,
  type StrategyRunArtifact,
  type SummaryRow,
} from '@/lib/artifacts';

export const PRIMARY_PERSONA = 'smic_follower_v2';

export type PortfolioSnapshot = {
  persona: string;
  label: string;
  finalEquityKrw: number | null;
  moneyWeightedReturn: number | null;
  maxDrawdown: number | null;
  unrealizedPnlKrw: number | null;
  holdingCount: number;
  top5Weight: number | null;
  positiveHoldingCount: number;
  holdings: HoldingRow[];
};

export type ReportStats = {
  total: number;
  hitCount: number;
  activeCount: number;
  expiredCount: number;
  positiveReturnCount: number;
  targetHitRate: number;
  positiveReturnRate: number;
  averageCurrentReturn: number | null;
  medianCurrentReturn: number | null;
  averageTargetProgress: number | null;
  medianDaysToTarget: number | null;
  latestPublicationDate: string;
};

export type StrategyLeaderboardRow = {
  id: string;
  label: string;
  kind: 'baseline' | 'candidate';
  returnPct: number | null;
  maxDrawdown: number | null;
  sharpe: number | null;
  sortino: number | null;
  tradeCount: number | null;
  benchmarkExcess: number | null;
  benchmarkLabel: string;
  href: string;
};

export type ResearchCandidate = {
  report: ReportRow;
  rankBasis: string;
  bucket: 'fresh' | 'large-upside' | 'near-target' | 'active';
};

export type ExecutiveOverview = {
  snapshotDate: string;
  portfolio: PortfolioSnapshot;
  reportStats: ReportStats;
  bestStrategies: StrategyLeaderboardRow[];
  recentReports: ReportRow[];
  researchCandidates: ResearchCandidate[];
};

export function getExecutiveOverview(): ExecutiveOverview {
  const overview = getOverview();
  const reports = getReportRows();
  return {
    snapshotDate: overview.simulation_window?.price_end ?? overview.simulation_window?.report_end ?? '',
    portfolio: getPortfolioSnapshot(PRIMARY_PERSONA),
    reportStats: buildReportStats(reports),
    bestStrategies: getStrategyLeaderboard().slice(0, 5),
    recentReports: [...reports].sort((a, b) => b.publicationDate.localeCompare(a.publicationDate)).slice(0, 6),
    researchCandidates: getResearchCandidates(),
  };
}

export function getPrimaryHoldings(): HoldingRow[] {
  return getCurrentHoldings()
    .filter((row) => row.persona === PRIMARY_PERSONA)
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
}

export function getPortfolioSnapshot(persona = PRIMARY_PERSONA): PortfolioSnapshot {
  const holdings = getCurrentHoldings()
    .filter((row) => row.persona === persona)
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  const summary = getSummaryRows().find((row) => row.persona === persona);
  const unrealizedPnlKrw = holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  return {
    persona,
    label: getPersonaLabel(persona),
    finalEquityKrw: summary?.finalEquityKrw ?? null,
    moneyWeightedReturn: summary?.moneyWeightedReturn ?? null,
    maxDrawdown: summary?.maxDrawdown ?? null,
    unrealizedPnlKrw,
    holdingCount: holdings.length,
    top5Weight: topWeight(holdings, 5),
    positiveHoldingCount: holdings.filter((row) => (row.unrealizedReturn ?? 0) > 0).length,
    holdings,
  };
}

export function buildReportStats(reports = getReportRows()): ReportStats {
  const currentReturns = reports.map((row) => row.currentReturn).filter(isFiniteNumber);
  const progressValues = reports.map((row) => row.targetProgressPct).filter(isFiniteNumber);
  const daysToTarget = reports.map((row) => row.daysToTarget).filter(isFiniteNumber);
  const hitCount = reports.filter((row) => row.targetHit).length;
  const activeCount = reports.filter(
    (row) => !row.targetHit && !row.expired && (row.targetUpsideAtPub ?? 0) > 0,
  ).length;
  const positiveReturnCount = reports.filter((row) => (row.currentReturn ?? Number.NEGATIVE_INFINITY) >= 0).length;
  return {
    total: reports.length,
    hitCount,
    activeCount,
    expiredCount: reports.filter((row) => row.expired).length,
    positiveReturnCount,
    targetHitRate: hitCount / Math.max(1, reports.length),
    positiveReturnRate: positiveReturnCount / Math.max(1, reports.length),
    averageCurrentReturn: average(currentReturns),
    medianCurrentReturn: median(currentReturns),
    averageTargetProgress: average(progressValues),
    medianDaysToTarget: median(daysToTarget),
    latestPublicationDate: reports.reduce(
      (latest, report) => (report.publicationDate > latest ? report.publicationDate : latest),
      '',
    ),
  };
}

export function getResearchCandidates(): ResearchCandidate[] {
  const now = latestReportDate();
  return getReportRows()
    .filter((report) => {
      if (report.targetDirection !== 'upside') return false;
      if (report.targetHit || report.expired) return false;
      if (!isFiniteNumber(report.targetUpsideAtPub) || report.targetUpsideAtPub <= 0) return false;
      if (!isFiniteNumber(report.currentReturn) || !isFiniteNumber(report.targetProgressPct)) return false;
      return true;
    })
    .map((report) => toResearchCandidate(report, daysBetween(report.publicationDate, now)))
    .sort((a, b) => {
      const basisDelta = basisSortValue(b) - basisSortValue(a);
      if (basisDelta !== 0) return basisDelta;
      return b.report.publicationDate.localeCompare(a.report.publicationDate);
    });
}

function toResearchCandidate(report: ReportRow, ageDays: number | null): ResearchCandidate {
  if (ageDays !== null && ageDays <= 120) {
    return { report, bucket: 'fresh', rankBasis: `최근 ${ageDays}일 리포트 · 업사이드 우선` };
  }
  if ((report.targetUpsideAtPub ?? 0) >= 0.5) {
    return { report, bucket: 'large-upside', rankBasis: '목표 업사이드 50% 이상' };
  }
  if ((report.targetProgressPct ?? 0) >= 0.7) {
    return { report, bucket: 'near-target', rankBasis: '목표 진행률 70% 이상' };
  }
  return { report, bucket: 'active', rankBasis: '미도달·미만료 활성 리포트' };
}

function basisSortValue(candidate: ResearchCandidate): number {
  if (candidate.bucket === 'fresh') return 10 + (candidate.report.targetUpsideAtPub ?? 0);
  if (candidate.bucket === 'large-upside') return 8 + (candidate.report.targetUpsideAtPub ?? 0);
  if (candidate.bucket === 'near-target') return 6 + (candidate.report.targetProgressPct ?? 0);
  return candidate.report.targetUpsideAtPub ?? 0;
}

export function getStrategyLeaderboard(): StrategyLeaderboardRow[] {
  const summaries = getSummaryRows();
  const equity = getEquityDaily();
  const benchmark = bestBenchmark(summaries);
  const baselineRows = summaries.map((summary) => strategyRowFromSummary(summary, equity, benchmark));
  const strategyRows = getStrategyRuns().runs.map((run) => strategyRowFromRun(run, benchmark));
  return [...strategyRows, ...baselineRows]
    .map((row) => ({ ...row, benchmarkLabel: benchmark?.label ?? 'best baseline' }))
    .sort((a, b) => (b.returnPct ?? Number.NEGATIVE_INFINITY) - (a.returnPct ?? Number.NEGATIVE_INFINITY));
}

function strategyRowFromSummary(
  summary: SummaryRow,
  equity: EquityPoint[],
  benchmark: SummaryRow | undefined,
): StrategyLeaderboardRow {
  const metrics = riskMetricsFromCumulative(
    equity
      .filter((point) => point.persona === summary.persona && point.cumulativeReturn !== null)
      .map((point) => point.cumulativeReturn ?? 0),
  );
  return {
    id: summary.persona,
    label: summary.label ?? getPersonaLabel(summary.persona),
    kind: 'baseline',
    returnPct: summary.moneyWeightedReturn ?? null,
    maxDrawdown: summary.maxDrawdown,
    sharpe: metrics.sharpe,
    sortino: metrics.sortino,
    tradeCount: summary.tradeCount,
    benchmarkExcess:
      benchmark?.persona &&
      benchmark.persona !== summary.persona &&
      summary.moneyWeightedReturn !== null &&
      summary.moneyWeightedReturn !== undefined
        ? summary.moneyWeightedReturn - (benchmark.moneyWeightedReturn ?? 0)
        : null,
    benchmarkLabel: benchmark?.label ?? 'best baseline',
    href: '/portfolio',
  };
}

function strategyRowFromRun(run: StrategyRunArtifact, benchmark: SummaryRow | undefined): StrategyLeaderboardRow {
  const series = getStrategyExperiment(run).cumulativeReturnSeries.map((point: PricePoint) => point.value);
  const metrics = riskMetricsFromCumulative(series);
  const m = run.metrics;
  const returnPct = asNumber(m.money_weighted_return ?? m.full_money_weighted_return ?? m.score);
  const maxDrawdown = asNumber(m.max_drawdown ?? m.full_max_drawdown);
  const tradeCount = asNumber(m.trade_count ?? m.full_trade_count);
  const benchmarkReturn = benchmark?.moneyWeightedReturn ?? null;
  return {
    id: run.run_id,
    label: run.label,
    kind: 'candidate',
    returnPct,
    maxDrawdown,
    sharpe: metrics.sharpe,
    sortino: metrics.sortino,
    tradeCount,
    benchmarkExcess: returnPct !== null && benchmarkReturn !== null ? returnPct - benchmarkReturn : null,
    benchmarkLabel: benchmark?.label ?? 'best baseline',
    href: `/strategies/${run.run_id}`,
  };
}

function bestBenchmark(summaries: SummaryRow[]): SummaryRow | undefined {
  return summaries
    .filter((row) => row.persona.startsWith('benchmark_') || row.persona === 'all_weather')
    .sort(
      (a, b) =>
        (b.moneyWeightedReturn ?? Number.NEGATIVE_INFINITY) - (a.moneyWeightedReturn ?? Number.NEGATIVE_INFINITY),
    )[0];
}

function riskMetricsFromCumulative(cumulative: number[]): { sharpe: number | null; sortino: number | null } {
  const returns: number[] = [];
  for (let index = 1; index < cumulative.length; index += 1) {
    const prev = cumulative[index - 1];
    const next = cumulative[index];
    if (!Number.isFinite(prev) || !Number.isFinite(next) || prev <= -1) continue;
    returns.push((1 + next) / (1 + prev) - 1);
  }
  if (returns.length < 3) return { sharpe: null, sortino: null };
  const mean = average(returns);
  if (mean === null) return { sharpe: null, sortino: null };
  const sd = standardDeviation(returns, mean);
  const downside = returns.filter((value) => value < 0);
  const downsideSd = downside.length ? standardDeviation(downside, 0) : null;
  const annual = Math.sqrt(252);
  return {
    sharpe: sd && sd > 0 ? (mean / sd) * annual : null,
    sortino: downsideSd && downsideSd > 0 ? (mean / downsideSd) * annual : null,
  };
}

function standardDeviation(values: number[], center: number): number | null {
  if (values.length < 2) return null;
  const variance = values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function latestReportDate(): string {
  return getReportRows().reduce(
    (latest, report) => (report.publicationDate > latest ? report.publicationDate : latest),
    '',
  );
}

function daysBetween(start: string, end: string): number | null {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000));
}

function topWeight(rows: HoldingRow[], count: number): number | null {
  const total = rows.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  if (total <= 0) return null;
  const top = rows.slice(0, count).reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  return top / total;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}
