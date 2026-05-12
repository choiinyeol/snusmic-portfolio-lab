'use client';

import * as d3 from 'd3';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { HoldingRow } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';

type Props = {
  holdings: HoldingRow[];
};

type LeafDatum = HoldingRow & { weight: number };
type LeafNode = d3.HierarchyRectangularNode<LeafDatum>;

type Tooltip = { x: number; y: number; row: LeafDatum } | null;

/** Proportional capital-weight treemap, rendered with d3 squarify layout on
 * Canvas. Cell area = market value, cell color = unrealized return. Two
 * canvas layers (base + hover overlay) keep redraws cheap when only the
 * hovered tile changes. */
export function HoldingsTreemap({ holdings }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [size, setSize] = useState({ width: 0, height: 340 });
  const [tooltip, setTooltip] = useState<Tooltip>(null);
  const hoveredRef = useRef<LeafNode | null>(null);

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
    d3.treemap<{ children: LeafDatum[] } | LeafDatum>().size([size.width, size.height]).paddingInner(2).round(true)(
      hierarchy,
    );
    return hierarchy as d3.HierarchyRectangularNode<{ children: LeafDatum[] }>;
  }, [holdings, totalValue, size.width, size.height]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
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
    if (baseCtx) drawHeatmap(baseCtx, root, size.width, size.height);
    if (overlayCtx) overlayCtx.clearRect(0, 0, size.width, size.height);
  }, [root, size.width, size.height]);

  if (!holdings.length || totalValue <= 0) return null;

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas || !root) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const target = findLeafAt(root, x, y);
    if (target === hoveredRef.current) {
      if (target) {
        setTooltip({ x: x + 14, y: y + 14, row: target.data });
      }
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

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs text-base-content/55">
        <span>비중 비례 타일 — 면적 = 평가액, 색 = 미실현 손익. 호버하면 상세.</span>
        <span>합계 {formatKrw(totalValue)}</span>
      </div>
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border border-base-300 bg-base-200/30"
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
        />
        {tooltip ? (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-base-300 bg-base-100/95 px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(tooltip.x, size.width - 220), top: Math.min(tooltip.y, size.height - 110) }}
          >
            <div className="font-bold">
              {tooltip.row.company || tooltip.row.symbol}{' '}
              <span className="font-mono text-base-content/55">· {tooltip.row.symbol}</span>
            </div>
            <div className="mt-1 text-base-content/65">
              비중 {formatPercent(tooltip.row.weight)} · {formatKrw(tooltip.row.marketValueKrw)}
            </div>
            <div className={(tooltip.row.unrealizedReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}>
              미실현 {formatPercent(tooltip.row.unrealizedReturn)}
            </div>
          </div>
        ) : null}
      </div>
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
): void {
  ctx.clearRect(0, 0, width, height);
  const leaves = root.leaves() as unknown as LeafNode[];
  for (const leaf of leaves) {
    const x = leaf.x0;
    const y = leaf.y0;
    const w = leaf.x1 - leaf.x0;
    const h = leaf.y1 - leaf.y0;
    if (w <= 1 || h <= 1) continue;
    ctx.fillStyle = colorForReturn(leaf.data.unrealizedReturn ?? 0);
    drawRoundedRect(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (w < 56 || h < 36) continue;
    ctx.fillStyle = 'white';
    ctx.textBaseline = 'top';
    ctx.font = '700 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(leaf.data.company || leaf.data.symbol, x + 8, y + 6, w - 16);
    if (w >= 70 && h >= 50) {
      ctx.font = '500 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(formatPercent(leaf.data.weight), x + 8, y + 22, w - 16);
    }
    if (w >= 100 && h >= 70) {
      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      ctx.font = '500 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(formatPercent(leaf.data.unrealizedReturn), x + 8, y + 38, w - 16);
    }
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
  drawRoundedRect(ctx, x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2), 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
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

function colorForReturn(ret: number): string {
  // Saturates around ±25%. daisyUI tone-aligned hex values.
  const mag = Math.min(1, Math.abs(ret) / 0.25);
  if (ret >= 0) {
    if (mag > 0.66) return '#16a368';
    if (mag > 0.33) return '#3aae74';
    return '#67b88f';
  }
  if (mag > 0.66) return '#ef4452';
  if (mag > 0.33) return '#e96872';
  return '#dd8a92';
}
