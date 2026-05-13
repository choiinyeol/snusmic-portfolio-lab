'use client';

import { useMemo } from 'react';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import type { EquityPoint } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import type { StrategyLeaderboardRow } from '@/lib/product-model';

type Props = {
  equity: EquityPoint[];
  persona: string;
  rows: StrategyLeaderboardRow[];
  personaLabels: Record<string, string>;
};

const CHART_COLORS = ['#111827', '#2563eb', '#059669', '#dc2626', '#7c3aed'];
const BENCHMARKS = ['benchmark_kodex200', 'benchmark_qqq', 'benchmark_spy'];

export function PortfolioAnalyticsPanel({ equity, persona, rows, personaLabels }: Props) {
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const selected = rowById.get(persona);
  const compareIds = useMemo(() => {
    const ids = [persona, ...BENCHMARKS.filter((id) => id !== persona)];
    return ids.filter((id, index) => ids.indexOf(id) === index && equity.some((point) => point.persona === id));
  }, [equity, persona]);
  const series = useMemo<ReturnSeries[]>(
    () =>
      compareIds.map((id, index) => ({
        id,
        label: personaLabels[id] ?? rowById.get(id)?.label ?? id,
        shortLabel: rowById.get(id)?.shortLabel ?? personaLabels[id] ?? id,
        color: CHART_COLORS[index % CHART_COLORS.length],
        points: equity
          .filter((point) => point.persona === id && point.cumulativeReturn !== null)
          .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
      })),
    [compareIds, equity, personaLabels, rowById],
  );
  const frontierRows = useMemo(
    () =>
      rows
        .filter((row) => row.kind !== 'oracle' && row.returnPct !== null && row.maxDrawdown !== null)
        .sort((a, b) => (a.maxDrawdown ?? 0) - (b.maxDrawdown ?? 0)),
    [rows],
  );
  const efficientIds = useMemo(() => efficientFrontierIds(frontierRows), [frontierRows]);

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">성과 경로</div>
            <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-950">선택 전략 vs 기준선</h2>
          </div>
          <div className="text-right text-xs text-slate-500">
            TradingView lightweight-charts
            <br />
            누적 수익률 경로
          </div>
        </div>
        <CumulativeReturnChart series={series} />
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Risk / return</div>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-950">효율적 프론티어</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            x축은 최대낙폭, y축은 MWR입니다. 선은 실제 전략 조합 최적화가 아니라 현재 산출물의 위험-수익 상단입니다.
          </p>
        </div>
        <FrontierSvg rows={frontierRows} efficientIds={efficientIds} selectedId={persona} />
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Stat label="선택 MWR" value={formatPercent(selected?.returnPct)} />
          <Stat label="선택 MDD" value={formatPercent(selected?.maxDrawdown)} />
          <Stat label="Sharpe" value={formatNumber(selected?.sharpe)} />
        </div>
      </article>
    </section>
  );
}

function FrontierSvg({
  rows,
  efficientIds,
  selectedId,
}: {
  rows: StrategyLeaderboardRow[];
  efficientIds: Set<string>;
  selectedId: string;
}) {
  const width = 520;
  const height = 280;
  const pad = { left: 42, right: 18, top: 18, bottom: 34 };
  const xs = rows.map((row) => row.maxDrawdown ?? 0);
  const ys = rows.map((row) => row.returnPct ?? 0);
  const maxX = Math.max(0.01, ...xs) * 1.08;
  const minY = Math.min(0, ...ys) * 1.08;
  const maxY = Math.max(0.01, ...ys) * 1.08;
  const x = (value: number) => pad.left + (value / maxX) * (width - pad.left - pad.right);
  const y = (value: number) =>
    height - pad.bottom - ((value - minY) / (maxY - minY || 1)) * (height - pad.top - pad.bottom);
  const frontier = rows.filter((row) => efficientIds.has(row.id));
  const path = frontier
    .map((row, index) => `${index === 0 ? 'M' : 'L'} ${x(row.maxDrawdown ?? 0)} ${y(row.returnPct ?? 0)}`)
    .join(' ');

  return (
    <svg
      className="h-auto w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="전략별 최대낙폭과 수익률 프론티어"
    >
      <rect width={width} height={height} rx="18" fill="#f8fafc" />
      {[0.1, 0.2, 0.3, 0.4].map((tick) => (
        <g key={`x-${tick}`}>
          <line x1={x(tick)} x2={x(tick)} y1={pad.top} y2={height - pad.bottom} stroke="#e5e7eb" />
          <text x={x(tick)} y={height - 12} textAnchor="middle" className="fill-slate-400 text-[10px]">
            {Math.round(tick * 100)}%
          </text>
        </g>
      ))}
      {[0, 0.25, 0.5, 0.75].map((tick) => (
        <g key={`y-${tick}`}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#e5e7eb" />
          <text x={10} y={y(tick) + 4} className="fill-slate-400 text-[10px]">
            {Math.round(tick * 100)}%
          </text>
        </g>
      ))}
      {path ? <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 4" /> : null}
      {rows.map((row) => {
        const selected = row.id === selectedId;
        const efficient = efficientIds.has(row.id);
        return (
          <g key={row.id}>
            <circle
              cx={x(row.maxDrawdown ?? 0)}
              cy={y(row.returnPct ?? 0)}
              fill={selected ? '#111827' : efficient ? '#2563eb' : row.kind === 'benchmark' ? '#94a3b8' : '#10b981'}
              r={selected ? 5.5 : efficient ? 4.5 : 3.5}
            />
            {selected || efficient ? (
              <text
                x={x(row.maxDrawdown ?? 0) + 7}
                y={y(row.returnPct ?? 0) - 6}
                className="fill-slate-700 text-[10px] font-medium"
              >
                {row.shortLabel}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function efficientFrontierIds(rows: StrategyLeaderboardRow[]): Set<string> {
  let best = Number.NEGATIVE_INFINITY;
  const ids = new Set<string>();
  for (const row of rows) {
    const value = row.returnPct ?? Number.NEGATIVE_INFINITY;
    if (value > best) {
      ids.add(row.id);
      best = value;
    }
  }
  return ids;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
