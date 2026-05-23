'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';

const PERIODS = [
  { id: '1m', label: '1M', days: 31 },
  { id: '3m', label: '3M', days: 93 },
  { id: '6m', label: '6M', days: 186 },
  { id: 'ytd', label: 'YTD', days: null },
  { id: 'all', label: 'ALL', days: null },
] as const;

type PeriodId = (typeof PERIODS)[number]['id'];

/** Convert a hex colour (#rgb / #rrggbb) into rgba(...) so the active toggle pill
 * can share one visual encoding with the chart line at a lower opacity. */
function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const full = hex.length === 3 ? hex.replace(/(.)/g, '$1$1') : hex;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function SeriesToggleChart({ series }: { series: ReturnSeries[] }) {
  const available = useMemo(() => series.filter((item) => item.points.length), [series]);
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set(available.map((item) => item.id)));
  const [period, setPeriod] = useState<PeriodId>('all');
  const activeSeries = useMemo(
    () =>
      filterSeriesByPeriod(
        available.filter((item) => activeIds.has(item.id)),
        period,
      ),
    [activeIds, available, period],
  );
  const activeCount = available.filter((item) => activeIds.has(item.id)).length;
  const hiddenCount = Math.max(0, available.length - activeCount);

  function toggle(id: string) {
    setActiveIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        if (next.size === 1) return next;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function setAll() {
    setActiveIds(new Set(available.map((item) => item.id)));
  }

  function setPrimaryOnly() {
    setActiveIds(new Set(available.slice(0, 3).map((item) => item.id)));
  }

  return (
    <div className="grid gap-3">
      <div className="grid min-w-0 gap-2">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-950/45">
            표시 {activeSeries.length.toLocaleString('ko-KR')} · 숨김 {hiddenCount.toLocaleString('ko-KR')}
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <div
              className="inline-flex max-w-full overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-0.5"
              aria-label="성과 기간"
            >
              {PERIODS.map((item) => (
                <button
                  className={`min-h-7 rounded px-2 font-mono text-[11px] font-semibold transition ${
                    period === item.id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-950'
                  }`}
                  key={item.id}
                  onClick={() => setPeriod(item.id)}
                  type="button"
                  aria-pressed={period === item.id}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button className="snapshot-pill" onClick={setPrimaryOnly} type="button">
              핵심만
            </button>
            <button className="snapshot-pill" onClick={setAll} type="button">
              전체
            </button>
          </div>
        </div>
        <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1" aria-label="차트 표시 항목">
          {available.map((item) => {
            const active = activeIds.has(item.id);
            // Tint the active pill with the series's own colour so the toggle and
            // the chart line share one visual encoding instead of two parallel ones.
            const activeStyle: CSSProperties | undefined = active
              ? {
                  backgroundColor: colorWithAlpha(item.color, 0.14),
                  borderColor: colorWithAlpha(item.color, 0.4),
                  color: item.color,
                }
              : undefined;
            return (
              <button
                className={`snapshot-pill max-w-[9.5rem] shrink-0 border transition ${active ? '' : 'opacity-55'}`}
                key={item.id}
                onClick={() => toggle(item.id)}
                style={activeStyle}
                title={item.label}
                type="button"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 truncate">{item.shortLabel ?? item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <CumulativeReturnChart series={activeSeries} showLegend={false} />
    </div>
  );
}

function filterSeriesByPeriod(series: ReturnSeries[], period: PeriodId): ReturnSeries[] {
  if (period === 'all') return series;
  const latestTime = series
    .flatMap((item) => item.points.map((point) => Date.parse(point.time)))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  if (!latestTime) return series;
  const latest = new Date(latestTime);
  const cutoff =
    period === 'ytd'
      ? Date.UTC(latest.getUTCFullYear(), 0, 1)
      : latestTime - (PERIODS.find((item) => item.id === period)?.days ?? 0) * 24 * 60 * 60 * 1000;
  return series.map((item) => ({
    ...item,
    points: item.points.filter((point) => Date.parse(point.time) >= cutoff),
  }));
}
