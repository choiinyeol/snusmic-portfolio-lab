'use client';

import { useMemo, useState } from 'react';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import type { EquityPoint } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import type { AccountLeaderboardRow } from '@/lib/product-model';

type Props = {
  equity: EquityPoint[];
  account_id: string;
  rows: AccountLeaderboardRow[];
  accountLabels: Record<string, string>;
};

const CHART_COLORS = ['#111827', '#2563eb', '#059669', '#dc2626', '#7c3aed'];
const BENCHMARKS = ['benchmark_kodex200', 'benchmark_qqq', 'benchmark_spy'];

export function PortfolioAnalyticsPanel({ equity, account_id, rows, accountLabels }: Props) {
  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const selected = rowById.get(account_id);
  const compareIds = useMemo(() => {
    const ids = [account_id, ...BENCHMARKS.filter((id) => id !== account_id)];
    return ids.filter((id, index) => ids.indexOf(id) === index && equity.some((point) => point.account_id === id));
  }, [equity, account_id]);
  const series = useMemo<ReturnSeries[]>(
    () =>
      compareIds.map((id, index) => ({
        id,
        label: accountLabels[id] ?? rowById.get(id)?.label ?? id,
        shortLabel: rowById.get(id)?.shortLabel ?? accountLabels[id] ?? id,
        color: CHART_COLORS[index % CHART_COLORS.length],
        points: equity
          .filter((point) => point.account_id === id && point.cumulativeReturn !== null)
          .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
      })),
    [compareIds, equity, accountLabels, rowById],
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
            <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-950">선택 계좌 vs 기준선</h2>
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
            x축은 최대낙폭, y축은 MWR입니다. 선은 실제 계좌 조합 최적화가 아니라 현재 산출물의 위험-수익 상단입니다.
          </p>
        </div>
        <FrontierPlot rows={frontierRows} efficientIds={efficientIds} selectedId={account_id} />
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Stat label="선택 MWR" value={formatPercent(selected?.returnPct)} />
          <Stat label="선택 MDD" value={formatPercent(selected?.maxDrawdown)} />
          <Stat label="Sharpe" value={formatNumber(selected?.sharpe)} />
        </div>
      </article>
    </section>
  );
}

function FrontierPlot({
  rows,
  efficientIds,
  selectedId,
}: {
  rows: AccountLeaderboardRow[];
  efficientIds: Set<string>;
  selectedId: string;
}) {
  const [riskWindow, setRiskWindow] = useState<'all' | 'focused'>('all');
  const [pinnedId, setPinnedId] = useState(selectedId);
  const visibleRows = rows.filter((row) => riskWindow === 'all' || (row.maxDrawdown ?? 0) <= 0.3);
  const xs = visibleRows.map((row) => row.maxDrawdown ?? 0);
  const ys = visibleRows.map((row) => row.returnPct ?? 0);
  const maxX = Math.max(0.01, ...xs) * 1.08;
  const minY = Math.min(0, ...ys) * 1.08;
  const maxY = Math.max(0.01, ...ys) * 1.08;
  const frontier = visibleRows.filter((row) => efficientIds.has(row.id));
  const pinned = rows.find((row) => row.id === pinnedId) ?? rows.find((row) => row.id === selectedId) ?? null;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">점을 누르면 아래에 계좌가 고정됩니다.</span>
        <div className="flex rounded-md border border-slate-200 bg-white p-0.5">
          {[
            ['all', '전체'],
            ['focused', 'MDD 30% 이하'],
          ].map(([id, label]) => (
            <button
              className={[
                'h-7 rounded px-2 text-[11px] font-semibold transition-colors',
                riskWindow === id ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50',
              ].join(' ')}
              key={id}
              type="button"
              onClick={() => setRiskWindow(id as typeof riskWindow)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[280px] rounded-2xl border border-slate-100 bg-[linear-gradient(to_right,rgba(226,232,240,.8)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,.8)_1px,transparent_1px)] bg-[size:20%_25%] px-5 py-5">
        <div className="absolute bottom-3 left-5 right-5 flex justify-between font-mono text-[10px] text-slate-400">
          <span>낮은 MDD</span>
          <span>{riskWindow === 'focused' ? 'MDD 30%' : '높은 MDD'}</span>
        </div>
        <div className="absolute left-4 top-3 text-[10px] text-slate-400">높은 MWR</div>
        {frontier.map((row, index) => {
          const next = frontier[index + 1];
          if (!next) return null;
          const x1 = xScale(row.maxDrawdown ?? 0, 0, maxX);
          const y1 = 100 - xScale(row.returnPct ?? 0, minY, maxY);
          const x2 = xScale(next.maxDrawdown ?? 0, 0, maxX);
          const y2 = 100 - xScale(next.returnPct ?? 0, minY, maxY);
          return <FrontierSegment key={`${row.id}-${next.id}`} x1={x1} x2={x2} y1={y1} y2={y2} />;
        })}
        {visibleRows.map((row) => {
          const selected = row.id === selectedId;
          const efficient = efficientIds.has(row.id);
          const tone = selected
            ? 'selected'
            : efficient
              ? 'efficient'
              : row.kind === 'benchmark'
                ? 'benchmark'
                : 'account';
          return (
            <FrontierPoint
              key={row.id}
              label={row.shortLabel || row.label}
              meta={row.label}
              tone={tone}
              pinned={row.id === pinned?.id}
              x={xScale(row.maxDrawdown ?? 0, 0, maxX)}
              y={100 - xScale(row.returnPct ?? 0, minY, maxY)}
              rows={[
                ['MWR', formatPercent(row.returnPct)],
                ['MDD', formatPercent(row.maxDrawdown)],
                ['Sharpe', formatNumber(row.sharpe)],
                ['거래 수', row.tradeCount?.toLocaleString('ko-KR') ?? '—'],
              ]}
              onSelect={() => setPinnedId(row.id)}
            />
          );
        })}
      </div>
      {pinned ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
          <div className="font-semibold text-slate-950">{pinned.label}</div>
          <div className="mt-2 grid gap-2 font-mono tabular-nums sm:grid-cols-4">
            <span>MWR {formatPercent(pinned.returnPct)}</span>
            <span>MDD {formatPercent(pinned.maxDrawdown)}</span>
            <span>Sharpe {formatNumber(pinned.sharpe)}</span>
            <span>{pinned.sourceLabel}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FrontierSegment({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <span
      className="pointer-events-none absolute h-px origin-left border-t border-dashed border-blue-500/70"
      style={{
        left: `calc(1.25rem + ${x1} * (100% - 2.5rem) / 100)`,
        top: `calc(1.25rem + ${y1} * (100% - 2.5rem) / 100)`,
        transform: `rotate(${angle}deg)`,
        width: `calc(${length} * (100% - 2.5rem) / 100)`,
      }}
    />
  );
}

function FrontierPoint({
  x,
  y,
  label,
  meta,
  tone,
  pinned = false,
  rows,
  onSelect,
}: {
  x: number;
  y: number;
  label: string;
  meta: string;
  tone: 'selected' | 'efficient' | 'benchmark' | 'account';
  pinned?: boolean;
  rows: Array<[string, string]>;
  onSelect: () => void;
}) {
  const colorClass =
    tone === 'selected'
      ? 'bg-slate-950 ring-slate-200'
      : tone === 'efficient'
        ? 'bg-blue-600 ring-blue-100'
        : tone === 'benchmark'
          ? 'bg-slate-400 ring-slate-100'
          : 'bg-emerald-600 ring-emerald-100';

  return (
    <button
      aria-label={`${meta} ${rows.map(([key, value]) => `${key} ${value}`).join(', ')}`}
      className="group absolute z-10 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center outline-none"
      style={{
        left: `calc(1.25rem + ${x} * (100% - 2.5rem) / 100)`,
        top: `calc(1.25rem + ${y} * (100% - 2.5rem) / 100)`,
      }}
      type="button"
      onClick={onSelect}
    >
      <span
        className={[
          'size-2.5 rounded-full ring-4 transition-transform group-hover:scale-150 group-focus-visible:scale-150',
          pinned ? 'scale-150 ring-slate-950/20' : '',
          colorClass,
        ].join(' ')}
      />
      {tone === 'selected' || tone === 'efficient' ? (
        <span className="pointer-events-none absolute left-4 top-0 max-w-28 truncate rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-sm">
          {label}
        </span>
      ) : null}
      <span className="pointer-events-none absolute bottom-7 left-1/2 z-30 hidden w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs shadow-xl group-hover:block group-focus-visible:block">
        <span className="block font-semibold text-slate-950">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{meta}</span>
        <span className="mt-2 grid gap-1">
          {rows.map(([key, value]) => (
            <span className="flex items-center justify-between gap-3" key={key}>
              <span className="text-slate-500">{key}</span>
              <span className="font-mono font-semibold tabular-nums text-slate-950">{value}</span>
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

function xScale(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function efficientFrontierIds(rows: AccountLeaderboardRow[]): Set<string> {
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
