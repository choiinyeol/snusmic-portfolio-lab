'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CsvDownloadButton, DataPanel, downloadCsv } from '@/components/ui/data-panel';
import { formatPercent, signedTextClass } from '@/lib/format';
import type { StrategyLeaderboardRow } from '@/lib/product-model';
import { SortHeader, sortRows, type SortState } from './TableControls';

type RiskSortKey =
  | 'kind'
  | 'label'
  | 'returnPct'
  | 'sharpe'
  | 'sortino'
  | 'maxDrawdown'
  | 'benchmarkExcess'
  | 'tradeCount';

export function StrategyRiskTable({
  rows,
  title = '전략 성과',
  csvFilename = 'snusmic-accounts.csv',
}: {
  rows: StrategyLeaderboardRow[];
  title?: string;
  csvFilename?: string;
}) {
  const [sort, setSort] = useState<SortState<RiskSortKey>>({ key: 'returnPct', direction: 'desc' });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, {
        kind: (row) => row.kind,
        label: (row) => row.shortLabel || row.label,
        returnPct: (row) => row.returnPct,
        sharpe: (row) => row.sharpe,
        sortino: (row) => row.sortino,
        maxDrawdown: (row) => row.maxDrawdown,
        benchmarkExcess: (row) => row.benchmarkExcess,
        tradeCount: (row) => row.tradeCount,
      }),
    [rows, sort],
  );
  const updateSort = (key: RiskSortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <DataPanel
      title={title}
      subtitle={`${sorted.length.toLocaleString('ko-KR')}건`}
      actions={<CsvDownloadButton label="CSV" onClick={() => downloadStrategies(sorted, csvFilename)} />}
    >
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left">
              <SortHeader label="구분" sortKey="kind" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="이름" sortKey="label" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="수익률" sortKey="returnPct" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="Sharpe" sortKey="sharpe" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="Sortino" sortKey="sortino" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="MDD" sortKey="maxDrawdown" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="KOSPI 초과" sortKey="benchmarkExcess" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">목표</th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="거래" sortKey="tradeCount" sort={sort} onSort={updateSort} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-3 py-2">
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${kindBadgeClass(row.kind)}`}>
                  {kindLabel(row.kind)}
                </span>
              </td>
              <td className="min-w-[130px] max-w-[230px] px-3 py-2">
                {row.kind === 'strategy' && row.isSelectable ? (
                  <Link className="block min-w-0" href={row.href} title={row.label}>
                    <StrategyName row={row} />
                  </Link>
                ) : (
                  <div className="block min-w-0" title={`${row.label} — 비교 기준이며 포트폴리오 원장이 아닙니다.`}>
                    <StrategyName row={row} />
                  </div>
                )}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono font-black tabular-nums ${signedTextClass(row.returnPct)}`}
              >
                {formatPercent(row.returnPct)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{formatNumber(row.sharpe)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{formatNumber(row.sortino)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-600">
                {formatPercent(row.maxDrawdown)}
                {(row.maxDrawdown ?? 0) > 0.25 ? (
                  <span className="ml-1 rounded-md bg-amber-50 px-1 py-0.5 text-[10px] font-medium text-amber-700">
                    낙폭 점검
                  </span>
                ) : null}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono font-bold tabular-nums ${signedTextClass(row.benchmarkExcess)}`}
              >
                {formatPercent(row.benchmarkExcess)}
              </td>
              <td className="px-3 py-2 text-right">{objectiveBadge(row)}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                {row.tradeCount?.toLocaleString('ko-KR') ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataPanel>
  );
}

function StrategyName({ row }: { row: StrategyLeaderboardRow }) {
  return (
    <>
      <span className="block truncate font-bold text-slate-950">{row.shortLabel || row.label}</span>
      <span className="block truncate text-[11px] font-medium text-slate-500">{row.label}</span>
    </>
  );
}

function kindLabel(kind: StrategyLeaderboardRow['kind']): string {
  if (kind === 'strategy') return '고유 전략';
  if (kind === 'oracle') return '상한선';
  return '벤치마크';
}

function kindBadgeClass(kind: StrategyLeaderboardRow['kind']): string {
  if (kind === 'strategy') return 'bg-blue-50 text-blue-700';
  if (kind === 'oracle') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function objectiveBadge(row: StrategyLeaderboardRow) {
  if (row.kind === 'benchmark') {
    return <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">기준선</span>;
  }
  if (row.kind === 'oracle') {
    return <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">상한선</span>;
  }
  if (row.objectivePassed) {
    return <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">통과</span>;
  }
  return <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">미달</span>;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

function downloadStrategies(rows: StrategyLeaderboardRow[], filename: string) {
  const headers = [
    'id',
    'kind',
    'label',
    'short_label',
    'return_pct',
    'sharpe',
    'sortino',
    'max_drawdown',
    'benchmark_excess',
    'trade_count',
    'objective_passed',
  ];
  const data = rows.map((row) => [
    row.id,
    row.kind,
    row.label,
    row.shortLabel,
    row.returnPct ?? '',
    row.sharpe ?? '',
    row.sortino ?? '',
    row.maxDrawdown ?? '',
    row.benchmarkExcess ?? '',
    row.tradeCount ?? '',
    row.objectivePassed ? 'true' : 'false',
  ]);
  downloadCsv(filename, headers, data);
}
