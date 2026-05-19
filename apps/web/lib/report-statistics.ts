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
