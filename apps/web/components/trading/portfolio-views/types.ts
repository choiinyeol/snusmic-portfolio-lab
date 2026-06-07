import type { AccountSelectorOption } from '@/components/trading/AccountSelector';
import type {
  AccountingReconciliationRow,
  EquityPoint,
  HoldingRow,
  PositionEpisodeRow,
  ReportTargetDigest,
  TradeRow,
} from '@/lib/artifacts';

export type PortfolioViewModel = {
  holdings: HoldingRow[];
  accounting: AccountingReconciliationRow[];
  equity: EquityPoint[];
  trades: TradeRow[];
  episodes: PositionEpisodeRow[];
  ledgerDiagnostics: AccountLedgerDiagnostics;
  accounts: string[];
  benchmarkAccounts: string[];
  accountLabels: Record<string, string>;
  accountOptions: AccountSelectorOption[];
  defaultAccount: string;
  selectedAccount: string;
  invalidAccountId: string | null;
  capitalByAccount: Record<string, number>;
  cashByAccount: Record<string, number>;
  reportSymbolsById: Record<string, string>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
  targetsByReportId: Record<string, ReportTargetDigest>;
  portfolioAccountCount: number;
  latestEquityDate: string;
};

export type PositionOutcome = {
  symbol: string;
  company: string;
  status: string;
  openDate: string;
  closeDate: string | null;
  holdingDays: number | null;
  pnlKrw: number | null;
  returnPct: number | null;
  rMultiple: number | null;
  reason: string;
};

export type AccountLedgerDiagnostics = {
  currentValueKrw: number | null;
  totalContributedKrw: number | null;
  netProfitKrw: number | null;
  cumulativeReturn: number | null;
  cagr: number | null;
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number | null;
  currentDrawdown: number | null;
  realizedPnlKrw: number | null;
  unrealizedPnlKrw: number | null;
  cashYieldKrw: number | null;
  cashKrw: number | null;
  holdingsValueKrw: number | null;
  openPositionCount: number;
  closedEpisodeCount: number;
  winningEpisodeCount: number;
  losingEpisodeCount: number;
  winRate: number | null;
  avgWinKrw: number | null;
  avgLossKrw: number | null;
  avgWinHoldingDays: number | null;
  avgLossHoldingDays: number | null;
  payoffRatio: number | null;
  tradePerformanceIndex: number | null;
  avgRMultiple: number | null;
  expectancyKrw: number | null;
  avgClosedHoldingDays: number | null;
  maxConsecutiveLosses: number;
  winnerConcentration: number | null;
  topFiveWinnerContribution: number | null;
  loserDrag: number | null;
  bottomFiveLoserDrag: number | null;
  reconciliationStatus: 'ok' | 'warning' | 'missing';
  reconciliationGaps: {
    cashGapKrw: number | null;
    equityGapKrw: number | null;
    profitGapKrw: number | null;
  };
  bestClosed: PositionOutcome[];
  worstClosed: PositionOutcome[];
  bestOpen: PositionOutcome[];
  worstOpen: PositionOutcome[];
};

export type PortfolioAccountSnapshot = {
  id: string;
  label: string;
  shortLabel: string;
  kind: 'account' | 'benchmark' | 'oracle';
  href: string;
  finalEquityKrw: number | null;
  cashKrw: number | null;
  holdingsValueKrw: number | null;
  cashWeight: number | null;
  moneyWeightedReturn: number | null;
  maxDrawdown: number | null;
  tradeCount: number | null;
  holdingCount: number;
  topHoldingLabel: string;
  topHoldingWeight: number | null;
  shortlistRole: 'candidate' | 'baseline' | 'robustness' | 'follower';
  shortlistReason: string;
  comparisonPrompt: string;
};

export type PortfolioLandingModel = {
  defaultAccount: string;
  latestEquityDate: string;
  accounts: PortfolioAccountSnapshot[];
  frontierRows: PortfolioAccountSnapshot[];
  allWeatherReturn: number | null;
  totalResearchAccountCount: number;
  hiddenResearchAccountCount: number;
  holdings: HoldingRow[];
  equity: EquityPoint[];
  trades: TradeRow[];
  accountLabels: Record<string, string>;
};
