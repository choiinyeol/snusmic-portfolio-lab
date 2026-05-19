import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {
  ArtifactManifestSchema,
  AccountingReconciliationRowSchema,
  CompactEquityArtifactSchema,
  CompactTableArtifactSchema,
  parseArtifact,
  parseRows,
  RawHoldingRowSchema,
  RawReportRowSchema,
  ScreenerCandidateSchema,
  RawTradeRowSchema,
  StrategyCatalogRowSchema,
  WebPersonaSchema,
  WebDataQualitySchema,
  WebOverviewSchema,
} from '@/lib/schemas';

const repoRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), '../..');

type RawReport = Record<string, unknown>;
type CompactTableArtifact = {
  columns: string[];
  rows: unknown[][];
};

export type ReportRow = {
  reportId: string;
  symbol: string;
  company: string;
  publicationDate: string;
  title: string;
  exchange: string;
  markdownFilename: string;
  pdfFilename: string;
  pdfUrl: string;
  currency: string;
  displayCurrency: string;
  targetDirection: 'upside' | 'downside' | null;
  entryPriceKrw: number | null;
  entryPriceNative: number | null;
  targetPriceKrw: number | null;
  targetPriceNative: number | null;
  targetUpsideAtPub: number | null;
  targetHit: boolean;
  targetHitDate: string | null;
  daysToTarget: number | null;
  lastCloseKrw: number | null;
  lastCloseNative: number | null;
  lastCloseDate: string | null;
  currentReturn: number | null;
  peakReturn: number | null;
  troughReturn: number | null;
  targetGapPct: number | null;
  /** Additional move (always >= 0) the current price must make to reach
   * the target. Null for hit/expired/no-target reports. */
  targetRemainingPct: number | null;
  /** Progress from entry price to target price, capped to 0..1.
   * Formula: `(current - entry) / (target - entry)`. Null when no target. */
  targetProgressPct: number | null;
  expiryDate: string | null;
  expired: boolean;
  caveatFlags: string[];
};

export type HoldingRow = {
  persona: string;
  symbol: string;
  company: string;
  qty: number | null;
  avgCostKrw: number | null;
  lastCloseKrw: number | null;
  lastCloseNative: number | null;
  currency: string;
  marketValueKrw: number | null;
  unrealizedPnlKrw: number | null;
  unrealizedReturn: number | null;
  holdingDays: number | null;
  firstBuyDate: string | null;
};

export type MonthlyHoldingRow = {
  persona: string;
  monthEnd: string;
  symbol: string;
  company: string;
  qty: number | null;
  avgCostKrw: number | null;
  monthCloseKrw: number | null;
  monthCloseNative: number | null;
  currency: string;
  marketValueKrw: number | null;
  unrealizedPnlKrw: number | null;
  unrealizedReturn: number | null;
  weightInPortfolio: number | null;
};

export type TradeRow = {
  persona: string;
  date: string;
  symbol: string;
  side: 'buy' | 'sell' | string;
  qty: number | null;
  currency: string;
  fillPriceKrw: number | null;
  fillPriceNative: number | null;
  grossNative: number | null;
  grossKrw: number | null;
  cashAfterKrw: number | null;
  reason: string;
  reportId: string | null;
};

export type PositionEpisodeRow = {
  persona: string;
  symbol: string;
  company: string;
  openDate: string;
  closeDate: string | null;
  holdingDays: number | null;
  buyFills: number | null;
  sellFills: number | null;
  totalQtyBought: number | null;
  totalQtySold: number | null;
  currency: string;
  avgEntryPriceKrw: number | null;
  avgEntryPriceNative: number | null;
  avgExitPriceKrw: number | null;
  avgExitPriceNative: number | null;
  realizedPnlKrw: number | null;
  unrealizedPnlKrw: number | null;
  lastCloseKrw: number | null;
  lastCloseNative: number | null;
  status: string;
  exitReasons: string;
};

export type PricePoint = {
  time: string;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  closeKrw?: number | null;
  currency?: string;
  volume?: number | null;
  stockSplit?: number | null;
  splitEventType?: string | null;
  splitRatioText?: string | null;
  splitFactor?: number | null;
  cumSplitFactorToLatest?: number | null;
  splitAdjustedOpen?: number | null;
  splitAdjustedHigh?: number | null;
  splitAdjustedLow?: number | null;
  splitAdjustedClose?: number | null;
  splitAdjustedCloseKrw?: number | null;
  splitAdjustedVolume?: number | null;
};

export type ReportTargetDigest = {
  reportId: string;
  symbol: string;
  company: string;
  exchange: string;
  marketRegion: 'domestic' | 'overseas';
  currency: string;
  publicationDate: string;
  targetPriceKrw: number | null;
  targetPriceNative: number | null;
  targetUpsideAtPub: number | null;
};
export type EquityPoint = {
  persona: string;
  date: string;
  equityKrw: number | null;
  contributedCapitalKrw: number | null;
  cumulativeReturn: number | null;
};
export type SummaryRow = {
  persona: string;
  label?: string;
  finalEquityKrw: number | null;
  finalCashKrw?: number | null;
  finalHoldingsValueKrw?: number | null;
  totalContributedKrw: number | null;
  cumulativeDepositsKrw?: number | null;
  netProfitKrw: number | null;
  irr?: number | null;
  moneyWeightedReturn?: number | null;
  maxDrawdown: number | null;
  tradeCount: number | null;
};

export type AccountingReconciliationRow = {
  persona: string;
  label?: string;
  totalContributedKrw: number | null;
  realizedPnlKrw: number | null;
  finalCashKrw: number | null;
  openCostBasisKrw: number | null;
  openMarketValueKrw: number | null;
  unrealizedPnlKrw: number | null;
  cashYieldKrw?: number | null;
  finalEquityKrw: number | null;
  netProfitKrw: number | null;
  expectedCashKrw: number | null;
  cashGapKrw: number | null;
  equityGapKrw: number | null;
  profitGapKrw: number | null;
  status: 'ok' | 'warning';
  explanationKo: string;
};
export type DataQuality = {
  extractedReports: number;
  reportsWithPrices: number;
  totalReports: number;
  targetHitRate: number;
  missingPriceSymbols: number;
  reportExclusions: Record<string, number>;
  extractionQuality: Record<string, unknown>;
};

export type StrategyCatalogRow = {
  strategyId: string;
  label: string;
  shortLabel: string;
  kind: 'benchmark' | 'strategy' | 'oracle';
  benchmarkGroup: string | null;
  isSelectable: boolean;
  isDefaultCandidate: boolean;
  objectivePassed: boolean;
  objectiveReturnExcess: number | null;
  objectiveMddSlack: number | null;
  methodologySummary: string;
  buyRules: string[];
  sellRules: string[];
  riskControls: string[];
  params: Record<string, unknown>;
  metrics: {
    finalEquityKrw: number | null;
    finalCashKrw: number | null;
    finalHoldingsValueKrw: number | null;
    moneyWeightedReturn: number | null;
    cagr: number | null;
    maxDrawdown: number | null;
    tradeCount: number | null;
    openPositions: number | null;
  };
};

export type ScreenerCandidateRow = {
  reportId: string;
  symbol: string;
  company: string;
  publicationDate: string;
  bucket: 'fresh' | 'large-upside' | 'near-target' | 'active';
  rankBasis: string;
  score: number;
  targetUpsideAtPub: number | null;
  currentReturn: number | null;
  targetGapPct: number | null;
};

export type WebPersona = {
  persona: string;
  label?: string;
  final_equity_krw: number | null;
  final_cash_krw?: number | null;
  final_holdings_value_krw?: number | null;
  total_contributed_krw?: number | null;
  cumulative_deposits_krw?: number | null;
  net_profit_krw: number | null;
  money_weighted_return?: number | null;
  cagr?: number | null;
  max_drawdown: number | null;
  trade_count: number | null;
  open_positions?: number | null;
};

export type WebReportRankingRow = {
  report_id: string;
  symbol: string;
  company: string;
  publication_date: string;
  date?: string;
  entry_price_krw: number | null;
  target_price_krw: number | null;
  target_upside_at_pub: number | null;
  target_hit: boolean;
  target_hit_date: string | null;
  days_to_target: number | null;
  last_close_krw: number | null;
  last_close_date: string | null;
  current_return: number | null;
  peak_return: number | null;
  trough_return: number | null;
  target_gap_pct: number | null;
  value?: number | null;
};

export type ReportCounts = {
  extracted_reports?: number;
  web_report_rows?: number;
  price_matched_reports?: number;
  excluded_reports?: number;
  excluded_missing_price?: number;
  excluded_missing_performance?: number;
  excluded_sell_opinion?: number;
  excluded_non_positive_upside?: number;
  excluded_downside_target?: number;
  excluded_instant_target_hit?: number;
  [key: string]: number | undefined;
};

export type WebOverview = {
  baseline_personas: WebPersona[];
  generated_from?: Record<string, string>;
  report_counts?: ReportCounts;
  simulation_window?: Record<string, string | null>;
  target_stats?: Record<string, number | null>;
};

export type WebReportRankings = {
  top_winners?: WebReportRankingRow[];
  top_losers?: WebReportRankingRow[];
  most_aggressive_targets?: WebReportRankingRow[];
  fastest_hits?: WebReportRankingRow[];
  biggest_open_target_gaps?: WebReportRankingRow[];
  best_current_returns?: WebReportRankingRow[];
  worst_current_returns?: WebReportRankingRow[];
};

export type WebDataQuality = {
  coverage?: Record<string, number>;
  extraction_quality?: Record<string, unknown>;
  report_exclusions?: Record<string, number>;
  missing_symbols?: { symbol: string; company?: string; reason?: string }[];
};

export type ArtifactManifest = {
  schema_version: string;
  generated_at: string | null;
  artifact_root: string;
  report_range: { start: string | null; end: string | null };
  price_range: { start: string | null; end: string | null };
  simulation_range: { start: string | null; end: string | null };
  row_counts: Record<string, number>;
  data_quality: {
    total_reports?: number | null;
    reports_with_prices?: number | null;
    missing_price_symbols?: number | null;
    target_hit_count?: number | null;
  };
  artifacts: string[];
  price_artifact_count: number;
  checksums: Record<string, string>;
};

export type Insight = {
  id: string;
  title: string;
  sentence: string;
  metric?: number | string | null;
  related_report_ids?: string[];
};

export type ReportStatisticsLabSummary = {
  generatedAt: string;
  sample: {
    reportCount: number;
    eligibleReportCount: number;
    tickerCount: number;
    startDate: string;
    endDate: string;
    exclusions: Record<string, number>;
  };
  fractionalHitRates: Array<{
    threshold: number;
    horizonDays: number;
    hitRate: number | null;
    sampleSize: number;
    hitCount: number;
    medianDaysToHit: number | null;
    ci95: [number | null, number | null];
  }>;
  delayedEntry: Array<{
    delayDays: number;
    horizonDays: number;
    sampleSize: number;
    medianReturn: number | null;
    meanReturn: number | null;
    p25Return: number | null;
    p75Return: number | null;
    winRate: number | null;
    hitRate08: number | null;
    medianDrawdown: number | null;
  }>;
  entryTriggers: Array<{
    type: 'dip' | 'rally';
    triggerPct: number;
    horizonDays: number;
    entryRate: number | null;
    sampleSize: number;
    enteredCount: number;
    medianReturn: number | null;
    meanReturn: number | null;
    hitRate08: number | null;
    medianDrawdown: number | null;
    missedOpportunityRate: number | null;
    falseBreakoutRate: number | null;
  }>;
  postTargetDrift: Array<{
    daysAfterTarget: number;
    sampleSize: number;
    medianReturn: number | null;
    meanReturn: number | null;
    p25Return: number | null;
    p75Return: number | null;
    p10Return: number | null;
    p90Return: number | null;
    sharePositive: number | null;
  }>;
  optimalTargetMultiples: Array<{
    targetMultiple: number;
    horizonDays: number;
    hitRate: number | null;
    sampleSize: number;
    medianReturn: number | null;
    meanReturn: number | null;
    p25Return: number | null;
    downsideRisk: number | null;
    rewardReliabilityScore: number | null;
  }>;
  riskScatter: Array<{
    reportId: string;
    symbol: string;
    company: string;
    publicationDate: string;
    maxFavorableExcursion: number | null;
    maxAdverseExcursion: number | null;
    upsideCaptureRatio: number | null;
    targetReturn: number | null;
    currentReturn: number | null;
    /** Close-price return at the end of the analysis window (publication
     * + N trading days). Populated at runtime when the row has been
     * clipped to a window; `null` if the window has not fully elapsed
     * yet (active reports inside their first N days). */
    expiryReturn?: number | null;
    /** Absolute KRW close at the window's expiry day. Null when the
     * window is still in progress. */
    expiryCloseKrw?: number | null;
    /** ISO date string for the expiry day's bar. Useful when surfacing
     * "만료 시점" rows on per-report views. */
    expiryDate?: string | null;
    hit06: boolean;
    hit08: boolean;
    hit10: boolean;
  }>;
  topExamples: Record<string, Array<Record<string, unknown>>>;
};

function fullPath(relativePath: string): string {
  return path.join(repoRoot, relativePath);
}

let artifactCacheStamp: number | undefined;

function artifactCacheValid(): boolean {
  if (process.env.NODE_ENV === 'production') return true;

  const stamp = currentArtifactStamp();
  if (artifactCacheStamp === stamp) return true;

  clearArtifactCaches();
  artifactCacheStamp = stamp;
  return false;
}

function currentArtifactStamp(): number {
  try {
    return fs.statSync(fullPath('data/web/manifest.json')).mtimeMs;
  } catch {
    return Date.now();
  }
}

function clearArtifactCaches() {
  reportCache = undefined;
  strategyCatalogCache = undefined;
  screenerCandidateCache = undefined;
  holdingsCache = undefined;
  monthlyHoldingsCache = undefined;
  tradesCache = undefined;
  positionEpisodesCache = undefined;
  equityDailyCache = undefined;
  strategyCurvesCache = undefined;
  priceSeriesCache.clear();
  nativePricePointCache.clear();
}

function readText(relativePath: string): string {
  return fs.readFileSync(fullPath(relativePath), 'utf8');
}

function readRequiredJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function num(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown): boolean {
  return value === true || value === 'True' || value === 'true' || value === '1' || value === 1;
}

function strOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function targetDirection(value: unknown): 'upside' | 'downside' | null {
  return value === 'upside' || value === 'downside' ? value : null;
}

function positivePrice(value: unknown): number | undefined {
  const parsed = num(value);
  if (parsed === null || parsed <= 0) return undefined;
  return parsed;
}

let reportCache: ReportRow[] | undefined;
export function getReportRows(): ReportRow[] {
  if (artifactCacheValid() && reportCache) return reportCache;
  const raw = parseRows('reports/table.json', RawReportRowSchema, JSON.parse(readText('data/web/reports/table.json')));
  reportCache = raw
    .map((row) => fromRawReport(row as RawReport))
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate) || a.company.localeCompare(b.company, 'ko-KR'));
  return reportCache;
}

function fromRawReport(row: RawReport): ReportRow {
  const report: ReportRow = {
    reportId: String(row.report_id ?? row.reportId ?? ''),
    symbol: String(row.symbol ?? ''),
    company: String(row.company ?? ''),
    publicationDate: String(row.date ?? row.publication_date ?? row.publicationDate ?? ''),
    title: String(row.title ?? row.company ?? ''),
    exchange: String(row.exchange ?? ''),
    markdownFilename: String(row.markdown_filename ?? row.markdownFilename ?? ''),
    pdfFilename: String(row.pdf_filename ?? row.pdfFilename ?? ''),
    pdfUrl: String(row.pdf_url ?? row.pdfUrl ?? ''),
    currency: String(row.currency ?? row.price_currency ?? 'KRW') || 'KRW',
    displayCurrency:
      String(row.display_currency ?? row.displayCurrency ?? row.currency ?? row.price_currency ?? 'KRW') || 'KRW',
    targetDirection: targetDirection(row.target_direction ?? row.targetDirection),
    entryPriceKrw: num(row.entry_price_krw ?? row.publication_price_krw ?? row.entryPriceKrw),
    entryPriceNative: num(
      row.entry_price_native ?? row.entry_price ?? row.report_current_price ?? row.entryPriceNative,
    ),
    targetPriceKrw: num(row.target_price_krw ?? row.targetPriceKrw),
    targetPriceNative: num(row.target_price_native ?? row.target_price ?? row.targetPriceNative),
    targetUpsideAtPub: num(row.target_upside_at_pub ?? row.targetUpsideAtPub),
    targetHit: bool(row.target_hit ?? row.targetHit),
    targetHitDate: strOrNull(row.target_hit_date ?? row.targetHitDate),
    daysToTarget: num(row.days_to_target ?? row.daysToTarget),
    lastCloseKrw: num(row.last_close_krw ?? row.lastCloseKrw),
    lastCloseNative: num(row.last_close_native ?? row.lastCloseNative),
    lastCloseDate: strOrNull(row.last_close_date ?? row.lastCloseDate),
    currentReturn: num(row.current_return ?? row.currentReturn),
    peakReturn: num(row.peak_return ?? row.peakReturn),
    troughReturn: num(row.trough_return ?? row.troughReturn),
    targetGapPct: num(row.target_gap_pct ?? row.targetGapPct),
    targetRemainingPct: null,
    targetProgressPct: null,
    expiryDate: strOrNull(row.expiry_date ?? row.expiryDate),
    expired: bool(row.expired),
    caveatFlags: Array.isArray(row.caveat_flags) ? row.caveat_flags : [],
  };
  const enriched = withLatestNativeClose(report);
  const hasTargetHitField = row.target_hit !== undefined || row.targetHit !== undefined;
  const withHit = hasTargetHitField ? enriched : withOhlcTargetTouch(enriched);
  return withTargetMetrics(withHit);
}

function withTargetMetrics(report: ReportRow): ReportRow {
  const current = report.lastCloseNative ?? report.lastCloseKrw;
  const target = report.targetPriceNative ?? report.targetPriceKrw;
  if (!current || !target || current <= 0 || target <= 0) {
    return { ...report, targetRemainingPct: null, targetProgressPct: null };
  }
  if (report.targetHit) {
    // Resolved — no "remaining"; keep progress uncapped so overshoot remains visible.
    return { ...report, targetRemainingPct: 0, targetProgressPct: targetProgressFromEntry(report) ?? 1 };
  }
  const targetProgressPct = targetProgressFromEntry(report);
  if (report.targetDirection === 'upside') {
    return {
      ...report,
      targetRemainingPct: Math.max(0, target / current - 1),
      targetProgressPct,
    };
  }
  if (report.targetDirection === 'downside') {
    return {
      ...report,
      targetRemainingPct: Math.max(0, 1 - target / current),
      targetProgressPct,
    };
  }
  return { ...report, targetRemainingPct: null, targetProgressPct: null };
}

function targetProgressFromEntry(report: ReportRow): number | null {
  const nativePrices =
    report.lastCloseNative !== null && report.targetPriceNative !== null && report.entryPriceNative !== null
      ? {
          current: report.lastCloseNative,
          target: report.targetPriceNative,
          entry: report.entryPriceNative,
        }
      : null;
  const krwPrices =
    report.lastCloseKrw !== null && report.targetPriceKrw !== null && report.entryPriceKrw !== null
      ? {
          current: report.lastCloseKrw,
          target: report.targetPriceKrw,
          entry: report.entryPriceKrw,
        }
      : null;
  const prices = nativePrices ?? krwPrices;
  if (!prices || prices.current <= 0 || prices.target <= 0 || prices.entry <= 0) return null;

  const targetMove = prices.target - prices.entry;
  if (targetMove === 0) return null;

  const progress = (prices.current - prices.entry) / targetMove;
  return progress;
}

function withOhlcTargetTouch(report: ReportRow): ReportRow {
  const targetPrice = report.targetPriceNative ?? report.targetPriceKrw;
  const entryPrice = report.entryPriceNative ?? report.entryPriceKrw;
  if (!report.symbol || !report.publicationDate || !targetPrice || !entryPrice || entryPrice <= 0) return report;
  const direction = targetPrice > entryPrice ? 'upside' : targetPrice < entryPrice ? 'downside' : null;
  if (!direction) return report;
  const prices = getPriceSeries(report.symbol, report.publicationDate);
  const hit = prices.find((point) => {
    const high = point.high ?? point.close ?? point.value;
    const low = point.low ?? point.close ?? point.value;
    return direction === 'upside' ? high >= targetPrice : low <= targetPrice;
  });
  if (!hit) return { ...report, targetHit: false, targetHitDate: null, daysToTarget: null };
  return {
    ...report,
    targetHit: true,
    targetHitDate: hit.time,
    daysToTarget: diffDays(report.publicationDate, hit.time),
  };
}

/** Always recompute the report's latest price, current return, and peak/trough
 * return off the full price series so expired reports do not freeze at the
 * artifact's cap date. The artifact still owns target-hit semantics within the
 * validation window; this only refreshes the "as of today" view.
 *
 * Also corrects PDF-extracted entry/target prices that diverge ≥5× from the
 * publication-day close (a strong split / data-extraction signal). When that
 * happens, the entry snaps to the publication-day close and the target is
 * rescaled by the same ratio so 코세스-style "진입가 10원" artifacts stop
 * leaking through to the screener and report table. */
function withLatestNativeClose(report: ReportRow): ReportRow {
  if (!report.symbol) return report;
  const fullPrices = getPriceSeries(report.symbol);
  const latest = fullPrices.at(-1);
  if (!latest) return report;
  const lastCloseNative = latest.close ?? latest.value;
  if (lastCloseNative === null || lastCloseNative === undefined || !Number.isFinite(lastCloseNative)) {
    return report;
  }

  // Detect split / extraction errors before recomputing returns.
  let entry: number | null = report.entryPriceNative;
  let targetPriceNative = report.targetPriceNative;
  let targetPriceKrw = report.targetPriceKrw;
  let entryPriceKrw = report.entryPriceKrw;
  const pubPoint = report.publicationDate ? fullPrices.find((point) => point.time >= report.publicationDate) : null;
  const pubClose = pubPoint?.close ?? pubPoint?.value ?? null;
  if (
    pubClose !== null &&
    pubClose !== undefined &&
    Number.isFinite(pubClose) &&
    pubClose > 0 &&
    entry !== null &&
    entry !== undefined &&
    Number.isFinite(entry) &&
    entry > 0
  ) {
    const ratio = entry / pubClose;
    if (ratio > 5 || ratio < 0.2) {
      // Treat as suspected split / extraction defect; rescale target by the same
      // ratio so the relative upside stays intact while absolute prices align
      // with the post-split series the chart already shows.
      if (targetPriceNative !== null && Number.isFinite(targetPriceNative)) {
        targetPriceNative = targetPriceNative / ratio;
      }
      if (targetPriceKrw !== null && Number.isFinite(targetPriceKrw)) {
        targetPriceKrw = targetPriceKrw / ratio;
      }
      if (entryPriceKrw !== null && Number.isFinite(entryPriceKrw)) {
        entryPriceKrw = entryPriceKrw / ratio;
      }
      entry = pubClose;
    }
  }

  const currentReturn =
    entry !== null && entry !== undefined && Number.isFinite(entry) && entry !== 0
      ? lastCloseNative / entry - 1
      : report.currentReturn;
  // Peak/trough span the entire post-publication path so the table reflects the
  // full lifetime, not just the validation window.
  const pricesSincePublication = report.publicationDate
    ? fullPrices.filter((point) => point.time >= report.publicationDate)
    : fullPrices;
  const closes = pricesSincePublication
    .map((point) => point.close ?? point.value)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const peakReturn =
    entry && Number.isFinite(entry) && entry !== 0 && closes.length
      ? Math.max(...closes) / entry - 1
      : report.peakReturn;
  const troughReturn =
    entry && Number.isFinite(entry) && entry !== 0 && closes.length
      ? Math.min(...closes) / entry - 1
      : report.troughReturn;
  return {
    ...report,
    currency: latest.currency ?? report.currency,
    entryPriceNative: entry,
    entryPriceKrw,
    targetPriceNative,
    targetPriceKrw,
    lastCloseNative,
    lastCloseDate: latest.time ?? report.lastCloseDate,
    currentReturn,
    peakReturn,
    troughReturn,
  };
}

function diffDays(start: string, end: string): number | null {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.round((endMs - startMs) / 86_400_000);
}

export function getReportById(reportId: string): ReportRow | undefined {
  return getReportRows().find((report) => report.reportId === reportId);
}

export function getReportsBySymbol(symbol: string): ReportRow[] {
  const normalized = symbol.toUpperCase();
  return getReportRows()
    .filter((report) => report.symbol.toUpperCase() === normalized)
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate) || b.reportId.localeCompare(a.reportId));
}

export function getReportBySymbol(symbol: string): ReportRow | undefined {
  return getReportsBySymbol(symbol)[0];
}

export function getReportSymbolById(reportId: string | null | undefined): string | null {
  if (!reportId) return null;
  return getReportById(reportId)?.symbol ?? null;
}

export function getReportTargetDigests(): ReportTargetDigest[] {
  return getReportRows().map((report) => ({
    reportId: report.reportId,
    symbol: report.symbol,
    company: report.company,
    exchange: report.exchange,
    marketRegion: marketRegionForSymbol(report.symbol, report.exchange),
    currency: report.currency,
    publicationDate: report.publicationDate,
    targetPriceKrw: report.targetPriceKrw,
    targetPriceNative: report.targetPriceNative,
    targetUpsideAtPub: report.targetUpsideAtPub,
  }));
}

export function getLatestReportTargetsBySymbol(): Record<string, ReportTargetDigest> {
  const out: Record<string, ReportTargetDigest> = {};
  for (const report of getReportTargetDigests()) {
    const previous = out[report.symbol];
    if (!previous || report.publicationDate > previous.publicationDate) out[report.symbol] = report;
  }
  return out;
}

export function getReportTargetsById(): Record<string, ReportTargetDigest> {
  return Object.fromEntries(getReportTargetDigests().map((report) => [report.reportId, report]));
}

export function hasPriceArtifact(symbol: string): boolean {
  return fs.existsSync(fullPath(`data/web/prices/${symbol}.json`));
}

export function marketRegionForSymbol(symbol: string, exchange?: string): 'domestic' | 'overseas' {
  const upperExchange = (exchange ?? '').toUpperCase();
  if (
    symbol.endsWith('.KS') ||
    symbol.endsWith('.KQ') ||
    upperExchange === 'KRX' ||
    upperExchange === 'KOSPI' ||
    upperExchange === 'KOSDAQ'
  )
    return 'domestic';
  return 'overseas';
}

const priceSeriesCache = new Map<string, PricePoint[]>();

export function getPriceSeries(symbol: string, startDate?: string, endDate?: string | null): PricePoint[] {
  artifactCacheValid();
  const base = getFullPriceSeries(symbol);
  if (!startDate && !endDate) return base;
  const stop = endDate ?? '9999-99-99';
  return base.filter((point) => (!startDate || point.time >= startDate) && point.time <= stop);
}

function getFullPriceSeries(symbol: string): PricePoint[] {
  const cached = priceSeriesCache.get(symbol);
  if (cached) return cached;
  const artifact = readRequiredJson<{ currency?: string; prices: Array<Record<string, unknown>> }>(
    `data/web/prices/${symbol}.json`,
  );
  const series = artifact.prices
    .map((point) => {
      const close = num(point.close);
      const closeKrw = num(point.close_krw);
      const currency = String(point.currency ?? point.source_currency ?? artifact.currency ?? 'KRW') || 'KRW';
      const value = close ?? closeKrw ?? 0;
      return {
        time: String(point.date),
        value,
        open: positivePrice(point.open),
        high: positivePrice(point.high),
        low: positivePrice(point.low),
        close: value,
        closeKrw,
        currency,
        volume: num(point.volume),
        stockSplit: num(point.stock_split),
        splitEventType: typeof point.split_event_type === 'string' ? point.split_event_type : null,
        splitRatioText: typeof point.split_ratio_text === 'string' ? point.split_ratio_text : null,
        splitFactor: num(point.split_factor),
        cumSplitFactorToLatest: num(point.cum_split_factor_to_latest),
        splitAdjustedOpen: positivePrice(point.split_adjusted_open),
        splitAdjustedHigh: positivePrice(point.split_adjusted_high),
        splitAdjustedLow: positivePrice(point.split_adjusted_low),
        splitAdjustedClose: positivePrice(point.split_adjusted_close),
        splitAdjustedCloseKrw: num(point.split_adjusted_close_krw),
        splitAdjustedVolume: num(point.split_adjusted_volume),
      };
    })
    .filter((point) => point.value > 0);
  priceSeriesCache.set(symbol, series);
  return series;
}

const nativePricePointCache = new Map<string, PricePoint | undefined>();

function nativePricePointAtOrBefore(symbol: string, date: string | null | undefined): PricePoint | undefined {
  const key = `${symbol}|${date ?? ''}`;
  if (nativePricePointCache.has(key)) return nativePricePointCache.get(key);
  const series = getPriceSeries(symbol, undefined, date);
  const point = series.at(-1);
  nativePricePointCache.set(key, point);
  return point;
}

function nativeFromKrwAtSymbolDate(symbol: string, date: string | null | undefined, krw: number | null): number | null {
  if (krw === null) return null;
  const point = nativePricePointAtOrBefore(symbol, date);
  if (!point?.closeKrw || point.closeKrw <= 0) return krw;
  return (krw * point.value) / point.closeKrw;
}

function currencyForPricePoint(symbol: string, date: string | null | undefined): string {
  return nativePricePointAtOrBefore(symbol, date)?.currency ?? 'KRW';
}

export function getMarkdownSnippet(report: ReportRow): string {
  if (!report.markdownFilename) return '이 리포트에는 markdown 추출 파일이 기록되어 있지 않습니다.';
  const markdownPath = fullPath(`data/markdown/${report.markdownFilename}`);
  if (!fs.existsSync(markdownPath)) return `markdown 추출 파일을 찾을 수 없습니다: ${report.markdownFilename}`;
  return fs.readFileSync(markdownPath, 'utf8').slice(0, 5000);
}

export function getSummaryRows(): SummaryRow[] {
  const raw = parseRows(
    'portfolio/personas.json',
    WebPersonaSchema,
    readRequiredJson<unknown>('data/web/portfolio/personas.json'),
  );
  return (
    raw?.map((row) => ({
      persona: row.persona,
      label: row.label,
      finalEquityKrw: num(row.final_equity_krw),
      finalCashKrw: num(row.final_cash_krw),
      finalHoldingsValueKrw: num(row.final_holdings_value_krw),
      totalContributedKrw: num(row.total_contributed_krw),
      netProfitKrw: num(row.net_profit_krw),
      moneyWeightedReturn: num(row.money_weighted_return),
      maxDrawdown: num(row.max_drawdown),
      tradeCount: num(row.trade_count),
    })) ?? []
  );
}

export function getAccountingReconciliations(): AccountingReconciliationRow[] {
  const raw = parseRows(
    'portfolio/accounting-reconciliation.json',
    AccountingReconciliationRowSchema,
    readRequiredJson<unknown>('data/web/portfolio/accounting-reconciliation.json'),
  );
  return raw.map((row) => ({
    persona: row.persona,
    label: row.label,
    totalContributedKrw: row.total_contributed_krw,
    realizedPnlKrw: row.realized_pnl_krw,
    finalCashKrw: row.final_cash_krw,
    openCostBasisKrw: row.open_cost_basis_krw,
    openMarketValueKrw: row.open_market_value_krw,
    unrealizedPnlKrw: row.unrealized_pnl_krw,
    cashYieldKrw: row.cash_yield_krw,
    finalEquityKrw: row.final_equity_krw,
    netProfitKrw: row.net_profit_krw,
    expectedCashKrw: row.expected_cash_krw,
    cashGapKrw: row.cash_gap_krw,
    equityGapKrw: row.equity_gap_krw,
    profitGapKrw: row.profit_gap_krw,
    status: row.status,
    explanationKo: row.explanation_ko,
  }));
}

export function getDataQuality(): DataQuality {
  const web = getWebDataQuality();
  const reports = getReportRows();
  const targetHitCount = reports.filter((report) => report.targetHit).length;
  return {
    extractedReports: Number(web.coverage?.warehouse_reports ?? web.coverage?.extracted_reports ?? reports.length),
    reportsWithPrices: Number(web.coverage?.report_performance_rows ?? reports.length),
    totalReports: Number(web.coverage?.warehouse_reports ?? reports.length),
    targetHitRate: targetHitCount / Math.max(1, reports.length),
    missingPriceSymbols: web.missing_symbols?.length ?? 0,
    reportExclusions: web.report_exclusions ?? {},
    extractionQuality: web.extraction_quality ?? {},
  };
}

export function getWebDataQuality(): WebDataQuality {
  return parseArtifact(
    'overview/data-quality.json',
    WebDataQualitySchema,
    readRequiredJson<unknown>('data/web/overview/data-quality.json'),
  );
}

export function getOverview(): WebOverview {
  return parseArtifact(
    'overview/snapshot.json',
    WebOverviewSchema,
    readRequiredJson<unknown>('data/web/overview/snapshot.json'),
  );
}

let strategyCatalogCache: StrategyCatalogRow[] | undefined;
export function getStrategyCatalog(): StrategyCatalogRow[] {
  if (artifactCacheValid() && strategyCatalogCache) return strategyCatalogCache;
  const raw = parseRows(
    'strategies/catalog.json',
    StrategyCatalogRowSchema,
    readRequiredJson<unknown>('data/web/strategies/catalog.json'),
  );
  strategyCatalogCache = raw.map((row) => ({
    strategyId: row.strategy_id,
    label: row.label,
    shortLabel: row.short_label,
    kind: row.kind,
    benchmarkGroup: row.benchmark_group,
    isSelectable: row.is_selectable,
    isDefaultCandidate: row.is_default_candidate,
    objectivePassed: row.objective_passed,
    objectiveReturnExcess: row.objective_return_excess,
    objectiveMddSlack: row.objective_mdd_slack,
    methodologySummary: row.methodology_summary,
    buyRules: row.buy_rules,
    sellRules: row.sell_rules,
    riskControls: row.risk_controls,
    params: row.params,
    metrics: {
      finalEquityKrw: row.metrics.final_equity_krw,
      finalCashKrw: row.metrics.final_cash_krw,
      finalHoldingsValueKrw: row.metrics.final_holdings_value_krw,
      moneyWeightedReturn: row.metrics.money_weighted_return,
      cagr: row.metrics.cagr,
      maxDrawdown: row.metrics.max_drawdown,
      tradeCount: row.metrics.trade_count,
      openPositions: row.metrics.open_positions,
    },
  }));
  return strategyCatalogCache;
}

export function getArtifactManifest(): ArtifactManifest {
  return parseArtifact('manifest.json', ArtifactManifestSchema, readRequiredJson<unknown>('data/web/manifest.json'));
}

export function getReportRankings(): WebReportRankings {
  const raw = readRequiredJson<WebReportRankings>('data/web/reports/rankings.json');
  return {
    ...raw,
    top_winners: raw.top_winners ?? raw.best_current_returns,
    top_losers: raw.top_losers ?? raw.worst_current_returns,
  };
}

export const getRankings = getReportRankings;

export function getReportStatisticsLabSummary(): ReportStatisticsLabSummary {
  const raw = readRequiredJson<{ summary: ReportStatisticsLabSummary }>('data/web/report-statistics-lab.json');
  return raw.summary;
}

export function getInsights(): Insight[] {
  return readRequiredJson<Insight[]>('data/web/overview/research-pulse.json');
}

let screenerCandidateCache: ScreenerCandidateRow[] | undefined;
export function getScreenerCandidates(): ScreenerCandidateRow[] {
  if (artifactCacheValid() && screenerCandidateCache) return screenerCandidateCache;
  const raw = parseRows(
    'screener/candidates.json',
    ScreenerCandidateSchema,
    readRequiredJson<unknown>('data/web/screener/candidates.json'),
  );
  screenerCandidateCache = raw.map((row) => ({
    reportId: row.report_id,
    symbol: row.symbol,
    company: row.company,
    publicationDate: row.date,
    bucket: row.bucket,
    rankBasis: row.rank_basis,
    score: row.score,
    targetUpsideAtPub: row.target_upside_at_pub,
    currentReturn: row.current_return,
    targetGapPct: row.target_gap_pct,
  }));
  return screenerCandidateCache;
}

export function getDownloadHref(fileName: string): string {
  return `/downloads/${fileName}`;
}

export function readDownloadCsv(fileName: string): string {
  return readText(`data/web/${fileName}`);
}

let holdingsCache: HoldingRow[] | undefined;
export function getCurrentHoldings(): HoldingRow[] {
  if (artifactCacheValid() && holdingsCache) return holdingsCache;
  const raw = parseRows(
    'portfolio/holdings.json',
    RawHoldingRowSchema,
    JSON.parse(readText('data/web/portfolio/holdings.json')),
  );
  holdingsCache = raw
    .map((row) => ({
      persona: row.persona,
      symbol: row.symbol,
      company: row.company || row.symbol,
      qty: row.qty,
      avgCostKrw: row.avg_cost_krw,
      lastCloseKrw: row.last_close_krw,
      lastCloseNative: row.last_close_native,
      currency: row.currency || 'KRW',
      marketValueKrw: row.market_value_krw,
      unrealizedPnlKrw: row.unrealized_pnl_krw,
      unrealizedReturn: row.unrealized_return,
      holdingDays: row.holding_days,
      firstBuyDate: row.first_buy_date,
    }))
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  return holdingsCache;
}

let monthlyHoldingsCache: MonthlyHoldingRow[] | undefined;
export function getMonthlyHoldings(): MonthlyHoldingRow[] {
  if (artifactCacheValid() && monthlyHoldingsCache) return monthlyHoldingsCache;
  const raw = readCompactTable('data/web/portfolio/monthly-holdings.json', [
    'persona',
    'month_end',
    'symbol',
    'company',
    'qty',
    'market_value_krw',
    'last_close_native',
    'currency',
    'weight_in_portfolio',
  ]);
  const costBySnapshot = buildMonthlyCostBasis(raw);
  monthlyHoldingsCache = raw
    .map((row) => ({
      ...enrichMonthlyHolding(row, costBySnapshot),
    }))
    .sort((a, b) => b.monthEnd.localeCompare(a.monthEnd) || (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  return monthlyHoldingsCache;
}

function enrichMonthlyHolding(row: RawReport, costBySnapshot: Map<string, number | null>): MonthlyHoldingRow {
  const persona = String(row.persona ?? '');
  const monthEnd = String(row.month_end ?? row.monthEnd ?? '');
  const symbol = String(row.symbol ?? '');
  const qty = num(row.qty);
  const marketValueKrw = num(row.market_value_krw ?? row.marketValueKrw);
  const monthCloseKrw = qty && qty > 0 && marketValueKrw !== null ? marketValueKrw / qty : null;
  const avgCostKrw = costBySnapshot.get(`${persona}|${monthEnd}|${symbol}`) ?? null;
  const costValueKrw = avgCostKrw !== null && qty !== null ? avgCostKrw * qty : null;
  const unrealizedPnlKrw = marketValueKrw !== null && costValueKrw !== null ? marketValueKrw - costValueKrw : null;
  const unrealizedReturn =
    avgCostKrw !== null && avgCostKrw > 0 && monthCloseKrw !== null ? monthCloseKrw / avgCostKrw - 1 : null;
  return {
    persona,
    monthEnd,
    symbol,
    company: String(row.company ?? row.symbol ?? ''),
    qty,
    avgCostKrw,
    monthCloseKrw,
    monthCloseNative: num(
      row.last_close_native ?? row.lastCloseNative ?? row.month_close_native ?? row.monthCloseNative,
    ),
    currency: String(row.currency ?? 'KRW') || 'KRW',
    marketValueKrw,
    unrealizedPnlKrw,
    unrealizedReturn,
    weightInPortfolio: num(row.weight_in_portfolio ?? row.weightInPortfolio),
  };
}

function buildMonthlyCostBasis(rows: RawReport[]): Map<string, number | null> {
  const snapshots = [...rows]
    .map((row) => ({
      persona: String(row.persona ?? ''),
      monthEnd: String(row.month_end ?? row.monthEnd ?? ''),
      symbol: String(row.symbol ?? ''),
      qty: num(row.qty),
    }))
    .filter((row) => row.persona && row.monthEnd && row.symbol)
    .sort((a, b) => a.monthEnd.localeCompare(b.monthEnd));
  const trades = readCompactTable('data/web/portfolio/trades.json', [
    'persona',
    'date',
    'symbol',
    'side',
    'qty',
    'fill_price_krw',
    'gross_krw',
    'cash_after_krw',
    'reason',
    'report_id',
  ])
    .map((row) => ({
      persona: String(row.persona ?? ''),
      date: String(row.date ?? ''),
      symbol: String(row.symbol ?? ''),
      side: String(row.side ?? ''),
      qty: num(row.qty),
      price: num(row.fill_price_krw),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const out = new Map<string, number | null>();
  const state = new Map<string, { qty: number; cost: number }>();
  let tradeIndex = 0;
  for (const snapshot of snapshots) {
    while (tradeIndex < trades.length && trades[tradeIndex].date <= snapshot.monthEnd) {
      applyCostBasisTrade(state, trades[tradeIndex]);
      tradeIndex += 1;
    }
    const key = `${snapshot.persona}|${snapshot.symbol}`;
    const lot = state.get(key);
    const avgCost = lot && lot.qty > 0 ? lot.cost / lot.qty : null;
    out.set(`${snapshot.persona}|${snapshot.monthEnd}|${snapshot.symbol}`, avgCost);
  }
  return out;
}

function applyCostBasisTrade(
  state: Map<string, { qty: number; cost: number }>,
  trade: { persona: string; symbol: string; side: string; qty: number | null; price: number | null },
) {
  if (!trade.persona || !trade.symbol || !trade.qty || trade.qty <= 0 || trade.price === null || trade.price <= 0)
    return;
  const key = `${trade.persona}|${trade.symbol}`;
  const lot = state.get(key) ?? { qty: 0, cost: 0 };
  if (trade.side === 'buy') {
    state.set(key, { qty: lot.qty + trade.qty, cost: lot.cost + trade.qty * trade.price });
    return;
  }
  if (trade.side === 'sell') {
    const avgCost = lot.qty > 0 ? lot.cost / lot.qty : 0;
    const nextQty = Math.max(0, lot.qty - trade.qty);
    state.set(key, { qty: nextQty, cost: Math.max(0, lot.cost - avgCost * Math.min(lot.qty, trade.qty)) });
  }
}

let tradesCache: TradeRow[] | undefined;
export function getTrades(): TradeRow[] {
  if (artifactCacheValid() && tradesCache) return tradesCache;
  const raw = parseRows(
    'portfolio/trades.json',
    RawTradeRowSchema,
    readCompactTable('data/web/portfolio/trades.json', [
      'persona',
      'date',
      'symbol',
      'side',
      'qty',
      'fill_price_krw',
      'gross_krw',
      'cash_after_krw',
      'reason',
      'report_id',
    ]),
  );
  tradesCache = raw
    .map((row) => {
      const fillPriceNative = nativeFromKrwAtSymbolDate(row.symbol, row.date, row.fill_price_krw);
      return {
        persona: row.persona,
        date: row.date,
        symbol: row.symbol,
        side: row.side,
        qty: row.qty,
        currency: currencyForPricePoint(row.symbol, row.date),
        fillPriceKrw: row.fill_price_krw,
        fillPriceNative,
        grossNative: fillPriceNative !== null && row.qty !== null ? fillPriceNative * row.qty : null,
        grossKrw: row.gross_krw,
        cashAfterKrw: row.cash_after_krw,
        reason: row.reason,
        reportId: row.report_id,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  return tradesCache;
}

let positionEpisodesCache: PositionEpisodeRow[] | undefined;
export function getPositionEpisodes(): PositionEpisodeRow[] {
  if (artifactCacheValid() && positionEpisodesCache) return positionEpisodesCache;
  positionEpisodesCache = readCompactTable('data/web/portfolio/episodes.json', [
    'persona',
    'symbol',
    'company',
    'open_date',
    'close_date',
    'holding_days',
    'buy_fills',
    'sell_fills',
    'total_qty_bought',
    'total_qty_sold',
    'avg_entry_price_krw',
    'avg_exit_price_krw',
    'realized_pnl_krw',
    'unrealized_pnl_krw',
    'last_close_krw',
    'status',
    'exit_reasons',
  ])
    .map((row) => {
      const symbol = String(row.symbol ?? '');
      const openDate = String(row.open_date ?? '');
      const closeDate = strOrNull(row.close_date);
      const lastCloseDate = closeDate ?? getPriceSeries(symbol).at(-1)?.time ?? openDate;
      const avgEntryPriceKrw = num(row.avg_entry_price_krw);
      const avgExitPriceKrw = num(row.avg_exit_price_krw);
      const lastCloseKrw = num(row.last_close_krw);
      return {
        persona: String(row.persona ?? ''),
        symbol,
        company: String(row.company ?? row.symbol ?? ''),
        openDate,
        closeDate,
        holdingDays: num(row.holding_days),
        buyFills: num(row.buy_fills),
        sellFills: num(row.sell_fills),
        totalQtyBought: num(row.total_qty_bought),
        totalQtySold: num(row.total_qty_sold),
        currency: currencyForPricePoint(symbol, lastCloseDate),
        avgEntryPriceKrw,
        avgEntryPriceNative: nativeFromKrwAtSymbolDate(symbol, openDate, avgEntryPriceKrw),
        avgExitPriceKrw,
        avgExitPriceNative: nativeFromKrwAtSymbolDate(symbol, closeDate, avgExitPriceKrw),
        realizedPnlKrw: num(row.realized_pnl_krw),
        unrealizedPnlKrw: num(row.unrealized_pnl_krw),
        lastCloseKrw,
        lastCloseNative: nativeFromKrwAtSymbolDate(symbol, lastCloseDate, lastCloseKrw),
        status: String(row.status ?? ''),
        exitReasons: String(row.exit_reasons ?? ''),
      };
    })
    .sort((a, b) => b.openDate.localeCompare(a.openDate));
  return positionEpisodesCache;
}

export function getPersonaLabel(persona: string): string {
  return getSummaryRows().find((row) => row.persona === persona)?.label ?? persona;
}

let equityDailyCache: EquityPoint[] | undefined;
export function getEquityDaily(): EquityPoint[] {
  if (artifactCacheValid() && equityDailyCache) return equityDailyCache;
  equityDailyCache = readCompactEquityCurves('data/web/portfolio/equity-daily.json');
  return equityDailyCache;
}

let strategyCurvesCache: EquityPoint[] | undefined;
export function getStrategyCurves(): EquityPoint[] {
  if (artifactCacheValid() && strategyCurvesCache) return strategyCurvesCache;
  strategyCurvesCache = readCompactEquityCurves('data/web/strategies/curves.json');
  return strategyCurvesCache;
}

function readCompactTable(filePath: string, expectedColumns: string[]): RawReport[] {
  const artifact = parseArtifact<CompactTableArtifact>(
    filePath,
    CompactTableArtifactSchema,
    readRequiredJson<unknown>(filePath),
  );
  const missing = expectedColumns.filter((column) => !artifact.columns.includes(column));
  if (missing.length > 0) {
    throw new Error(`Schema mismatch in ${filePath}: missing compact columns ${missing.join(', ')}.`);
  }
  const indexes = Object.fromEntries(artifact.columns.map((column, index) => [column, index]));
  return artifact.rows.map((row, rowIndex) => {
    const out: RawReport = {};
    for (const column of expectedColumns) {
      const index = indexes[column];
      out[column] = row[index] ?? null;
    }
    if (row.length !== artifact.columns.length) {
      throw new Error(
        `Schema mismatch in ${filePath}[${rowIndex}]: row has ${row.length} values but ${artifact.columns.length} columns.`,
      );
    }
    return out;
  });
}

function readCompactEquityCurves(filePath: string): EquityPoint[] {
  const artifact = parseArtifact(filePath, CompactEquityArtifactSchema, readRequiredJson<unknown>(filePath));
  const rows: EquityPoint[] = [];
  for (const series of artifact.series) {
    if (series.equity_krw.length !== artifact.dates.length) {
      throw new Error(
        `Schema mismatch in ${filePath}.${series.persona}.equity_krw: expected ${artifact.dates.length} points, got ${series.equity_krw.length}.`,
      );
    }
    if (series.cumulative_return.length !== artifact.dates.length) {
      throw new Error(
        `Schema mismatch in ${filePath}.${series.persona}.cumulative_return: expected ${artifact.dates.length} points, got ${series.cumulative_return.length}.`,
      );
    }
    artifact.dates.forEach((date, index) => {
      rows.push({
        persona: series.persona,
        date,
        equityKrw: series.equity_krw[index] ?? null,
        contributedCapitalKrw: null,
        cumulativeReturn: series.cumulative_return[index] ?? null,
      });
    });
  }
  return rows;
}
