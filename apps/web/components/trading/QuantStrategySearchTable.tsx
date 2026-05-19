'use client';

import { useMemo, useState } from 'react';
import { CsvDownloadButton, DataPanel, downloadCsv } from '@/components/ui/data-panel';
import { formatDays, formatPercent, signedTextClass } from '@/lib/format';
import type { QuantStrategySearchRow } from '@/lib/artifacts';
import { SortHeader, sortRows, type SortState } from './TableControls';

type QuantSortKey =
  | 'rank'
  | 'strategyId'
  | 'family'
  | 'annualizedSharpe'
  | 'annualizedSortinoLpm0'
  | 'annualizedSortinoDownsideStd'
  | 'cagr'
  | 'maxDrawdown'
  | 'totalReturn'
  | 'robustGoalHit';

const TOP_N_OPTIONS = [10, 25, 50] as const;

export function QuantStrategySearchTable({ rows }: { rows: QuantStrategySearchRow[] }) {
  const [topN, setTopN] = useState<number>(25);
  const [sort, setSort] = useState<SortState<QuantSortKey>>({ key: 'rank', direction: 'asc' });
  const sorted = useMemo(
    () =>
      sortRows(rows, sort, {
        rank: (row) => row.rank,
        strategyId: (row) => row.strategyId,
        family: (row) => row.family,
        annualizedSharpe: (row) => row.annualizedSharpe,
        annualizedSortinoLpm0: (row) => row.annualizedSortinoLpm0,
        annualizedSortinoDownsideStd: (row) => row.annualizedSortinoDownsideStd,
        cagr: (row) => row.cagr,
        maxDrawdown: (row) => row.maxDrawdown,
        totalReturn: (row) => row.totalReturn,
        robustGoalHit: (row) => (row.robustGoalHit ? 1 : 0),
      }).slice(0, topN),
    [rows, sort, topN],
  );
  const updateSort = (key: QuantSortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  return (
    <DataPanel
      title="퀀트 탐색 Top N"
      subtitle={`표시 ${sorted.length.toLocaleString('ko-KR')}건 / 후보 ${rows.length.toLocaleString('ko-KR')}건`}
      toolbar={
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <label className="inline-flex items-center gap-2">
            <span className="font-semibold text-slate-700">상위 N</span>
            <select
              value={topN}
              onChange={(event) => setTopN(Number(event.target.value))}
              className="min-h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs leading-normal text-slate-700"
            >
              {TOP_N_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}개
                </option>
              ))}
            </select>
          </label>
          <span>기본 순위는 탐색 리더보드 순서이며, 각 열을 눌러 재정렬할 수 있습니다.</span>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <CsvDownloadButton
            label="전체 CSV"
            onClick={() => downloadQuantRows(rows, 'snusmic-quant-strategy-search.csv')}
          />
          <CsvDownloadButton
            label="표시 CSV"
            onClick={() => downloadQuantRows(sorted, 'snusmic-quant-strategy-search-top.csv')}
          />
        </div>
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-right">
              <SortHeader label="순위" sortKey="rank" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="전략" sortKey="strategyId" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="군" sortKey="family" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="Sharpe" sortKey="annualizedSharpe" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="Sortino LPM0" sortKey="annualizedSortinoLpm0" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="Sortino DS" sortKey="annualizedSortinoDownsideStd" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="CAGR" sortKey="cagr" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="총수익" sortKey="totalReturn" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="MDD" sortKey="maxDrawdown" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">검증</th>
            <th className="px-3 py-2 text-left">파라미터</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((row) => (
            <tr key={`${row.rank}-${row.strategyId}`} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{row.rank}</td>
              <td className="min-w-[210px] px-3 py-2">
                <span className="block font-bold text-slate-950">{row.strategyId}</span>
                <span className="block text-[11px] font-medium text-slate-500">{formatDays(row.days)}</span>
              </td>
              <td className="px-3 py-2">
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {familyLabel(row.family)}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{formatRatio(row.annualizedSharpe)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold tabular-nums text-emerald-600">
                {formatRatio(row.annualizedSortinoLpm0)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {formatRatio(row.annualizedSortinoDownsideStd)}
              </td>
              <td className={`px-3 py-2 text-right font-mono tabular-nums ${signedTextClass(row.cagr)}`}>
                {formatPercent(row.cagr)}
              </td>
              <td className={`px-3 py-2 text-right font-mono tabular-nums ${signedTextClass(row.totalReturn)}`}>
                {formatPercent(row.totalReturn)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-600">
                {formatPercent(row.maxDrawdown)}
              </td>
              <td className="px-3 py-2 text-right">{hitBadge(row)}</td>
              <td className="min-w-[260px] max-w-[360px] px-3 py-2 text-xs leading-5 text-slate-500">
                <span className="line-clamp-2" title={row.paramsSummary}>
                  {row.paramsSummary}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataPanel>
  );
}

function familyLabel(family: string): string {
  if (family === 'persona_rotation') return '로테이션';
  if (family === 'persona_momentum_filter') return '모멘텀 필터';
  if (family === 'persona_momentum_volcap') return '변동성 캡';
  return family || '기타';
}

function hitBadge(row: QuantStrategySearchRow) {
  if (row.robustGoalHit) {
    return <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] text-emerald-700">강건 통과</span>;
  }
  if (row.goalHit) {
    return <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-700">Sortino 통과</span>;
  }
  return <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">후보</span>;
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function downloadQuantRows(rows: QuantStrategySearchRow[], filename: string) {
  downloadCsv(
    filename,
    [
      'rank',
      'strategy_id',
      'family',
      'goal_hit',
      'robust_goal_hit',
      'hit_basis',
      'annualized_sharpe',
      'annualized_sortino_lpm0',
      'annualized_sortino_downside_std',
      'cagr',
      'total_return',
      'max_drawdown',
      'days',
      'params_summary',
    ],
    rows.map((row) => [
      row.rank,
      row.strategyId,
      row.family,
      row.goalHit,
      row.robustGoalHit,
      row.hitBasis,
      row.annualizedSharpe,
      row.annualizedSortinoLpm0,
      row.annualizedSortinoDownsideStd,
      row.cagr,
      row.totalReturn,
      row.maxDrawdown,
      row.days,
      row.paramsSummary,
    ]),
  );
}
