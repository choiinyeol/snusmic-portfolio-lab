import { formatNativeWithKrw } from '@/lib/format';

type Tone = 'neutral' | 'good' | 'bad' | 'warn';
type Layout = 'stacked' | 'inline';

const toneClass: Record<Tone, string> = {
  neutral: 'text-slate-950',
  good: 'text-emerald-600',
  bad: 'text-rose-600',
  warn: 'text-amber-600',
};

type Props = {
  native: number | null | undefined;
  krw?: number | null | undefined;
  currency: string | null | undefined;
  tone?: Tone;
  layout?: Layout;
  showSecondary?: boolean;
  bold?: boolean;
};

/**
 * Single source of truth for asset price display.
 * Native currency primary, KRW secondary (per product direction §3.4).
 * Use this for any per-asset price; aggregate KRW totals use formatKrw directly.
 */
export function Money({
  native,
  krw,
  currency,
  tone = 'neutral',
  layout = 'stacked',
  showSecondary = true,
  bold = false,
}: Props) {
  const { primary, secondary } = formatNativeWithKrw(native, krw, currency);
  const primaryClass = `break-words tabular-nums ${toneClass[tone]} ${bold ? 'font-bold' : ''}`;
  const secondaryClass = 'break-words tabular-nums text-xs text-slate-950/55';
  if (layout === 'inline') {
    return (
      <span className="inline-flex max-w-full flex-wrap items-baseline gap-1.5">
        <span className={primaryClass}>{primary}</span>
        {showSecondary && secondary ? <span className={secondaryClass}>{secondary}</span> : null}
      </span>
    );
  }
  return (
    <span className="inline-grid max-w-full">
      <span className={primaryClass}>{primary}</span>
      {showSecondary && secondary ? <span className={secondaryClass}>{secondary}</span> : null}
    </span>
  );
}
