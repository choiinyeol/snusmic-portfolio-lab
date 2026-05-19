import {
  type FeatureBucket,
  type PricePathSeries,
  ReportStatisticsStory,
} from '@/components/reports/ReportStatisticsStory';
import { getPriceSeries, getReportRows, getReportStatisticsLabSummary, hasPriceArtifact } from '@/lib/artifacts';
import type { PricePoint, ReportRow, ReportStatisticsLabSummary } from '@/lib/artifacts';
import { isNumber } from '@/lib/report-statistics';

/** All return/hit metrics on this page are capped to this many trading
 * days from publication. Two calendar years ≈ 500 trading days; the
 * user-facing rule is "if peak hit target within 2 years it counts,
 * what happens after is out of scope." */
const RETURN_WINDOW_DAYS = 500;

function highKrw(point: PricePoint): number {
  const high = point.high ?? point.close ?? point.value;
  const close = point.close ?? point.value ?? 0;
  const closeKrw = point.closeKrw ?? null;
  if (closeKrw != null && close > 0) return high * (closeKrw / close);
  return high;
}

function lowKrw(point: PricePoint): number {
  const low = point.low ?? point.close ?? point.value;
  const close = point.close ?? point.value ?? 0;
  const closeKrw = point.closeKrw ?? null;
  if (closeKrw != null && close > 0) return low * (closeKrw / close);
  return low;
}

function closeKrwOf(point: PricePoint): number {
  return point.closeKrw ?? point.close ?? point.value ?? 0;
}

/** Recompute peak/trough/hit flags within the trading-day window. The
 * returned row carries the windowed values in the same fields used by
 * downstream views (maxFavorableExcursion, hit10/08/06), so all stats
 * downstream automatically honor the 500-day deadline. */
function clipRowToWindow(
  row: ReportStatisticsLabSummary['riskScatter'][number],
  reportMeta: ReportRow | undefined,
  windowDays: number,
): ReportStatisticsLabSummary['riskScatter'][number] {
  if (!hasPriceArtifact(row.symbol)) return row;
  const series = getPriceSeries(row.symbol, row.publicationDate);
  if (series.length === 0) return row;
  const window = series.slice(0, windowDays);
  const baseKrw = closeKrwOf(window[0]);
  if (!baseKrw || baseKrw <= 0) return row;

  const target = reportMeta?.targetPriceKrw ?? null;
  const entry = reportMeta?.entryPriceKrw ?? baseKrw;
  const threshold10 = target;
  const threshold08 = target !== null && entry !== null ? entry + (target - entry) * 0.8 : null;
  const threshold06 = target !== null && entry !== null ? entry + (target - entry) * 0.6 : null;

  let maxKrw = baseKrw;
  let minKrw = baseKrw;
  let hit10Day: number | null = null;
  let hit08Day: number | null = null;
  let hit06Day: number | null = null;

  for (let i = 0; i < window.length; i += 1) {
    const h = highKrw(window[i]);
    const l = lowKrw(window[i]);
    if (h > maxKrw) maxKrw = h;
    if (l < minKrw) minKrw = l;
    if (threshold10 !== null && hit10Day === null && h >= threshold10) hit10Day = i;
    if (threshold08 !== null && hit08Day === null && h >= threshold08) hit08Day = i;
    if (threshold06 !== null && hit06Day === null && h >= threshold06) hit06Day = i;
  }

  return {
    ...row,
    maxFavorableExcursion: maxKrw / baseKrw - 1,
    maxAdverseExcursion: minKrw / baseKrw - 1,
    hit10: hit10Day !== null,
    hit08: hit08Day !== null,
    hit06: hit06Day !== null,
  };
}

function clipSummary(
  summary: ReportStatisticsLabSummary,
  reportById: Map<string, ReportRow>,
  windowDays: number,
): ReportStatisticsLabSummary {
  return {
    ...summary,
    riskScatter: summary.riskScatter.map((row) => clipRowToWindow(row, reportById.get(row.reportId), windowDays)),
  };
}

/** Days from publication to first close-or-high crossing the 1.0x target
 * within the trading-day window, or null if never hit. Re-derived from
 * price series so we honor the 500-day cap regardless of what the
 * pre-built artifact recorded. */
function daysToTargetWithin(
  row: ReportStatisticsLabSummary['riskScatter'][number],
  reportMeta: ReportRow | undefined,
  windowDays: number,
): number | null {
  if (!reportMeta?.targetPriceKrw || !hasPriceArtifact(row.symbol)) return null;
  const series = getPriceSeries(row.symbol, row.publicationDate);
  const target = reportMeta.targetPriceKrw;
  const limit = Math.min(series.length, windowDays);
  for (let i = 0; i < limit; i += 1) {
    if (highKrw(series[i]) >= target) return i;
  }
  return null;
}

function buildPricePath(
  row: ReportStatisticsLabSummary['riskScatter'][number],
  windowDays: number,
): PricePathSeries | null {
  const fullSeries = getPriceSeries(row.symbol, row.publicationDate);
  if (fullSeries.length === 0) return null;
  const window = fullSeries.slice(0, windowDays);
  const basePoint = window[0];
  const baseKrw = closeKrwOf(basePoint);
  if (!baseKrw || baseKrw <= 0) return null;

  const bars = window
    .map((point, day) => ({
      day,
      time: point.time,
      open: point.open ?? point.close ?? point.value,
      high: point.high ?? point.close ?? point.value,
      low: point.low ?? point.close ?? point.value,
      close: point.close ?? point.value,
      closeKrw: closeKrwOf(point),
    }))
    .filter((bar) => bar.close > 0);

  return {
    reportId: row.reportId,
    symbol: row.symbol,
    company: row.company,
    currency: basePoint.currency ?? 'KRW',
    publicationDate: row.publicationDate,
    peakReturn: row.maxFavorableExcursion ?? 0,
    baseKrw,
    bars,
  };
}

function buildPricePaths(
  summary: ReportStatisticsLabSummary,
  options: { winnerCount: number; loserCount: number; windowDays: number },
): { winners: PricePathSeries[]; losers: PricePathSeries[] } {
  const eligible = summary.riskScatter.filter(
    (row) => isNumber(row.maxFavorableExcursion) && hasPriceArtifact(row.symbol),
  );
  const winners = [...eligible]
    .sort((a, b) => (b.maxFavorableExcursion ?? 0) - (a.maxFavorableExcursion ?? 0))
    .slice(0, options.winnerCount);
  const losers = [...eligible]
    .sort((a, b) => (a.maxFavorableExcursion ?? 0) - (b.maxFavorableExcursion ?? 0))
    .slice(0, options.loserCount);
  return {
    winners: winners
      .map((row) => buildPricePath(row, options.windowDays))
      .filter((path): path is PricePathSeries => path !== null),
    losers: losers
      .map((row) => buildPricePath(row, options.windowDays))
      .filter((path): path is PricePathSeries => path !== null),
  };
}

type PublicationFeatures = {
  aligned: boolean | null;
  high52wProximity: number | null;
};

/** Compute price-action features at publication day from the symbol's
 * full daily history: trend alignment (price > SMA20 > SMA50 > SMA200)
 * and 52-week high proximity (close at pub / max close over past ~252
 * trading days). Returns nulls for features that need more history
 * than is available. */
function computeFeatures(prices: PricePoint[], publicationDate: string): PublicationFeatures | null {
  const pubIdx = prices.findIndex((point) => point.time >= publicationDate);
  if (pubIdx < 0) return null;
  const upTo = prices.slice(0, pubIdx + 1);
  const closes = upTo.map((point) => point.close ?? point.value).filter((value) => value > 0);
  if (closes.length < 20) return null;
  const last = closes[closes.length - 1];

  const sma = (window: number): number | null => {
    if (closes.length < window) return null;
    const slice = closes.slice(-window);
    return slice.reduce((sum, value) => sum + value, 0) / window;
  };
  const sma20 = sma(20);
  const sma50 = sma(50);
  const sma200 = sma(200);
  const aligned =
    sma20 !== null && sma50 !== null && sma200 !== null && last > sma20 && sma20 > sma50 && sma50 > sma200
      ? true
      : sma20 !== null && sma50 !== null && sma200 !== null
        ? false
        : null;

  const lookback = closes.slice(-252);
  const high52w = Math.max(...lookback);
  const high52wProximity = high52w > 0 ? last / high52w : null;

  return { aligned, high52wProximity };
}

/** Standard normal CDF via Abramowitz & Stegun 26.2.17 — accurate to ~7.5
 * decimal places, plenty for converting Mann-Whitney z-scores to p-values. */
function normalCdf(z: number): number {
  if (z < 0) return 1 - normalCdf(-z);
  const t = 1 / (1 + 0.2316419 * z);
  const density = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return 1 - density * poly;
}

/** Two-sided Mann-Whitney U test with mid-rank tie correction. Returns
 * the two-tailed p-value via normal approximation (n1, n2 ≳ 10).
 * Preferred over the two-sample t-test for stock returns because it makes
 * no normality assumption and is robust to fat tails. */
function mannWhitneyU(a: number[], b: number[]): { pValue: number; effectSign: number } {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 === 0 || n2 === 0) return { pValue: 1, effectSign: 0 };
  const combined = [
    ...a.map((value) => ({ value, group: 'a' as const })),
    ...b.map((value) => ({ value, group: 'b' as const })),
  ].sort((x, y) => x.value - y.value);
  const ranks = new Array<number>(combined.length).fill(0);
  let tieCorrection = 0;
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j + 1 < combined.length && combined[j + 1].value === combined[i].value) j += 1;
    const tied = j - i + 1;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) ranks[k] = avgRank;
    if (tied > 1) tieCorrection += tied ** 3 - tied;
    i = j + 1;
  }
  let rankSumA = 0;
  for (let k = 0; k < combined.length; k += 1) {
    if (combined[k].group === 'a') rankSumA += ranks[k];
  }
  const u1 = rankSumA - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const u = Math.min(u1, u2);
  const meanU = (n1 * n2) / 2;
  const n = n1 + n2;
  const variance = ((n1 * n2) / 12) * (n + 1 - tieCorrection / (n * (n - 1)));
  if (variance <= 0) return { pValue: 1, effectSign: 0 };
  const z = (u - meanU) / Math.sqrt(variance);
  const pValue = Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
  const effectSign = u1 > u2 ? 1 : u1 < u2 ? -1 : 0;
  return { pValue, effectSign };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Snapshot = {
  peakReturn: number;
  hit10: boolean;
  daysToTarget: number | null;
  features: PublicationFeatures;
};

function bucketStats(
  group: FeatureBucket['group'],
  label: string,
  bucket: Snapshot[],
  rest: Snapshot[],
): FeatureBucket {
  const returns = bucket.map((s) => s.peakReturn);
  const hits = bucket.filter((s) => s.hit10);
  const hitDays = hits.map((s) => s.daysToTarget).filter((value): value is number => value !== null);
  const { pValue } =
    bucket.length >= 5 && rest.length >= 5
      ? mannWhitneyU(
          returns,
          rest.map((s) => s.peakReturn),
        )
      : { pValue: null };
  return {
    group,
    label,
    count: bucket.length,
    medianReturn: median(returns),
    hitRate10: bucket.length === 0 ? 0 : hits.length / bucket.length,
    medianDaysToHit10: median(hitDays),
    pValue,
  };
}

function buildFeatureBuckets(
  summary: ReportStatisticsLabSummary,
  reportById: Map<string, ReportRow>,
  windowDays: number,
): FeatureBucket[] {
  const snapshots: Snapshot[] = [];
  for (const row of summary.riskScatter) {
    if (!isNumber(row.maxFavorableExcursion)) continue;
    if (!hasPriceArtifact(row.symbol)) continue;
    const prices = getPriceSeries(row.symbol);
    const features = computeFeatures(prices, row.publicationDate);
    if (features === null) continue;
    snapshots.push({
      peakReturn: row.maxFavorableExcursion,
      hit10: row.hit10,
      daysToTarget: daysToTargetWithin(row, reportById.get(row.reportId), windowDays),
      features,
    });
  }

  const alignedYes = snapshots.filter((s) => s.features.aligned === true);
  const alignedNo = snapshots.filter((s) => s.features.aligned === false);
  const high52wUniverse = snapshots.filter((s) => s.features.high52wProximity !== null);
  const high95 = high52wUniverse.filter((s) => (s.features.high52wProximity ?? 0) >= 0.95);
  const high80 = high52wUniverse.filter(
    (s) => (s.features.high52wProximity ?? 0) >= 0.8 && (s.features.high52wProximity ?? 0) < 0.95,
  );
  const highLow = high52wUniverse.filter((s) => (s.features.high52wProximity ?? 0) < 0.8);
  const without = (universe: Snapshot[], group: Snapshot[]) => {
    const ids = new Set(group);
    return universe.filter((s) => !ids.has(s));
  };

  return [
    bucketStats('alignment', '정배열 (가격 > SMA20 > SMA50 > SMA200)', alignedYes, alignedNo),
    bucketStats('alignment', '비정배열', alignedNo, alignedYes),
    bucketStats('high52w', '52주 고가의 95%+ 근접', high95, without(high52wUniverse, high95)),
    bucketStats('high52w', '80–95%', high80, without(high52wUniverse, high80)),
    bucketStats('high52w', '80% 미만', highLow, without(high52wUniverse, highLow)),
  ];
}

export default function ReportStatisticsPage() {
  const rawSummary = getReportStatisticsLabSummary();
  const reportById = new Map(getReportRows().map((row) => [row.reportId, row]));
  const summary = clipSummary(rawSummary, reportById, RETURN_WINDOW_DAYS);
  const pricePaths = buildPricePaths(summary, {
    winnerCount: 10,
    loserCount: 5,
    windowDays: RETURN_WINDOW_DAYS,
  });
  const featureBuckets = buildFeatureBuckets(summary, reportById, RETURN_WINDOW_DAYS);
  return (
    <ReportStatisticsStory
      featureBuckets={featureBuckets}
      pricePaths={pricePaths}
      summary={summary}
      windowDays={RETURN_WINDOW_DAYS}
    />
  );
}
