import type {
  AccountLedgerDiagnostics,
  PortfolioLandingModel,
  PortfolioAccountSnapshot,
  PositionOutcome,
  PortfolioViewModel,
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
import { strategyMeta } from '@/components/trading/portfolio-views/strategy-display';
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
    const shortlist = shortlistMetadata(row.id);
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
      ...shortlist,
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

function shortlistMetadata(
  accountId: string,
): Pick<PortfolioAccountSnapshot, 'shortlistRole' | 'shortlistReason' | 'comparisonPrompt'> {
  const meta = strategyMeta(accountId);

  if (meta.role === 'candidate') {
    return {
      shortlistRole: 'candidate',
      shortlistReason: '현재 검토 후보라서 다른 대표 원장보다 먼저 봅니다.',
      comparisonPrompt: '부분 재투입 후보가 수익률, 낙폭, 체결 수를 함께 개선했는지 확인합니다.',
    };
  }

  if (meta.role === 'robustness') {
    return {
      shortlistRole: 'robustness',
      shortlistReason: '후보와 같은 trim 구조에서 현금 재투입 강도만 비교하는 견고성 점검입니다.',
      comparisonPrompt: '현금 전액 재투입 대비 부분 재투입이 과열 재진입과 낙폭을 줄였는지 봅니다.',
    };
  }

  if (accountId === 'smic_follower') {
    return {
      shortlistRole: 'follower',
      shortlistReason: '점수 전략 없이 리포트 추종만 했을 때의 현실적인 기준선입니다.',
      comparisonPrompt: 'TopN 점수 전략이 단순 리포트 추종보다 충분한 초과성과를 냈는지 봅니다.',
    };
  }

  return {
    shortlistRole: 'baseline',
    shortlistReason: `${meta.subtitle}으로 후보 전략의 추가 규칙을 떼어 비교합니다.`,
    comparisonPrompt: '후보의 보유 유지, trim, 현금 재투입 규칙이 기준선 대비 무엇을 더했는지 봅니다.',
  };
}

export function buildPortfolioViewModel(selectedAccount?: string): PortfolioViewModel {
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
  const accounts = Array.from(new Set([defaultAccount, ...portfolioRows.map((row) => row.id)])).filter((account_id) =>
    dataAccountIds.has(account_id),
  );
  const activeAccount = selectedAccount && accounts.includes(selectedAccount) ? selectedAccount : defaultAccount;
  const invalidAccountId = selectedAccount && !accounts.includes(selectedAccount) ? selectedAccount : null;
  const accountLabels = Object.fromEntries([
    ...accounts.map((account_id) => {
      const row = portfolioRowById.get(account_id);
      const fallback = row?.label ?? getAccountLabel(account_id);
      return [account_id, displayPortfolioName(account_id, fallback)];
    }),
    ...benchmarkRows.map((row) => [row.id, row.shortLabel || row.label]),
  ]);
  const accountOptions = accounts.map((account_id) => {
    const row = portfolioRowById.get(account_id);
    return {
      id: account_id,
      label: displayPortfolioName(account_id, row?.label ?? getAccountLabel(account_id)),
      shortLabel: displayPortfolioName(account_id, row?.shortLabel ?? getAccountLabel(account_id)),
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
  const equity = getEquityDailyForAccounts([activeAccount, ...benchmarkIds]);
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
  const latestEquityDate = equity
    .filter((row) => accounts.includes(row.account_id))
    .reduce((latest, row) => (row.date > latest ? row.date : latest), '');
  return {
    holdings,
    accounting,
    equity,
    trades,
    episodes,
    ledgerDiagnostics: buildAccountLedgerDiagnostics({
      accounting: accounting[0],
      episodes,
      equity: equity.filter((row) => row.account_id === activeAccount),
      holdings,
      catalog: catalogById.get(activeAccount),
      leaderboardRow: portfolioRowById.get(activeAccount),
      summary: activeSummary,
    }),
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
    .filter((episode) => Number.isFinite(episode.realizedPnlKrw ?? NaN))
    .sort((a, b) => (b.realizedPnlKrw ?? 0) - (a.realizedPnlKrw ?? 0))
    .slice(0, 3)
    .map((episode) => toPositionOutcome(episode, episode.realizedPnlKrw, lossUnitKrw));
  const worstClosed = closed
    .filter((episode) => Number.isFinite(episode.realizedPnlKrw ?? NaN))
    .sort((a, b) => (a.realizedPnlKrw ?? 0) - (b.realizedPnlKrw ?? 0))
    .slice(0, 3)
    .map((episode) => toPositionOutcome(episode, episode.realizedPnlKrw, lossUnitKrw));
  const bestOpen = open
    .filter((episode) => Number.isFinite(episode.unrealizedPnlKrw ?? NaN))
    .sort((a, b) => (b.unrealizedPnlKrw ?? 0) - (a.unrealizedPnlKrw ?? 0))
    .slice(0, 3)
    .map((episode) => toPositionOutcome(episode, episode.unrealizedPnlKrw, lossUnitKrw));
  const worstOpen = open
    .filter((episode) => Number.isFinite(episode.unrealizedPnlKrw ?? NaN))
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
