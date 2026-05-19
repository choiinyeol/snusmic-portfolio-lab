import type {
  PortfolioLandingModel,
  PortfolioStrategySnapshot,
  PortfolioViewModel,
} from '@/components/trading/portfolio-views/types';
import {
  getAccountingReconciliations,
  getCurrentHoldings,
  getEquityDaily,
  getLatestReportTargetsBySymbol,
  getPersonaLabel,
  getPositionEpisodes,
  getReportSymbolById,
  getReportTargetsById,
  getSummaryRows,
  getTrades,
} from '@/lib/artifacts';
import {
  getDefaultPortfolioPersona,
  getSelectableStrategyRows,
  getStrategyLeaderboard,
  portfolioStrategyHref,
  type StrategyLeaderboardRow,
} from '@/lib/product-model';

const ALL_WEATHER_PERSONA = 'all_weather';

export function buildPortfolioLandingModel(): PortfolioLandingModel {
  const allHoldings = getCurrentHoldings();
  const allEquity = getEquityDaily();
  const summaries = getSummaryRows();
  const allTrades = getTrades();
  const leaderboardRows = getStrategyLeaderboard();
  const allWeatherReturn = leaderboardRows.find((row) => row.id === ALL_WEATHER_PERSONA)?.returnPct ?? null;
  const portfolioRows = getPortfolioRows(leaderboardRows);
  const benchmarkRows = leaderboardRows.filter((row) => row.kind === 'benchmark');
  const defaultPersona = getDefaultPortfolioPersona();
  const portfolioIds = new Set(portfolioRows.map((row) => row.id));
  const frontierIds = new Set([...portfolioRows.map((row) => row.id), ...benchmarkRows.map((row) => row.id)]);
  const personaLabels = Object.fromEntries(portfolioRows.map((row) => [row.id, row.label]));
  const summaryById = new Map(summaries.map((row) => [row.persona, row]));
  const holdingsByPersona = groupByPersona(allHoldings.filter((row) => frontierIds.has(row.persona)));
  const trades = allTrades.filter((row) => portfolioIds.has(row.persona));
  const equity = allEquity.filter((row) => portfolioIds.has(row.persona));
  const snapshotFromRow = (row: StrategyLeaderboardRow): PortfolioStrategySnapshot => {
    const summary = summaryById.get(row.id);
    const holdings = holdingsByPersona.get(row.id) ?? [];
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
  const strategies = portfolioRows.map(snapshotFromRow);
  const frontierRows = [...strategies, ...benchmarkRows.map(snapshotFromRow)];
  return {
    defaultPersona,
    latestEquityDate: equity.reduce((latest, row) => (row.date > latest ? row.date : latest), ''),
    strategies,
    frontierRows,
    allWeatherReturn,
    holdings: allHoldings.filter((row) => portfolioIds.has(row.persona)),
    equity,
    trades,
    personaLabels,
  };
}

export function buildPortfolioViewModel(selectedPersona?: string): PortfolioViewModel {
  const allHoldings = getCurrentHoldings();
  const allAccounting = getAccountingReconciliations();
  const allEquity = getEquityDaily();
  const summaries = getSummaryRows();
  const allTrades = getTrades();
  const allEpisodes = getPositionEpisodes();
  const allTargetsBySymbol = getLatestReportTargetsBySymbol();
  const allTargetsByReportId = getReportTargetsById();
  const portfolioRows = getPortfolioRows();
  const defaultPersona = getDefaultPortfolioPersona();

  const portfolioRowById = new Map(portfolioRows.map((row) => [row.id, row]));
  const dataPersonaIds = new Set([
    ...summaries.map((row) => row.persona),
    ...allHoldings.map((row) => row.persona),
    ...allTrades.map((row) => row.persona),
    ...allEquity.map((row) => row.persona),
  ]);
  const personas = Array.from(new Set([defaultPersona, ...portfolioRows.map((row) => row.id)])).filter((persona) =>
    dataPersonaIds.has(persona),
  );
  const activePersona = selectedPersona && personas.includes(selectedPersona) ? selectedPersona : defaultPersona;
  const invalidStrategyId = selectedPersona && !personas.includes(selectedPersona) ? selectedPersona : null;
  const personaLabels = Object.fromEntries(
    personas.map((persona) => [persona, portfolioRowById.get(persona)?.label ?? getPersonaLabel(persona)]),
  );
  const strategyOptions = personas.map((persona) => {
    const row = portfolioRowById.get(persona);
    return {
      id: persona,
      label: row?.label ?? getPersonaLabel(persona),
      shortLabel: row?.shortLabel ?? getPersonaLabel(persona),
      kind: 'strategy' as const,
      href: portfolioStrategyHref(persona),
      isDefault: persona === defaultPersona,
    };
  });
  const capitalByPersona = Object.fromEntries(
    summaries
      .filter((row) => personas.includes(row.persona))
      .map((row) => [row.persona, row.totalContributedKrw ?? row.finalEquityKrw ?? 0]),
  );
  const cashByPersona = Object.fromEntries(
    summaries.filter((row) => personas.includes(row.persona)).map((row) => [row.persona, row.finalCashKrw ?? 0]),
  );
  const methodsByPersona = Object.fromEntries(
    portfolioRows.map((row) => [
      row.id,
      {
        summary: row.methodologySummary,
        buyRules: row.buyRules,
        sellRules: row.sellRules,
        riskControls: row.riskControls,
        params: row.params,
      },
    ]),
  );

  const holdings = allHoldings.filter((row) => row.persona === activePersona);
  const accounting = allAccounting.filter((row) => row.persona === activePersona);
  const equity = allEquity.filter((row) => row.persona === activePersona);
  const trades = allTrades.filter((row) => row.persona === activePersona);
  const episodes = allEpisodes.filter((row) => row.persona === activePersona);
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
    .filter((row) => personas.includes(row.persona))
    .reduce((latest, row) => (row.date > latest ? row.date : latest), '');
  return {
    holdings,
    accounting,
    equity,
    trades,
    episodes,
    personas,
    personaLabels,
    strategyOptions,
    defaultPersona,
    selectedPersona: activePersona,
    invalidStrategyId,
    methodsByPersona,
    capitalByPersona,
    cashByPersona,
    reportSymbolsById,
    targetsBySymbol,
    targetsByReportId,
    portfolioStrategyCount: personas.length,
    latestEquityDate,
  };
}

export function getPortfolioStaticParams() {
  const summaries = getSummaryRows();
  const summaryIds = new Set(summaries.map((row) => row.persona));
  return getPortfolioRows(getStrategyLeaderboard())
    .filter((row) => summaryIds.has(row.id))
    .map((row) => ({ strategy: row.id }));
}

function getPortfolioRows(rows: StrategyLeaderboardRow[] = getStrategyLeaderboard()) {
  const allWeatherReturn = rows.find((row) => row.id === ALL_WEATHER_PERSONA)?.returnPct ?? null;
  return getSelectableStrategyRows(rows).filter((row) => {
    if (row.kind !== 'strategy' || !row.isSelectable) return false;
    if (allWeatherReturn === null || row.returnPct === null) return true;
    return row.returnPct >= allWeatherReturn;
  });
}

function groupByPersona<T extends { persona: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const group = map.get(row.persona) ?? [];
    group.push(row);
    map.set(row.persona, group);
  }
  return map;
}
