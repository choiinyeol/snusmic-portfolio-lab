'use client';

import { useMemo, useState } from 'react';
import type { MonthlyHoldingRow, ReportTargetDigest } from '@/lib/artifacts';
import { Money } from '@/components/ui/Money';
import { formatDateKo, formatKrw, formatPercent } from '@/lib/format';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { CsvDownloadButton, DataPanel, downloadCsv } from '@/components/ui/data-panel';
import { marketLabel, nativeFromKrw } from './helpers';
import { SortHeader, pageRows, sortRows, type SortState } from './TableControls';

type Props = {
  monthly: MonthlyHoldingRow[];
  /** Strategy controlled by the parent — single source of truth. */
  persona: string;
  personaLabels: Record<string, string>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
};

type MonthlySortKey =
  | 'month'
  | 'strategy'
  | 'market'
  | 'symbol'
  | 'target'
  | 'qty'
  | 'monthClose'
  | 'avgCost'
  | 'marketValue'
  | 'unrealizedPnl'
  | 'unrealizedReturn'
  | 'targetGap'
  | 'targetPnl'
  | 'weight';

const STACK_COLORS = [
  '#d7ff4f',
  '#35f2c2',
  '#8ab4ff',
  '#ffd166',
  '#ff6f91',
  '#b892ff',
  '#7ee787',
  '#fca5a5',
  '#cbd5e1',
];

export function PortfolioHistory({ monthly, persona, personaLabels, targetsBySymbol }: Props) {
  const months = useMemo(
    () =>
      Array.from(new Set(monthly.map((row) => row.monthEnd)))
        .sort()
        .reverse(),
    [monthly],
  );
  const [month, setMonth] = useState(months[0] ?? '');
  const [sort, setSort] = useState<SortState<MonthlySortKey>>({ key: 'weight', direction: 'desc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(
    () => monthly.filter((row) => row.persona === persona && (!month || row.monthEnd === month)),
    [month, monthly, persona],
  );
  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, {
        month: (row) => row.monthEnd,
        strategy: (row) => personaLabels[row.persona] ?? row.persona,
        market: (row) => marketLabel(targetsBySymbol[row.symbol]?.marketRegion),
        symbol: (row) => row.company || row.symbol,
        target: (row) => targetsBySymbol[row.symbol]?.targetPriceNative ?? targetsBySymbol[row.symbol]?.targetPriceKrw,
        qty: (row) => row.qty,
        monthClose: (row) => row.monthCloseKrw,
        avgCost: (row) => row.avgCostKrw,
        marketValue: (row) => row.marketValueKrw,
        unrealizedPnl: (row) => row.unrealizedPnlKrw,
        unrealizedReturn: (row) => row.unrealizedReturn,
        targetGap: (row) => targetGap(row, targetsBySymbol[row.symbol]),
        targetPnl: (row) => targetPnl(row, targetsBySymbol[row.symbol]),
        weight: (row) => row.weightInPortfolio,
      }),
    [filtered, personaLabels, sort, targetsBySymbol],
  );
  const rows = useMemo(() => pageRows(sorted, page, pageSize), [page, pageSize, sorted]);
  const stacks = useMemo(() => buildStacks(monthly, persona), [monthly, persona]);
  const updateSort = (key: MonthlySortKey) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
    setPage(0);
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 p-5">
          <h2 className="text-base font-semibold text-slate-950">비중 추이 — 100% 스택</h2>
          <div className="grid gap-1" aria-label="월말 포트폴리오 비중 추이">
            {stacks.map((stack) => (
              <div className="grid grid-cols-[6rem_1fr_minmax(140px,16rem)] items-center gap-3" key={stack.month}>
                <div className="font-mono text-xs text-slate-500">{stack.month}</div>
                <div className="flex h-3 overflow-hidden rounded-full">
                  {stack.segments.map((segment, index) => (
                    <span
                      key={`${stack.month}-${segment.symbol}`}
                      style={{
                        width: `${Math.max(0, segment.weight * 100)}%`,
                        background: STACK_COLORS[index % STACK_COLORS.length],
                      }}
                      title={`${segment.symbol}: ${formatPercent(segment.weight)}`}
                    />
                  ))}
                </div>
                <div className="truncate text-xs text-slate-950/55">
                  {stack.segments
                    .slice(0, 4)
                    .map((segment) => segment.symbol)
                    .join(' · ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DataPanel
        title={`${month} 월말 포트폴리오`}
        subtitle={`${sorted.length.toLocaleString('ko-KR')}건`}
        actions={
          <>
            <NativeSelect
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setPage(0);
              }}
              aria-label="월말 기준일"
              className="h-8 w-32 rounded-md border border-slate-200 bg-white px-2 text-xs"
            >
              {months.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <CsvDownloadButton label="CSV" onClick={() => downloadMonthly(sorted, targetsBySymbol)} />
          </>
        }
        pagination={{
          page,
          pageCount: Math.ceil(sorted.length / pageSize),
          totalRows: sorted.length,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(0);
          },
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>
                <SortHeader label="월말" sortKey="month" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="전략" sortKey="strategy" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="시장" sortKey="market" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="심볼" sortKey="symbol" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="목표가" sortKey="target" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="수량" sortKey="qty" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="월말가" sortKey="monthClose" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="평단" sortKey="avgCost" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="평가액" sortKey="marketValue" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="미실현 손익" sortKey="unrealizedPnl" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="당시 수익률" sortKey="unrealizedReturn" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="목표까지" sortKey="targetGap" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="목표 달성 손익" sortKey="targetPnl" sort={sort} onSort={updateSort} />
              </th>
              <th>
                <SortHeader label="비중" sortKey="weight" sort={sort} onSort={updateSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const target = targetsBySymbol[row.symbol];
              const gap = targetGap(row, target);
              const pnlToTarget = targetPnl(row, target);
              const evalNative =
                row.monthCloseNative !== null && row.qty !== null ? row.monthCloseNative * row.qty : null;
              return (
                <tr key={`${row.persona}-${row.monthEnd}-${row.symbol}`}>
                  <td className="font-mono text-xs">{row.monthEnd}</td>
                  <td>{personaLabels[row.persona] ?? row.persona}</td>
                  <td>
                    <span className="badge badge-ghost badge-sm">{marketLabel(target?.marketRegion)}</span>
                  </td>
                  <td>
                    {row.company || row.symbol}
                    <div className="text-xs text-slate-950/55">
                      <a className="link hover:underline" href={`/reports/${encodeURIComponent(row.symbol)}`}>
                        {row.symbol}
                      </a>
                    </div>
                  </td>
                  <td>
                    {target ? (
                      <Money native={target.targetPriceNative} krw={target.targetPriceKrw} currency={target.currency} />
                    ) : (
                      '—'
                    )}
                    <div className="text-xs text-slate-950/55">{formatDateKo(target?.publicationDate)}</div>
                  </td>
                  <td className="tabular-nums">{row.qty?.toLocaleString('ko-KR') ?? '—'}</td>
                  <td>
                    <Money native={row.monthCloseNative} krw={row.monthCloseKrw} currency={row.currency} />
                  </td>
                  <td>
                    <Money
                      native={nativeFromKrw(row.avgCostKrw, row.monthCloseNative, row.monthCloseKrw)}
                      krw={row.avgCostKrw}
                      currency={row.currency}
                    />
                  </td>
                  <td>
                    <Money native={evalNative} krw={row.marketValueKrw} currency={row.currency} />
                  </td>
                  <td
                    className={`tabular-nums ${(row.unrealizedPnlKrw ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {formatKrw(row.unrealizedPnlKrw)}
                  </td>
                  <td
                    className={`tabular-nums ${(row.unrealizedReturn ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                  >
                    {formatPercent(row.unrealizedReturn)}
                  </td>
                  <td className={`tabular-nums ${(gap ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatPercent(gap)}
                  </td>
                  <td className={`tabular-nums ${(pnlToTarget ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {formatKrw(pnlToTarget)}
                  </td>
                  <td className="tabular-nums">{formatPercent(row.weightInPortfolio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataPanel>
    </div>
  );
}

function buildStacks(rows: MonthlyHoldingRow[], persona: string) {
  const groups = new Map<string, MonthlyHoldingRow[]>();
  for (const row of rows) {
    if (row.persona !== persona) continue;
    const key = row.monthEnd;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 24)
    .reverse()
    .map(([month, group]) => {
      const sorted = [...group].sort((a, b) => (b.weightInPortfolio ?? 0) - (a.weightInPortfolio ?? 0));
      const top = sorted
        .slice(0, 8)
        .map((row) => ({ symbol: row.symbol, weight: Math.max(0, row.weightInPortfolio ?? 0) }));
      const other = sorted.slice(8).reduce((sum, row) => sum + Math.max(0, row.weightInPortfolio ?? 0), 0);
      const total = top.reduce((sum, row) => sum + row.weight, other) || 1;
      const segments = [...top, ...(other > 0 ? [{ symbol: '기타', weight: other }] : [])].map((segment) => ({
        ...segment,
        weight: segment.weight / total,
      }));
      return { month, segments };
    });
}

function downloadMonthly(rows: MonthlyHoldingRow[], targetsBySymbol: Record<string, ReportTargetDigest>) {
  const headers = [
    'month_end',
    'persona',
    'market_region',
    'symbol',
    'company',
    'target_price_krw',
    'target_publication_date',
    'qty',
    'month_close_krw',
    'avg_cost_krw',
    'market_value_krw',
    'unrealized_pnl_krw',
    'unrealized_return',
    'target_gap_from_month_close',
    'target_pnl_at_hit_krw',
    'weight_in_portfolio',
  ];
  const data = rows.map((row) => {
    const target = targetsBySymbol[row.symbol];
    return [
      row.monthEnd,
      row.persona,
      target?.marketRegion ?? '',
      row.symbol,
      row.company,
      target?.targetPriceKrw ?? '',
      target?.publicationDate ?? '',
      row.qty ?? '',
      row.monthCloseKrw ?? '',
      row.avgCostKrw ?? '',
      row.marketValueKrw ?? '',
      row.unrealizedPnlKrw ?? '',
      row.unrealizedReturn ?? '',
      targetGap(row, target) ?? '',
      targetPnl(row, target) ?? '',
      row.weightInPortfolio ?? '',
    ];
  });
  downloadCsv('snusmic-monthly-portfolio.csv', headers, data);
}

function targetGap(row: MonthlyHoldingRow, target: ReportTargetDigest | undefined): number | null {
  if (!target?.targetPriceKrw || !row.monthCloseKrw || row.monthCloseKrw <= 0) return null;
  return target.targetPriceKrw / row.monthCloseKrw - 1;
}

function targetPnl(row: MonthlyHoldingRow, target: ReportTargetDigest | undefined): number | null {
  if (!target?.targetPriceKrw || !row.qty || row.marketValueKrw === null) return null;
  return target.targetPriceKrw * row.qty - row.marketValueKrw;
}
