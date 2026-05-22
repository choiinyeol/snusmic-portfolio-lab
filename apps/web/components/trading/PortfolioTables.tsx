'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Money } from '@/components/ui/Money';
import { CsvDownloadButton, DataPanel, EmptyTableState, downloadCsv } from '@/components/ui/data-panel';
import type { HoldingRow, ReportTargetDigest } from '@/lib/artifacts';
import { formatDateKo, formatDays, formatKrw, formatPercent } from '@/lib/format';
import { capitalContribution, marketLabel, nativeFromKrw, reportTargetHref } from './helpers';
import { SortHeader, pageRows, sortRows, type SortState } from './TableControls';

type Props = {
  holdings: HoldingRow[];
  /** Strategy/account_id controlled by the parent — single source of truth so
   * URL state and inner state cannot drift apart. */
  account_id: string;
  accountLabels: Record<string, string>;
  capitalByAccount: Record<string, number>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
};

type HoldingSortKey =
  | 'strategy'
  | 'market'
  | 'symbol'
  | 'target'
  | 'qty'
  | 'avgCost'
  | 'lastClose'
  | 'marketValue'
  | 'stockReturn'
  | 'contribution'
  | 'firstBuy';

export function PortfolioTables({
  holdings,
  account_id,
  accountLabels,
  capitalByAccount = {},
  targetsBySymbol,
}: Props) {
  const [sort, setSort] = useState<SortState<HoldingSortKey>>({ key: 'marketValue', direction: 'desc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');

  const accountHoldings = useMemo(
    () => holdings.filter((row) => row.account_id === account_id),
    [holdings, account_id],
  );
  const searched = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ko-KR');
    if (!needle) return accountHoldings;
    return accountHoldings.filter((row) =>
      [row.company, row.symbol].some((value) => value?.toLocaleLowerCase('ko-KR').includes(needle)),
    );
  }, [accountHoldings, search]);

  const sorted = useMemo(
    () =>
      sortRows(searched, sort, {
        strategy: (row) => accountLabels[row.account_id] ?? row.account_id,
        market: (row) => marketLabel(targetsBySymbol[row.symbol]?.marketRegion),
        symbol: (row) => row.company || row.symbol,
        target: (row) => targetsBySymbol[row.symbol]?.targetPriceNative ?? targetsBySymbol[row.symbol]?.targetPriceKrw,
        qty: (row) => row.qty,
        avgCost: (row) => row.avgCostKrw,
        lastClose: (row) => row.lastCloseKrw,
        marketValue: (row) => row.marketValueKrw,
        stockReturn: (row) => row.unrealizedReturn,
        contribution: (row) => capitalContribution(row.unrealizedPnlKrw, capitalByAccount[row.account_id]),
        firstBuy: (row) => row.firstBuyDate,
      }),
    [capitalByAccount, accountLabels, searched, sort, targetsBySymbol],
  );

  const visibleRows = useMemo(() => pageRows(sorted, page, pageSize), [sorted, page, pageSize]);
  const updateSort = (key: HoldingSortKey) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
    setPage(0);
  };

  return (
    <DataPanel
      title="현재 보유"
      subtitle={`${accountLabels[account_id] ?? account_id} · ${sorted.length.toLocaleString('ko-KR')}건`}
      search={{
        value: search,
        onChange: (value) => {
          setSearch(value);
          setPage(0);
        },
        placeholder: '종목·심볼 검색',
      }}
      actions={
        <CsvDownloadButton
          label="CSV"
          onClick={() => downloadHoldings(sorted, targetsBySymbol, accountLabels[account_id] ?? account_id)}
        />
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
            <th className="px-3 py-2 text-left">
              <SortHeader label="전략" sortKey="strategy" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="시장" sortKey="market" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="종목" sortKey="symbol" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="목표가" sortKey="target" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="수량" sortKey="qty" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="평단" sortKey="avgCost" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="최근가" sortKey="lastClose" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="평가액" sortKey="marketValue" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="종목 수익률" sortKey="stockReturn" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="자본 기여" sortKey="contribution" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="최초 매수" sortKey="firstBuy" sort={sort} onSort={updateSort} />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visibleRows.length === 0 ? (
            <tr>
              <td colSpan={11}>
                <EmptyTableState
                  message="조건에 맞는 보유 종목이 없습니다"
                  actionLabel="검색·필터 초기화"
                  onAction={() => {
                    setSearch('');
                    setPage(0);
                  }}
                />
              </td>
            </tr>
          ) : (
            visibleRows.map((row) => {
              const contribution = capitalContribution(row.unrealizedPnlKrw, capitalByAccount[row.account_id]);
              const target = targetsBySymbol[row.symbol];
              const nativeValue =
                row.lastCloseNative !== null && row.qty !== null ? row.lastCloseNative * row.qty : null;
              return (
                <tr key={`${row.account_id}-${row.symbol}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-sm">{accountLabels[row.account_id] ?? row.account_id}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                      {marketLabel(target?.marketRegion)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      className="font-semibold text-slate-950 hover:underline"
                      href={targetHrefFor(row.symbol, targetsBySymbol)}
                    >
                      {row.company || row.symbol}
                    </Link>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">{row.symbol}</div>
                  </td>
                  <td className="px-3 py-2">
                    {target ? (
                      <>
                        <Money
                          native={target.targetPriceNative}
                          krw={target.targetPriceKrw}
                          currency={target.currency}
                        />
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {formatDateKo(target.publicationDate)}
                        </div>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {row.qty?.toLocaleString('ko-KR') ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Money
                      native={nativeFromKrw(row.avgCostKrw, row.lastCloseNative, row.lastCloseKrw)}
                      krw={row.avgCostKrw}
                      currency={row.currency}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Money native={row.lastCloseNative} krw={row.lastCloseKrw} currency={row.currency} />
                  </td>
                  <td className="px-3 py-2">
                    <Money native={nativeValue} krw={row.marketValueKrw} currency={row.currency} />
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                      손익 {formatKrw(row.unrealizedPnlKrw)}
                    </div>
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono tabular-nums ${
                      (row.unrealizedReturn ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatPercent(row.unrealizedReturn)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono tabular-nums ${
                      (contribution ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatPercent(contribution)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono tabular-nums text-slate-950">{row.firstBuyDate}</span>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500">{formatDays(row.holdingDays)}</div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </DataPanel>
  );
}

function downloadHoldings(
  rows: HoldingRow[],
  targetsBySymbol: Record<string, ReportTargetDigest>,
  accountName: string,
) {
  const headers = [
    'account_id',
    'market_region',
    'symbol',
    'company',
    'currency',
    'target_price_krw',
    'target_publication_date',
    'qty',
    'avg_cost_krw',
    'last_close_native',
    'last_close_krw',
    'market_value_krw',
    'unrealized_pnl_krw',
    'unrealized_return',
    'first_buy_date',
  ];
  const data = rows.map((row) => {
    const target = targetsBySymbol[row.symbol];
    return [
      row.account_id,
      target?.marketRegion ?? '',
      row.symbol,
      row.company,
      row.currency,
      target?.targetPriceKrw ?? '',
      target?.publicationDate ?? '',
      row.qty ?? '',
      row.avgCostKrw ?? '',
      row.lastCloseNative ?? '',
      row.lastCloseKrw ?? '',
      row.marketValueKrw ?? '',
      row.unrealizedPnlKrw ?? '',
      row.unrealizedReturn ?? '',
      row.firstBuyDate ?? '',
    ];
  });
  const slug = accountName.replace(/[^a-zA-Z0-9가-힣]+/g, '-').slice(0, 40);
  downloadCsv(`snusmic-holdings-${slug}.csv`, headers, data);
}

function targetHrefFor(symbol: string, targetsBySymbol: Record<string, ReportTargetDigest>): string {
  const target = targetsBySymbol[symbol];
  return target ? reportTargetHref(target) : `/reports/${encodeURIComponent(symbol)}`;
}
