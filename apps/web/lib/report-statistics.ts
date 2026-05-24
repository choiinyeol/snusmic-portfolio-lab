import type { ReportStatisticsLabSummary } from '@/lib/artifacts';

/** Pure numeric helpers extracted from ReportStatisticsStory so server-side or
 * non-client callers can reuse them without pulling the entire 1000-line
 * statistics renderer into their bundle. */

type RiskScatterRow = ReportStatisticsLabSummary['riskScatter'][number];

export type ReturnBin = {
  id: string;
  label: string;
  min: number;
  max: number | null;
  barClass: string;
  textClass: string;
};

export type ReturnDistributionBin = ReturnBin & {
  rows: RiskScatterRow[];
  count: number;
  share: number;
};

export type PeakReturnDistribution = {
  bins: ReturnDistributionBin[];
  mean: number | null;
  median: number | null;
  p90: number | null;
  defaultBinId: string | null;
};

export const RETURN_BINS: ReturnBin[] = [
  {
    id: 'below-0',
    label: '<0%',
    min: Number.NEGATIVE_INFINITY,
    max: 0,
    barClass: 'bg-rose-500',
    textClass: 'text-rose-600',
  },
  { id: '0-5', label: '0-5%', min: 0, max: 0.05, barClass: 'bg-slate-400', textClass: 'text-slate-600' },
  { id: '5-10', label: '5-10%', min: 0.05, max: 0.1, barClass: 'bg-slate-500', textClass: 'text-slate-600' },
  { id: '10-20', label: '10-20%', min: 0.1, max: 0.2, barClass: 'bg-emerald-400', textClass: 'text-emerald-600' },
  { id: '20-30', label: '20-30%', min: 0.2, max: 0.3, barClass: 'bg-emerald-500', textClass: 'text-emerald-600' },
  { id: '30-50', label: '30-50%', min: 0.3, max: 0.5, barClass: 'bg-teal-500', textClass: 'text-teal-600' },
  { id: '50-80', label: '50-80%', min: 0.5, max: 0.8, barClass: 'bg-sky-500', textClass: 'text-sky-600' },
  { id: '80-120', label: '80-120%', min: 0.8, max: 1.2, barClass: 'bg-blue-500', textClass: 'text-blue-600' },
  { id: '120-200', label: '120-200%', min: 1.2, max: 2, barClass: 'bg-indigo-500', textClass: 'text-indigo-600' },
  { id: 'over-200', label: '200%+', min: 2, max: null, barClass: 'bg-slate-950', textClass: 'text-slate-950' },
];

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Linear-interpolated quantile of an already-sorted ascending array. Callers
 * are expected to sort once and reuse for all percentile lookups. */
export function quantileFromSorted(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

export function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}x`;
}

export function buildPeakReturnDistribution(rows: RiskScatterRow[]): PeakReturnDistribution {
  const peakReturns = rows.map((row) => row.maxFavorableExcursion).filter(isNumber);
  const sortedPeakReturns = [...peakReturns].sort((a, b) => a - b);
  const total = rows.length;
  const bins = RETURN_BINS.map((bin) => {
    const binRows = rows
      .filter((row) => isInReturnBin(row.maxFavorableExcursion ?? null, bin))
      .sort(
        (a, b) =>
          (b.maxFavorableExcursion ?? Number.NEGATIVE_INFINITY) - (a.maxFavorableExcursion ?? Number.NEGATIVE_INFINITY),
      );
    return {
      ...bin,
      rows: binRows,
      count: binRows.length,
      share: total ? binRows.length / total : 0,
    };
  });
  const defaultBinId = bins.reduce((best, bin) => (bin.count > best.count ? bin : best), bins[0])?.id ?? null;
  return {
    bins,
    mean: mean(peakReturns),
    median: quantileFromSorted(sortedPeakReturns, 0.5),
    p90: quantileFromSorted(sortedPeakReturns, 0.9),
    defaultBinId,
  };
}

export function isInReturnBin(value: number | null, bin: ReturnBin): boolean {
  if (value === null) return false;
  if (value < bin.min) return false;
  if (bin.max === null) return true;
  return value < bin.max;
}

/** Wilson score 95% CI for a binomial proportion. Returns [lo, hi] in [0, 1].
 * Stable at small n where the normal approximation breaks down — preferred
 * over k/n ± 1.96·√(p(1−p)/n) for hit-rate analysis under n &lt; 100. */
export function wilsonCI(k: number, n: number, z: number = 1.96): { lo: number; hi: number; point: number } {
  if (!Number.isFinite(k) || !Number.isFinite(n) || n <= 0) return { lo: 0, hi: 0, point: 0 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n);
  return {
    lo: Math.max(0, (center - margin) / denom),
    hi: Math.min(1, (center + margin) / denom),
    point: p,
  };
}

/** Symmetric trimmed mean — drop the top and bottom `fraction` of the sample
 * before averaging. fraction=0.1 drops the extreme 10% on each side. Lets
 * readers see whether a handful of tail observations are inflating the mean. */
export function trimmedMean(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(values.length * fraction);
  const slice = sorted.slice(trim, sorted.length - trim);
  if (!slice.length) return null;
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}
