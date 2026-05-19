'use client';

import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EquityPoint, TradeRow } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';

type Tooltip = {
  x: number;
  y: number;
  date: string;
  equityKrw: number | null;
  returnPct: number | null;
  trades: TradeRow[];
};

type Props = {
  equity: EquityPoint[];
  trades: TradeRow[];
  persona: string;
  label: string;
  height?: number;
};

export function PortfolioEquityTradeChart({ equity, trades, persona, label, height = 420 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const personaEquity = useMemo(
    () => equity.filter((row) => row.persona === persona).sort((a, b) => a.date.localeCompare(b.date)),
    [equity, persona],
  );
  const personaTrades = useMemo(
    () => trades.filter((row) => row.persona === persona).sort((a, b) => a.date.localeCompare(b.date)),
    [trades, persona],
  );
  const tradesByDate = useMemo(() => groupTradesByDate(personaTrades), [personaTrades]);
  const lineData = useMemo(
    () =>
      personaEquity
        .filter((row) => row.cumulativeReturn !== null)
        .map((row) => ({ time: row.date as Time, value: (row.cumulativeReturn ?? 0) * 100 })),
    [personaEquity],
  );
  const equityByDate = useMemo(() => new Map(personaEquity.map((row) => [row.date, row])), [personaEquity]);
  const markers = useMemo(() => buildTradeMarkers(personaTrades), [personaTrades]);

  useEffect(() => {
    if (!ref.current || !lineData.length) return;
    const container = ref.current;
    const chart = createChart(container, {
      autoSize: true,
      height,
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#4e5968', attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: '#f4f6f9' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#eaedf2', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: '#eaedf2', timeVisible: true, secondsVisible: false, rightOffset: 8 },
    });
    const line = chart.addSeries(LineSeries, {
      color: '#111827',
      lineWidth: 2,
      priceFormat: { type: 'percent', precision: 2, minMove: 0.01 },
      priceLineVisible: false,
      lastValueVisible: false,
      title: label,
    });
    line.setData(lineData);
    createSeriesMarkers(line, markers);
    const handleCrosshairMove = (params: MouseEventParams<Time>) => {
      if (!params.point || !params.time || params.point.x < 0 || params.point.y < 0) {
        setTooltip(null);
        return;
      }
      const date = String(params.time);
      const point = equityByDate.get(date);
      if (!point) {
        setTooltip(null);
        return;
      }
      setTooltip({
        x: Math.min(params.point.x + 16, Math.max(16, container.clientWidth - 260)),
        y: Math.max(12, params.point.y - 132),
        date,
        equityKrw: point.equityKrw,
        returnPct: point.cumulativeReturn,
        trades: tradesByDate.get(date) ?? [],
      });
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().fitContent();
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
    };
  }, [equityByDate, height, label, lineData, markers, tradesByDate]);

  if (!lineData.length) {
    return <div className="chart-box empty-chart">포트폴리오 손익 경로 데이터가 없습니다.</div>;
  }

  return (
    <div className="chart-shell relative">
      <div className="mb-2 flex flex-wrap gap-3 px-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-950" />
          누적 수익률
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          매수
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-rose-600" />
          매도
        </span>
      </div>
      <div
        ref={ref}
        className="chart-box chart-box-fixed"
        style={{ height }}
        aria-label={`${label} 누적 손익 및 매매 마커`}
      />
      {tooltip ? (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tooltip-date">{tooltip.date}</div>
          <div>평가액 {formatKrw(tooltip.equityKrw)}</div>
          <div>누적 {formatPercent(tooltip.returnPct)}</div>
          {tooltip.trades.length ? (
            <div className="mt-1 grid gap-1 border-t border-slate-100 pt-1">
              {tooltip.trades.slice(0, 3).map((trade) => (
                <TradeTooltipLine key={`${trade.date}-${trade.symbol}-${trade.side}-${trade.qty}`} trade={trade} />
              ))}
              {tooltip.trades.length > 3 ? (
                <div className="text-slate-400">외 {tooltip.trades.length - 3}건</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TradeTooltipLine({ trade }: { trade: TradeRow }) {
  const sideLabel = trade.side === 'sell' ? '매도' : '매수';
  const sideClass = trade.side === 'sell' ? 'text-rose-600' : 'text-emerald-600';
  return (
    <div className="grid gap-0.5">
      <div className="flex items-center justify-between gap-3">
        <span className={`font-semibold ${sideClass}`}>
          {sideLabel} {trade.symbol}
        </span>
        <span className="font-mono tabular-nums text-slate-950">{formatKrw(trade.grossKrw)}</span>
      </div>
      <div className="truncate text-[11px] text-slate-500">
        {trade.qty?.toLocaleString('ko-KR') ?? '—'}주 · {trade.reason || '기록된 사유 없음'}
      </div>
    </div>
  );
}

function groupTradesByDate(trades: TradeRow[]): Map<string, TradeRow[]> {
  const map = new Map<string, TradeRow[]>();
  for (const trade of trades) {
    const group = map.get(trade.date) ?? [];
    group.push(trade);
    map.set(trade.date, group);
  }
  return map;
}

function buildTradeMarkers(trades: TradeRow[]): SeriesMarker<Time>[] {
  const byDateSide = new Map<string, { date: string; side: 'buy' | 'sell'; count: number; grossKrw: number }>();
  for (const trade of trades) {
    if (trade.side !== 'buy' && trade.side !== 'sell') continue;
    const key = `${trade.date}-${trade.side}`;
    const current = byDateSide.get(key) ?? { date: trade.date, side: trade.side, count: 0, grossKrw: 0 };
    current.count += 1;
    current.grossKrw += Math.abs(trade.grossKrw ?? 0);
    byDateSide.set(key, current);
  }
  return [...byDateSide.values()]
    .map((row) => ({
      time: row.date as Time,
      position: row.side === 'buy' ? ('belowBar' as const) : ('aboveBar' as const),
      color: row.side === 'buy' ? '#16a368' : '#ef4452',
      shape: row.side === 'buy' ? ('arrowUp' as const) : ('arrowDown' as const),
      text: `${row.side === 'buy' ? '매수' : '매도'}${row.count > 1 ? ` ${row.count}` : ''} · ${formatCompactKrw(row.grossKrw)}`,
    }))
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

function formatCompactKrw(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000) return `${Math.round(value / 10_000).toLocaleString('ko-KR')}만`;
  return value.toLocaleString('ko-KR');
}
