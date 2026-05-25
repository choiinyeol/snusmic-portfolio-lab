'use client';

import {
  ColorType,
  CrosshairMode,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EquityPoint, TradeRow } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';
import { tradeDisplayName } from '../helpers';

type Tooltip = {
  x: number;
  y: number;
  date: string;
  equityKrw: number | null;
  returnPct: number | null;
  trades: TradeRow[];
  comparisonRows: Array<{ label: string; value: number; color: string }>;
};

type Props = {
  equity: EquityPoint[];
  trades: TradeRow[];
  account_id: string;
  label: string;
  benchmarkAccounts?: string[];
  accountLabels?: Record<string, string>;
  height?: number;
};

const BENCHMARK_COLORS = ['#64748b', '#94a3b8', '#a855f7', '#f59e0b'];

export function PortfolioEquityTradeChart({
  equity,
  trades,
  account_id,
  label,
  benchmarkAccounts = [],
  accountLabels = {},
  height = 420,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [showTradeMarkers, setShowTradeMarkers] = useState(false);
  const [enabledBenchmarkIds, setEnabledBenchmarkIds] = useState<Set<string>>(new Set());
  const accountEquity = useMemo(
    () => equity.filter((row) => row.account_id === account_id).sort((a, b) => a.date.localeCompare(b.date)),
    [equity, account_id],
  );
  const accountTrades = useMemo(
    () => trades.filter((row) => row.account_id === account_id).sort((a, b) => a.date.localeCompare(b.date)),
    [trades, account_id],
  );
  const tradesByDate = useMemo(() => groupTradesByDate(accountTrades), [accountTrades]);
  const lineData = useMemo(
    () =>
      accountEquity
        .filter((row) => row.cumulativeReturn !== null)
        .map((row) => ({ time: row.date as Time, value: (row.cumulativeReturn ?? 0) * 100 })),
    [accountEquity],
  );
  const benchmarkSeries = useMemo(
    () =>
      benchmarkAccounts
        .map((benchmarkAccount, index) => ({
          account_id: benchmarkAccount,
          label: accountLabels[benchmarkAccount] ?? benchmarkAccount,
          color: BENCHMARK_COLORS[index % BENCHMARK_COLORS.length],
          points: equity
            .filter((row) => row.account_id === benchmarkAccount && row.cumulativeReturn !== null)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((row) => ({ time: row.date as Time, value: (row.cumulativeReturn ?? 0) * 100 })),
        }))
        .filter((series) => series.points.length),
    [benchmarkAccounts, equity, accountLabels],
  );
  const benchmarkIds = useMemo(() => benchmarkSeries.map((series) => series.account_id), [benchmarkSeries]);
  const selectedBenchmarkSeries = useMemo(
    () =>
      enabledBenchmarkIds.size
        ? benchmarkSeries.filter((series) => enabledBenchmarkIds.has(series.account_id))
        : benchmarkSeries,
    [benchmarkSeries, enabledBenchmarkIds],
  );
  const equityByDate = useMemo(() => new Map(accountEquity.map((row) => [row.date, row])), [accountEquity]);
  const markers = useMemo(() => buildTradeMarkers(accountTrades), [accountTrades]);

  useEffect(() => {
    setEnabledBenchmarkIds((current) => {
      if (!current.size) return current;
      const available = new Set(benchmarkIds);
      const next = new Set([...current].filter((id) => available.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [benchmarkIds]);

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
    const apiByLabel = new Map<ISeriesApi<'Line'>, { label: string; color: string }>([
      [line, { label, color: '#111827' }],
    ]);
    for (const benchmark of selectedBenchmarkSeries) {
      const benchmarkLine = chart.addSeries(LineSeries, {
        color: benchmark.color,
        lineWidth: 1,
        priceFormat: { type: 'percent', precision: 2, minMove: 0.01 },
        priceLineVisible: false,
        lastValueVisible: false,
        title: benchmark.label,
      });
      benchmarkLine.setData(benchmark.points);
      apiByLabel.set(benchmarkLine, { label: benchmark.label, color: benchmark.color });
    }
    createSeriesMarkers(line, showTradeMarkers ? markers : []);
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
      const comparisonRows = [...apiByLabel.entries()]
        .map(([api, meta]) => {
          const datum = params.seriesData.get(api);
          if (typeof datum !== 'object' || !datum || !('value' in datum)) return null;
          const value = Number(datum.value);
          if (!Number.isFinite(value)) return null;
          return { label: meta.label, value: value / 100, color: meta.color };
        })
        .filter((row): row is { label: string; value: number; color: string } => Boolean(row));
      setTooltip({
        x: Math.min(params.point.x + 16, Math.max(16, container.clientWidth - 260)),
        y: Math.max(12, params.point.y - 132),
        date,
        equityKrw: point.equityKrw,
        returnPct: point.cumulativeReturn,
        trades: tradesByDate.get(date) ?? [],
        comparisonRows,
      });
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().fitContent();
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
    };
  }, [equityByDate, height, label, lineData, markers, selectedBenchmarkSeries, showTradeMarkers, tradesByDate]);

  if (!lineData.length) {
    return <div className="chart-box empty-chart">계좌 손익 경로 데이터가 없습니다.</div>;
  }

  return (
    <div className="chart-shell relative">
      <div className="mb-2 flex flex-wrap gap-2 px-1 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-950">
          <span className="h-2 w-2 rounded-full bg-slate-950" />
          {label}
        </span>
        {benchmarkSeries.map((series) => (
          <button
            aria-pressed={!enabledBenchmarkIds.size || enabledBenchmarkIds.has(series.account_id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
              !enabledBenchmarkIds.size || enabledBenchmarkIds.has(series.account_id)
                ? 'bg-slate-100 text-slate-950'
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
            }`}
            key={series.account_id}
            onClick={() => {
              setEnabledBenchmarkIds((current) => {
                const next = current.size ? new Set(current) : new Set(benchmarkIds);
                if (next.has(series.account_id) && next.size > 1) next.delete(series.account_id);
                else next.add(series.account_id);
                return next;
              });
            }}
            type="button"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />
            {series.label}
          </button>
        ))}
        <button
          aria-pressed={showTradeMarkers}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
            showTradeMarkers ? 'bg-slate-100 text-slate-950' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
          }`}
          onClick={() => setShowTradeMarkers((value) => !value)}
          type="button"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          매수
          <span className="h-2 w-2 rounded-full bg-rose-600" />
          매도
        </button>
        {!showTradeMarkers && markers.length ? (
          <span className="inline-flex items-center gap-1.5 px-1 py-1 text-slate-400">
            {markers.length.toLocaleString('ko-KR')}개 마커 숨김
          </span>
        ) : null}
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
          {tooltip.comparisonRows.length ? (
            <div className="mt-1 grid gap-0.5 border-t border-slate-100 pt-1">
              {tooltip.comparisonRows.map((row) => (
                <div key={row.label} style={{ color: row.color }}>
                  {row.label}: {formatPercent(row.value)}
                </div>
              ))}
            </div>
          ) : null}
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
          {sideLabel} {tradeDisplayName(trade.symbol, trade.company)}
        </span>
        <span className="font-mono tabular-nums text-slate-950">{formatKrw(trade.grossKrw)}</span>
      </div>
      <div className="truncate text-[11px] text-slate-500">
        {trade.qty?.toLocaleString('ko-KR') ?? '-'}주 · {trade.reason || '기록된 사유 없음'}
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
      text: row.count > 1 ? `${row.count}` : '',
    }))
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
}
