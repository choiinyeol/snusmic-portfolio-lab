'use client';

import { useMemo, useState } from 'react';
import { formatPercent } from '@/lib/format';

type Point = { time: string; value: number };
export type ReturnSeries = { id: string; label: string; shortLabel?: string; color: string; points: Point[] };

type HoverPoint = {
  x: number;
  y: number;
  tooltipX: number;
  tooltipY: number;
  tooltipSide: 'left' | 'right';
  time: string;
  rows: Array<{ label: string; value: number; color: string }>;
};
type ChartHoverPoint = Omit<HoverPoint, 'tooltipX' | 'tooltipY' | 'tooltipSide'>;

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 360;
const PADDING = { top: 28, right: 52, bottom: 34, left: 48 };
const TOOLTIP_WIDTH = 220;
const TOOLTIP_GAP = 18;
const TOOLTIP_ESTIMATED_HEIGHT = 132;

export function CumulativeReturnChart({ series, showLegend = true }: { series: ReturnSeries[]; showLegend?: boolean }) {
  const visibleSeries = useMemo(() => series.filter((item) => item.points.length), [series]);
  const chartModel = useMemo(() => buildChartModel(visibleSeries), [visibleSeries]);
  const [hover, setHover] = useState<HoverPoint | null>(null);

  if (!visibleSeries.length || !chartModel) {
    return <div className="chart-box empty-chart">수익률 경로 데이터가 없습니다.</div>;
  }

  return (
    <div className="chart-shell">
      {showLegend ? (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs">
          {visibleSeries.slice(0, 14).map((item) => (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap" key={item.id} title={item.label}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="font-semibold text-slate-500">{item.shortLabel ?? item.label}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="chart-box chart-box-return relative border border-slate-100 bg-white">
        <svg
          aria-label="계좌 누적 수익률 비교 차트"
          className="h-full w-full"
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1);
            const nextHover = chartModel.hoverAt(ratio);
            setHover(positionTooltip(nextHover, rect.width, rect.height));
          }}
        >
          <title>계좌 누적 수익률 비교</title>
          <ChartGrid ticks={chartModel.yTicks} scaleY={chartModel.scaleY} />
          {chartModel.paths.map((path) => (
            <path
              d={path.d}
              fill="none"
              key={path.id}
              stroke={path.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={path.primary ? 2.4 : 1.8}
              opacity={path.primary ? 1 : 0.82}
            />
          ))}
          {hover ? (
            <g pointerEvents="none">
              <line x1={hover.x} x2={hover.x} y1={PADDING.top} y2={CHART_HEIGHT - PADDING.bottom} stroke="#cbd5e1" />
              <circle cx={hover.x} cy={hover.y} fill="#111827" r="3.5" />
            </g>
          ) : null}
          <ChartAxis start={chartModel.firstDate} end={chartModel.lastDate} min={chartModel.min} max={chartModel.max} />
        </svg>
        {hover ? (
          <div
            className="chart-tooltip"
            data-side={hover.tooltipSide}
            style={{ left: hover.tooltipX, top: hover.tooltipY, width: TOOLTIP_WIDTH }}
          >
            <div className="tooltip-date">{hover.time}</div>
            {hover.rows.map((row) => (
              <div key={row.label} style={{ color: row.color }}>
                {row.label}: {formatPercent(row.value)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function positionTooltip(hover: ChartHoverPoint, width: number, height: number): HoverPoint {
  const chartX = (hover.x / CHART_WIDTH) * width;
  const chartY = (hover.y / CHART_HEIGHT) * height;
  const hasRoomRight = chartX + TOOLTIP_GAP + TOOLTIP_WIDTH <= width - 12;
  const tooltipX = hasRoomRight
    ? chartX + TOOLTIP_GAP
    : Math.max(12, Math.min(width - TOOLTIP_WIDTH - 12, chartX - TOOLTIP_WIDTH - TOOLTIP_GAP));
  const tooltipY = Math.max(12, Math.min(height - TOOLTIP_ESTIMATED_HEIGHT - 12, chartY - 64));
  return {
    ...hover,
    tooltipX,
    tooltipY,
    tooltipSide: hasRoomRight ? 'right' : 'left',
  };
}

function ChartGrid({ ticks, scaleY }: { ticks: number[]; scaleY: (value: number) => number }) {
  return (
    <g>
      {ticks.map((tick) => {
        const y = scaleY(tick);
        return (
          <g key={tick}>
            <line stroke="#edf2f7" x1={PADDING.left} x2={CHART_WIDTH - PADDING.right} y1={y} y2={y} />
            <text fill="#64748b" fontSize="11" textAnchor="end" x={PADDING.left - 10} y={y + 4}>
              {formatPercent(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ChartAxis({ start, end, min, max }: { start: string; end: string; min: number; max: number }) {
  return (
    <g fill="#64748b" fontSize="11">
      <line
        stroke="#cbd5e1"
        x1={PADDING.left}
        x2={CHART_WIDTH - PADDING.right}
        y1={CHART_HEIGHT - PADDING.bottom}
        y2={CHART_HEIGHT - PADDING.bottom}
      />
      <text x={PADDING.left} y={CHART_HEIGHT - 10}>
        {start}
      </text>
      <text textAnchor="end" x={CHART_WIDTH - PADDING.right} y={CHART_HEIGHT - 10}>
        {end}
      </text>
      <text textAnchor="end" x={CHART_WIDTH - 8} y={PADDING.top + 4}>
        {formatPercent(max)}
      </text>
      <text textAnchor="end" x={CHART_WIDTH - 8} y={CHART_HEIGHT - PADDING.bottom - 2}>
        {formatPercent(min)}
      </text>
    </g>
  );
}

function buildChartModel(series: ReturnSeries[]) {
  const dates = [...new Set(series.flatMap((item) => item.points.map((point) => point.time)))].sort();
  const values = series.flatMap((item) => item.points.map((point) => point.value));
  if (!dates.length || !values.length) return null;

  const rawMin = Math.min(...values, 0);
  const rawMax = Math.max(...values, 0);
  const span = Math.max(rawMax - rawMin, 0.08);
  const min = rawMin - span * 0.1;
  const max = rawMax + span * 0.1;
  const indexByDate = new Map(dates.map((date, index) => [date, index]));
  const xSpan = CHART_WIDTH - PADDING.left - PADDING.right;
  const ySpan = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const scaleX = (date: string) => {
    const index = indexByDate.get(date) ?? 0;
    return PADDING.left + (index / Math.max(dates.length - 1, 1)) * xSpan;
  };
  const scaleY = (value: number) => PADDING.top + ((max - value) / Math.max(max - min, 0.0001)) * ySpan;
  const yTicks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4).reverse();
  const pointByDateBySeries = series.map((item) => ({
    item,
    pointsByDate: new Map(item.points.map((point) => [point.time, point])),
  }));
  const paths = series.map((item, index) => ({
    id: item.id,
    color: item.color,
    primary: index === 0,
    d: item.points
      .map((point, pointIndex) => `${pointIndex === 0 ? 'M' : 'L'} ${scaleX(point.time)} ${scaleY(point.value)}`)
      .join(' '),
  }));

  return {
    firstDate: dates[0],
    lastDate: dates.at(-1) ?? dates[0],
    max,
    min,
    paths,
    scaleY,
    yTicks,
    hoverAt: (ratio: number): ChartHoverPoint => {
      const bounded = Math.max(0, Math.min(1, ratio));
      const dateIndex = Math.round(bounded * (dates.length - 1));
      const time = dates[dateIndex] ?? dates[0];
      const rows = pointByDateBySeries
        .map(({ item, pointsByDate }) => {
          const point = pointsByDate.get(time);
          return point ? { label: item.shortLabel ?? item.label, value: point.value, color: item.color } : null;
        })
        .filter((row): row is { label: string; value: number; color: string } => row !== null);
      const primary = rows[0];
      return {
        x: scaleX(time),
        y: scaleY(primary?.value ?? 0),
        time,
        rows,
      };
    },
  };
}
