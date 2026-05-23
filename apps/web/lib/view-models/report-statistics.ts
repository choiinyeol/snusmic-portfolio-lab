import type { PricePathSeries } from '@/components/reports/ReportStatisticsStory';
import { getPriceSeries, getReportStatisticsPageBundle, hasPriceArtifact } from '@/lib/artifacts';
import type { PricePoint, ReportStatisticsLabSummary } from '@/lib/artifacts';

const CHART_WINDOW_DAYS = 500;

function closeKrwOf(point: PricePoint): number {
  return point.closeKrw ?? point.close ?? point.value ?? 0;
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
    (row) =>
      row.maxFavorableExcursion !== null && Number.isFinite(row.maxFavorableExcursion) && hasPriceArtifact(row.symbol),
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

export type ReportStatisticsViewModel = {
  summary: ReportStatisticsLabSummary;
  pricePaths: { winners: PricePathSeries[]; losers: PricePathSeries[] };
  featureBuckets: [];
  confirmationSignals: [];
  windowDays: number;
};

export function getReportStatisticsViewModel(): ReportStatisticsViewModel {
  const bundle = getReportStatisticsPageBundle();
  const summary = bundle.summary;
  return {
    confirmationSignals: [],
    featureBuckets: [],
    pricePaths: buildPricePaths(summary, {
      winnerCount: 10,
      loserCount: 10,
      windowDays: CHART_WINDOW_DAYS,
    }),
    summary,
    windowDays: CHART_WINDOW_DAYS,
  };
}
