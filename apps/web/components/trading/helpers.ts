import type { ReportTargetDigest } from '@/lib/artifacts';

/** Domestic / overseas market-region label shared by every portfolio
 * surface so the badge wording stays in sync. */
export function marketLabel(region: 'domestic' | 'overseas' | undefined): string {
  return region === 'domestic' ? '국내' : '해외';
}

/** Per-row contribution to total deployed capital (pnl ÷ capital). Returns
 * null when either operand is missing or capital is non-positive. */
export function capitalContribution(pnl: number | null, capital: number | undefined): number | null {
  if (pnl === null || pnl === undefined || !capital || capital <= 0) return null;
  return pnl / capital;
}

/** Convert a KRW value back to native currency using the row's native-
 * vs-KRW pair. Used for cells that need both the KRW and the source-
 * currency representation (e.g., average cost). */
export function nativeFromKrw(
  krw: number | null,
  nativeReference: number | null,
  krwReference: number | null,
): number | null {
  if (krw === null || nativeReference === null || krwReference === null || krwReference <= 0) return krw;
  return (krw * nativeReference) / krwReference;
}

/** Canonical link to a report detail page given its target digest. */
export function reportTargetHref(target: ReportTargetDigest): string {
  return `/reports/${encodeURIComponent(target.symbol)}/${encodeURIComponent(target.reportId)}`;
}
