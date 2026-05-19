/** Pure numeric helpers extracted from ReportStatisticsStory so server-side or
 * non-client callers can reuse them without pulling the entire 1000-line
 * statistics renderer into their bundle. */

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

/** Sample skewness (Fisher-Pearson). Positive = right tail heavier than left
 * (analyst-recommendation samples typically show this). */
export function sampleSkewness(values: number[]): number | null {
  if (values.length < 3) return null;
  const n = values.length;
  const mu = values.reduce((sum, value) => sum + value, 0) / n;
  let m2 = 0;
  let m3 = 0;
  for (const value of values) {
    const d = value - mu;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= n;
  m3 /= n;
  if (m2 <= 0) return null;
  return m3 / m2 ** 1.5;
}

/** Excess kurtosis (kurtosis − 3). Positive ⇒ tails fatter than a normal. */
export function excessKurtosis(values: number[]): number | null {
  if (values.length < 4) return null;
  const n = values.length;
  const mu = values.reduce((sum, value) => sum + value, 0) / n;
  let m2 = 0;
  let m4 = 0;
  for (const value of values) {
    const d = value - mu;
    m2 += d * d;
    m4 += d * d * d * d;
  }
  m2 /= n;
  m4 /= n;
  if (m2 <= 0) return null;
  return m4 / (m2 * m2) - 3;
}
