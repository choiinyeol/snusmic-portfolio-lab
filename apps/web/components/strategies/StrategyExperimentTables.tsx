'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { StrategyExperiment, StrategyExperimentPosition, StrategyExperimentTrade } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';

type Direction = 'asc' | 'desc';
type SortState<K> = { key: K; direction: Direction };

type PositionKey =
  | 'symbol'
  | 'publicationDate'
  | 'weight'
  | 'entryPriceKrw'
  | 'targetPriceKrw'
  | 'realizedReturn'
  | 'status';

type TradeKey = 'date' | 'side' | 'symbol' | 'weight' | 'referencePriceKrw' | 'reason';

type Props = {
  runLabel: string;
  experiment: StrategyExperiment;
};

export function StrategyExperimentTables({ runLabel, experiment }: Props) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <PositionsTable runLabel={runLabel} positions={experiment.positions} />
      <TradesTable runLabel={runLabel} trades={experiment.trades} />
    </div>
  );
}

function PositionsTable({ runLabel, positions }: { runLabel: string; positions: StrategyExperimentPosition[] }) {
  const [sort, setSort] = useState<SortState<PositionKey>>({ key: 'publicationDate', direction: 'desc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const sorted = useMemo(() => sortRows(positions, sort, positionAccessors), [positions, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const headers: { key: PositionKey; label: string }[] = [
    { key: 'symbol', label: '종목' },
    { key: 'publicationDate', label: '발간일' },
    { key: 'weight', label: '비중' },
    { key: 'entryPriceKrw', label: '진입가' },
    { key: 'targetPriceKrw', label: '목표가' },
    { key: 'realizedReturn', label: '실험 수익률' },
    { key: 'status', label: '상태' },
  ];

  return (
    <article className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body min-w-0 gap-3 p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="card-title">실험 포트폴리오</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-base-content/55">{positions.length}건</span>
            <button
              className="btn btn-sm btn-outline"
              type="button"
              onClick={() => downloadCsv(`strategy-${runLabel}-positions.csv`, positions, positionCsv)}
            >
              CSV 다운로드
            </button>
          </div>
        </header>
        <div className="min-w-0 overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm table-zebra">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h.key}>
                    <SortButton
                      label={h.label}
                      active={sort.key === h.key}
                      direction={sort.direction}
                      onClick={() => toggleSort(h.key, sort, setSort, setPage)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={`${row.symbol}-${row.publicationDate}`}>
                  <td>
                    <Link className="link link-hover" href={`/reports/${row.symbol}`}>
                      {row.company || row.symbol}
                    </Link>
                    <div className="text-xs text-base-content/55">{row.symbol}</div>
                  </td>
                  <td className="font-mono text-xs">{row.publicationDate}</td>
                  <td className="tabular-nums">{formatPercent(row.weight)}</td>
                  <td className="tabular-nums">{formatKrw(row.entryPriceKrw)}</td>
                  <td className="tabular-nums">{formatKrw(row.targetPriceKrw)}</td>
                  <td className={`tabular-nums ${(row.realizedReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                    {formatPercent(row.realizedReturn)}
                  </td>
                  <td>{row.status === 'closed' ? `청산 · ${row.exitDate ?? '—'}` : '보유/오픈'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalRows={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>
    </article>
  );
}

function TradesTable({ runLabel, trades }: { runLabel: string; trades: StrategyExperimentTrade[] }) {
  const [sort, setSort] = useState<SortState<TradeKey>>({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const sorted = useMemo(() => sortRows(trades, sort, tradeAccessors), [trades, sort]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const headers: { key: TradeKey; label: string }[] = [
    { key: 'date', label: '일자' },
    { key: 'side', label: '구분' },
    { key: 'symbol', label: '종목' },
    { key: 'weight', label: '비중' },
    { key: 'referencePriceKrw', label: '참조가격' },
    { key: 'reason', label: '기준' },
  ];

  return (
    <article className="card min-w-0 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body min-w-0 gap-3 p-5">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="card-title">실험 매매내역</h3>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-base-content/55">{trades.length}건</span>
            <button
              className="btn btn-sm btn-outline"
              type="button"
              onClick={() => downloadCsv(`strategy-${runLabel}-trades.csv`, trades, tradeCsv)}
            >
              CSV 다운로드
            </button>
          </div>
        </header>
        <div className="min-w-0 overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm table-zebra">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h.key}>
                    <SortButton
                      label={h.label}
                      active={sort.key === h.key}
                      direction={sort.direction}
                      onClick={() => toggleSort(h.key, sort, setSort, setPage)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={`${row.date}-${row.side}-${row.symbol}`}>
                  <td className="font-mono text-xs">{row.date}</td>
                  <td>
                    <span
                      className={`badge badge-soft badge-sm ${row.side === 'buy' ? 'badge-success' : 'badge-warning'}`}
                    >
                      {row.side === 'buy' ? '매수' : '매도'}
                    </span>
                  </td>
                  <td>
                    <Link className="link link-hover" href={`/reports/${row.symbol}`}>
                      {row.company || row.symbol}
                    </Link>
                    <div className="text-xs text-base-content/55">{row.symbol}</div>
                  </td>
                  <td className="tabular-nums">{formatPercent(row.weight)}</td>
                  <td className="tabular-nums">{formatKrw(row.referencePriceKrw)}</td>
                  <td className="text-sm">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalRows={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>
    </article>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: Direction;
  onClick: () => void;
}) {
  const indicator = active ? (direction === 'asc' ? ' ↑' : ' ↓') : ' ↕';
  return (
    <button type="button" className="cursor-pointer text-left font-semibold" onClick={onClick}>
      {label}
      <span aria-hidden="true">{indicator}</span>
    </button>
  );
}

function PaginationControls({
  page,
  pageCount,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const start = totalRows === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(totalRows, (page + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-base-content/55">
      <span>
        {start}-{end} / {totalRows}
      </span>
      <div className="flex items-center gap-2">
        <select
          className="select select-xs select-bordered"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {[25, 50, 100, 200].map((size) => (
            <option key={size} value={size}>
              {size}/page
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          이전
        </button>
        <span>
          {page + 1}/{pageCount}
        </span>
        <button
          type="button"
          className="btn btn-xs btn-ghost"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        >
          다음
        </button>
      </div>
    </div>
  );
}

function toggleSort<K extends string>(
  key: K,
  current: SortState<K>,
  setSort: (s: SortState<K>) => void,
  setPage: (p: number) => void,
) {
  setSort({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' });
  setPage(0);
}

function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  accessors: Record<K, (row: T) => string | number | null | undefined>,
): T[] {
  const accessor = accessors[sort.key];
  if (!accessor) return rows;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
    return String(av).localeCompare(String(bv), 'ko-KR') * direction;
  });
}

const positionAccessors: Record<PositionKey, (row: StrategyExperimentPosition) => string | number | null | undefined> =
  {
    symbol: (row) => row.company || row.symbol,
    publicationDate: (row) => row.publicationDate,
    weight: (row) => row.weight,
    entryPriceKrw: (row) => row.entryPriceKrw,
    targetPriceKrw: (row) => row.targetPriceKrw,
    realizedReturn: (row) => row.realizedReturn,
    status: (row) => row.status,
  };

const tradeAccessors: Record<TradeKey, (row: StrategyExperimentTrade) => string | number | null | undefined> = {
  date: (row) => row.date,
  side: (row) => row.side,
  symbol: (row) => row.symbol,
  weight: (row) => row.weight,
  referencePriceKrw: (row) => row.referencePriceKrw,
  reason: (row) => row.reason,
};

const positionCsv: [string, (row: StrategyExperimentPosition) => string | number | boolean | null][] = [
  ['symbol', (r) => r.symbol],
  ['company', (r) => r.company],
  ['publication_date', (r) => r.publicationDate],
  ['exit_date', (r) => r.exitDate],
  ['status', (r) => r.status],
  ['weight', (r) => r.weight],
  ['entry_price_krw', (r) => r.entryPriceKrw],
  ['target_price_krw', (r) => r.targetPriceKrw],
  ['expected_return', (r) => r.expectedReturn],
  ['realized_return', (r) => r.realizedReturn],
  ['target_hit', (r) => r.targetHit],
];

const tradeCsv: [string, (row: StrategyExperimentTrade) => string | number | null][] = [
  ['date', (r) => r.date],
  ['side', (r) => r.side],
  ['symbol', (r) => r.symbol],
  ['company', (r) => r.company],
  ['weight', (r) => r.weight],
  ['reference_price_krw', (r) => r.referencePriceKrw],
  ['reason', (r) => r.reason],
];

function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: [string, (row: T) => string | number | boolean | null][],
): void {
  const header = columns.map(([label]) => csvCell(label)).join(',');
  const body = rows.map((row) => columns.map(([, fn]) => csvCell(fn(row))).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
