export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

export function formatMultiple(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('ko-KR', { maximumFractionDigits: digits })}배`;
}

/** Korean fintech convention: chunk into 억/만 so a portfolio analyst can read at
 * a glance instead of counting digits. 12,345,678,900 → "123억 4,568만원".
 * `exact: true` falls back to raw won for places that need ledger precision. */
export function formatKrw(value: number | null | undefined, opts: { exact?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  if (opts.exact) {
    return `${rounded.toLocaleString('ko-KR')}원`;
  }
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded);
  const EOK = 100_000_000;
  const MAN = 10_000;
  if (abs >= EOK) {
    const eok = Math.floor(abs / EOK);
    const remainderMan = Math.round((abs % EOK) / MAN);
    if (remainderMan > 0) return `${sign}${eok.toLocaleString('ko-KR')}억 ${remainderMan.toLocaleString('ko-KR')}만원`;
    return `${sign}${eok.toLocaleString('ko-KR')}억원`;
  }
  if (abs >= MAN) {
    const man = Math.floor(abs / MAN);
    return `${sign}${man.toLocaleString('ko-KR')}만원`;
  }
  return `${sign}${abs.toLocaleString('ko-KR')}원`;
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
  if (value === null || value === undefined || !Number.isFinite(value)) return 'text-slate-950/55';
  return value >= 0 ? 'text-emerald-600' : 'text-rose-600';
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
