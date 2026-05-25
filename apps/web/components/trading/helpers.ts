import type { ReportTargetDigest } from '@/lib/artifacts';

/** Domestic / overseas market-region label shared by portfolio surfaces. */
export function marketLabel(region: 'domestic' | 'overseas' | undefined): string {
  return region === 'domestic' ? '국내' : '해외';
}

/** Per-row contribution to total deployed capital. */
export function capitalContribution(pnl: number | null, capital: number | undefined): number | null {
  if (pnl === null || pnl === undefined || !capital || capital <= 0) return null;
  return pnl / capital;
}

/** Convert a KRW value back to native currency using the row's native-vs-KRW pair. */
export function nativeFromKrw(
  krw: number | null,
  nativeReference: number | null,
  krwReference: number | null,
): number | null {
  if (krw === null || nativeReference === null || krwReference === null || krwReference <= 0) return krw;
  return (krw * nativeReference) / krwReference;
}

export function reportTargetHref(target: ReportTargetDigest): string {
  return `/reports/${encodeURIComponent(target.symbol)}/${encodeURIComponent(target.reportId)}`;
}

export function tradeDisplayName(symbol: string, company?: string | null): string {
  return stockDisplayName(symbol, company);
}

export function compactTicker(symbol: string): string {
  return symbol.replace(/\.(KS|KQ)$/u, '');
}

export function stockDisplayName(symbol: string, company?: string | null): string {
  if (symbol === 'CASH') return company || '현금/RP';
  if (isUsTicker(symbol)) return compactTicker(symbol);
  if (isDomesticTicker(symbol)) return company || compactTicker(symbol);
  return company || compactTicker(symbol);
}

function isUsTicker(symbol: string): boolean {
  return /^[A-Z]{1,5}$/u.test(symbol);
}

function isDomesticTicker(symbol: string): boolean {
  return /^\d{6}(\.(KS|KQ))?$/u.test(symbol);
}
