export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

export function formatMultiple(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: digits })}배`;
}

export function formatKrw(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_0000_0000_0000)
    return `${(value / 1_0000_0000_0000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}조원`;
  if (abs >= 1_0000_0000) return `${(value / 1_0000_0000).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억원`;
  if (abs >= 10_000) return `${(value / 10_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만원`;
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

export function formatKrwMillions(value: number | null | undefined): string {
  return formatKrw(value);
}

export function formatDays(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${Math.round(value).toLocaleString('ko-KR')}거래일`;
}

export function formatDateKo(value: string | null | undefined): string {
  if (!value) return '—';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

export function signedClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return value >= 0 ? 'good' : 'bad';
}

/** Tailwind class for numeric table cells: right align + tabular figures. */
export const numCellClass = 'text-right tabular-nums';

/** Tailwind class for signed numeric values (success/error tinting). */
export function signedTextClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'text-base-content/55';
  return value >= 0 ? 'text-success' : 'text-error';
}

const CURRENCY_SYMBOL: Record<string, string> = {
  KRW: '₩',
  USD: '$',
  JPY: '¥',
  HKD: 'HK$',
  CNY: '¥',
  EUR: '€',
  CHF: 'CHF ',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
};

const CURRENCY_LOCALE: Record<string, string> = {
  KRW: 'ko-KR',
  JPY: 'ja-JP',
  USD: 'en-US',
};

const CURRENCY_DIGITS: Record<string, number> = {
  KRW: 0,
  JPY: 0,
  HKD: 2,
  USD: 2,
  EUR: 2,
  CHF: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  CNY: 2,
};

export function formatNative(value: number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const code = (currency ?? 'KRW').toUpperCase();
  if (code === 'KRW') return formatKrw(value);
  const symbol = CURRENCY_SYMBOL[code] ?? `${code} `;
  const digits = CURRENCY_DIGITS[code] ?? 2;
  const locale = CURRENCY_LOCALE[code] ?? 'en-US';
  return `${symbol}${value.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}

export function formatNativeWithKrw(
  native: number | null | undefined,
  krw: number | null | undefined,
  currency: string | null | undefined,
): { primary: string; secondary: string | null } {
  const code = (currency ?? 'KRW').toUpperCase();
  if (code === 'KRW') {
    return { primary: formatKrw(krw), secondary: null };
  }
  const primary = formatNative(native, code);
  const secondary = krw !== null && krw !== undefined && Number.isFinite(krw) ? `≈ ${formatKrw(krw)}` : null;
  return { primary, secondary };
}
