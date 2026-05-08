'use client';

import type { HoldingRow } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';

type Props = {
  holdings: HoldingRow[];
};

/** Proportional weight tile-cluster (cheap treemap). Each tile's flex-grow
 * is the holding's weight, so the row visualizes capital concentration; tone
 * encodes unrealized return.  Falls back to nothing when there are no
 * holdings — the table beneath stays as the canonical view. */
export function HoldingsTreemap({ holdings }: Props) {
  const total = holdings.reduce((sum, row) => sum + Math.max(0, row.marketValueKrw ?? 0), 0);
  if (holdings.length === 0 || total <= 0) return null;
  const sorted = [...holdings].sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-base-content/55">
        <span>비중 비례 타일 — 면적 = 평가액, 색 = 미실현 손익</span>
        <span>합계 {formatKrw(total)}</span>
      </div>
      <div className="flex h-44 w-full overflow-hidden rounded-lg border border-base-300 bg-base-200/30">
        {sorted.map((row) => {
          const weight = (row.marketValueKrw ?? 0) / total;
          const ret = row.unrealizedReturn ?? 0;
          const tone = toneFor(ret);
          return (
            <div
              key={`${row.persona}-${row.symbol}`}
              className={`flex min-w-0 flex-col justify-between border-r border-white/40 px-2 py-1.5 text-white last:border-r-0 ${tone.bg}`}
              style={{ flex: `${Math.max(weight, 0.0001)} 1 0` }}
              title={`${row.company || row.symbol} · ${formatPercent(weight)} · ${formatKrw(row.marketValueKrw)} · ${formatPercent(row.unrealizedReturn)}`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="truncate text-xs font-bold leading-tight">{row.company || row.symbol}</span>
                <span className="truncate font-mono text-[10px] leading-none opacity-70">{row.symbol}</span>
              </div>
              <div className="flex flex-col">
                <span className="tabular-nums text-xs font-semibold">{formatPercent(weight)}</span>
                <span className="tabular-nums text-[11px] opacity-90">{formatPercent(row.unrealizedReturn)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function toneFor(unrealizedReturn: number): { bg: string } {
  // Gradient by magnitude — saturates around ±25%.
  const mag = Math.min(1, Math.abs(unrealizedReturn) / 0.25);
  if (unrealizedReturn >= 0) {
    if (mag > 0.66) return { bg: 'bg-success' };
    if (mag > 0.33) return { bg: 'bg-success/80' };
    return { bg: 'bg-success/55' };
  }
  if (mag > 0.66) return { bg: 'bg-error' };
  if (mag > 0.33) return { bg: 'bg-error/80' };
  return { bg: 'bg-error/55' };
}
