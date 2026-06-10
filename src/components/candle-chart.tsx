"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { useTheme } from "@/components/theme-provider";
import { schoolShort } from "@/lib/verdict";
import type { School } from "@/lib/report-model";

export type Candle = { time: string; open: number; high: number; low: number; close: number; volume: number };
export type ReportMark = {
  sourceName: string;
  school: School;
  date: string;
  targetPrice: number | null;
};

/** 테마 토큰을 실제 색으로 — 차트는 CSS 변수를 직접 못 읽는다 */
function cssHsl(variable: string, alpha?: number) {
  if (typeof window === "undefined") return "#888888";
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!value) return "#888888";
  return alpha !== undefined ? `hsl(${value} / ${alpha})` : `hsl(${value})`;
}

/** 학회별 마커 잉크 — 발간 시점을 차트에 찍는다 */
const SCHOOL_VARS: Record<School, string> = {
  smic: "--stamp",
  yig: "--down",
  star: "--warn",
  kuvic: "--quality",
};

/** 리포트 발간일을 실제 캔들 시간축에 맞춘다 (주봉 구간 대응) */
function snapToCandle(date: string, times: string[]) {
  let lo = 0;
  let hi = times.length - 1;
  if (date <= times[0]) return times[0];
  if (date >= times[hi]) return times[hi];
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < date) lo = mid + 1;
    else hi = mid;
  }
  return times[lo];
}

export function CandleChart({ candles, marks, market }: { candles: Candle[]; marks: ReportMark[]; market: string | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  const times = useMemo(() => candles.map((c) => c.time), [candles]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || candles.length < 2) return;

    const up = cssHsl("--up");
    const down = cssHsl("--down");
    const text = cssHsl("--muted-foreground");
    const grid = cssHsl("--border", 0.45);
    const border = cssHsl("--border");
    // 캔버스는 CSS 변수를 못 읽으므로 모노 폰트 패밀리를 런타임에 풀어서 넘긴다
    const monoFamily = getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim();

    const chart = createChart(container, {
      autoSize: true,
      height: 420,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: monoFamily ? `${monoFamily}, ui-monospace, monospace` : "ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: grid, style: LineStyle.Dotted },
        horzLines: { color: grid, style: LineStyle.Dotted },
      },
      rightPriceScale: { borderColor: border, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: border, timeVisible: false },
      crosshair: {
        vertLine: { color: cssHsl("--foreground", 0.4), labelBackgroundColor: cssHsl("--foreground") },
        horzLine: { color: cssHsl("--foreground", 0.4), labelBackgroundColor: cssHsl("--foreground") },
      },
      localization: {
        priceFormatter: (price: number) =>
          market === "US"
            ? `$${price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`
            : price.toLocaleString("ko-KR", { maximumFractionDigits: 0 }),
      },
    });
    chartRef.current = chart;

    // 캔들 — 한국 증시 색 관습: 상승 적색, 하락 청색
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
    });
    candleSeries.setData(candles.map((c) => ({ time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close })));

    // 거래량 — 하단 18% 영역의 히스토그램
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 }, visible: false });
    volumeSeries.setData(
      candles.map((c) => ({
        time: c.time as Time,
        value: Number.isFinite(c.volume) ? c.volume : 0,
        color: c.close >= c.open ? cssHsl("--up", 0.35) : cssHsl("--down", 0.35),
      })),
    );

    // 발간 마커 — 학회별 잉크로 그날을 찍는다
    const markers: SeriesMarker<Time>[] = marks
      .map((mark) => ({
        time: snapToCandle(mark.date, times) as Time,
        position: "belowBar" as const,
        shape: "arrowUp" as const,
        color: cssHsl(SCHOOL_VARS[mark.school]),
        text: schoolShort[mark.school],
        size: 1.4,
      }))
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
    if (markers.length) createSeriesMarkers(candleSeries, markers);

    // 목표가 수평선 — 그날의 주장이 가격축에 남는다
    for (const mark of marks) {
      if (mark.targetPrice === null) continue;
      candleSeries.createPriceLine({
        price: mark.targetPrice,
        color: cssHsl(SCHOOL_VARS[mark.school], 0.75),
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `${schoolShort[mark.school]} 목표`,
      });
    }

    chart.timeScale().fitContent();

    return () => {
      chartRef.current = null;
      chart.remove();
    };
    // resolvedTheme 변경 시 차트를 테마 색으로 다시 그린다
  }, [candles, marks, market, times, resolvedTheme]);

  if (candles.length < 2) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        가격 차트 데이터가 부족합니다.
      </div>
    );
  }

  return <div ref={containerRef} className="h-[420px] w-full" role="img" aria-label="종목 캔들 차트 — 발간 시점 마커와 학회별 목표가 수평선 포함" />;
}
