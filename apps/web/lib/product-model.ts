import 'server-only';
import {
  getCurrentHoldings,
  getOverview,
  getAccountLabel,
  getReportRows,
  getScreenerCandidates,
  getAccountCatalog,
  getAccountCurves,
  getSummaryRows,
  type EquityPoint,
  type HoldingRow,
  type ReportRow,
  type AccountCatalogRow,
  type SummaryRow,
} from '@/lib/artifacts';

export const TARGET_BENCHMARK_ID = 'benchmark_kodex200';
export const OBJECTIVE_MAX_DRAWDOWN = 0.15;
export const BENCHMARK_IDS = getAccountCatalog()
  .filter((row) => row.kind !== 'account')
  .map((row) => row.accountId);

export type AccountKind = 'benchmark' | 'account' | 'oracle';

export type PortfolioSnapshot = {
  account_id: string;
  label: string;
  finalEquityKrw: number | null;
  cashKrw: number | null;
  holdingsValueKrw: number | null;
  cashWeight: number | null;
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

export type AccountLeaderboardRow = {
  id: string;
  label: string;
  shortLabel: string;
  kind: AccountKind;
  benchmarkGroup: string | null;
  returnPct: number | null;
  maxDrawdown: number | null;
  sharpe: number | null;
  sortino: number | null;
  tradeCount: number | null;
  benchmarkExcess: number | null;
  benchmarkLabel: string;
  objectivePassed: boolean;
  objectiveMddSlack: number | null;
  objectiveReturnExcess: number | null;
  isSelectable: boolean;
  sourceLabel: string;
  methodologySummary: string;
  buyRules: string[];
  sellRules: string[];
  riskControls: string[];
  params: Record<string, unknown>;
  href: string;
};

export function portfolioAccountHref(accountId: string): string {
  return `/portfolio/${encodeURIComponent(accountId)}`;
}

export type ResearchCandidate = {
  report: ReportRow;
  rankBasis: string;
  bucket: 'fresh' | 'large-upside' | 'near-target' | 'active';
};

export type ExecutiveOverview = {
  snapshotDate: string;
  portfolio: PortfolioSnapshot;
  reportStats: ReportStats;
  bestAccounts: AccountLeaderboardRow[];
  recentReports: ReportRow[];
  researchCandidates: ResearchCandidate[];
};

export function getDefaultPortfolioAccount(): string {
  const summaries = getSummaryRows();
  const holdings = getCurrentHoldings();
  const summaryIds = new Set(summaries.map((row) => row.account_id));
  const accountsWithOpenHoldings = new Set(holdings.map((row) => row.account_id));
  const rankedAccounts = getObjectivePassingRows(getAccountLeaderboard()).filter((row) => summaryIds.has(row.id));
  const topWithOpenHoldings = rankedAccounts.find((row) => accountsWithOpenHoldings.has(row.id));
  if (topWithOpenHoldings) {
    return topWithOpenHoldings.id;
  }
  const topAccount = rankedAccounts[0];
  if (topAccount) {
    return topAccount.id;
  }
  if (summaryIds.has(TARGET_BENCHMARK_ID)) {
    return TARGET_BENCHMARK_ID;
  }
  const withOpenHoldings = summaries
    .filter((summary) => holdings.some((holding) => holding.account_id === summary.account_id))
    .sort(
      (a, b) =>
        (b.moneyWeightedReturn ?? Number.NEGATIVE_INFINITY) - (a.moneyWeightedReturn ?? Number.NEGATIVE_INFINITY),
    );
  const firstAvailable = withOpenHoldings[0] ?? summaries[0];
  if (!firstAvailable) {
    throw new Error('Account catalog has no selectable account for the default portfolio view.');
  }
  return firstAvailable.account_id;
}

export function getExecutiveOverview(account_id = getDefaultPortfolioAccount()): ExecutiveOverview {
  const overview = getOverview();
  const reports = getReportRows();
  return {
    snapshotDate: overview.simulation_window?.price_end ?? overview.simulation_window?.report_end ?? '',
    portfolio: getPortfolioSnapshot(account_id),
    reportStats: buildReportStats(reports),
    bestAccounts: getObjectivePassingRows(getAccountLeaderboard()).slice(0, 5),
    recentReports: [...reports].sort((a, b) => b.publicationDate.localeCompare(a.publicationDate)).slice(0, 6),
    researchCandidates: getResearchCandidates(),
  };
}

export function getPrimaryHoldings(): HoldingRow[] {
  return getCurrentHoldings()
    .filter((row) => row.account_id === getDefaultPortfolioAccount())
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
}

export function getPortfolioSnapshot(account_id = getDefaultPortfolioAccount()): PortfolioSnapshot {
  const holdings = getCurrentHoldings()
    .filter((row) => row.account_id === account_id)
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  const summary = getSummaryRows().find((row) => row.account_id === account_id);
  const unrealizedPnlKrw = holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  return {
    account_id,
    label: getAccountLabel(account_id),
    finalEquityKrw: summary?.finalEquityKrw ?? null,
    cashKrw: summary?.finalCashKrw ?? null,
    holdingsValueKrw: summary?.finalHoldingsValueKrw ?? null,
    cashWeight:
      summary?.finalCashKrw !== null &&
      summary?.finalCashKrw !== undefined &&
      summary?.finalEquityKrw !== null &&
      summary?.finalEquityKrw !== undefined &&
      summary.finalEquityKrw > 0
        ? summary.finalCashKrw / summary.finalEquityKrw
        : null,
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
  const reportsById = new Map(getReportRows().map((report) => [report.reportId, report]));
  return getScreenerCandidates().map((candidate) => {
    const report = reportsById.get(candidate.reportId);
    if (!report) {
      throw new Error(`Screener candidate references missing report_id: ${candidate.reportId}`);
    }
    return {
      report,
      bucket: candidate.bucket,
      rankBasis: candidate.rankBasis,
    };
  });
}

export function getAccountLeaderboard(): AccountLeaderboardRow[] {
  const summaries = getSummaryRows();
  const equity = getAccountCurves();
  const benchmark = targetBenchmark(summaries);
  const catalogById = new Map(getAccountCatalog().map((row) => [row.accountId, row]));
  const accountRows = summaries.map((summary) => accountRowFromSummary(summary, equity, benchmark, catalogById));
  return accountRows
    .map((row) => ({ ...row, benchmarkLabel: benchmark?.label ?? 'KOSPI/KODEX 200' }))
    .sort((a, b) => (b.returnPct ?? Number.NEGATIVE_INFINITY) - (a.returnPct ?? Number.NEGATIVE_INFINITY));
}

export function getBenchmarkRows(rows = getAccountLeaderboard()): AccountLeaderboardRow[] {
  const order = new Map<string, number>(BENCHMARK_IDS.map((id, index) => [id, index]));
  return rows
    .filter((row) => row.kind !== 'account')
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
}

export function getSelectableAccountRows(rows = getAccountLeaderboard()): AccountLeaderboardRow[] {
  return rows.filter((row) => row.kind === 'account' && row.isSelectable);
}

export function getObjectivePassingRows(rows = getAccountLeaderboard()): AccountLeaderboardRow[] {
  return getSelectableAccountRows(rows).filter((row) => row.objectivePassed);
}

export function isBenchmarkAccount(account_id: string): boolean {
  return getAccountCatalog().some((row) => row.accountId === account_id && row.kind !== 'account');
}

function accountRowFromSummary(
  summary: SummaryRow,
  equity: EquityPoint[],
  benchmark: SummaryRow | undefined,
  catalogById: Map<string, AccountCatalogRow>,
): AccountLeaderboardRow {
  const catalog = catalogById.get(summary.account_id);
  const metrics = riskMetricsFromCumulative(
    equity
      .filter((point) => point.account_id === summary.account_id && point.cumulativeReturn !== null)
      .map((point) => point.cumulativeReturn ?? 0),
  );
  const kind: AccountKind = catalog?.kind ?? (isBenchmarkAccount(summary.account_id) ? 'benchmark' : 'account');
  const returnPct = summary.moneyWeightedReturn ?? null;
  const objective = objectiveGate(kind, returnPct, summary.maxDrawdown, benchmark?.moneyWeightedReturn ?? null);
  const label = catalog?.label ?? summary.label ?? getAccountLabel(summary.account_id);
  return {
    id: summary.account_id,
    label,
    shortLabel: catalog?.shortLabel ?? compactAccountLabel(summary.account_id, label),
    kind,
    benchmarkGroup: catalog?.benchmarkGroup ?? null,
    returnPct,
    maxDrawdown: summary.maxDrawdown,
    sharpe: metrics.sharpe,
    sortino: metrics.sortino,
    tradeCount: summary.tradeCount,
    benchmarkExcess:
      benchmark?.account_id &&
      benchmark.account_id !== summary.account_id &&
      summary.moneyWeightedReturn !== null &&
      summary.moneyWeightedReturn !== undefined
        ? summary.moneyWeightedReturn - (benchmark.moneyWeightedReturn ?? 0)
        : null,
    benchmarkLabel: benchmark?.label ?? 'KOSPI/KODEX 200',
    objectivePassed: catalog?.objectivePassed ?? objective.passed,
    objectiveMddSlack: catalog?.objectiveMddSlack ?? objective.mddSlack,
    objectiveReturnExcess: catalog?.objectiveReturnExcess ?? objective.returnExcess,
    isSelectable: catalog?.isSelectable ?? kind === 'account',
    sourceLabel: kind === 'account' ? '고유 전략' : kind === 'oracle' ? '오라클 기준선' : '벤치마크',
    methodologySummary: catalog?.methodologySummary ?? '',
    buyRules: catalog?.buyRules ?? [],
    sellRules: catalog?.sellRules ?? [],
    riskControls: catalog?.riskControls ?? [],
    params: catalog?.params ?? {},
    href:
      kind === 'account' && (catalog?.isSelectable ?? true) ? portfolioAccountHref(summary.account_id) : '/portfolio',
  };
}

function targetBenchmark(summaries: SummaryRow[]): SummaryRow | undefined {
  return summaries.find((row) => row.account_id === TARGET_BENCHMARK_ID);
}

function objectiveGate(
  kind: AccountKind,
  returnPct: number | null,
  maxDrawdown: number | null,
  benchmarkReturn: number | null,
): { passed: boolean; mddSlack: number | null; returnExcess: number | null } {
  const mddSlack = maxDrawdown === null ? null : OBJECTIVE_MAX_DRAWDOWN - maxDrawdown;
  const returnExcess = returnPct !== null && benchmarkReturn !== null ? returnPct - benchmarkReturn : null;
  return {
    passed: kind === 'account' && mddSlack !== null && mddSlack >= 0 && returnExcess !== null && returnExcess > 0,
    mddSlack,
    returnExcess,
  };
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

export function compactAccountLabel(id: string, label: string): string {
  if (id === 'all_weather') return '올웨더';
  if (id === 'smic_follower') return '리포트 추종 v1';
  if (id === 'smic_follower_v2') return '손절 리포트 추종';
  if (id === 'benchmark_kodex200') return 'KODEX200';
  if (id === 'benchmark_qqq') return 'QQQ';
  if (id === 'benchmark_spy') return 'SPY';
  if (id === 'benchmark_gld') return 'GLD';
  if (id === 'weak_oracle') return '미래정보 상한선';
  return label;
}
