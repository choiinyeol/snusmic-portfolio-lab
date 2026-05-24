'use client';

import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPercent } from '@/lib/format';

type Point = { time: string; value: number };
export type ReturnSeries = { id: string; label: string; shortLabel?: string; color: string; points: Point[] };

type TooltipRow = { label: string; value: number; color: string };
type Tooltip = {
  x: number;
  y: number;
  time: string;
  rows: TooltipRow[];
};

export function CumulativeReturnChart({
  series,
  showLegend = true,
  height = 360,
}: {
  series: ReturnSeries[];
  showLegend?: boolean;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const visibleSeries = useMemo(() => series.filter((item) => item.points.length), [series]);
  const normalizedSeries = useMemo(
    () =>
      visibleSeries.map((item, index) => ({
        ...item,
        primary: index === 0,
        points: item.points
          .filter((point) => Number.isFinite(point.value))
          .sort((a, b) => a.time.localeCompare(b.time))
          .map((point) => ({ time: point.time as Time, value: point.value * 100 })),
      })),
    [visibleSeries],
  );

  useEffect(() => {
    const container = ref.current;
    if (!container || !normalizedSeries.length) return;

    const chart = createChart(container, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#475569',
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#eef2f7' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#cbd5e1', style: 3 },
        horzLine: { color: '#cbd5e1', style: 3 },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
    });

    const apiBySeries = new Map<ISeriesApi<'Line'>, { label: string; color: string }>();
    for (const item of normalizedSeries) {
      const line = chart.addSeries(LineSeries, {
        color: item.color,
        lineWidth: item.primary ? 2 : 1,
        priceFormat: { type: 'percent', precision: 2, minMove: 0.01 },
        priceLineVisible: false,
        lastValueVisible: item.primary,
        title: item.shortLabel ?? item.label,
      });
      line.setData(item.points);
      apiBySeries.set(line, { label: item.shortLabel ?? item.label, color: item.color });
    }

    const handleCrosshairMove = (params: MouseEventParams<Time>) => {
      if (!params.point || !params.time || params.point.x < 0 || params.point.y < 0) {
        setTooltip(null);
        return;
      }
      const rows = [...apiBySeries.entries()]
        .map(([api, meta]) => {
          const datum = params.seriesData.get(api);
          if (typeof datum !== 'object' || !datum || !('value' in datum)) return null;
          const value = Number(datum.value);
          if (!Number.isFinite(value)) return null;
          return { label: meta.label, value: value / 100, color: meta.color };
        })
        .filter((row): row is TooltipRow => row !== null)
        .sort((a, b) => b.value - a.value);
      if (!rows.length) {
        setTooltip(null);
        return;
      }
      const tooltipWidth = 230;
      setTooltip({
        x: Math.min(params.point.x + 14, Math.max(12, container.clientWidth - tooltipWidth - 12)),
        y: Math.max(12, Math.min(container.clientHeight - 150, params.point.y - 72)),
        time: String(params.time),
        rows,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().fitContent();
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
    };
  }, [height, normalizedSeries]);

  if (!normalizedSeries.length) {
    return (
      <div className="grid min-h-72 place-items-center rounded-md border border-slate-100 bg-white text-sm text-slate-500">
        수익률 경로 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="relative grid gap-2">
      {showLegend ? (
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 px-1 text-xs">
          {normalizedSeries.slice(0, 14).map((item) => (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap" key={item.id} title={item.label}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="font-medium text-slate-500">{item.shortLabel ?? item.label}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div
        ref={ref}
        className="rounded-md border border-slate-100 bg-white"
        style={{ height }}
        aria-label="전략과 벤치마크 누적 수익률 비교 차트"
      />
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 grid w-[230px] gap-1 rounded-lg border border-slate-200 bg-white/95 p-2 text-xs shadow-lg shadow-slate-200/70"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-mono text-[11px] font-semibold text-slate-500">{tooltip.time}</div>
          {tooltip.rows.slice(0, 8).map((row) => (
            <div className="flex items-center justify-between gap-3" key={row.label}>
              <span className="min-w-0 truncate" style={{ color: row.color }}>
                {row.label}
              </span>
              <span className="font-mono font-semibold tabular-nums text-slate-950">{formatPercent(row.value)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
