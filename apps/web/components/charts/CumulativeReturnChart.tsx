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
import { useEffect, useRef, useState } from 'react';
import { formatPercent } from '@/lib/format';

type Point = { time: string; value: number };
export type ReturnSeries = { id: string; label: string; shortLabel?: string; color: string; points: Point[] };

type Tooltip = { x: number; y: number; time: string; rows: Array<{ label: string; value: number; color: string }> };

export function CumulativeReturnChart({ series, showLegend = true }: { series: ReturnSeries[]; showLegend?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  useEffect(() => {
    if (!ref.current || !series.some((item) => item.points.length)) return;
    const container = ref.current;
    const chart = createChart(container, {
      autoSize: true,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#4e5968',
        attributionLogo: true,
      },
      grid: { vertLines: { color: '#f1f3f6' }, horzLines: { color: '#f1f3f6' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#eaedf2', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: '#eaedf2', timeVisible: true, secondsVisible: false },
    });
    const apiByLabel = new Map<ISeriesApi<'Line'>, ReturnSeries>();
    for (const item of series) {
      if (!item.points.length) continue;
      const line = chart.addSeries(LineSeries, {
        color: item.color,
        lineWidth: 2,
        priceFormat: { type: 'percent', precision: 2, minMove: 0.01 },
        priceLineVisible: false,
        lastValueVisible: false,
        title: item.shortLabel ?? item.label,
      });
      line.setData(item.points.map((point) => ({ time: point.time as Time, value: point.value * 100 })));
      apiByLabel.set(line, item);
    }
    const handleCrosshairMove = (params: MouseEventParams<Time>) => {
      if (!params.point || !params.time || params.point.x < 0 || params.point.y < 0) {
        setTooltip(null);
        return;
      }
      const rows: Tooltip['rows'] = [];
      for (const [line, item] of apiByLabel.entries()) {
        const data = params.seriesData.get(line);
        if (typeof data === 'object' && data && 'value' in data && Number.isFinite(Number(data.value))) {
          rows.push({ label: item.shortLabel ?? item.label, value: Number(data.value) / 100, color: item.color });
        }
      }
      setTooltip({
        x: Math.min(params.point.x + 16, Math.max(16, container.clientWidth - 240)),
        y: Math.max(12, params.point.y - 90),
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
  }, [series]);

  if (!series.some((item) => item.points.length))
    return <div className="chart-box empty-chart">수익률 경로 데이터가 없습니다.</div>;
  return (
    <div className="chart-shell">
      {showLegend ? (
        <div className="chart-legend mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs">
          {series
            .filter((item) => item.points.length)
            .slice(0, 14)
            .map((item) => (
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap" key={item.id} title={item.label}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-semibold text-base-content/65">{item.shortLabel ?? item.label}</span>
              </span>
            ))}
        </div>
      ) : null}
      <div ref={ref} className="chart-box chart-box-fixed chart-box-return" aria-label="전략 누적 수익률 비교 차트" />
      {tooltip ? (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tooltip-date">{tooltip.time}</div>
          {tooltip.rows.map((row) => (
            <div key={row.label} style={{ color: row.color }}>
              {row.label}: {formatPercent(row.value)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
