'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { SeriesToggleChart } from '@/components/charts/SeriesToggleChart';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { Button } from '@/components/ui/button';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import type { HoldingRow } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';
import type { PortfolioLandingModel, PortfolioAccountSnapshot } from './types';

const SERIES_COLORS = ['#111827', '#2563eb', '#059669', '#f29423', '#7c3aed', '#dc2626'];

export function PortfolioLandingView({ model }: { model: PortfolioLandingModel }) {
  const [selectedId, setSelectedId] = useState(model.defaultAccount);
  const selected = model.accounts.find((row) => row.id === selectedId) ?? model.accounts[0];
  const benchmarkCount = model.frontierRows.filter((row) => row.kind === 'benchmark').length;
  const selectedHoldings = useMemo(
    () =>
      withCashHolding(
        model.holdings.filter((row) => row.account_id === selected?.id),
        selected,
      ),
    [model.holdings, selected],
  );
  const selectedEquity = useMemo(
    () => model.equity.filter((row) => row.account_id === selected?.id).sort((a, b) => a.date.localeCompare(b.date)),
    [model.equity, selected],
  );
  const chartSeries = useMemo<ReturnSeries[]>(() => {
    const benchmarkRows = model.frontierRows.filter((row) => row.kind === 'benchmark');
    const rows = [...model.accounts, ...benchmarkRows];
    return rows.map((account, index) => ({
      id: account.id,
      label: account.label,
      shortLabel: account.shortLabel,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points: model.equity
        .filter((point) => point.account_id === account.id && point.cumulativeReturn !== null)
        .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
    }));
  }, [model.equity, model.frontierRows, model.accounts]);

  if (!selected) {
    return (
      <div className="grid gap-4">
        <PageHero
          eyebrow="Portfolio report"
          title="계좌 원장 없음"
          subtitle="실제 계좌 원장이 아직 없습니다."
          badges={[
            { label: '계좌', value: '0개' },
            { label: '상태', value: '연결 안 됨' },
          ]}
          actions={
            <Button asChild size="sm" variant="outline">
              <Link href="/statistics">리포트 통계 보기</Link>
            </Button>
          }
        />
        <div className="rounded-md border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600 [overflow-wrap:anywhere] [word-break:break-all]">
          계좌 원장이 생기면 평가액, 보유 비중, 체결 기록이 여기에 표시됩니다.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <PageHero
        eyebrow="SMIC follower account"
        title="SMIC Follower 포트폴리오"
        subtitle="리포트 신호를 실제 수량 단위 매수·보유·매도 원장으로 추적합니다. 벤치마크는 선택 대상이 아니라 수익률과 낙폭의 기준선으로만 표시합니다."
        badges={[
          { label: '최근 평가', value: model.latestEquityDate || '—' },
          { label: '계좌', value: `${model.accounts.length}개` },
          { label: '기준선', value: `${benchmarkCount}개` },
        ]}
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href={selected.href}>선택 계좌 열기</Link>
          </Button>
        }
        kpis={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              compact
              label="선택 계좌 평가액"
              value={formatKrw(selected.finalEquityKrw)}
              caption={selected.shortLabel}
            />
            <KpiTile
              compact
              label="선택 계좌 수익률"
              value={formatPercent(selected.moneyWeightedReturn)}
              tone={(selected.moneyWeightedReturn ?? 0) >= 0 ? 'good' : 'bad'}
              caption={`MDD ${formatPercent(selected.maxDrawdown)}`}
            />
            <KpiTile
              compact
              label="현금/RP 비중"
              value={formatPercent(selected.cashWeight)}
              caption={formatKrw(selected.cashKrw)}
            />
            <KpiTile
              compact
              label="올웨더 기준선"
              value={formatPercent(model.allWeatherReturn)}
              caption="비교용 벤치마크"
            />
          </div>
        }
      />

      <section
        id="benchmark-board"
        className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,.65fr)]"
        aria-label="현재 비중과 수익률 낙폭 지도"
      >
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
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
            height={620}
            compact
            caption="면적 = 현재 평가액. RP이자 잔고도 현금성 비중으로 포함합니다."
          />
        </article>

        <div className="grid gap-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Follower 위치 지도
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Follower 수익률 / 낙폭 위치</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                SMIC follower 계좌의 수익률과 최대 낙폭을 기준선과 비교합니다. 벤치마크 점은 위치 비교용입니다.
              </p>
            </div>
            <PortfolioFrontierChart rows={model.frontierRows} selectedId={selected.id} onSelect={setSelectedId} />
          </article>

          <div className="grid gap-3 sm:grid-cols-2">
            <KpiTile compact label="선택 계좌" value={selected.shortLabel} caption={selected.topHoldingLabel} />
            <KpiTile
              compact
              label="체결 기록"
              value={selected.tradeCount?.toLocaleString('ko-KR') ?? '—'}
              caption="매수·매도 원장"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-3" aria-label="계좌 선택 버튼">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              choose account
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">계좌 원장 선택</h2>
          </div>
          <span className="text-xs font-medium text-slate-500">
            SMIC follower · {model.accounts.length.toLocaleString('ko-KR')}개 계좌
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {model.accounts.map((account) => (
            <PortfolioChoiceButton
              key={account.id}
              account={account}
              selected={account.id === selected.id}
              onSelect={() => setSelectedId(account.id)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4" aria-label="계좌 누적 수익률 비교">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              pnl path
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">실제 계좌 손익 경로</h2>
          </div>
          <span className="text-xs text-slate-500">{selectedEquity.length.toLocaleString('ko-KR')} 거래일</span>
        </div>
        <SeriesToggleChart series={chartSeries} />
      </section>
    </div>
  );
}

function PortfolioChoiceButton({
  account,
  selected,
  onSelect,
}: {
  account: PortfolioAccountSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={selected}
      className={`group grid min-h-24 cursor-pointer gap-2 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950/20 ${
        selected
          ? 'border-slate-950 bg-slate-950 text-white shadow-sm'
          : 'border-slate-200 bg-white text-slate-950 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-sm'
      }`}
      type="button"
      onClick={onSelect}
    >
      <span className="grid min-w-0 gap-1">
        <span className={`truncate text-sm font-semibold ${selected ? 'text-white' : 'text-slate-950'}`}>
          {account.shortLabel}
        </span>
        <span className={`line-clamp-1 text-xs ${selected ? 'text-slate-300' : 'text-slate-500'}`}>
          {account.topHoldingLabel} · 보유 {account.holdingCount.toLocaleString('ko-KR')}개
        </span>
      </span>
      <span className="grid grid-cols-2 gap-2">
        <span className={`rounded-lg px-2 py-1 ${selected ? 'bg-white/10' : 'bg-emerald-50'}`}>
          <span className={`block text-[10px] font-medium ${selected ? 'text-slate-300' : 'text-emerald-700'}`}>
            MWR
          </span>
          <span
            className={`block font-mono text-sm font-semibold tabular-nums ${
              selected ? 'text-white' : (account.moneyWeightedReturn ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {formatPercent(account.moneyWeightedReturn)}
          </span>
        </span>
        <span className={`rounded-lg px-2 py-1 ${selected ? 'bg-white/10' : 'bg-rose-50'}`}>
          <span className={`block text-[10px] font-medium ${selected ? 'text-slate-300' : 'text-rose-700'}`}>MDD</span>
          <span
            className={`block font-mono text-sm font-semibold tabular-nums ${selected ? 'text-white' : 'text-rose-700'}`}
          >
            {formatPercent(account.maxDrawdown)}
          </span>
        </span>
      </span>
    </button>
  );
}

function PortfolioFrontierChart({
  rows,
  selectedId,
  onSelect,
}: {
  rows: PortfolioAccountSnapshot[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const plottableRows = rows.filter((row) => row.maxDrawdown !== null && row.moneyWeightedReturn !== null);
  const accountRows = plottableRows.filter((row) => row.kind === 'account');
  const benchmarkRows = plottableRows.filter((row) => row.kind === 'benchmark');
  const frontier = efficientFrontier(accountRows);
  const frontierIds = new Set(frontier.map((row) => row.id));
  const selectedRow = plottableRows.find((row) => row.id === selectedId) ?? accountRows[0] ?? benchmarkRows[0];
  const activeRow = plottableRows.find((row) => row.id === (hoveredId ?? selectedId)) ?? selectedRow;
  const visibleRows = uniqueRows([...accountRows, ...benchmarkRows]);
  const domainRows = visibleRows.length ? visibleRows : plottableRows;
  const xValues = domainRows.map((row) => row.maxDrawdown ?? 0);
  const yValues = domainRows.map((row) => row.moneyWeightedReturn ?? 0);
  const { min: minX, max: maxX } = paddedDomain(xValues, { floor: 0.0, minSpan: 0.01 });
  const { min: minY, max: maxY } = paddedDomain(yValues, { minSpan: 0.04 });
  const maxScoreRow = bestRiskAdjustedRow(frontier);
  const minRiskRow = minDrawdownRow(frontier);
  const path = frontier
    .map(
      (row, index) =>
        `${index === 0 ? 'M' : 'L'} ${plotX(row.maxDrawdown ?? 0, minX, maxX)} ${plotY(row.moneyWeightedReturn ?? 0, minY, maxY)}`,
    )
    .join(' ');
  return (
    <div className="grid gap-3">
      <div className="relative h-[360px] overflow-hidden rounded-xl border border-slate-100 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,.14),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#eef2ff_100%)]">
        <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-2 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2 py-1 text-white">
            <span className="size-2 rounded-full bg-white" />
            후보 계좌
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/85 px-2 py-1 text-slate-600">
            <span className="size-2 rotate-45 bg-slate-400" />
            벤치마크
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
            지배 계좌 제외 후 {accountRows.length.toLocaleString('ko-KR')}개
          </span>
        </div>
        <svg
          className="h-full w-full"
          viewBox="0 0 360 280"
          role="img"
          aria-label="실제 포트폴리오 계좌와 벤치마크의 MDD 대비 수익률 지도"
        >
          <defs>
            <linearGradient id="frontierStroke" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="55%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <g opacity="0.62">
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={`v-${ratio}`}
                x1={34 + 300 * ratio}
                x2={34 + 300 * ratio}
                y1="38"
                y2="248"
                stroke="#cbd5e1"
                strokeDasharray="3 5"
              />
            ))}
            {[0.25, 0.5, 0.75].map((ratio) => (
              <line
                key={`h-${ratio}`}
                x1="34"
                x2="334"
                y1={38 + 210 * ratio}
                y2={38 + 210 * ratio}
                stroke="#cbd5e1"
                strokeDasharray="3 5"
              />
            ))}
          </g>
          <line x1="34" x2="334" y1="248" y2="248" stroke="#94a3b8" />
          <line x1="34" x2="34" y1="38" y2="248" stroke="#94a3b8" />
          {path ? (
            <path
              d={path}
              fill="none"
              stroke="url(#frontierStroke)"
              strokeDasharray="6 5"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          ) : null}
          {visibleRows.map((row) => {
            const selected = row.id === selectedId;
            const hovered = row.id === hoveredId;
            const benchmark = row.kind === 'benchmark';
            const efficient = row.kind === 'account' && frontierIds.has(row.id);
            const x = plotX(row.maxDrawdown ?? 0, minX, maxX);
            const y = plotY(row.moneyWeightedReturn ?? 0, minY, maxY);
            const canSelect = row.kind === 'account';
            return (
              <g key={row.id}>
                {benchmark ? (
                  <rect
                    aria-label={`${row.shortLabel} 벤치마크 상세 보기`}
                    className="cursor-default outline-none"
                    fill={hovered ? '#64748b' : '#94a3b8'}
                    height={hovered ? 11 : 9}
                    role="button"
                    stroke="white"
                    strokeWidth="2"
                    tabIndex={0}
                    transform={`rotate(45 ${x} ${y})`}
                    width={hovered ? 11 : 9}
                    x={x - (hovered ? 5.5 : 4.5)}
                    y={y - (hovered ? 5.5 : 4.5)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => setHoveredId(row.id)}
                    onFocus={() => setHoveredId(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setHoveredId(row.id);
                    }}
                    onMouseEnter={() => setHoveredId(row.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                ) : (
                  <circle
                    aria-label={`${row.shortLabel} 선택`}
                    cx={x}
                    cy={y}
                    fill={selected ? '#111827' : hovered ? '#f29423' : efficient ? '#2563eb' : '#94a3b8'}
                    role="button"
                    tabIndex={0}
                    r={selected || hovered ? 8 : efficient ? 5.8 : 4.8}
                    stroke="white"
                    strokeWidth="2"
                    className={canSelect ? 'cursor-pointer outline-none' : 'outline-none'}
                    onClick={() => canSelect && onSelect(row.id)}
                    onMouseEnter={() => setHoveredId(row.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(row.id)}
                    onBlur={() => setHoveredId(null)}
                    onKeyDown={(event) => {
                      if (canSelect && (event.key === 'Enter' || event.key === ' ')) onSelect(row.id);
                    }}
                  />
                )}
                {selected || hovered ? (
                  <text x={x + 9} y={y - 7} className="fill-slate-950 text-[10px] font-semibold">
                    {shortChartLabel(row.shortLabel)}
                  </text>
                ) : null}
              </g>
            );
          })}
          {maxScoreRow ? (
            <StarMarker
              label="최고 위험대비 점수"
              selectable={maxScoreRow.kind === 'account'}
              x={plotX(maxScoreRow.maxDrawdown ?? 0, minX, maxX)}
              y={plotY(maxScoreRow.moneyWeightedReturn ?? 0, minY, maxY)}
              onBlur={() => setHoveredId(null)}
              onFocus={() => setHoveredId(maxScoreRow.id)}
              onMouseEnter={() => setHoveredId(maxScoreRow.id)}
              onMouseLeave={() => setHoveredId(null)}
              onSelect={() => {
                if (maxScoreRow.kind === 'account') onSelect(maxScoreRow.id);
              }}
            />
          ) : null}
          {minRiskRow ? (
            <g>
              <circle
                cx={plotX(minRiskRow.maxDrawdown ?? 0, minX, maxX)}
                cy={plotY(minRiskRow.moneyWeightedReturn ?? 0, minY, maxY)}
                fill="none"
                r="12"
                stroke="#22c55e"
                strokeDasharray="3 3"
                strokeWidth="2"
              />
            </g>
          ) : null}
        </svg>
        <div className="absolute bottom-2 left-3 right-3 flex justify-between font-mono text-[10px] text-slate-400">
          <span>{formatPercent(minX)}</span>
          <span>{formatPercent(maxX)}</span>
        </div>
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          MDD
        </div>
        <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          MWR
        </div>
        <div className="absolute left-3 top-10 font-mono text-[10px] text-slate-400">{formatPercent(maxY)}</div>
        <div className="absolute left-3 bottom-6 font-mono text-[10px] text-slate-400">{formatPercent(minY)}</div>
      </div>
      <FrontierDetailCard
        activeRow={activeRow}
        frontierCount={frontier.length}
        inspecting={hoveredId !== null && hoveredId !== selectedId}
        onSelect={activeRow?.kind === 'account' ? () => onSelect(activeRow.id) : undefined}
      />
    </div>
  );
}

function StarMarker({
  x,
  y,
  label,
  selectable,
  onSelect,
  onFocus,
  onBlur,
  onMouseEnter,
  onMouseLeave,
}: {
  x: number;
  y: number;
  label: string;
  selectable: boolean;
  onSelect: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <g
      aria-label={label}
      aria-disabled={!selectable}
      className={selectable ? 'cursor-pointer outline-none' : 'outline-none'}
      role="button"
      tabIndex={selectable ? 0 : -1}
      onBlur={onBlur}
      onClick={selectable ? onSelect : undefined}
      onFocus={onFocus}
      onKeyDown={(event) => {
        if (selectable && (event.key === 'Enter' || event.key === ' ')) onSelect();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <path
        d={`M ${x} ${y - 11} L ${x + 3.1} ${y - 3.5} L ${x + 11} ${y - 3.2} L ${x + 4.8} ${y + 1.8} L ${x + 6.8} ${y + 9.5} L ${x} ${y + 5.2} L ${x - 6.8} ${y + 9.5} L ${x - 4.8} ${y + 1.8} L ${x - 11} ${y - 3.2} L ${x - 3.1} ${y - 3.5} Z`}
        fill="#f59e0b"
        stroke="white"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </g>
  );
}

function uniqueRows(rows: PortfolioAccountSnapshot[]): PortfolioAccountSnapshot[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function FrontierDetailCard({
  activeRow,
  frontierCount,
  inspecting,
  onSelect,
}: {
  activeRow: PortfolioAccountSnapshot | undefined;
  frontierCount: number;
  inspecting: boolean;
  onSelect?: () => void;
}) {
  if (!activeRow) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        표시할 계좌 후보 점이 없습니다.
      </div>
    );
  }
  const isBenchmark = activeRow.kind === 'benchmark';
  const stateLabel = isBenchmark ? '벤치마크 비교점' : '후보 계좌';
  const stateTone = isBenchmark
    ? 'border-slate-200 bg-slate-50 text-slate-600'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return (
    <div
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="portfolio-frontier-detail-card"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${stateTone}`}>{stateLabel}</span>
            {inspecting ? (
              <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                탐색 중
              </span>
            ) : (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                선택 계좌
              </span>
            )}
          </div>
          <h3 className="mt-2 truncate text-base font-semibold text-slate-950">{activeRow.shortLabel}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            계좌 후보는 지배 계좌를 제거한 {frontierCount.toLocaleString('ko-KR')}개 계좌만 남깁니다. 벤치마크는 선택
            대상이 아니라 위치 비교용입니다.
          </p>
        </div>
        {onSelect && inspecting ? (
          <Button size="sm" variant="outline" onClick={onSelect}>
            이 계좌 선택
          </Button>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="MWR" value={formatPercent(activeRow.moneyWeightedReturn)} />
        <MiniStat label="MDD" value={formatPercent(activeRow.maxDrawdown)} />
        <MiniStat label="RP이자" value={formatPercent(activeRow.cashWeight)} />
        <MiniStat label="보유" value={`${activeRow.holdingCount.toLocaleString('ko-KR')}개`} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function plotX(value: number, minX: number, maxX: number): number {
  const span = maxX - minX || 1;
  return 34 + ((value - minX) / span) * 300;
}

function plotY(value: number, minY: number, maxY: number): number {
  const span = maxY - minY || 1;
  return 248 - ((value - minY) / span) * 210;
}

function paddedDomain(values: number[], options: { floor?: number; minSpan: number }): { min: number; max: number } {
  if (!values.length) return { min: options.floor ?? 0, max: (options.floor ?? 0) + options.minSpan };
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const center = (rawMin + rawMax) / 2;
  const span = Math.max(rawMax - rawMin, options.minSpan);
  let min = center - span * 0.62;
  let max = center + span * 0.62;
  if (options.floor !== undefined && min < options.floor) {
    max += options.floor - min;
    min = options.floor;
  }
  return { min, max };
}

function shortChartLabel(label: string): string {
  return label;
}

function efficientFrontier(rows: PortfolioAccountSnapshot[]): PortfolioAccountSnapshot[] {
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

function bestRiskAdjustedRow(rows: PortfolioAccountSnapshot[]): PortfolioAccountSnapshot | null {
  const riskFreeRate = 0.025;
  return rows.reduce<PortfolioAccountSnapshot | null>((best, row) => {
    if (row.moneyWeightedReturn === null || row.maxDrawdown === null || row.maxDrawdown <= 0) return best;
    const score = (row.moneyWeightedReturn - riskFreeRate) / row.maxDrawdown;
    if (!Number.isFinite(score)) return best;
    if (!best || best.moneyWeightedReturn === null || best.maxDrawdown === null || best.maxDrawdown <= 0) return row;
    const bestScore = (best.moneyWeightedReturn - riskFreeRate) / best.maxDrawdown;
    return score > bestScore ? row : best;
  }, null);
}

function minDrawdownRow(rows: PortfolioAccountSnapshot[]): PortfolioAccountSnapshot | null {
  return rows.reduce<PortfolioAccountSnapshot | null>((best, row) => {
    if (row.maxDrawdown === null) return best;
    if (!best || best.maxDrawdown === null) return row;
    return row.maxDrawdown < best.maxDrawdown ? row : best;
  }, null);
}

function withCashHolding(holdings: HoldingRow[], selected: PortfolioAccountSnapshot | undefined): HoldingRow[] {
  if (!selected?.cashKrw || selected.cashKrw <= 0) return holdings;
  return [
    ...holdings,
    {
      account_id: selected.id,
      symbol: 'CASH',
      company: 'RP이자',
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
