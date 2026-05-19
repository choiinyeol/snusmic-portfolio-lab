import { ReportStatisticsStory, type PricePathSeries } from '@/components/reports/ReportStatisticsStory';
import { getPriceSeries, getReportStatisticsLabSummary, hasPriceArtifact } from '@/lib/artifacts';
import type { ReportStatisticsLabSummary } from '@/lib/artifacts';
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

export default function ReportStatisticsPage() {
  const summary = getReportStatisticsLabSummary();
  const pricePaths = buildPricePaths(summary, { winnerCount: 10, loserCount: 5, samplePoints: 60 });
  return <ReportStatisticsStory summary={summary} pricePaths={pricePaths} />;
}
