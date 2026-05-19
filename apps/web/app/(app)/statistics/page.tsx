import {
  type FeatureBucket,
  type PricePathSeries,
  ReportStatisticsStory,
} from '@/components/reports/ReportStatisticsStory';
import { getPriceSeries, getReportRows, getReportStatisticsLabSummary, hasPriceArtifact } from '@/lib/artifacts';
import type { PricePoint, ReportStatisticsLabSummary } from '@/lib/artifacts';
import { isNumber } from '@/lib/report-statistics';

function buildPricePath(
  row: ReportStatisticsLabSummary['riskScatter'][number],
  samplePoints: number,
): PricePathSeries | null {
  const prices = getPriceSeries(row.symbol, row.publicationDate);
  if (prices.length === 0) return null;
  const basePrice = prices[0].close ?? prices[0].value;
  if (!basePrice || basePrice <= 0) return null;
  const step = Math.max(1, Math.floor(prices.length / samplePoints));
  const points: Array<{ day: number; returnPct: number }> = [];
  for (let i = 0; i < prices.length; i += step) {
    const close = prices[i].close ?? prices[i].value;
    if (close > 0) points.push({ day: i, returnPct: close / basePrice - 1 });
  }
  const lastIdx = prices.length - 1;
  if (points[points.length - 1]?.day !== lastIdx) {
    const lastClose = prices[lastIdx].close ?? prices[lastIdx].value;
    if (lastClose > 0) points.push({ day: lastIdx, returnPct: lastClose / basePrice - 1 });
  }
  return {
    reportId: row.reportId,
    symbol: row.symbol,
    company: row.company,
    publicationDate: row.publicationDate,
    peakReturn: row.maxFavorableExcursion ?? 0,
    points,
  };
}

function buildPricePaths(
  summary: ReportStatisticsLabSummary,
  options: { winnerCount: number; loserCount: number; samplePoints: number },
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
      .map((row) => buildPricePath(row, options.samplePoints))
      .filter((path): path is PricePathSeries => path !== null),
    losers: losers
      .map((row) => buildPricePath(row, options.samplePoints))
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

function buildFeatureBuckets(summary: ReportStatisticsLabSummary): FeatureBucket[] {
  const reportById = new Map(getReportRows().map((row) => [row.reportId, row]));
  const snapshots: Snapshot[] = [];
  for (const row of summary.riskScatter) {
    if (!isNumber(row.maxFavorableExcursion)) continue;
    if (!hasPriceArtifact(row.symbol)) continue;
    const prices = getPriceSeries(row.symbol);
    const features = computeFeatures(prices, row.publicationDate);
    if (features === null) continue;
    const meta = reportById.get(row.reportId);
    snapshots.push({
      peakReturn: row.maxFavorableExcursion,
      hit10: row.hit10,
      daysToTarget: meta?.daysToTarget ?? null,
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
  const summary = getReportStatisticsLabSummary();
  const pricePaths = buildPricePaths(summary, { winnerCount: 10, loserCount: 5, samplePoints: 60 });
  const featureBuckets = buildFeatureBuckets(summary);
  return <ReportStatisticsStory summary={summary} pricePaths={pricePaths} featureBuckets={featureBuckets} />;
}
