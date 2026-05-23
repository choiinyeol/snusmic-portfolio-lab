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
  objectivePassed: boolean;
};

export type PortfolioLandingModel = {
  defaultAccount: string;
  latestEquityDate: string;
  accounts: PortfolioAccountSnapshot[];
  frontierRows: PortfolioAccountSnapshot[];
  allWeatherReturn: number | null;
  holdings: HoldingRow[];
  equity: EquityPoint[];
  trades: TradeRow[];
  accountLabels: Record<string, string>;
};
