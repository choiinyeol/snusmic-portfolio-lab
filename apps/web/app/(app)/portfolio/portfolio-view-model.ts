import type {
  AccountLedgerDiagnostics,
  PortfolioAccountSnapshot,
  PortfolioLandingModel,
  PortfolioRouteModels,
  PortfolioTradeTableModel,
  PositionOutcome,
} from '@/components/trading/portfolio-views/types';
import type {
  AccountingReconciliationRow,
  EquityPoint,
  HoldingRow,
  PositionEpisodeRow,
  SummaryRow,
} from '@/lib/artifacts';
import {
  getAccountCatalog,
  getAccountingReconciliations,
  getCurrentHoldings,
  getEquityDailyForAccounts,
  getLatestReportTargetsBySymbol,
  getAccountLabel,
  getPositionEpisodes,
  getReportSymbolById,
  getReportTargetsById,
  getSummaryRows,
  getTrades,
} from '@/lib/artifacts';
import { displayPortfolioName } from '@/lib/portfolio-labels';
import {
  getDefaultPortfolioAccount,
  getAccountLeaderboard,
  portfolioAccountHref,
  type AccountLeaderboardRow,
} from '@/lib/product-model';

const ALL_WEATHER_ACCOUNT = 'all_weather';
export const NO_ADMITTED_ACCOUNT_PARAM = 'no-admitted-account';

export function buildPortfolioLandingModel(): PortfolioLandingModel {
  const allHoldings = getCurrentHoldings();
  const summaries = getSummaryRows();
  const allTrades = getTrades();
  const leaderboardRows = getAccountLeaderboard();
  const allWeatherReturn = leaderboardRows.find((row) => row.id === ALL_WEATHER_ACCOUNT)?.returnPct ?? null;
  const portfolioRows = getPortfolioRows(leaderboardRows);
  const totalResearchAccountCount = leaderboardRows.filter((row) => row.kind === 'account').length;
  const benchmarkRows = leaderboardRows.filter((row) => row.kind === 'benchmark');
  const catalogById = new Map(getAccountCatalog().map((row) => [row.accountId, row]));
  const defaultAccount = defaultPortfolioAccount(portfolioRows);
  const portfolioIds = new Set(portfolioRows.map((row) => row.id));
  const frontierIds = new Set([...portfolioRows.map((row) => row.id), ...benchmarkRows.map((row) => row.id)]);
  const equity = getEquityDailyForAccounts([...frontierIds]);
  const accountLabels = Object.fromEntries(
    portfolioRows.map((row) => [row.id, displayPortfolioName(row.id, row.label)]),
  );
  const summaryById = new Map(summaries.map((row) => [row.account_id, row]));
  const holdingsByAccount = groupByAccount(allHoldings.filter((row) => frontierIds.has(row.account_id)));
  const trades = allTrades.filter((row) => portfolioIds.has(row.account_id));
  const snapshotFromRow = (row: AccountLeaderboardRow): PortfolioAccountSnapshot => {
    const summary = summaryById.get(row.id);
    const holdings = holdingsByAccount.get(row.id) ?? [];
    const holdingsValue =
      summary?.finalHoldingsValueKrw ?? holdings.reduce((sum, holding) => sum + (holding.marketValueKrw ?? 0), 0);
    const cashKrw = summary?.finalCashKrw ?? 0;
    const finalEquity = summary?.finalEquityKrw ?? (holdingsValue || cashKrw ? holdingsValue + cashKrw : null);
    const topHolding = [...holdings].sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0))[0];
    const catalog = catalogById.get(row.id);
    const context = portfolioContextForRow(row, catalog);
    return {
      id: row.id,
      label: displayPortfolioName(row.id, row.label),
      shortLabel: displayPortfolioName(row.id, row.shortLabel),
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
      topHoldingLabel: topHolding?.company || topHolding?.symbol || '-',
      topHoldingWeight:
        finalEquity && finalEquity > 0 && topHolding?.marketValueKrw ? topHolding.marketValueKrw / finalEquity : null,
      shortlistRole: normalizeShortlistRole(context.role),
      shortlistReason: context.shortlistReason ?? context.subtitle,
      comparisonPrompt: context.comparisonPrompt,
      context,
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
    totalResearchAccountCount,
    hiddenResearchAccountCount: Math.max(0, totalResearchAccountCount - portfolioRows.length),
    holdings: allHoldings.filter((row) => portfolioIds.has(row.account_id)),
    equity,
    trades,
    accountLabels,
  };
}

function normalizeShortlistRole(role: string): PortfolioAccountSnapshot['shortlistRole'] {
  if (role === 'candidate') return 'candidate';
  if (role === 'robustness') return 'robustness';
  if (role === 'follower' || role === 'report_follower') return 'follower';
  return 'baseline';
}

function defaultPortfolioContext(
  kind: 'account' | 'benchmark' | 'oracle' = 'account',
): ReturnType<typeof getAccountCatalog>[number]['context'] {
  if (kind === 'benchmark') {
    return {
      role: 'benchmark',
      category: 'benchmark',
      title: '벤치마크',
      subtitle: '비교 기준',
      comparisonPrompt: '대표 계좌와 수익률, 낙폭, 현금 비중을 같은 축에서 비교합니다.',
      shortlistReason: null,
    };
  }
  return {
    role: 'portfolio',
    category: 'strategy',
    title: '포트폴리오 proof',
    subtitle: '비교 기준 미분류',
    comparisonPrompt: '수익률, 낙폭, 체결 강도를 기준선과 함께 비교합니다.',
    shortlistReason: null,
  };
}
function portfolioContextForRow(
  row: Pick<AccountLeaderboardRow, 'id' | 'kind'>,
  catalog: ReturnType<typeof getAccountCatalog>[number] | undefined,
): ReturnType<typeof getAccountCatalog>[number]['context'] {
  if (catalog?.context) return catalog.context;
  if (row.kind === 'benchmark' || row.kind === 'oracle') return defaultPortfolioContext(row.kind);
  throw new Error(`Missing exported account context for selectable account: ${row.id}`);
}

export function buildPortfolioRouteModels(selectedAccount?: string): PortfolioRouteModels {
  const allHoldings = getCurrentHoldings();
  const allAccounting = getAccountingReconciliations();
  const summaries = getSummaryRows();
  const allTrades = getTrades();
  const allEpisodes = getPositionEpisodes();
  const allTargetsBySymbol = getLatestReportTargetsBySymbol();
  const allTargetsByReportId = getReportTargetsById();
  const portfolioRows = getPortfolioRows();
  const benchmarkRows = getAccountLeaderboard().filter((row) => row.kind === 'benchmark');
  const catalogById = new Map(getAccountCatalog().map((row) => [row.accountId, row]));
  const defaultAccount = defaultPortfolioAccount(portfolioRows);

  const portfolioRowById = new Map(portfolioRows.map((row) => [row.id, row]));
  const dataAccountIds = new Set([
    ...summaries.map((row) => row.account_id),
    ...allHoldings.map((row) => row.account_id),
    ...allTrades.map((row) => row.account_id),
  ]);
  const accounts = Array.from(new Set([defaultAccount, ...portfolioRows.map((row) => row.id)])).filter((accountId) =>
    dataAccountIds.has(accountId),
  );
  const activeAccount = selectedAccount && accounts.includes(selectedAccount) ? selectedAccount : defaultAccount;
  const accountLabels = Object.fromEntries([
    ...accounts.map((accountId) => {
      const row = portfolioRowById.get(accountId);
      const fallback = row?.label ?? getAccountLabel(accountId);
      return [accountId, displayPortfolioName(accountId, fallback)];
    }),
    ...benchmarkRows.map((row) => [row.id, row.shortLabel || row.label]),
  ]);
  const accountOptions = accounts.map((accountId) => {
    const row = portfolioRowById.get(accountId);
    return {
      id: accountId,
      label: displayPortfolioName(accountId, row?.label ?? getAccountLabel(accountId)),
      shortLabel: displayPortfolioName(accountId, row?.shortLabel ?? getAccountLabel(accountId)),
      kind: 'account' as const,
      href: portfolioAccountHref(accountId),
      isDefault: accountId === defaultAccount,
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
  const benchmarkAccounts = benchmarkRows.map((row) => row.id);
  const equity = getEquityDailyForAccounts([activeAccount, ...benchmarkAccounts]);
  const trades = allTrades.filter((row) => row.account_id === activeAccount);
  const episodes = allEpisodes.filter((row) => row.account_id === activeAccount);
  const activeSummary = summaries.find((row) => row.account_id === activeAccount);
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
  const latestEquityDate = equity.reduce((latest, row) => (row.date > latest ? row.date : latest), '');
  const activeCatalog = catalogById.get(activeAccount);
  const activeContext = portfolioContextForRow(
    { id: activeAccount, kind: portfolioRowById.get(activeAccount)?.kind ?? 'account' },
    activeCatalog,
  );
  const ledgerDiagnostics = buildAccountLedgerDiagnostics({
    accounting: accounting[0],
    episodes,
    equity: equity.filter((row) => row.account_id === activeAccount),
    holdings,
    catalog: activeCatalog,
    leaderboardRow: portfolioRowById.get(activeAccount),
    summary: activeSummary,
  });
  const tradeTable: PortfolioTradeTableModel = {
    accountId: activeAccount,
    trades,
    accountLabels: pickAccountLabels(accountLabels, [activeAccount]),
    reportSymbolsById,
    targetsBySymbol,
    targetsByReportId,
  };
  const chart = {
    accountId: activeAccount,
    accountLabel: accountLabels[activeAccount] ?? activeAccount,
    accountLabels: pickAccountLabels(accountLabels, [activeAccount, ...benchmarkAccounts]),
    benchmarkAccounts,
    equity,
    trades,
    latestEquityDate,
  };

  return {
    shell: {
      selectedAccount: activeAccount,
      accountOptions,
      ledgerDiagnostics,
    },
    overview: {
      accountId: activeAccount,
      diagnostics: ledgerDiagnostics,
      holdings,
      targetsBySymbol,
      chart,
      tradeTable,
      context: activeContext,
    },
    holdings: {
      accountId: activeAccount,
      holdings,
      cashKrw: cashByAccount[activeAccount] ?? 0,
      capitalByAccount: { [activeAccount]: capitalByAccount[activeAccount] ?? 0 },
      accountLabels: pickAccountLabels(accountLabels, [activeAccount]),
      targetsBySymbol,
    },
    trades: tradeTable,
  };
}

function buildAccountLedgerDiagnostics({
  accounting,
  catalog,
  episodes,
  equity,
  holdings,
  leaderboardRow,
  summary,
}: {
  accounting: AccountingReconciliationRow | undefined;
  catalog: ReturnType<typeof getAccountCatalog>[number] | undefined;
  episodes: PositionEpisodeRow[];
  equity: EquityPoint[];
  holdings: HoldingRow[];
  leaderboardRow: AccountLeaderboardRow | undefined;
  summary: SummaryRow | undefined;
}): AccountLedgerDiagnostics {
  const closed = episodes.filter((episode) => episode.status === 'closed' || Boolean(episode.closeDate));
  const open = episodes.filter((episode) => episode.status !== 'closed' && !episode.closeDate);
  const wins = closed.filter((episode) => (episode.realizedPnlKrw ?? 0) > 0);
  const losses = closed.filter((episode) => (episode.realizedPnlKrw ?? 0) < 0);
  const avgWinKrw = average(wins.map((episode) => episode.realizedPnlKrw));
  const avgLossKrw = average(losses.map((episode) => episode.realizedPnlKrw));
  const lossUnitKrw = avgLossKrw !== null ? Math.abs(avgLossKrw) : null;
  const payoffRatioValue = ratio(avgWinKrw, avgLossKrw);
  const closedRMultiples = closed.map((episode) => rMultiple(episode.realizedPnlKrw, lossUnitKrw));
  const topFiveWinnerKrw = wins
    .map((episode) => episode.realizedPnlKrw ?? 0)
    .sort((a, b) => b - a)
    .slice(0, 5)
    .reduce((sum, value) => sum + value, 0);
  const bottomFiveLoserKrw = losses
    .map((episode) => episode.realizedPnlKrw ?? 0)
    .sort((a, b) => a - b)
    .slice(0, 5)
    .reduce((sum, value) => sum + value, 0);
  const realizedPnlKrw = accounting?.realizedPnlKrw ?? sumNullable(closed.map((episode) => episode.realizedPnlKrw));
  const unrealizedPnlKrw = accounting?.unrealizedPnlKrw ?? sumNullable(open.map((episode) => episode.unrealizedPnlKrw));
  const holdingsValueKrw =
    accounting?.openMarketValueKrw ??
    summary?.finalHoldingsValueKrw ??
    sumNullable(holdings.map((row) => row.marketValueKrw));
  const currentValueKrw = accounting?.finalEquityKrw ?? summary?.finalEquityKrw ?? null;
  const netProfitKrw =
    accounting?.netProfitKrw ??
    summary?.netProfitKrw ??
    addNullable([realizedPnlKrw, unrealizedPnlKrw, accounting?.cashYieldKrw]);
  const bestClosed = closed
    .filter((episode) => Number.isFinite(episode.realizedPnlKrw ?? Number.NaN))
    .sort((a, b) => (b.realizedPnlKrw ?? 0) - (a.realizedPnlKrw ?? 0))
    .slice(0, 3)
    .map((episode) => toPositionOutcome(episode, episode.realizedPnlKrw, lossUnitKrw));
  const worstClosed = closed
    .filter((episode) => Number.isFinite(episode.realizedPnlKrw ?? Number.NaN))
    .sort((a, b) => (a.realizedPnlKrw ?? 0) - (b.realizedPnlKrw ?? 0))
    .slice(0, 3)
    .map((episode) => toPositionOutcome(episode, episode.realizedPnlKrw, lossUnitKrw));
  const bestOpen = open
    .filter((episode) => Number.isFinite(episode.unrealizedPnlKrw ?? Number.NaN))
    .sort((a, b) => (b.unrealizedPnlKrw ?? 0) - (a.unrealizedPnlKrw ?? 0))
    .slice(0, 3)
    .map((episode) => toPositionOutcome(episode, episode.unrealizedPnlKrw, lossUnitKrw));
  const worstOpen = open
    .filter((episode) => Number.isFinite(episode.unrealizedPnlKrw ?? Number.NaN))
    .sort((a, b) => (a.unrealizedPnlKrw ?? 0) - (b.unrealizedPnlKrw ?? 0))
    .slice(0, 3)
    .map((episode) => toPositionOutcome(episode, episode.unrealizedPnlKrw, lossUnitKrw));
  const topWinner = bestClosed[0]?.pnlKrw ?? null;
  const topLoser = worstClosed[0]?.pnlKrw ?? null;
  const latestEquity = [...equity].sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    currentValueKrw,
    totalContributedKrw: accounting?.totalContributedKrw ?? summary?.totalContributedKrw ?? null,
    netProfitKrw,
    cumulativeReturn:
      latestEquity?.cumulativeReturn ?? summary?.moneyWeightedReturn ?? leaderboardRow?.returnPct ?? null,
    cagr: catalog?.metrics.cagr ?? null,
    sharpe: leaderboardRow?.sharpe ?? null,
    sortino: leaderboardRow?.sortino ?? null,
    maxDrawdown: summary?.maxDrawdown ?? leaderboardRow?.maxDrawdown ?? null,
    currentDrawdown: currentDrawdown(equity),
    realizedPnlKrw,
    unrealizedPnlKrw,
    cashYieldKrw: accounting?.cashYieldKrw ?? null,
    cashKrw: accounting?.finalCashKrw ?? summary?.finalCashKrw ?? null,
    holdingsValueKrw,
    openPositionCount: open.length,
    closedEpisodeCount: closed.length,
    winningEpisodeCount: wins.length,
    losingEpisodeCount: losses.length,
    winRate: closed.length > 0 ? wins.length / closed.length : null,
    avgWinKrw,
    avgLossKrw,
    avgWinHoldingDays: average(wins.map((episode) => episode.holdingDays)),
    avgLossHoldingDays: average(losses.map((episode) => episode.holdingDays)),
    payoffRatio: payoffRatioValue,
    tradePerformanceIndex: multiplyNullable([closed.length > 0 ? wins.length / closed.length : null, payoffRatioValue]),
    avgRMultiple: average(closedRMultiples),
    expectancyKrw: average(closed.map((episode) => episode.realizedPnlKrw)),
    avgClosedHoldingDays: average(closed.map((episode) => episode.holdingDays)),
    maxConsecutiveLosses: maxConsecutiveLosses(closed),
    winnerConcentration:
      realizedPnlKrw !== null && realizedPnlKrw > 0 && topWinner !== null ? topWinner / realizedPnlKrw : null,
    topFiveWinnerContribution:
      realizedPnlKrw !== null && realizedPnlKrw > 0 && topFiveWinnerKrw > 0 ? topFiveWinnerKrw / realizedPnlKrw : null,
    loserDrag:
      netProfitKrw !== null && netProfitKrw !== 0 && topLoser !== null ? topLoser / Math.abs(netProfitKrw) : null,
    bottomFiveLoserDrag:
      realizedPnlKrw !== null && realizedPnlKrw !== 0 && bottomFiveLoserKrw < 0
        ? bottomFiveLoserKrw / Math.abs(realizedPnlKrw)
        : null,
    reconciliationStatus: accounting?.status ?? 'missing',
    reconciliationGaps: {
      cashGapKrw: accounting?.cashGapKrw ?? null,
      equityGapKrw: accounting?.equityGapKrw ?? null,
      profitGapKrw: accounting?.profitGapKrw ?? null,
    },
    bestClosed,
    worstClosed,
    bestOpen,
    worstOpen,
  };
}

function toPositionOutcome(
  episode: PositionEpisodeRow,
  pnlKrw: number | null | undefined,
  lossUnitKrw: number | null,
): PositionOutcome {
  const costBasis = (episode.avgEntryPriceKrw ?? 0) * (episode.totalQtyBought ?? 0);
  return {
    symbol: episode.symbol,
    company: episode.company,
    status: episode.status,
    openDate: episode.openDate,
    closeDate: episode.closeDate,
    holdingDays: episode.holdingDays,
    pnlKrw: pnlKrw ?? null,
    returnPct: costBasis > 0 && pnlKrw !== null && pnlKrw !== undefined ? pnlKrw / costBasis : null,
    rMultiple: rMultiple(pnlKrw, lossUnitKrw),
    reason: normalizeExitReason(episode.exitReasons),
  };
}

function normalizeExitReason(value: string): string {
  return value.replace(/[()']/g, '').replace(/,/g, '').trim() || 'open';
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const finite = values.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  );
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) : null;
}

function addNullable(values: Array<number | null | undefined>): number | null {
  const finite = values.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  );
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) : null;
}

function multiplyNullable(values: Array<number | null | undefined>): number | null {
  const finite = values.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  );
  if (finite.length !== values.length) return null;
  return finite.reduce((product, value) => product * value, 1);
}

function average(values: Array<number | null | undefined>): number | null {
  const finite = values.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  );
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : null;
}

function currentDrawdown(equity: EquityPoint[]): number | null {
  let peak: number | null = null;
  let latest: number | null = null;
  for (const point of [...equity].sort((a, b) => a.date.localeCompare(b.date))) {
    if (point.equityKrw === null || point.equityKrw === undefined || !Number.isFinite(point.equityKrw)) continue;
    peak = peak === null ? point.equityKrw : Math.max(peak, point.equityKrw);
    latest = point.equityKrw;
  }
  if (peak === null || latest === null || peak <= 0) return null;
  return latest / peak - 1;
}

function maxConsecutiveLosses(episodes: PositionEpisodeRow[]): number {
  let current = 0;
  let maximum = 0;
  for (const episode of [...episodes].sort((a, b) =>
    (a.closeDate ?? a.openDate).localeCompare(b.closeDate ?? b.openDate),
  )) {
    if ((episode.realizedPnlKrw ?? 0) < 0) {
      current += 1;
      maximum = Math.max(maximum, current);
    } else {
      current = 0;
    }
  }
  return maximum;
}

function rMultiple(pnlKrw: number | null | undefined, lossUnitKrw: number | null): number | null {
  if (pnlKrw === null || pnlKrw === undefined || !Number.isFinite(pnlKrw)) return null;
  if (lossUnitKrw === null || !Number.isFinite(lossUnitKrw) || lossUnitKrw <= 0) return null;
  return pnlKrw / lossUnitKrw;
}

function ratio(win: number | null, loss: number | null): number | null {
  if (win === null || loss === null || loss === 0) return null;
  return win / Math.abs(loss);
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
  const order = new Map(getAccountCatalog().map((row) => [row.accountId, row.shortlistPriority ?? 999]));
  return rows
    .filter((row) => row.kind === 'account' && row.isSelectable)
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
}

function defaultPortfolioAccount(rows: AccountLeaderboardRow[]): string {
  const primary = rows[0]?.id;
  if (primary) return primary;
  const productDefault = getDefaultPortfolioAccount();
  if (rows.some((row) => row.id === productDefault)) return productDefault;
  const firstAvailable = rows[0]?.id;
  if (firstAvailable) return firstAvailable;
  return productDefault;
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

function pickAccountLabels(accountLabels: Record<string, string>, accountIds: string[]) {
  return Object.fromEntries(accountIds.map((accountId) => [accountId, accountLabels[accountId] ?? accountId]));
}
