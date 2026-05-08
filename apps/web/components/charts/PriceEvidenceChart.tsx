'use client';

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ITimeScaleApi,
  type AutoscaleInfoProvider,
  type MouseEventParams,
  type PriceFormatCustom,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPercent } from '@/lib/format';

type PricePoint = {
  time: string;
  value: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number | null;
};

type EvidenceMarker = {
  time: string;
  kind: 'publication' | 'target-hit' | 'peak' | 'trough';
  label: string;
  value?: number | null;
};

type OhlcState = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

type TooltipState = OhlcState & {
  x: number;
  y: number;
  targetPrice: number | null;
  targetGapPct: number | null;
};

type CandlePoint = { time: Time; open: number; high: number; low: number; close: number };
type VolumePoint = { time: Time; value: number; color: string };
type LinePoint = { time: Time; value: number };

type Props = {
  priceSeries: PricePoint[];
  targetPrice: number | null;
  entryPrice?: number | null;
  currency?: string;
  publicationDate: string;
  targetHitDate: string | null;
  expiryDate?: string | null;
  evidenceMarkers?: EvidenceMarker[];
};

type DragSelection = {
  fromTime: string;
  toTime: string;
  fromPrice: number;
  toPrice: number;
  fromX: number;
  toX: number;
};

const DEFAULT_VISIBLE_BARS_AROUND_PUB = { before: 22, after: 130 } as const; // ≈ 1mo before, 6mo after

export function PriceEvidenceChart({
  priceSeries,
  targetPrice,
  entryPrice = null,
  currency = 'KRW',
  publicationDate,
  targetHitDate,
  expiryDate = null,
  evidenceMarkers = [],
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const candleData = useMemo(() => priceSeries.map(toCandlePoint), [priceSeries]);
  const volumeData = useMemo(() => priceSeries.map(toVolumePoint), [priceSeries]);
  const movingAverageData = useMemo(
    () => ({
      ma20: toMovingAverageData(priceSeries, 20),
      ma60: toMovingAverageData(priceSeries, 60),
      ma200: toMovingAverageData(priceSeries, 200),
    }),
    [priceSeries],
  );
  const priceByTime = useMemo(() => new Map(priceSeries.map((point) => [point.time, point])), [priceSeries]);
  const maByTime = useMemo(() => buildMaByTime(movingAverageData), [movingAverageData]);
  const lastBar = useMemo(() => activeBarFromPoint(priceSeries.at(-1)), [priceSeries]);
  const [hoverBar, setHoverBar] = useState<OhlcState | null>(null);
  const lastMa = useMemo<MaValues>(
    () => maByTime.get(priceSeries.at(-1)?.time ?? '') ?? EMPTY_MA,
    [maByTime, priceSeries],
  );
  const [hoverMa, setHoverMa] = useState<MaValues>(EMPTY_MA);
  const activeBar = isCurrentHoverBar(hoverBar, priceByTime) ? hoverBar : lastBar;
  const activeMa = hoverBar ? hoverMa : lastMa;
  const [verticalLines, setVerticalLines] = useState<VerticalLineState>({ pub: null, expiry: null });
  const [drag, setDrag] = useState<DragSelection | null>(null);
  const dragStartRef = useRef<{ time: string; x: number; price: number } | null>(null);
  const chartMarkers = useMemo(
    () => buildMarkers(publicationDate, targetHitDate, evidenceMarkers),
    [evidenceMarkers, publicationDate, targetHitDate],
  );

  useEffect(() => {
    if (!ref.current || priceSeries.length === 0) return;
    const container = ref.current;
    const autoscaleInfoProvider: AutoscaleInfoProvider = (original) => {
      const info = original();
      if (!info?.priceRange) return info;
      const anchors = [
        info.priceRange.minValue,
        info.priceRange.maxValue,
        ...(isFinitePrice(targetPrice) ? [targetPrice] : []),
        ...(isFinitePrice(entryPrice) ? [entryPrice] : []),
      ];
      const minValue = Math.min(...anchors);
      const maxValue = Math.max(...anchors);
      const span = Math.max(maxValue - minValue, Math.abs(maxValue) * 0.02, Math.abs(minValue) * 0.02, 1);
      // Asset prices cannot go below 0 — clamp the lower padding so the y-axis
      // doesn't render a negative tick band.
      const paddedMin = Math.max(0, minValue - span * 0.04);
      return {
        ...info,
        priceRange: {
          minValue: paddedMin,
          maxValue: maxValue + span * 0.08,
        },
        margins: {
          above: Math.max(info.margins?.above ?? 0, 18),
          below: Math.max(info.margins?.below ?? 0, 18),
        },
      };
    };
    const chart: IChartApi = createChart(container, {
      autoSize: true,
      height: 560,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#4e5968',
        attributionLogo: true,
        panes: {
          separatorColor: '#edf1f5',
          separatorHoverColor: '#dbe4ef',
          enableResize: false,
        },
      },
      grid: { vertLines: { color: '#f1f3f6' }, horzLines: { color: '#f1f3f6' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#eaedf2',
        autoScale: true,
        alignLabels: true,
        minimumWidth: 82,
        ticksVisible: true,
        scaleMargins: { top: 0.1, bottom: 0.06 },
      },
      timeScale: { borderColor: '#eaedf2', timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8 },
    });

    const candleSeries: ISeriesApi<'Candlestick'> = chart.addSeries(CandlestickSeries, {
      upColor: '#16a368',
      downColor: '#ef4452',
      borderUpColor: '#16a368',
      borderDownColor: '#ef4452',
      wickUpColor: '#16a368',
      wickDownColor: '#ef4452',
      priceLineVisible: false,
      lastValueVisible: true,
      title: currency.toUpperCase(),
      priceFormat: priceFormatForCurrency(currency),
      autoscaleInfoProvider,
    });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.06 } });

    candleSeries.setData(candleData);

    // MA series: no right-axis title, no last-value label — legend is rendered
    // as a top-left HTML overlay (TradingView style).
    const ma20Series = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma20,
      lineWidth: 2,
      priceFormat: priceFormatForCurrency(currency),
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma20Series.setData(movingAverageData.ma20);

    const ma60Series = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma60,
      lineWidth: 2,
      priceFormat: priceFormatForCurrency(currency),
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma60Series.setData(movingAverageData.ma60);

    const ma200Series = chart.addSeries(LineSeries, {
      color: MA_COLORS.ma200,
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      priceFormat: priceFormatForCurrency(currency),
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma200Series.setData(movingAverageData.ma200);

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        color: 'rgba(49, 130, 246, 0.28)',
        priceFormat: { type: 'volume' },
        lastValueVisible: false,
        priceLineVisible: false,
        title: '거래량',
      },
      1,
    );
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.18, bottom: 0.06 }, ticksVisible: false });
    volumeSeries.setData(volumeData);
    chart.panes()[0]?.setHeight(450);
    chart.panes()[1]?.setHeight(110);

    if (isFinitePrice(targetPrice)) {
      candleSeries.createPriceLine({
        price: targetPrice,
        color: '#ef4452',
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '목표',
      });
    }
    if (isFinitePrice(entryPrice)) {
      candleSeries.createPriceLine({
        price: entryPrice,
        color: '#f29423',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: '발간',
      });
    }

    createSeriesMarkers(candleSeries, chartMarkers);

    let latestParams: MouseEventParams<Time> | null = null;
    const handleCrosshairMove = (params: MouseEventParams<Time>) => {
      latestParams = params;
      if (!params.point || !params.time || params.point.x < 0 || params.point.y < 0) {
        setTooltip(null);
        setHoverBar(null);
        setHoverMa(EMPTY_MA);
        if (dragStartRef.current) {
          // Mouse left the plot area mid-drag — keep the start point alive
          // (pointerup fires globally) but stop extending the selection.
        }
        return;
      }
      const time = String(params.time);
      const seriesData = params.seriesData.get(candleSeries);
      const fallback = priceByTime.get(time);
      const hoveredCandle = readCrosshairCandle(seriesData, fallback);
      if (!hoveredCandle) {
        setTooltip(null);
        setHoverBar(null);
        setHoverMa(EMPTY_MA);
        return;
      }
      const { open, high, low, close } = hoveredCandle;
      const targetGapPct = isFinitePrice(targetPrice) ? (targetPrice - close) / close : null;
      const nextBar = { time, open, high, low, close, volume: fallback?.volume ?? null };
      setHoverBar(nextBar);
      setHoverMa(maByTime.get(time) ?? EMPTY_MA);
      setTooltip({
        ...nextBar,
        x: Math.min(params.point.x + 16, Math.max(16, container.clientWidth - 240)),
        y: Math.max(12, params.point.y - 108),
        targetPrice,
        targetGapPct,
      });
      // Extend the active drag selection while the pointer is still down.
      if (dragStartRef.current) {
        const start = dragStartRef.current;
        const x = params.point.x;
        if (Math.abs(x - start.x) < 2) return;
        const fromX = Math.min(start.x, x);
        const toX = Math.max(start.x, x);
        const fromTime = start.x <= x ? start.time : time;
        const toTime = start.x <= x ? time : start.time;
        const fromPrice = priceByTime.get(fromTime)?.close ?? priceByTime.get(fromTime)?.value ?? start.price;
        const toPrice = priceByTime.get(toTime)?.close ?? priceByTime.get(toTime)?.value ?? close;
        setDrag({ fromTime, toTime, fromPrice, toPrice, fromX, toX });
      }
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    // Default zoom: pub - ~1mo to pub + ~6mo (B-3). Falls back to fitContent
    // when the publication date sits outside the available price series.
    const timeScale = chart.timeScale();
    const pubIndex = priceSeries.findIndex((point) => point.time >= publicationDate);
    if (pubIndex >= 0) {
      const fromIdx = Math.max(0, pubIndex - DEFAULT_VISIBLE_BARS_AROUND_PUB.before);
      const toIdx = Math.min(priceSeries.length - 1, pubIndex + DEFAULT_VISIBLE_BARS_AROUND_PUB.after);
      timeScale.setVisibleRange({
        from: priceSeries[fromIdx].time as Time,
        to: priceSeries[toIdx].time as Time,
      });
    } else {
      timeScale.fitContent();
    }

    // Vertical lines (B-1): pub date and expiry date overlays. We compute the
    // x-coordinate via timeToCoordinate and re-position on every visible-range
    // change so pan/zoom stays in sync. timeToCoordinate returns coordinates
    // relative to the canvas plot area; we hide the line when it falls
    // outside that area so it doesn't render against the legend or axis.
    const updateVerticalLines = () => {
      const width = container.clientWidth;
      const inside = (x: number | null) => (x !== null && x >= 0 && x <= width ? x : null);
      const pubX = inside(timeToCoordinateX(timeScale, publicationDate));
      const expiryX = expiryDate ? inside(timeToCoordinateX(timeScale, expiryDate)) : null;
      setVerticalLines({ pub: pubX, expiry: expiryX });
    };
    updateVerticalLines();
    timeScale.subscribeVisibleTimeRangeChange(updateVerticalLines);

    // Drag-to-measure (B-2). lightweight-charts owns mouse drag for panning
    // — we only intercept it when the user holds Shift to opt into a
    // measurement selection. Without Shift the chart pans as normal.
    const chartEl = chart.chartElement();
    const handlePointerDown = (event: PointerEvent) => {
      if (!event.shiftKey) return;
      const params = latestParams;
      if (!params?.time || !params.point) return;
      const time = String(params.time);
      const point = priceByTime.get(time);
      if (!point) return;
      event.preventDefault();
      dragStartRef.current = { time, x: params.point.x, price: point.close ?? point.value };
      setDrag(null);
      chart.applyOptions({ handleScroll: false, handleScale: false });
      chartEl.setPointerCapture?.(event.pointerId);
    };
    const finishDrag = () => {
      if (!dragStartRef.current) return;
      dragStartRef.current = null;
      chart.applyOptions({ handleScroll: true, handleScale: true });
    };
    chartEl.addEventListener('pointerdown', handlePointerDown);
    chartEl.addEventListener('pointerup', finishDrag);
    chartEl.addEventListener('pointercancel', finishDrag);
    chartEl.addEventListener('pointerleave', finishDrag);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      timeScale.unsubscribeVisibleTimeRangeChange(updateVerticalLines);
      chartEl.removeEventListener('pointerdown', handlePointerDown);
      chartEl.removeEventListener('pointerup', finishDrag);
      chartEl.removeEventListener('pointercancel', finishDrag);
      chartEl.removeEventListener('pointerleave', finishDrag);
      chart.remove();
    };
  }, [
    candleData,
    chartMarkers,
    currency,
    entryPrice,
    expiryDate,
    maByTime,
    movingAverageData,
    priceByTime,
    priceSeries,
    publicationDate,
    targetPrice,
    volumeData,
  ]);

  if (priceSeries.length === 0) {
    return (
      <div className="rounded-box border border-base-300 bg-base-100 p-5 text-sm text-base-content/65 shadow-sm">
        이 리포트 종목의 가격 경로를 찾을 수 없습니다.
      </div>
    );
  }
  const dragReturnPct = drag && drag.fromPrice ? drag.toPrice / drag.fromPrice - 1 : null;
  return (
    <div className="chart-shell relative">
      {activeBar ? <OhlcLegend bar={activeBar} ma={activeMa} currency={currency} targetPrice={targetPrice} /> : null}
      <div
        ref={ref}
        className="chart-box chart-box-fixed relative"
        aria-label="목표가 기준선, OHLC 캔들, 거래량, 발간·만료·목표도달·고점·저점 마커가 포함된 가격 경로"
      />
      {verticalLines.pub !== null ? (
        <VerticalLine x={verticalLines.pub} color="#f29423" label="발간" position="top" />
      ) : null}
      {verticalLines.expiry !== null ? (
        <VerticalLine x={verticalLines.expiry} color="#ef4452" label="만료" position="top" dashed />
      ) : null}
      {drag ? (
        <div
          className="pointer-events-none absolute top-0 bottom-0 bg-primary/10 ring-1 ring-primary/30"
          style={{ left: drag.fromX, width: Math.max(1, drag.toX - drag.fromX) }}
        >
          {dragReturnPct !== null ? (
            <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-md bg-base-100/95 px-2 py-1 text-xs font-semibold shadow-md">
              <span className={dragReturnPct >= 0 ? 'text-success' : 'text-error'}>
                {dragReturnPct >= 0 ? '+' : ''}
                {formatPercent(dragReturnPct)}
              </span>
              <span className="ml-2 text-base-content/55">
                {drag.fromTime} → {drag.toTime}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-md bg-base-100/85 px-2 py-1 text-[10px] text-base-content/55 shadow-sm">
        Shift+드래그 → 구간 수익률
      </div>
      {tooltip ? (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tooltip-date">{tooltip.time}</div>
          <div>
            O {formatChartPrice(tooltip.open, currency)} · H {formatChartPrice(tooltip.high, currency)}
          </div>
          <div>
            L {formatChartPrice(tooltip.low, currency)} · C {formatChartPrice(tooltip.close, currency)}
          </div>
          <div>거래량 {formatVolume(tooltip.volume)}</div>
          <div>목표가 {formatChartPrice(tooltip.targetPrice, currency)}</div>
          <div className={tooltip.targetGapPct !== null && tooltip.targetGapPct <= 0 ? 'good' : 'warn'}>
            목표까지 {formatPercent(tooltip.targetGapPct)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type MarkerStyle = { color: string; position: 'aboveBar' | 'belowBar'; shape: 'arrowUp' | 'arrowDown' | 'circle' };

function toCandlePoint(point: PricePoint): CandlePoint {
  const close = point.close ?? point.value;
  return {
    time: point.time as Time,
    open: point.open ?? close,
    high: point.high ?? close,
    low: point.low ?? close,
    close,
  };
}

function toVolumePoint(point: PricePoint): VolumePoint {
  const close = point.close ?? point.value;
  const open = point.open ?? close;
  return {
    time: point.time as Time,
    value: Math.max(0, point.volume ?? 0),
    color: close >= open ? 'rgba(22, 163, 104, 0.32)' : 'rgba(239, 68, 82, 0.30)',
  };
}

function toMovingAverageData(points: PricePoint[], window: number): LinePoint[] {
  const output: LinePoint[] = [];
  const closes: number[] = [];
  for (const point of points) {
    const close = point.close ?? point.value;
    closes.push(close);
    if (closes.length < window) continue;
    const slice = closes.slice(-window);
    const average = slice.reduce((sum, value) => sum + value, 0) / window;
    output.push({ time: point.time as Time, value: average });
  }
  return output;
}

function OhlcLegend({
  bar,
  ma,
  currency,
  targetPrice,
}: {
  bar: OhlcState;
  ma: MaValues;
  currency: string;
  targetPrice: number | null;
}) {
  const change = bar.close - bar.open;
  const changePct = bar.open !== 0 ? change / bar.open : null;
  const gapPct = isFinitePrice(targetPrice) && bar.close !== 0 ? (targetPrice - bar.close) / bar.close : null;
  const tone = change >= 0 ? 'good' : 'bad';
  return (
    <div className="chart-legend" aria-live="polite">
      <div className="chart-legend-main">
        <span className="legend-symbol">{currency.toUpperCase()} OHLC</span>
        <span>{bar.time}</span>
      </div>
      <div className="chart-legend-values">
        <span>O {formatChartPrice(bar.open, currency)}</span>
        <span>H {formatChartPrice(bar.high, currency)}</span>
        <span>L {formatChartPrice(bar.low, currency)}</span>
        <span>C {formatChartPrice(bar.close, currency)}</span>
        <span className={tone}>
          {formatChartPrice(change, currency)} ({formatPercent(changePct)})
        </span>
        <span>Vol {formatVolume(bar.volume)}</span>
        <span>
          목표 {formatChartPrice(targetPrice, currency)} · Gap {formatPercent(gapPct)}
        </span>
      </div>
      <div className="chart-legend-values">
        <span style={{ color: MA_COLORS.ma20 }}>
          MA20 {ma.ma20 !== null ? formatChartPrice(ma.ma20, currency) : '—'}
        </span>
        <span style={{ color: MA_COLORS.ma60 }}>
          MA60 {ma.ma60 !== null ? formatChartPrice(ma.ma60, currency) : '—'}
        </span>
        <span style={{ color: MA_COLORS.ma200 }}>
          MA200 {ma.ma200 !== null ? formatChartPrice(ma.ma200, currency) : '—'}
        </span>
      </div>
    </div>
  );
}

function priceFormatForCurrency(currency: string): PriceFormatCustom {
  const minMove = 10 ** -currencyDigits(currency);
  return {
    type: 'custom',
    minMove,
    formatter: (price) => formatChartPrice(Number(price), currency),
    tickmarksFormatter: (prices) => prices.map((price) => formatChartPrice(Number(price), currency)),
  };
}

function buildMarkers(
  publicationDate: string,
  targetHitDate: string | null,
  evidenceMarkers: EvidenceMarker[],
): SeriesMarker<Time>[] {
  const markerByKey = new Map<string, SeriesMarker<Time>>();
  const addMarker = (marker: SeriesMarker<Time>) => markerByKey.set(`${String(marker.time)}-${marker.text}`, marker);
  addMarker({ time: publicationDate as Time, position: 'belowBar', color: '#f29423', shape: 'arrowUp', text: '발간' });
  if (targetHitDate) {
    addMarker({
      time: targetHitDate as Time,
      position: 'aboveBar',
      color: '#16a368',
      shape: 'circle',
      text: '목표 도달',
    });
  }
  for (const marker of evidenceMarkers) {
    const markerConfig = markerStyle(marker);
    addMarker({
      time: marker.time as Time,
      position: markerConfig.position,
      color: markerConfig.color,
      shape: markerConfig.shape,
      text: marker.label,
    });
  }
  return [...markerByKey.values()].sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

function isCurrentHoverBar(bar: OhlcState | null, priceByTime: Map<string, PricePoint>): bar is OhlcState {
  if (!bar) return false;
  const current = priceByTime.get(bar.time);
  const close = current?.close ?? current?.value;
  return isFinitePrice(close) && close === bar.close;
}

function activeBarFromPoint(point: PricePoint | undefined): OhlcState | null {
  if (!point) return null;
  const candle = readCrosshairCandle(undefined, point);
  if (!candle) return null;
  return { time: point.time, ...candle, volume: point.volume ?? null };
}

function readCrosshairCandle(seriesData: unknown, fallback: PricePoint | undefined): Omit<CandlePoint, 'time'> | null {
  const closeRaw = isObjectWithNumber(seriesData, 'close')
    ? Number(seriesData.close)
    : (fallback?.close ?? fallback?.value);
  const openRaw = isObjectWithNumber(seriesData, 'open') ? Number(seriesData.open) : (fallback?.open ?? closeRaw);
  const highRaw = isObjectWithNumber(seriesData, 'high') ? Number(seriesData.high) : (fallback?.high ?? closeRaw);
  const lowRaw = isObjectWithNumber(seriesData, 'low') ? Number(seriesData.low) : (fallback?.low ?? closeRaw);
  if (closeRaw === undefined || openRaw === undefined || highRaw === undefined || lowRaw === undefined) return null;
  if (!Number.isFinite(closeRaw) || !Number.isFinite(openRaw) || !Number.isFinite(highRaw) || !Number.isFinite(lowRaw))
    return null;
  return { open: openRaw, high: highRaw, low: lowRaw, close: closeRaw };
}

function isObjectWithNumber(
  value: unknown,
  key: 'open' | 'high' | 'low' | 'close',
): value is Record<typeof key, number> {
  return (
    typeof value === 'object' &&
    value !== null &&
    key in value &&
    Number.isFinite(Number((value as Record<typeof key, unknown>)[key]))
  );
}

function markerStyle(marker: EvidenceMarker): MarkerStyle {
  switch (marker.kind) {
    case 'target-hit':
      return { color: '#16a368', position: 'aboveBar', shape: 'circle' };
    case 'peak':
      return { color: '#3182f6', position: 'aboveBar', shape: 'arrowDown' };
    case 'trough':
      return { color: '#ef4452', position: 'belowBar', shape: 'arrowUp' };
    default:
      return { color: '#f29423', position: 'belowBar', shape: 'arrowUp' };
  }
}

function isFinitePrice(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function currencyDigits(currency: string): number {
  const code = currency.toUpperCase();
  if (code === 'KRW' || code === 'JPY') return 0;
  return 2;
}

function formatChartPrice(value: number | null | undefined, currency: string): string {
  if (!isFinitePrice(value)) return '—';
  const code = currency.toUpperCase();
  const symbol = currencySymbol(code);
  const digits = currencyDigits(code);
  return `${symbol}${value.toLocaleString(code === 'KRW' ? 'ko-KR' : 'en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function currencySymbol(code: string): string {
  switch (code) {
    case 'KRW':
      return '₩';
    case 'USD':
      return '$';
    case 'JPY':
    case 'CNY':
      return '¥';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'HKD':
      return 'HK$';
    case 'CAD':
      return 'C$';
    case 'AUD':
      return 'A$';
    case 'CHF':
      return 'CHF ';
    default:
      return `${code} `;
  }
}

function formatVolume(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1_000_000_000)
    return `${(value / 1_000_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}B`;
  if (Math.abs(value) >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}K`;
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

const MA_COLORS = { ma20: '#1b64da', ma60: '#7d6bff', ma200: '#f29423' } as const;

type MaValues = { ma20: number | null; ma60: number | null; ma200: number | null };
const EMPTY_MA: MaValues = { ma20: null, ma60: null, ma200: null };

type VerticalLineState = { pub: number | null; expiry: number | null };

function buildMaByTime(data: { ma20: LinePoint[]; ma60: LinePoint[]; ma200: LinePoint[] }): Map<string, MaValues> {
  const result = new Map<string, MaValues>();
  const insert = (key: keyof MaValues, points: LinePoint[]) => {
    for (const point of points) {
      const time = String(point.time);
      const existing = result.get(time) ?? { ...EMPTY_MA };
      existing[key] = point.value;
      result.set(time, existing);
    }
  };
  insert('ma20', data.ma20);
  insert('ma60', data.ma60);
  insert('ma200', data.ma200);
  return result;
}

function timeToCoordinateX(timeScale: ITimeScaleApi<Time>, time: string): number | null {
  const coord = timeScale.timeToCoordinate(time as Time);
  return coord !== null && Number.isFinite(coord) ? Number(coord) : null;
}

function VerticalLine({
  x,
  color,
  label,
  position,
  dashed = false,
}: {
  x: number;
  color: string;
  label: string;
  position: 'top' | 'bottom';
  dashed?: boolean;
}) {
  return (
    <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: x - 0.5, width: 1 }} aria-hidden="true">
      <div
        className="h-full w-px"
        style={{
          backgroundColor: color,
          backgroundImage: dashed ? `linear-gradient(to bottom, ${color} 50%, transparent 50%)` : undefined,
          backgroundSize: dashed ? '1px 6px' : undefined,
          backgroundRepeat: dashed ? 'repeat-y' : undefined,
        }}
      />
      <span
        className={`absolute ${position === 'top' ? 'top-1' : 'bottom-1'} -translate-x-1/2 rounded-sm px-1 py-0.5 text-[10px] font-bold text-white shadow-sm`}
        style={{ left: 0, backgroundColor: color }}
      >
        {label}
      </span>
    </div>
  );
}
