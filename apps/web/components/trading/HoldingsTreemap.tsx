'use client';

import * as d3 from 'd3';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { HoldingRow } from '@/lib/artifacts';
import { formatKrw, formatNative, formatPercent } from '@/lib/format';

type Props = {
  holdings: HoldingRow[];
  height?: number;
  compact?: boolean;
  showLegend?: boolean;
  showToolbar?: boolean;
  caption?: string;
  hrefBySymbol?: Record<string, string>;
};

type LeafDatum = HoldingRow & { weight: number };
type LeafNode = d3.HierarchyRectangularNode<LeafDatum>;
type Tooltip = { x: number; y: number; row: LeafDatum } | null;

/** Proportional capital-weight treemap rendered with d3 squarify on Canvas.
 * Cell area = market value, cell color = unrealized return. Canvas keeps the
 * dense dashboard fast while a DOM tooltip carries the detailed ledger fields. */
export function HoldingsTreemap({
  holdings,
  height = 420,
  compact = false,
  showLegend = true,
  showToolbar = true,
  caption = '면적 = 평가액, 색 = 미실현 수익률. 종목을 선택하면 연결된 리포트 분석으로 이동합니다.',
  hrefBySymbol,
}: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [size, setSize] = useState({ width: 0, height });
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  const hoveredRef = useRef<LeafNode | null>(null);

  useEffect(() => {
    setSize((prev) => (prev.height === height ? prev : { ...prev, height }));
  }, [height]);

  const totalValue = useMemo(
    () => holdings.reduce((sum, row) => sum + Math.max(0, row.marketValueKrw ?? 0), 0),
    [holdings],
  );

  const root = useMemo<d3.HierarchyRectangularNode<{ children: LeafDatum[] }> | null>(() => {
    if (!holdings.length || totalValue <= 0 || size.width <= 0) return null;
    const leaves: LeafDatum[] = holdings
      .filter((row) => (row.marketValueKrw ?? 0) > 0)
      .map((row) => ({ ...row, weight: (row.marketValueKrw ?? 0) / totalValue }));
    if (!leaves.length) return null;
    const hierarchy = d3
      .hierarchy<{ children: LeafDatum[] } | LeafDatum>({ children: leaves })
      .sum((d) => ('marketValueKrw' in d ? Math.max(0, d.marketValueKrw ?? 0) : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    d3
      .treemap<{ children: LeafDatum[] } | LeafDatum>()
      .size([size.width, size.height])
      .paddingInner(compact ? 1 : 2)
      .round(true)(hierarchy);
    return hierarchy as d3.HierarchyRectangularNode<{ children: LeafDatum[] }>;
  }, [compact, holdings, totalValue, size.width, size.height]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(0, Math.floor(entry.contentRect.width));
      setSize((prev) => (prev.width === width ? prev : { ...prev, width }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const baseCanvas = baseCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!baseCanvas || !overlayCanvas || !root) return;
    const baseCtx = setupHiDpi(baseCanvas, size.width, size.height);
    const overlayCtx = setupHiDpi(overlayCanvas, size.width, size.height);
    if (baseCtx) drawHeatmap(baseCtx, root, size.width, size.height, compact);
    if (overlayCtx) overlayCtx.clearRect(0, 0, size.width, size.height);
  }, [compact, root, size.width, size.height]);

  if (!holdings.length || totalValue <= 0) {
    return <TreemapEmptyState height={height} />;
  }

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !root) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const target = findLeafAt(root, x, y);
    if (target === hoveredRef.current) {
      if (target) setTooltip({ x: x + 14, y: y + 14, row: target.data });
      return;
    }
    hoveredRef.current = target;
    const ctx = setupHiDpi(overlayCanvas, size.width, size.height);
    if (ctx) drawHoverOverlay(ctx, target, size.width, size.height);
    setTooltip(target ? { x: x + 14, y: y + 14, row: target.data } : null);
  };

  const handlePointerLeave = () => {
    hoveredRef.current = null;
    setTooltip(null);
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = setupHiDpi(overlayCanvas, size.width, size.height);
    if (ctx) ctx.clearRect(0, 0, size.width, size.height);
  };

  const handleClick = () => {
    const target = hoveredRef.current ?? (root?.leaves() as unknown as LeafNode[] | undefined)?.[0] ?? null;
    if (!target) return;
    const href = holdingHref(target.data, hrefBySymbol);
    if (!href) return;
    router.push(href);
  };

  return (
    <div className="grid gap-2" aria-label="포트폴리오 보유 종목 트리맵">
      {showToolbar ? (
        <div className="heatmap-toolbar">
          <div className="min-w-0">
            <p className="heatmap-caption">{caption}</p>
            <p className="mt-1 font-mono text-xs text-base-content/55">합계 {formatKrw(totalValue)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5" aria-label="트리맵 모드">
            <span className="snapshot-pill">전체</span>
            <span className="snapshot-pill">평가액</span>
            <span className="snapshot-pill">미실현</span>
            <span className="snapshot-pill">목표 진행</span>
          </div>
        </div>
      ) : null}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-2xl border border-base-300 bg-base-200/30"
        style={{ height: size.height }}
      >
        <canvas
          ref={baseCanvasRef}
          className="absolute left-0 top-0"
          style={{ width: size.width, height: size.height }}
        />
        <canvas
          ref={overlayCanvasRef}
          className="absolute left-0 top-0 cursor-pointer"
          style={{ width: size.width, height: size.height }}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') handleClick();
          }}
          tabIndex={0}
          role="button"
          aria-label="포트폴리오 보유 종목 트리맵. 연결된 리포트가 있는 종목은 선택하면 상세 분석으로 이동합니다."
        />
        {tooltip ? (
          <TreemapTooltip tooltip={tooltip} width={size.width} height={size.height} hrefBySymbol={hrefBySymbol} />
        ) : null}
      </div>
      {showLegend ? <TreemapLegend /> : null}
    </div>
  );
}

function TreemapEmptyState({ height }: { height: number }) {
  return (
    <div
      className="grid place-items-center rounded-2xl border border-dashed border-base-300 bg-base-100 p-6 text-center shadow-sm"
      style={{ minHeight: Math.max(240, height) }}
    >
      <div className="max-w-sm">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">▦</div>
        <h3 className="text-base font-black tracking-[-0.02em]">표시할 보유 종목이 없습니다</h3>
        <p className="mt-2 text-sm text-base-content/60">
          선택된 원장에 평가액이 있는 포지션이 생성되면 면적 기반 트리맵으로 표시됩니다.
        </p>
      </div>
    </div>
  );
}

function TreemapTooltip({
  tooltip,
  width,
  height,
  hrefBySymbol,
}: {
  tooltip: Exclude<Tooltip, null>;
  width: number;
  height: number;
  hrefBySymbol?: Record<string, string>;
}) {
  const row = tooltip.row;
  const left = Math.max(8, Math.min(tooltip.x, width - 260));
  const top = Math.max(8, Math.min(tooltip.y, height - 174));
  const href = holdingHref(row, hrefBySymbol);
  return (
    <div
      className="pointer-events-none absolute z-10 w-[252px] rounded-2xl border border-base-300 bg-base-100/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur"
      style={{ left, top }}
    >
      <div className="min-w-0 font-bold">
        <span className="block truncate">{row.company || row.symbol}</span>
        <span className="font-mono text-base-content/55">{row.symbol}</span>
      </div>
      <dl className="mt-2 grid gap-1.5 text-base-content/65">
        <TooltipLine label="평가액" value={`${formatKrw(row.marketValueKrw)} · ${formatPercent(row.weight)}`} />
        <TooltipLine
          label="미실현"
          value={`${formatKrw(row.unrealizedPnlKrw)} · ${formatPercent(row.unrealizedReturn)}`}
        />
        <TooltipLine label="수량" value={formatQuantity(row.qty)} />
        <TooltipLine label="평단(KRW)" value={formatKrw(row.avgCostKrw)} />
        <TooltipLine label="최근가" value={formatNative(row.lastCloseNative, row.currency)} />
        {href ? <TooltipLine label="동선" value="상세 분석으로 이동" /> : null}
      </dl>
    </div>
  );
}

function TooltipLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
      <dt className="text-base-content/45">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono font-bold tabular-nums text-base-content">{value}</dd>
    </div>
  );
}

function TreemapLegend() {
  return (
    <div className="heatmap-legend" aria-label="트리맵 색상 범례">
      <span className="legend-bad">손실 · -25%</span>
      <span className="legend-neutral">보합 · 0%</span>
      <span className="legend-good">수익 · +25%</span>
    </div>
  );
}

function setupHiDpi(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number): CanvasRenderingContext2D | null {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function drawHeatmap(
  ctx: CanvasRenderingContext2D,
  root: d3.HierarchyRectangularNode<{ children: LeafDatum[] }>,
  width: number,
  height: number,
  compact: boolean,
): void {
  ctx.clearRect(0, 0, width, height);
  const leaves = root.leaves() as unknown as LeafNode[];
  for (const leaf of leaves) {
    const x = leaf.x0;
    const y = leaf.y0;
    const w = leaf.x1 - leaf.x0;
    const h = leaf.y1 - leaf.y0;
    if (w <= 1 || h <= 1) continue;
    ctx.fillStyle = colorForReturn(leaf.data.unrealizedReturn ?? 0, leaf.data.symbol);
    drawRoundedRect(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), compact ? 5 : 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawLabel(ctx, leaf, w, h, compact);
  }
}

function drawLabel(ctx: CanvasRenderingContext2D, leaf: LeafNode, w: number, h: number, compact: boolean): void {
  const x = leaf.x0;
  const y = leaf.y0;
  const symbol = leaf.data.symbol;
  const company = leaf.data.company || symbol;
  const pad = compact ? 6 : 8;
  if (w < 42 || h < 24) return;

  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.textBaseline = 'top';
  ctx.font = `${compact ? 700 : 800} ${compact ? 11 : 13}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(w >= 92 && h >= 48 ? company : symbol, x + pad, y + pad, w - pad * 2);

  if (w >= 70 && h >= 44) {
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = `600 ${compact ? 10 : 11}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.fillText(formatPercent(leaf.data.unrealizedReturn), x + pad, y + pad + 17, w - pad * 2);
  }

  if (w >= 118 && h >= 76) {
    ctx.font = '600 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(formatPercent(leaf.data.weight), x + pad, y + pad + 34, w - pad * 2);
  }
}

function drawHoverOverlay(ctx: CanvasRenderingContext2D, target: LeafNode | null, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  if (!target) return;
  const x = target.x0;
  const y = target.y0;
  const w = target.x1 - target.x0;
  const h = target.y1 - target.y0;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  drawRoundedRect(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.98)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function findLeafAt(
  root: d3.HierarchyRectangularNode<{ children: LeafDatum[] }>,
  x: number,
  y: number,
): LeafNode | null {
  for (const leaf of root.leaves() as unknown as LeafNode[]) {
    if (x >= leaf.x0 && x <= leaf.x1 && y >= leaf.y0 && y <= leaf.y1) return leaf;
  }
  return null;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function colorForReturn(ret: number, symbol?: string): string {
  if (symbol === 'CASH') return '#94a3b8';
  const mag = Math.min(1, Math.abs(ret) / 0.25);
  if (ret >= 0) {
    if (mag > 0.66) return '#17a56a';
    if (mag > 0.33) return '#43b87b';
    return '#77c59b';
  }
  if (mag > 0.66) return '#ef4d5a';
  if (mag > 0.33) return '#e97780';
  return '#e3a0a6';
}

function formatQuantity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

function holdingHref(row: HoldingRow, hrefBySymbol: Record<string, string> | undefined): string | null {
  if (hrefBySymbol) return hrefBySymbol[row.symbol] ?? null;
  if (!row.symbol || row.symbol === 'CASH') return null;
  return `/reports/${encodeURIComponent(row.symbol)}`;
}
