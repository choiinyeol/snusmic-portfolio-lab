import 'server-only';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import {
  getDataQuality,
  getOverview,
  getReportRows,
  getAccountCurves,
  getTrades,
  type EquityPoint,
  type HoldingRow,
  type ReportRow,
} from '@/lib/artifacts';
import {
  getBenchmarkRows,
  getDefaultPortfolioAccount,
  getExecutiveOverview,
  getObjectivePassingRows,
  getAccountLeaderboard,
  TARGET_BENCHMARK_ID,
  type AccountLeaderboardRow,
} from '@/lib/product-model';

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

export type DashboardViewModel = ReturnType<typeof getDashboardViewModel>;

export function getDashboardViewModel() {
  const accountRows = getAccountLeaderboard();
  const selectedAccount = getDefaultPortfolioAccount();
  const overview = getExecutiveOverview(selectedAccount);
  const artifactOverview = getOverview();
  const trades = getTrades();
  const reports = getReportRows();
  const dataQuality = getDataQuality();
  const priceMatchedReports = artifactOverview.report_counts?.price_matched_reports ?? dataQuality.reportsWithPrices;
  const sourceReports = artifactOverview.report_counts?.extracted_reports ?? dataQuality.totalReports;
  const latestReportsBySymbol = latestReportBySymbol(reports);
  const reportHrefBySymbol = Object.fromEntries(
    [...latestReportsBySymbol.values()].map((report) => [
      report.symbol,
      `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`,
    ]),
  );
  const equity = getAccountCurves();
  const benchmarkRows = getBenchmarkRows(accountRows);
  const selectableRows = getObjectivePassingRows(accountRows);
  const selectedAccountRow = selectableRows.find((row) => row.id === selectedAccount);
  const chartSeries = buildDashboardSeries(equity, benchmarkRows, selectedAccountRow, selectableRows);
  const benchmarkToBeat = benchmarkRows.find((row) => row.id === TARGET_BENCHMARK_ID);
  const recentBuys = trades
    .filter((trade) => trade.account_id === selectedAccount && trade.side === 'buy')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return {
    accountRows,
    selectedAccount,
    overview,
    reports,
    dataQuality,
    priceMatchedReports,
    sourceReports,
    latestReportsBySymbol,
    reportHrefBySymbol,
    equity,
    benchmarkRows,
    selectableRows,
    selectedAccountRow,
    chartSeries,
    benchmarkToBeat,
    recentBuys,
  };
}

export function withCashHolding(
  holdings: HoldingRow[],
  cashKrw: number | null | undefined,
  account_id: string,
): HoldingRow[] {
  if (!cashKrw || cashKrw <= 0) return holdings;
  return [
    ...holdings,
    {
      account_id,
      symbol: 'CASH',
      company: 'RP이자',
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

export function topWeight(holdings: HoldingRow[], count: number): number | null {
  const total = holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  if (total <= 0) return null;
  return holdings.slice(0, count).reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0) / total;
}

export function currencyExposure(
  holdings: HoldingRow[],
  totalValue: number,
): Array<{ currency: string; weight: number }> {
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

function buildDashboardSeries(
  equity: EquityPoint[],
  benchmarks: AccountLeaderboardRow[],
  selected: AccountLeaderboardRow | undefined,
  selectable: AccountLeaderboardRow[],
): ReturnSeries[] {
  const rows = uniqueSeriesRows([
    ...benchmarks,
    ...(selected ? [selected] : []),
    ...selectable.filter((row) => row.objectivePassed).slice(0, 3),
    ...selectable.slice(0, 3),
  ]);
  return rows
    .map((row, index) => ({
      id: row.id,
      label: row.label,
      shortLabel: row.shortLabel,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points: equity
        .filter((point) => point.account_id === row.id && point.cumulativeReturn !== null)
        .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
    }))
    .filter((series) => series.points.length > 0);
}

function uniqueSeriesRows(rows: AccountLeaderboardRow[]): AccountLeaderboardRow[] {
  const seen = new Set<string>();
  const out: AccountLeaderboardRow[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function latestReportBySymbol(reports: ReportRow[]): Map<string, ReportRow> {
  const map = new Map<string, ReportRow>();
  for (const report of reports) {
    const current = map.get(report.symbol);
    if (!current || report.publicationDate > current.publicationDate) map.set(report.symbol, report);
  }
  return map;
}
