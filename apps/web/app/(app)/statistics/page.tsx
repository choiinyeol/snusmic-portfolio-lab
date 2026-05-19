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
    finalReturn: row.currentReturn ?? 0,
    points,
  };
}

function buildPricePaths(
  summary: ReportStatisticsLabSummary,
  options: { winnerCount: number; loserCount: number; samplePoints: number },
): { winners: PricePathSeries[]; losers: PricePathSeries[] } {
  const eligible = summary.riskScatter.filter((row) => isNumber(row.currentReturn) && hasPriceArtifact(row.symbol));
  const winners = [...eligible]
    .sort((a, b) => (b.currentReturn ?? 0) - (a.currentReturn ?? 0))
    .slice(0, options.winnerCount);
  const losers = [...eligible]
    .sort((a, b) => (a.currentReturn ?? 0) - (b.currentReturn ?? 0))
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
  gapPct: number | null;
};

/** Compute price-action features at publication day from the symbol's
 * full daily history: trend alignment (price > SMA20 > SMA50 > SMA200),
 * 52-week high proximity (close at pub / max close over past ~252 trading days),
 * and the opening gap (pub-day open vs prior-day close). Returns nulls
 * for features that need more history than is available. */
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

  let gapPct: number | null = null;
  if (pubIdx > 0) {
    const prevClose = prices[pubIdx - 1].close ?? prices[pubIdx - 1].value;
    const openPub = prices[pubIdx].open ?? null;
    if (openPub && prevClose > 0) {
      gapPct = openPub / prevClose - 1;
    }
  }

  return { aligned, high52wProximity, gapPct };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type Snapshot = {
  currentReturn: number;
  hit10: boolean;
  daysToTarget: number | null;
  features: PublicationFeatures;
};

function bucketStats(group: FeatureBucket['group'], label: string, items: Snapshot[]): FeatureBucket {
  const returns = items.map((s) => s.currentReturn);
  const hits = items.filter((s) => s.hit10);
  const hitDays = hits.map((s) => s.daysToTarget).filter((value): value is number => value !== null);
  return {
    group,
    label,
    count: items.length,
    medianReturn: median(returns),
    hitRate10: items.length === 0 ? 0 : hits.length / items.length,
    medianDaysToHit10: median(hitDays),
  };
}

function buildFeatureBuckets(summary: ReportStatisticsLabSummary): FeatureBucket[] {
  const reportById = new Map(getReportRows().map((row) => [row.reportId, row]));
  const snapshots: Snapshot[] = [];
  for (const row of summary.riskScatter) {
    if (!isNumber(row.currentReturn)) continue;
    if (!hasPriceArtifact(row.symbol)) continue;
    const prices = getPriceSeries(row.symbol);
    const features = computeFeatures(prices, row.publicationDate);
    if (features === null) continue;
    const meta = reportById.get(row.reportId);
    snapshots.push({
      currentReturn: row.currentReturn,
      hit10: row.hit10,
      daysToTarget: meta?.daysToTarget ?? null,
      features,
    });
  }

  const alignedYes = snapshots.filter((s) => s.features.aligned === true);
  const alignedNo = snapshots.filter((s) => s.features.aligned === false);
  const high95 = snapshots.filter((s) => (s.features.high52wProximity ?? 0) >= 0.95);
  const high80 = snapshots.filter(
    (s) => (s.features.high52wProximity ?? 0) >= 0.8 && (s.features.high52wProximity ?? 0) < 0.95,
  );
  const highLow = snapshots.filter(
    (s) => s.features.high52wProximity !== null && (s.features.high52wProximity ?? 0) < 0.8,
  );
  const gapUp = snapshots.filter((s) => (s.features.gapPct ?? 0) >= 0.02);
  const gapFlat = snapshots.filter((s) => s.features.gapPct !== null && Math.abs(s.features.gapPct ?? 0) < 0.02);
  const gapDown = snapshots.filter((s) => (s.features.gapPct ?? 0) <= -0.02);

  return [
    bucketStats('alignment', '정배열 (가격 > SMA20 > SMA50 > SMA200)', alignedYes),
    bucketStats('alignment', '비정배열', alignedNo),
    bucketStats('high52w', '52주 고가의 95%+ 근접', high95),
    bucketStats('high52w', '80–95%', high80),
    bucketStats('high52w', '80% 미만', highLow),
    bucketStats('gap', '발간일 갭 +2% 이상', gapUp),
    bucketStats('gap', '갭 ±2% 이내', gapFlat),
    bucketStats('gap', '발간일 갭 -2% 이하', gapDown),
  ];
}

export default function ReportStatisticsPage() {
  const summary = getReportStatisticsLabSummary();
  const pricePaths = buildPricePaths(summary, { winnerCount: 10, loserCount: 5, samplePoints: 60 });
  const featureBuckets = buildFeatureBuckets(summary);
  return <ReportStatisticsStory summary={summary} pricePaths={pricePaths} featureBuckets={featureBuckets} />;
}
