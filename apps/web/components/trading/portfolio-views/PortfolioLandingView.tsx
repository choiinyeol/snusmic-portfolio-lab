'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { Button } from '@/components/ui/button';
import { KpiTile } from '@/components/ui/KpiTile';
import type { HoldingRow } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';
import type { PortfolioLandingModel, PortfolioStrategySnapshot } from './types';

const SERIES_COLORS = ['#111827', '#2563eb', '#059669', '#f29423', '#7c3aed', '#dc2626'];

export function PortfolioLandingView({ model }: { model: PortfolioLandingModel }) {
  const [selectedId, setSelectedId] = useState(model.defaultPersona);
  const selected = model.strategies.find((row) => row.id === selectedId) ?? model.strategies[0];
  const selectedHoldings = useMemo(
    () =>
      withCashHolding(
        model.holdings.filter((row) => row.persona === selected?.id),
        selected,
      ),
    [model.holdings, selected],
  );
  const selectedEquity = useMemo(
    () => model.equity.filter((row) => row.persona === selected?.id).sort((a, b) => a.date.localeCompare(b.date)),
    [model.equity, selected],
  );
  const chartSeries = useMemo<ReturnSeries[]>(
    () =>
      model.strategies.map((strategy, index) => ({
        id: strategy.id,
        label: strategy.label,
        shortLabel: strategy.shortLabel,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        points: model.equity
          .filter((point) => point.persona === strategy.id && point.cumulativeReturn !== null)
          .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
      })),
    [model.equity, model.strategies],
  );

  if (!selected) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-500">
        표시할 실제 포트폴리오 전략이 없습니다. benchmark와 oracle은 이 원장에 포함하지 않습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <header className="grid gap-5 border-b border-slate-200 pb-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.62fr)] xl:items-end">
        <div className="grid gap-3">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            actual strategy ledger
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 md:text-5xl">포트폴리오</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
            benchmark·follower·oracle류는 포트폴리오 원장에서 제외했습니다. 이 화면은 실제로 운용할 수 있는 Report Trend
            포트폴리오만 선택하고, 현재 비중과 손익 경로를 먼저 보여줍니다.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={selected.href}>선택 포트폴리오 열기</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/strategies">전략/benchmark 비교 보기</Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
          <div className="text-xs font-medium text-slate-500">포트폴리오 범위</div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <Fact label="실제 전략" value={`${model.strategies.length}개`} />
            <Fact label="합산 평가" value={formatKrw(model.totalEquityKrw)} />
            <Fact label="최근 평가" value={model.latestEquityDate || '—'} />
          </dl>
        </div>
      </header>

      <section className="grid gap-3" aria-label="포트폴리오 선택">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              choose portfolio
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">실제 전략만 선택</h2>
          </div>
          <span className="text-xs font-medium text-slate-500">비교 기준 8개는 이 selector에서 제거</span>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {model.strategies.map((strategy) => (
            <button
              aria-pressed={strategy.id === selected.id}
              className={[
                'group grid min-w-0 gap-3 rounded-md border bg-white p-3 text-left transition-colors',
                strategy.id === selected.id
                  ? 'border-slate-950 ring-1 ring-slate-950/10'
                  : 'border-slate-200 hover:border-slate-400',
              ].join(' ')}
              key={strategy.id}
              type="button"
              onClick={() => setSelectedId(strategy.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold tracking-tight text-slate-950">
                    {strategy.shortLabel}
                  </div>
                  <div className="truncate text-xs text-slate-500">{strategy.label}</div>
                </div>
                <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-semibold text-white">전략</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Fact
                  label="MWR"
                  value={formatPercent(strategy.moneyWeightedReturn)}
                  tone={strategy.moneyWeightedReturn}
                />
                <Fact label="MDD" value={formatPercent(strategy.maxDrawdown)} danger />
                <Fact label="보유" value={`${strategy.holdingCount}개`} />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-950"
                  style={{ width: percentWidth(strategy.cashWeight) }}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                현금 {formatPercent(strategy.cashWeight)} · 최대 비중 {strategy.topHoldingLabel}{' '}
                {formatPercent(strategy.topHoldingWeight)}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section
        className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]"
        aria-label="현재 비중과 최적화 곡선"
      >
        <article className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                current allocation
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
                {selected.shortLabel} 현재 비중
              </h2>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`${selected.href}/holdings`}>보유 표 열기</Link>
            </Button>
          </div>
          <HoldingsTreemap
            holdings={selectedHoldings}
            height={460}
            compact
            caption="면적 = 현재 평가액. 현금도 하나의 비중으로 포함합니다."
          />
        </article>

        <div className="grid gap-4">
          <article className="rounded-md border border-slate-200 bg-white p-4">
            <div className="mb-3">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                portfolio frontier
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">수익률 / 낙폭 곡선</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                x축은 MDD, y축은 MWR입니다. benchmark는 제외하고 실제 포트폴리오 전략만 표시합니다.
              </p>
            </div>
            <PortfolioFrontierChart rows={model.strategies} selectedId={selected.id} onSelect={setSelectedId} />
          </article>

          <div className="grid gap-3 sm:grid-cols-2">
            <KpiTile label="평가액" value={formatKrw(selected.finalEquityKrw)} caption={selected.shortLabel} />
            <KpiTile
              label="누적 수익률"
              value={formatPercent(selected.moneyWeightedReturn)}
              tone={(selected.moneyWeightedReturn ?? 0) >= 0 ? 'good' : 'bad'}
              caption={`MDD ${formatPercent(selected.maxDrawdown)}`}
            />
            <KpiTile
              label="현금 비중"
              value={formatPercent(selected.cashWeight)}
              caption={formatKrw(selected.cashKrw)}
            />
            <KpiTile
              label="체결"
              value={selected.tradeCount?.toLocaleString('ko-KR') ?? '—'}
              caption="매수·매도 ledger"
            />
          </div>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4" aria-label="전략 누적 수익률 비교">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              pnl path
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">실제 포트폴리오 손익 경로</h2>
          </div>
          <span className="text-xs text-slate-500">{selectedEquity.length.toLocaleString('ko-KR')} 거래일</span>
        </div>
        <CumulativeReturnChart series={chartSeries} />
      </section>
    </div>
  );
}

function Fact({
  label,
  value,
  tone,
  danger = false,
}: {
  label: string;
  value: string;
  tone?: number | null;
  danger?: boolean;
}) {
  const color = danger
    ? 'text-rose-600'
    : tone === undefined || tone === null
      ? 'text-slate-950'
      : tone >= 0
        ? 'text-emerald-600'
        : 'text-rose-600';
  return (
    <div className="min-w-0 rounded-md bg-slate-50 px-2 py-1.5">
      <dt className="truncate text-[10px] font-medium text-slate-500">{label}</dt>
      <dd className={`truncate font-mono text-xs font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

function PortfolioFrontierChart({
  rows,
  selectedId,
  onSelect,
}: {
  rows: PortfolioStrategySnapshot[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const maxX = Math.max(0.01, ...rows.map((row) => row.maxDrawdown ?? 0)) * 1.08;
  const minY = Math.min(0, ...rows.map((row) => row.moneyWeightedReturn ?? 0)) * 1.08;
  const maxY = Math.max(0.01, ...rows.map((row) => row.moneyWeightedReturn ?? 0)) * 1.08;
  const frontier = efficientFrontier(rows);
  const path = frontier
    .map(
      (row, index) =>
        `${index === 0 ? 'M' : 'L'} ${plotX(row.maxDrawdown ?? 0, maxX)} ${plotY(row.moneyWeightedReturn ?? 0, minY, maxY)}`,
    )
    .join(' ');
  return (
    <div className="relative h-72 rounded-md border border-slate-100 bg-[linear-gradient(to_right,rgba(226,232,240,.75)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,.75)_1px,transparent_1px)] bg-[size:25%_25%]">
      <svg
        className="h-full w-full"
        viewBox="0 0 360 280"
        role="img"
        aria-label="실제 포트폴리오 전략의 MDD 대비 수익률 곡선"
      >
        {path ? <path d={path} fill="none" stroke="#2563eb" strokeDasharray="4 4" strokeWidth="2" /> : null}
        {rows.map((row) => {
          const selected = row.id === selectedId;
          return (
            <g key={row.id}>
              <circle
                cx={plotX(row.maxDrawdown ?? 0, maxX)}
                cy={plotY(row.moneyWeightedReturn ?? 0, minY, maxY)}
                fill={selected ? '#111827' : '#2563eb'}
                role="button"
                tabIndex={0}
                r={selected ? 7 : 5}
                stroke="white"
                strokeWidth="2"
                className="cursor-pointer outline-none"
                onClick={() => onSelect(row.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(row.id);
                }}
              />
              <text
                x={plotX(row.maxDrawdown ?? 0, maxX) + 9}
                y={plotY(row.moneyWeightedReturn ?? 0, minY, maxY) - 7}
                className="fill-slate-600 text-[10px] font-semibold"
              >
                {row.shortLabel.replace('Overseas Trend ', '').replace('Global Trend ', '')}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 left-3 right-3 flex justify-between font-mono text-[10px] text-slate-400">
        <span>낮은 MDD</span>
        <span>높은 MDD</span>
      </div>
      <div className="absolute left-3 top-2 font-mono text-[10px] text-slate-400">높은 MWR</div>
    </div>
  );
}

function plotX(value: number, maxX: number): number {
  return 34 + (Math.max(0, value) / maxX) * 300;
}

function plotY(value: number, minY: number, maxY: number): number {
  const span = maxY - minY || 1;
  return 248 - ((value - minY) / span) * 210;
}

function efficientFrontier(rows: PortfolioStrategySnapshot[]): PortfolioStrategySnapshot[] {
  const sorted = [...rows]
    .filter((row) => row.moneyWeightedReturn !== null && row.maxDrawdown !== null)
    .sort((a, b) => (a.maxDrawdown ?? 0) - (b.maxDrawdown ?? 0));
  let bestReturn = Number.NEGATIVE_INFINITY;
  return sorted.filter((row) => {
    const value = row.moneyWeightedReturn ?? Number.NEGATIVE_INFINITY;
    if (value <= bestReturn) return false;
    bestReturn = value;
    return true;
  });
}

function percentWidth(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '0%';
  return `${Math.max(2, Math.min(100, value * 100))}%`;
}

function withCashHolding(holdings: HoldingRow[], selected: PortfolioStrategySnapshot | undefined): HoldingRow[] {
  if (!selected?.cashKrw || selected.cashKrw <= 0) return holdings;
  return [
    ...holdings,
    {
      persona: selected.id,
      symbol: 'CASH',
      company: '현금',
      qty: null,
      avgCostKrw: null,
      lastCloseKrw: 1,
      lastCloseNative: 1,
      currency: 'KRW',
      marketValueKrw: selected.cashKrw,
      unrealizedPnlKrw: 0,
      unrealizedReturn: 0,
      holdingDays: null,
      firstBuyDate: null,
    },
  ];
}
