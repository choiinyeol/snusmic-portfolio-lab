import type { IChartApi, IPanePrimitive, Time } from 'lightweight-charts';

export type DragState = {
  fromTime: string;
  toTime: string;
  fromPrice: number;
  toPrice: number;
};

type AttachParam = { chart: IChartApi; requestUpdate: () => void };

type RenderTarget = {
  useMediaCoordinateSpace: (
    callback: (scope: { context: CanvasRenderingContext2D; mediaSize: { width: number; height: number } }) => void,
  ) => void;
};

/**
 * Lightweight-charts pane primitive that draws the user's drag-selected
 * range inside the chart's own canvas — using the library's coordinate
 * system rather than a separate DOM overlay. Pointer capture still happens
 * via the React overlay (primitives are render-only); this primitive owns
 * the visual band + percentage label.
 */
export class DragSelectionPrimitive implements IPanePrimitive<Time> {
  private chart: IChartApi | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: DragState | null = null;

  attached(param: AttachParam): void {
    this.chart = param.chart;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
  }

  setState(next: DragState | null): void {
    this.state = next;
    this.requestUpdate?.();
  }

  paneViews() {
    const state = this.state;
    const chart = this.chart;
    return [
      {
        zOrder: () => 'top' as const,
        renderer: () => ({
          draw: (target: RenderTarget) => {
            if (!state || !chart) return;
            const timeScale = chart.timeScale();
            const fromX = timeScale.timeToCoordinate(state.fromTime as Time);
            const toX = timeScale.timeToCoordinate(state.toTime as Time);
            if (fromX === null || toX === null) return;
            const ret = state.fromPrice ? state.toPrice / state.fromPrice - 1 : null;
            target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
              const left = Math.min(fromX, toX);
              const width = Math.max(1, Math.abs(toX - fromX));
              const height = mediaSize.height;
              const isUp = (ret ?? 0) >= 0;
              const fill = isUp ? 'rgba(22, 163, 104, 0.12)' : 'rgba(239, 68, 82, 0.12)';
              const edge = isUp ? 'rgba(22, 163, 104, 0.65)' : 'rgba(239, 68, 82, 0.65)';
              ctx.fillStyle = fill;
              ctx.fillRect(left, 0, width, height);
              ctx.strokeStyle = edge;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(left + 0.5, 0);
              ctx.lineTo(left + 0.5, height);
              ctx.moveTo(left + width - 0.5, 0);
              ctx.lineTo(left + width - 0.5, height);
              ctx.stroke();
              if (ret === null) return;
              const sign = ret >= 0 ? '+' : '';
              const label = `${sign}${(ret * 100).toFixed(2)}%`;
              const meta = `${state.fromTime} → ${state.toTime}`;
              ctx.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
              const labelW = ctx.measureText(label).width;
              ctx.font = '500 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
              const metaW = ctx.measureText(meta).width;
              const padX = 8;
              const padY = 5;
              const gap = 6;
              const boxW = Math.max(labelW, metaW) + padX * 2;
              const boxH = 13 + 11 + padY * 2 + 2;
              const cx = left + width / 2;
              const boxLeft = Math.max(2, Math.min(mediaSize.width - boxW - 2, cx - boxW / 2));
              // Position the badge near the bottom of the candle pane so it
              // doesn't slip under the top-left OHLC/MA legend overlay (which
              // is a DOM element layered over the canvas top-left corner).
              const boxTop = Math.max(8, mediaSize.height - boxH - 12);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
              ctx.fillRect(boxLeft, boxTop, boxW, boxH);
              ctx.strokeStyle = 'rgba(15, 23, 42, 0.12)';
              ctx.lineWidth = 1;
              ctx.strokeRect(boxLeft + 0.5, boxTop + 0.5, boxW - 1, boxH - 1);
              ctx.fillStyle = isUp ? '#16a368' : '#ef4452';
              ctx.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
              ctx.textBaseline = 'top';
              ctx.fillText(label, boxLeft + padX, boxTop + padY);
              ctx.fillStyle = 'rgba(78, 89, 104, 0.9)';
              ctx.font = '500 11px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
              ctx.fillText(meta, boxLeft + padX, boxTop + padY + 13 + 2);
              void gap;
            });
          },
        }),
      },
    ];
  }
}
