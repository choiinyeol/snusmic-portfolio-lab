import type { StrategySelectorOption } from '@/components/trading/StrategySelector';
import type {
  AccountingReconciliationRow,
  EquityPoint,
  HoldingRow,
  PositionEpisodeRow,
  QuantStrategySearchRow,
  ReportTargetDigest,
  TradeRow,
} from '@/lib/artifacts';

export type StrategyMethod = {
  summary: string;
  buyRules: string[];
  sellRules: string[];
  riskControls: string[];
  params: Record<string, unknown>;
};

export type PortfolioViewModel = {
  holdings: HoldingRow[];
  accounting: AccountingReconciliationRow[];
  equity: EquityPoint[];
  trades: TradeRow[];
  episodes: PositionEpisodeRow[];
  personas: string[];
  personaLabels: Record<string, string>;
  strategyOptions: StrategySelectorOption[];
  defaultPersona: string;
  selectedPersona: string;
  invalidStrategyId: string | null;
  methodsByPersona: Record<string, StrategyMethod>;
  capitalByPersona: Record<string, number>;
  cashByPersona: Record<string, number>;
  reportSymbolsById: Record<string, string>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
  targetsByReportId: Record<string, ReportTargetDigest>;
  portfolioStrategyCount: number;
  latestEquityDate: string;
};

export type PortfolioStrategySnapshot = {
  id: string;
  label: string;
  shortLabel: string;
  kind: 'strategy' | 'benchmark' | 'oracle';
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
  defaultPersona: string;
  latestEquityDate: string;
  strategies: PortfolioStrategySnapshot[];
  frontierRows: PortfolioStrategySnapshot[];
  quantSearch: {
    candidateCount: number;
    goalHitCount: number;
    excluded: string[];
    rows: QuantStrategySearchRow[];
  };
  allWeatherReturn: number | null;
  holdings: HoldingRow[];
  equity: EquityPoint[];
  trades: TradeRow[];
  personaLabels: Record<string, string>;
};
