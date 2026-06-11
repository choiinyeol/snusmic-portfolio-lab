"use client";

// ─── 멀티 시리즈 오버레이 차트 — TradingView lightweight-charts v5 ────────────
// 전략 자산곡선·월 적립 시뮬레이션 공용. recharts 정적 렌더를 대체:
// 크로스헤어 + 전체 시리즈 값 툴팁 + 타임스케일 + 테마 연동 + (옵션) 로그 스케일.
// 테마 패턴은 candle-chart.tsx와 동일 (cssHsl 헬퍼, resolvedTheme 의존 재렌더).

import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { useTheme } from "@/components/theme-provider";
import { chartMonoFamily, cssHsl } from "@/lib/chart-colors";

export type OverlaySeries = {
  id: string;
  label: string;
  /** CSS color — 차트 선 + 툴팁 스와치 공용. "stamp"는 그릴 때 테마 색으로 풀린다 */
  color: string;
  data: { time: string; value: number }[];
  dashed?: boolean;
  width?: 1 | 2 | 3;
};

export function OverlayChart({
  series,
  valueFormatter,
  logScale = false,
  oosBoundary,
  heightClass = "h-[300px]",
  ariaLabel,
}: {
  series: OverlaySeries[];
  valueFormatter: (v: number) => string;
  logScale?: boolean;
  /** OOS 경계일 (YYYY-MM-DD) — 첫 시리즈에 마커로 표시 */
  oosBoundary?: string;
  heightClass?: string;
  ariaLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !series.length) return;

    const text = cssHsl("--muted-foreground");
    const grid = cssHsl("--border", 0.45);
    const border = cssHsl("--border");
    const stamp = cssHsl("--stamp");

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: chartMonoFamily(),
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: grid, style: LineStyle.Dotted },
        horzLines: { color: grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderColor: border,
        mode: logScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
        scaleMargins: { top: 0.1, bottom: 0.08 },
      },
      timeScale: { borderColor: border, timeVisible: false },
      crosshair: {
        vertLine: { color: cssHsl("--foreground", 0.4), labelBackgroundColor: cssHsl("--foreground") },
        horzLine: { color: cssHsl("--foreground", 0.4), labelBackgroundColor: cssHsl("--foreground") },
      },
      localization: { priceFormatter: valueFormatter },
    });

    const apiMeta: { api: ISeriesApi<"Line">; s: OverlaySeries; color: string }[] = [];
    for (const s of series) {
      if (s.data.length < 2) continue;
      const color = s.color === "stamp" ? stamp : s.color;
      const api = chart.addSeries(LineSeries, {
        color,
        lineWidth: s.width ?? 2,
        lineStyle: s.dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerRadius: 3,
      });
      api.setData(s.data.map((p) => ({ time: p.time as Time, value: p.value })));
      apiMeta.push({ api, s, color });
    }
    if (!apiMeta.length) {
      chart.remove();
      return;
    }

    // OOS 경계 마커 — 첫 시리즈에서 경계 이후 첫 포인트를 찾아 찍는다
    if (oosBoundary) {
      const first = apiMeta[0];
      const pt = first.s.data.find((p) => p.time >= oosBoundary);
      if (pt) {
        const marker: SeriesMarker<Time> = {
          time: pt.time as Time,
          position: "aboveBar",
          shape: "circle",
          color: text,
          text: "OOS →",
          size: 0.1,
        };
        createSeriesMarkers(first.api, [marker]);
      }
    }

    // 크로스헤어 툴팁 — 켜져 있는 모든 시리즈의 값을 한 패널에
    const onCrosshair = (param: Parameters<Parameters<typeof chart.subscribeCrosshairMove>[0]>[0]) => {
      if (!tooltip) return;
      if (!param.point || !param.time || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = "none";
        return;
      }
      const rows: string[] = [];
      for (const { api, s, color } of apiMeta) {
        const d = param.seriesData.get(api) as { value?: number } | undefined;
        if (d?.value === undefined) continue;
        rows.push(
          `<div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">` +
            `<span style="display:inline-block;width:8px;height:2px;background:${color};"></span>` +
            `<span style="opacity:.75;">${s.label}</span>` +
            `<span style="margin-left:auto;font-weight:700;padding-left:10px;">${valueFormatter(d.value)}</span>` +
          `</div>`,
        );
      }
      if (!rows.length) {
        tooltip.style.display = "none";
        return;
      }
      tooltip.innerHTML =
        `<div style="opacity:.6;margin-bottom:3px;">${String(param.time)}</div>` + rows.join("");
      tooltip.style.display = "block";
      const rect = container.getBoundingClientRect();
      const tw = tooltip.offsetWidth;
      const th = tooltip.offsetHeight;
      let x = param.point.x + 14;
      if (x + tw > rect.width - 4) x = param.point.x - tw - 14;
      let y = param.point.y + 14;
      if (y + th > rect.height - 4) y = Math.max(4, param.point.y - th - 14);
      tooltip.style.left = `${Math.max(4, x)}px`;
      tooltip.style.top = `${y}px`;
    };
    chart.subscribeCrosshairMove(onCrosshair);

    chart.timeScale().fitContent();

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      chart.remove();
    };
    // resolvedTheme 변경 시 테마 색으로 다시 그린다
  }, [series, valueFormatter, logScale, oosBoundary, resolvedTheme]);

  return (
    <div className={`relative w-full ${heightClass}`}>
      <div ref={containerRef} className="h-full w-full" role="img" aria-label={ariaLabel} />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 hidden rounded border border-border bg-card/95 px-2.5 py-1.5 font-mono text-[10px] shadow-lg"
        style={{ display: "none", minWidth: 140 }}
      />
    </div>
  );
}
