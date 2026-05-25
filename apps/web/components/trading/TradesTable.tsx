'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { Money } from '@/components/ui/Money';
import { CsvDownloadButton, DataPanel, EmptyTableState, downloadCsv } from '@/components/ui/data-panel';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { ReportTargetDigest, TradeRow } from '@/lib/artifacts';
import { formatKrw, signedTextClass } from '@/lib/format';
import { reportTargetHref, tradeDisplayName } from './helpers';
import { SortHeader, pageRows, sortRows, type SortState } from './TableControls';

type Props = {
  trades: TradeRow[];
  account_id: string;
  accountLabels: Record<string, string>;
  reportSymbolsById: Record<string, string>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
  targetsByReportId: Record<string, ReportTargetDigest>;
};

type TradeSortKey = 'date' | 'side' | 'symbol' | 'qty' | 'price' | 'gross' | 'pnl' | 'reason';
type TradeSideFilter = 'all' | 'buy' | 'sell';

export function TradesTable({ trades, account_id, reportSymbolsById, targetsBySymbol, targetsByReportId }: Props) {
  const [query, setQuery] = useState(() => initialUrlQuery());
  const [side, setSide] = useState<TradeSideFilter>('all');
  const [tradeSort, setTradeSort] = useState<SortState<TradeSortKey>>({ key: 'date', direction: 'desc' });
  const [tradePage, setTradePage] = useState(0);
  const [tradePageSize, setTradePageSize] = useState(50);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const accountTrades = useMemo(() => trades.filter((trade) => trade.account_id === account_id), [account_id, trades]);

  const sideOptions = useMemo(
    () => [
      { value: 'all' as const, label: '전체', count: accountTrades.length },
      { value: 'buy' as const, label: '매수', count: accountTrades.filter((trade) => trade.side === 'buy').length },
      { value: 'sell' as const, label: '매도', count: accountTrades.filter((trade) => trade.side === 'sell').length },
    ],
    [accountTrades],
  );

  const filteredTrades = useMemo(
    () =>
      accountTrades.filter((trade) => {
        if (side !== 'all' && trade.side !== side) return false;
        const haystack = `${trade.symbol} ${trade.company} ${trade.reason} ${trade.reportId ?? ''}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [accountTrades, normalizedQuery, side],
  );

  const sortedTrades = useMemo(
    () =>
      sortRows(filteredTrades, tradeSort, {
        date: (row) => row.date,
        side: (row) => row.side,
        symbol: (row) => tradeDisplayName(row.symbol, row.company),
        qty: (row) => row.qty,
        price: (row) => row.fillPriceKrw,
        gross: (row) => row.grossKrw,
        pnl: (row) => row.realizedPnlKrw,
        reason: (row) => row.reason,
      }),
    [filteredTrades, tradeSort],
  );

  const tradeRows = useMemo(
    () => pageRows(sortedTrades, tradePage, tradePageSize),
    [sortedTrades, tradePage, tradePageSize],
  );

  const updateTradeSort = (key: TradeSortKey) => {
    setTradeSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
    setTradePage(0);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setTradePage(0);
  };

  const handleSideChange = (value: TradeSideFilter) => {
    setSide(value);
    setTradePage(0);
  };

  return (
    <DataPanel
      title="매매내역"
      subtitle={`${sortedTrades.length.toLocaleString('ko-KR')}건`}
      search={{
        value: query,
        onChange: handleQueryChange,
        placeholder: '종목·사유·리포트 ID',
      }}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            ariaLabel="매수/매도 필터"
            className="shrink-0"
            value={side}
            onValueChange={handleSideChange}
            options={sideOptions}
          />
          <CsvDownloadButton label="CSV" onClick={() => downloadTrades(sortedTrades)} />
        </div>
      }
      pagination={{
        page: tradePage,
        pageCount: Math.ceil(sortedTrades.length / tradePageSize),
        totalRows: sortedTrades.length,
        pageSize: tradePageSize,
        onPageChange: setTradePage,
        onPageSizeChange: (size) => {
          setTradePageSize(size);
          setTradePage(0);
        },
      }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left">
              <SortHeader label="거래일" sortKey="date" sort={tradeSort} onSort={updateTradeSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="종목" sortKey="symbol" sort={tradeSort} onSort={updateTradeSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="구분" sortKey="side" sort={tradeSort} onSort={updateTradeSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="수량" sortKey="qty" sort={tradeSort} onSort={updateTradeSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="체결가" sortKey="price" sort={tradeSort} onSort={updateTradeSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="금액" sortKey="gross" sort={tradeSort} onSort={updateTradeSort} />
            </th>
            <th className="px-3 py-2 text-right">
              <SortHeader label="실현손익" sortKey="pnl" sort={tradeSort} onSort={updateTradeSort} />
            </th>
            <th className="px-3 py-2 text-left">
              <SortHeader label="사유" sortKey="reason" sort={tradeSort} onSort={updateTradeSort} />
            </th>
            <th className="px-3 py-2 text-left">리포트</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tradeRows.length === 0 ? (
            <tr>
              <td colSpan={9}>
                <EmptyTableState
                  message="조건에 맞는 매매가 없습니다"
                  actionLabel="검색 초기화"
                  onAction={() => {
                    handleQueryChange('');
                    handleSideChange('all');
                  }}
                />
              </td>
            </tr>
          ) : (
            tradeRows.map((trade) => {
              const target =
                (trade.reportId ? targetsByReportId[trade.reportId] : undefined) ?? targetsBySymbol[trade.symbol];
              const displayName = tradeDisplayName(trade.symbol, target?.company ?? trade.company);
              const reportSymbol = trade.reportId ? reportSymbolsById[trade.reportId] : null;

              return (
                <tr
                  className="hover:bg-slate-50"
                  key={`${trade.account_id}-${trade.date}-${trade.symbol}-${trade.side}-${trade.qty ?? 'q'}-${trade.fillPriceKrw ?? 'p'}-${trade.grossKrw ?? 'g'}-${trade.reportId ?? 'no-report'}-${trade.cashAfterKrw ?? 'cash'}`}
                >
                  <td className="px-3 py-2 font-mono text-xs text-slate-950">{trade.date}</td>
                  <td className="px-3 py-2">
                    {target ? (
                      <Link className="font-semibold text-slate-950 hover:underline" href={reportTargetHref(target)}>
                        {displayName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-950">{displayName}</span>
                    )}
                    {displayName !== trade.symbol ? (
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">{trade.symbol}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                        trade.side === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {trade.side === 'buy' ? '매수' : '매도'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {trade.qty?.toLocaleString('ko-KR') ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money native={trade.fillPriceNative} krw={trade.fillPriceKrw} currency={trade.currency} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatKrw(Math.abs(trade.grossKrw ?? 0))}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-mono font-semibold tabular-nums ${signedTextClass(
                      trade.realizedPnlKrw,
                    )}`}
                  >
                    {trade.side === 'sell' ? formatSignedKrw(trade.realizedPnlKrw) : '-'}
                  </td>
                  <td className="max-w-[18rem] truncate px-3 py-2 text-sm text-slate-700">
                    {humanReason(trade.reason)}
                  </td>
                  <td className="px-3 py-2">
                    {trade.reportId && reportSymbol ? (
                      <Link
                        className="text-sm text-slate-700 hover:underline"
                        href={`/reports/${encodeURIComponent(reportSymbol)}/${encodeURIComponent(trade.reportId)}`}
                      >
                        보기
                      </Link>
                    ) : (
                      '-'
                    )}
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

function humanReason(reason: string): string {
  if (reason.includes('retained_cap_trim')) return '보유 비중 조절';
  if (reason.includes('target_hit')) return '목표가 도달';
  if (reason.includes('stop')) return '손절/리스크 제한';
  if (reason.includes('rebalance_buy')) return '리밸런싱 매수';
  if (reason.includes('rebalance_sell')) return '리밸런싱 매도';
  if (reason.includes('time')) return '시간 손절';
  return reason.replace(/[()']/g, '') || '-';
}

function downloadTrades(rows: TradeRow[]) {
  const headers = [
    'date',
    'account_id',
    'side',
    'symbol',
    'company',
    'currency',
    'qty',
    'fill_price_native',
    'fill_price_krw',
    'gross_native',
    'gross_krw',
    'realized_pnl_krw',
    'cash_after_krw',
    'reason',
    'report_id',
  ];
  const data = rows.map((row) => [
    row.date,
    row.account_id,
    row.side,
    row.symbol,
    row.company,
    row.currency,
    row.qty ?? '',
    row.fillPriceNative ?? '',
    row.fillPriceKrw ?? '',
    row.grossNative ?? '',
    row.grossKrw ?? '',
    row.realizedPnlKrw ?? '',
    row.cashAfterKrw ?? '',
    row.reason,
    row.reportId ?? '',
  ]);
  downloadCsv('snusmic-trades-filtered.csv', headers, data);
}

function formatSignedKrw(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatKrw(value)}`;
}

function initialUrlQuery(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('q') ?? params.get('symbol') ?? '';
}
