import type {
  PortfolioLandingModel,
  PortfolioAccountSnapshot,
  PortfolioViewModel,
} from '@/components/trading/portfolio-views/types';
import {
  getAccountingReconciliations,
  getCurrentHoldings,
  getEquityDaily,
  getLatestReportTargetsBySymbol,
  getAccountLabel,
  getPositionEpisodes,
  getReportSymbolById,
  getReportTargetsById,
  getSummaryRows,
  getTrades,
} from '@/lib/artifacts';
import {
  getDefaultPortfolioAccount,
  getObjectivePassingRows,
  getAccountLeaderboard,
  portfolioAccountHref,
  type AccountLeaderboardRow,
} from '@/lib/product-model';

const ALL_WEATHER_ACCOUNT = 'all_weather';
export const NO_ADMITTED_ACCOUNT_PARAM = 'no-admitted-account';

export function buildPortfolioLandingModel(): PortfolioLandingModel {
  const allHoldings = getCurrentHoldings();
  const allEquity = getEquityDaily();
  const summaries = getSummaryRows();
  const allTrades = getTrades();
  const leaderboardRows = getAccountLeaderboard();
  const allWeatherReturn = leaderboardRows.find((row) => row.id === ALL_WEATHER_ACCOUNT)?.returnPct ?? null;
  const portfolioRows = getPortfolioRows(leaderboardRows);
  const benchmarkRows = leaderboardRows.filter((row) => row.kind === 'benchmark');
  const defaultAccount = defaultPortfolioAccount(portfolioRows);
  const portfolioIds = new Set(portfolioRows.map((row) => row.id));
  const frontierIds = new Set([...portfolioRows.map((row) => row.id), ...benchmarkRows.map((row) => row.id)]);
  const accountLabels = Object.fromEntries(portfolioRows.map((row) => [row.id, row.label]));
  const summaryById = new Map(summaries.map((row) => [row.account_id, row]));
  const holdingsByAccount = groupByAccount(allHoldings.filter((row) => frontierIds.has(row.account_id)));
  const trades = allTrades.filter((row) => portfolioIds.has(row.account_id));
  const equity = allEquity.filter((row) => frontierIds.has(row.account_id));
  const snapshotFromRow = (row: AccountLeaderboardRow): PortfolioAccountSnapshot => {
    const summary = summaryById.get(row.id);
    const holdings = holdingsByAccount.get(row.id) ?? [];
    const holdingsValue =
      summary?.finalHoldingsValueKrw ?? holdings.reduce((sum, holding) => sum + (holding.marketValueKrw ?? 0), 0);
    const cashKrw = summary?.finalCashKrw ?? 0;
    const finalEquity = summary?.finalEquityKrw ?? (holdingsValue || cashKrw ? holdingsValue + cashKrw : null);
    const topHolding = [...holdings].sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0))[0];
    return {
      id: row.id,
      label: row.label,
      shortLabel: row.shortLabel,
      kind: row.kind,
      href: row.href,
      finalEquityKrw: finalEquity,
      cashKrw,
      holdingsValueKrw: holdingsValue,
      cashWeight: finalEquity && finalEquity > 0 ? cashKrw / finalEquity : null,
      moneyWeightedReturn: row.returnPct,
      maxDrawdown: row.maxDrawdown,
      tradeCount: summary?.tradeCount ?? row.tradeCount,
      holdingCount: holdings.length,
      topHoldingLabel: topHolding?.company || topHolding?.symbol || '—',
      topHoldingWeight:
        finalEquity && finalEquity > 0 && topHolding?.marketValueKrw ? topHolding.marketValueKrw / finalEquity : null,
      objectivePassed: row.objectivePassed,
    };
  };
  const accounts = portfolioRows.map(snapshotFromRow);
  const frontierRows = [...accounts, ...benchmarkRows.map(snapshotFromRow)];
  return {
    defaultAccount,
    latestEquityDate: equity.reduce((latest, row) => (row.date > latest ? row.date : latest), ''),
    accounts,
    frontierRows,
    allWeatherReturn,
    holdings: allHoldings.filter((row) => portfolioIds.has(row.account_id)),
    equity,
    trades,
    accountLabels,
  };
}

export function buildPortfolioViewModel(selectedAccount?: string): PortfolioViewModel {
  const allHoldings = getCurrentHoldings();
  const allAccounting = getAccountingReconciliations();
  const allEquity = getEquityDaily();
  const summaries = getSummaryRows();
  const allTrades = getTrades();
  const allEpisodes = getPositionEpisodes();
  const allTargetsBySymbol = getLatestReportTargetsBySymbol();
  const allTargetsByReportId = getReportTargetsById();
  const portfolioRows = getPortfolioRows();
  const benchmarkRows = getAccountLeaderboard().filter((row) => row.kind === 'benchmark');
  const defaultAccount = defaultPortfolioAccount(portfolioRows);

  const portfolioRowById = new Map(portfolioRows.map((row) => [row.id, row]));
  const dataAccountIds = new Set([
    ...summaries.map((row) => row.account_id),
    ...allHoldings.map((row) => row.account_id),
    ...allTrades.map((row) => row.account_id),
    ...allEquity.map((row) => row.account_id),
  ]);
  const accounts = Array.from(new Set([defaultAccount, ...portfolioRows.map((row) => row.id)])).filter((account_id) =>
    dataAccountIds.has(account_id),
  );
  const activeAccount = selectedAccount && accounts.includes(selectedAccount) ? selectedAccount : defaultAccount;
  const invalidAccountId = selectedAccount && !accounts.includes(selectedAccount) ? selectedAccount : null;
  const accountLabels = Object.fromEntries([
    ...accounts.map((account_id) => [
      account_id,
      portfolioRowById.get(account_id)?.label ?? getAccountLabel(account_id),
    ]),
    ...benchmarkRows.map((row) => [row.id, row.shortLabel || row.label]),
  ]);
  const accountOptions = accounts.map((account_id) => {
    const row = portfolioRowById.get(account_id);
    return {
      id: account_id,
      label: row?.label ?? getAccountLabel(account_id),
      shortLabel: row?.shortLabel ?? getAccountLabel(account_id),
      kind: 'account' as const,
      href: portfolioAccountHref(account_id),
      isDefault: account_id === defaultAccount,
    };
  });
  const capitalByAccount = Object.fromEntries(
    summaries
      .filter((row) => accounts.includes(row.account_id))
      .map((row) => [row.account_id, row.totalContributedKrw ?? row.finalEquityKrw ?? 0]),
  );
  const cashByAccount = Object.fromEntries(
    summaries.filter((row) => accounts.includes(row.account_id)).map((row) => [row.account_id, row.finalCashKrw ?? 0]),
  );
  const holdings = allHoldings.filter((row) => row.account_id === activeAccount);
  const accounting = allAccounting.filter((row) => row.account_id === activeAccount);
  const benchmarkIds = new Set(benchmarkRows.map((row) => row.id));
  const equity = allEquity.filter((row) => row.account_id === activeAccount || benchmarkIds.has(row.account_id));
  const trades = allTrades.filter((row) => row.account_id === activeAccount);
  const episodes = allEpisodes.filter((row) => row.account_id === activeAccount);
  const relevantSymbols = new Set([
    ...holdings.map((row) => row.symbol),
    ...trades.map((row) => row.symbol),
    ...episodes.map((row) => row.symbol),
  ]);
  const relevantReportIds = new Set(
    trades.map((trade) => trade.reportId).filter((value): value is string => Boolean(value)),
  );
  const targetsBySymbol = Object.fromEntries(
    Object.entries(allTargetsBySymbol).filter(([symbol]) => relevantSymbols.has(symbol)),
  );
  const targetsByReportId = Object.fromEntries(
    Object.entries(allTargetsByReportId).filter(
      ([reportId, target]) => relevantReportIds.has(reportId) || relevantSymbols.has(target.symbol),
    ),
  );
  const reportSymbolsById = Object.fromEntries(
    Array.from(relevantReportIds)
      .map((reportId) => [reportId, getReportSymbolById(reportId)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const latestEquityDate = allEquity
    .filter((row) => accounts.includes(row.account_id))
    .reduce((latest, row) => (row.date > latest ? row.date : latest), '');
  return {
    holdings,
    accounting,
    equity,
    trades,
    episodes,
    accounts,
    benchmarkAccounts: benchmarkRows.map((row) => row.id),
    accountLabels,
    accountOptions,
    defaultAccount,
    selectedAccount: activeAccount,
    invalidAccountId,
    capitalByAccount,
    cashByAccount,
    reportSymbolsById,
    targetsBySymbol,
    targetsByReportId,
    portfolioAccountCount: accounts.length,
    latestEquityDate,
  };
}

export function getPortfolioStaticParams() {
  const summaries = getSummaryRows();
  const summaryIds = new Set(summaries.map((row) => row.account_id));
  const params = getPortfolioRows(getAccountLeaderboard())
    .filter((row) => summaryIds.has(row.id))
    .map((row) => ({ account: row.id }));
  return params.length ? params : [{ account: NO_ADMITTED_ACCOUNT_PARAM }];
}

function getPortfolioRows(rows: AccountLeaderboardRow[] = getAccountLeaderboard()) {
  const selectable = getObjectivePassingRows(rows).filter((row) => row.kind === 'account' && row.isSelectable);
  const nonDominated = selectable.filter((row) => !selectable.some((candidate) => dominates(candidate, row)));
  return nonDominated.sort((a, b) => {
    if (a.objectivePassed !== b.objectivePassed) return a.objectivePassed ? -1 : 1;
    return (b.returnPct ?? Number.NEGATIVE_INFINITY) - (a.returnPct ?? Number.NEGATIVE_INFINITY);
  });
}

function defaultPortfolioAccount(rows: AccountLeaderboardRow[]): string {
  const productDefault = getDefaultPortfolioAccount();
  if (rows.some((row) => row.id === productDefault)) return productDefault;
  const firstAvailable = rows[0]?.id;
  if (firstAvailable) return firstAvailable;
  return productDefault;
}

function dominates(candidate: AccountLeaderboardRow, target: AccountLeaderboardRow): boolean {
  if (
    candidate.id === target.id ||
    candidate.returnPct === null ||
    candidate.maxDrawdown === null ||
    target.returnPct === null ||
    target.maxDrawdown === null
  ) {
    return false;
  }
  const noWorseReturn = candidate.returnPct >= target.returnPct;
  const noWorseDrawdown = candidate.maxDrawdown <= target.maxDrawdown;
  const strictlyBetter = candidate.returnPct > target.returnPct || candidate.maxDrawdown < target.maxDrawdown;
  return noWorseReturn && noWorseDrawdown && strictlyBetter;
}

function groupByAccount<T extends { account_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const group = map.get(row.account_id) ?? [];
    group.push(row);
    map.set(row.account_id, group);
  }
  return map;
}
