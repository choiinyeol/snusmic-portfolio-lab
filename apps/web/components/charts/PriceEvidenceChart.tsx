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
  evidenceMarkers?: EvidenceMarker[];
};

export function PriceEvidenceChart({
  priceSeries,
  targetPrice,
  entryPrice = null,
  currency = 'KRW',
  publicationDate,
  targetHitDate,
  evidenceMarkers = [],
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const candleData = useMemo(() => priceSeries.map(toCandlePoint), [priceSeries]);
  const volumeData = useMemo(() => priceSeries.map(toVolumePoint), [priceSeries]);
  const movingAverageData = useMemo(() => ({
    ma20: toMovingAverageData(priceSeries, 20),
    ma60: toMovingAverageData(priceSeries, 60),
    ma200: toMovingAverageData(priceSeries, 200),
  }), [priceSeries]);
  const priceByTime = useMemo(() => new Map(priceSeries.map((point) => [point.time, point])), [priceSeries]);
  const lastBar = useMemo(() => activeBarFromPoint(priceSeries.at(-1)), [priceSeries]);
  const [hoverBar, setHoverBar] = useState<OhlcState | null>(null);
  const activeBar = isCurrentHoverBar(hoverBar, priceByTime) ? hoverBar : lastBar;
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
      const paddedMin = minValue >= 0 ? Math.max(0, minValue - span * 0.04) : minValue - span * 0.04;
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
        scaleMargins: { top: 0.10, bottom: 0.06 },
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
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.10, bottom: 0.06 } });

    candleSeries.setData(candleData);

    const ma20Series = chart.addSeries(LineSeries, {
      color: '#1b64da',
      lineWidth: 2,
      title: 'MA20',
      priceFormat: priceFormatForCurrency(currency),
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma20Series.setData(movingAverageData.ma20);

    const ma60Series = chart.addSeries(LineSeries, {
      color: '#7d6bff',
      lineWidth: 2,
      title: 'MA60',
      priceFormat: priceFormatForCurrency(currency),
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma60Series.setData(movingAverageData.ma60);

    const ma200Series = chart.addSeries(LineSeries, {
      color: '#f29423',
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      title: 'MA200',
      priceFormat: priceFormatForCurrency(currency),
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ma200Series.setData(movingAverageData.ma200);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: 'rgba(49, 130, 246, 0.28)',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
      title: '거래량',
    }, 1);
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

    const handleCrosshairMove = (params: MouseEventParams<Time>) => {
      if (!params.point || !params.time || params.point.x < 0 || params.point.y < 0) {
        setTooltip(null);
        setHoverBar(null);
        return;
      }
      const time = String(params.time);
      const seriesData = params.seriesData.get(candleSeries);
      const fallback = priceByTime.get(time);
      const hoveredCandle = readCrosshairCandle(seriesData, fallback);
      if (!hoveredCandle) {
        setTooltip(null);
        setHoverBar(null);
        return;
      }
      const { open, high, low, close } = hoveredCandle;
      const targetGapPct = isFinitePrice(targetPrice) ? (targetPrice - close) / close : null;
      const nextBar = { time, open, high, low, close, volume: fallback?.volume ?? null };
      setHoverBar(nextBar);
      setTooltip({
        ...nextBar,
        x: Math.min(params.point.x + 16, Math.max(16, container.clientWidth - 240)),
        y: Math.max(12, params.point.y - 108),
        targetPrice,
        targetGapPct,
      });
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().fitContent();
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
    };
  }, [candleData, chartMarkers, currency, entryPrice, movingAverageData, priceByTime, priceSeries.length, targetPrice, volumeData]);

  if (priceSeries.length === 0) {
    return <div className="panel chart-box">이 리포트 종목의 가격 경로를 찾을 수 없습니다.</div>;
  }
  return (
    <div className="chart-shell">
      {activeBar ? <OhlcLegend bar={activeBar} currency={currency} targetPrice={targetPrice} /> : null}
      <div ref={ref} className="chart-box chart-box-fixed" aria-label="목표가 기준선, OHLC 캔들, 거래량, 발간·목표도달·고점·저점 마커가 포함된 가격 경로" />
      {tooltip ? (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tooltip-date">{tooltip.time}</div>
          <div>O {formatChartPrice(tooltip.open, currency)} · H {formatChartPrice(tooltip.high, currency)}</div>
          <div>L {formatChartPrice(tooltip.low, currency)} · C {formatChartPrice(tooltip.close, currency)}</div>
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

function OhlcLegend({ bar, currency, targetPrice }: { bar: OhlcState; currency: string; targetPrice: number | null }) {
  const change = bar.close - bar.open;
  const changePct = bar.open !== 0 ? change / bar.open : null;
  const gapPct = isFinitePrice(targetPrice) && bar.close !== 0 ? (targetPrice - bar.close) / bar.close : null;
  const tone = change >= 0 ? 'good' : 'bad';
  return (
    <div className="chart-legend" aria-live="polite">
      <div className="chart-legend-main">
        <span className="legend-symbol">{currency.toUpperCase()} OHLC</span>
        <span>{bar.time}</span>
        <span className="legend-ma">MA20·60·200</span>
      </div>
      <div className="chart-legend-values">
        <span>O {formatChartPrice(bar.open, currency)}</span>
        <span>H {formatChartPrice(bar.high, currency)}</span>
        <span>L {formatChartPrice(bar.low, currency)}</span>
        <span>C {formatChartPrice(bar.close, currency)}</span>
        <span className={tone}>{formatChartPrice(change, currency)} ({formatPercent(changePct)})</span>
        <span>Vol {formatVolume(bar.volume)}</span>
        <span>목표 {formatChartPrice(targetPrice, currency)} · Gap {formatPercent(gapPct)}</span>
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


function buildMarkers(publicationDate: string, targetHitDate: string | null, evidenceMarkers: EvidenceMarker[]): SeriesMarker<Time>[] {
  const markerByKey = new Map<string, SeriesMarker<Time>>();
  const addMarker = (marker: SeriesMarker<Time>) => markerByKey.set(`${String(marker.time)}-${marker.text}`, marker);
  addMarker({ time: publicationDate as Time, position: 'belowBar', color: '#f29423', shape: 'arrowUp', text: '발간' });
  if (targetHitDate) {
    addMarker({ time: targetHitDate as Time, position: 'aboveBar', color: '#16a368', shape: 'circle', text: '목표 도달' });
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
  const closeRaw = isObjectWithNumber(seriesData, 'close') ? Number(seriesData.close) : (fallback?.close ?? fallback?.value);
  const openRaw = isObjectWithNumber(seriesData, 'open') ? Number(seriesData.open) : (fallback?.open ?? closeRaw);
  const highRaw = isObjectWithNumber(seriesData, 'high') ? Number(seriesData.high) : (fallback?.high ?? closeRaw);
  const lowRaw = isObjectWithNumber(seriesData, 'low') ? Number(seriesData.low) : (fallback?.low ?? closeRaw);
  if (closeRaw === undefined || openRaw === undefined || highRaw === undefined || lowRaw === undefined) return null;
  if (!Number.isFinite(closeRaw) || !Number.isFinite(openRaw) || !Number.isFinite(highRaw) || !Number.isFinite(lowRaw)) return null;
  return { open: openRaw, high: highRaw, low: lowRaw, close: closeRaw };
}

function isObjectWithNumber(value: unknown, key: 'open' | 'high' | 'low' | 'close'): value is Record<typeof key, number> {
  return typeof value === 'object' && value !== null && key in value && Number.isFinite(Number((value as Record<typeof key, unknown>)[key]));
}

function markerStyle(marker: EvidenceMarker): MarkerStyle {
  switch (marker.kind) {
    case 'target-hit':
      return { color: '#16a368', position: 'aboveBar', shape: 'circle' };
    case 'peak':
      return { color: '#3182f6', position: 'aboveBar', shape: 'arrowDown' };
    case 'trough':
      return { color: '#ef4452', position: 'belowBar', shape: 'arrowUp' };
    case 'publication':
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
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}K`;
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}
