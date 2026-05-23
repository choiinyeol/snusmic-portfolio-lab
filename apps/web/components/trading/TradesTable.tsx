'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { Money } from '@/components/ui/Money';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { CsvDownloadButton, DataPanel, EmptyTableState, downloadCsv } from '@/components/ui/data-panel';
import type { ReportTargetDigest, TradeRow } from '@/lib/artifacts';
import { formatKrw } from '@/lib/format';
import { marketLabel, reportTargetHref, tradeDisplayName } from './helpers';
import { SortHeader, pageRows, sortRows, type SortState } from './TableControls';

type Props = {
  trades: TradeRow[];
  /** Account controlled by the parent — single source of truth. */
  account_id: string;
  accountLabels: Record<string, string>;
  reportSymbolsById: Record<string, string>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
  targetsByReportId: Record<string, ReportTargetDigest>;
};

type TradeSortKey =
  | 'date'
  | 'account'
  | 'market'
  | 'side'
  | 'symbol'
  | 'target'
  | 'qty'
  | 'price'
  | 'gross'
  | 'cash'
  | 'reason';

export function TradesTable({
  trades,
  account_id,
  accountLabels,
  reportSymbolsById,
  targetsBySymbol,
  targetsByReportId,
}: Props) {
  const [query, setQuery] = useState(() => initialUrlQuery());
  const [side, setSide] = useState('all');
  const [tradeSort, setTradeSort] = useState<SortState<TradeSortKey>>({ key: 'date', direction: 'desc' });
  const [tradePage, setTradePage] = useState(0);
  const [tradePageSize, setTradePageSize] = useState(50);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredTrades = useMemo(
    () =>
      trades.filter((trade) => {
        if (trade.account_id !== account_id) return false;
        if (side !== 'all' && trade.side !== side) return false;
        const haystack = `${trade.symbol} ${trade.company} ${trade.reason} ${trade.reportId ?? ''}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [normalizedQuery, account_id, side, trades],
  );
  const sortedTrades = useMemo(
    () =>
      sortRows(filteredTrades, tradeSort, {
        date: (row) => row.date,
        account: (row) => accountLabels[row.account_id] ?? row.account_id,
        market: (row) =>
          marketLabel(
            (row.reportId ? targetsByReportId[row.reportId]?.marketRegion : undefined) ??
              targetsBySymbol[row.symbol]?.marketRegion,
          ),
        side: (row) => row.side,
        symbol: (row) => tradeDisplayName(row.symbol, row.company),
        target: (row) =>
          (row.reportId ? targetsByReportId[row.reportId]?.targetPriceNative : undefined) ??
          targetsBySymbol[row.symbol]?.targetPriceNative ??
          targetsBySymbol[row.symbol]?.targetPriceKrw,
        qty: (row) => row.qty,
        price: (row) => row.fillPriceKrw,
        gross: (row) => row.grossKrw,
        cash: (row) => row.cashAfterKrw,
        reason: (row) => row.reason,
      }),
    [filteredTrades, accountLabels, targetsByReportId, targetsBySymbol, tradeSort],
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
  const handleSideChange = (value: string) => {
    setSide(value);
    setTradePage(0);
  };

  return (
    <div className="grid gap-4">
      <div
        className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3"
        aria-label="매매내역 필터"
      >
        <input
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="심볼·사유·리포트 ID"
          aria-label="검색"
          className="min-h-9 w-64 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-normal text-slate-700 outline-none focus:border-slate-500"
        />
        <NativeSelect
          value={side}
          onChange={(event) => handleSideChange(event.target.value)}
          aria-label="매수/매도 필터"
          className="min-h-9 w-28 rounded-md border border-slate-200 bg-white px-2 py-2 text-sm leading-normal"
        >
          <NativeSelectOption value="all">전체</NativeSelectOption>
          <NativeSelectOption value="buy">매수</NativeSelectOption>
          <NativeSelectOption value="sell">매도</NativeSelectOption>
        </NativeSelect>
      </div>

      <DataPanel
        title="매매내역"
        subtitle={`${sortedTrades.length.toLocaleString('ko-KR')}건 · 포지션 단위 집계는 원장 사유와 체결 행 안에서 확인`}
        actions={<CsvDownloadButton label="매매 CSV" onClick={() => downloadTrades(sortedTrades)} />}
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
                <SortHeader label="일자" sortKey="date" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="전략" sortKey="account" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="시장" sortKey="market" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="구분" sortKey="side" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="심볼" sortKey="symbol" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="목표가" sortKey="target" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="수량" sortKey="qty" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="체결가" sortKey="price" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="체결금액" sortKey="gross" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="RP이자 잔고" sortKey="cash" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="사유" sortKey="reason" sort={tradeSort} onSort={updateTradeSort} />
              </th>
              <th className="px-3 py-2 text-left">근거</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tradeRows.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <EmptyTableState
                    message="조건에 맞는 매매가 없습니다"
                    actionLabel="검색·필터 초기화"
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
                return (
                  <tr
                    className="hover:bg-slate-50"
                    key={`${trade.account_id}-${trade.date}-${trade.symbol}-${trade.side}-${trade.qty ?? 'q'}-${trade.fillPriceKrw ?? 'p'}-${trade.grossKrw ?? 'g'}-${trade.reportId ?? 'no-report'}-${trade.cashAfterKrw ?? 'cash'}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-950">{trade.date}</td>
                    <td className="px-3 py-2 text-sm">{accountLabels[trade.account_id] ?? trade.account_id}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        {marketLabel(target?.marketRegion)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                          trade.side === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {trade.side === 'buy' ? '매수' : '매도'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        className="font-semibold text-slate-950 hover:underline"
                        href={target ? reportTargetHref(target) : `/reports/${encodeURIComponent(trade.symbol)}`}
                      >
                        {tradeDisplayName(trade.symbol, target?.company ?? trade.company)}
                      </Link>
                      {tradeDisplayName(trade.symbol, target?.company ?? trade.company) !== trade.symbol ? (
                        <div className="mt-0.5 font-mono text-[11px] text-slate-400">{trade.symbol}</div>
                      ) : null}
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
                            {target.publicationDate ?? '—'}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {trade.qty?.toLocaleString('ko-KR') ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Money native={trade.fillPriceNative} krw={trade.fillPriceKrw} currency={trade.currency} />
                    </td>
                    <td className="px-3 py-2">
                      <Money native={trade.grossNative} krw={trade.grossKrw} currency={trade.currency} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatKrw(trade.cashAfterKrw)}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{humanReason(trade.reason)}</td>
                    <td className="px-3 py-2">
                      {trade.reportId && reportSymbolsById[trade.reportId] ? (
                        <Link
                          className="text-sm text-slate-700 hover:underline"
                          href={`/reports/${encodeURIComponent(reportSymbolsById[trade.reportId])}/${encodeURIComponent(trade.reportId)}`}
                        >
                          리포트
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DataPanel>
    </div>
  );
}

function humanReason(reason: string): string {
  if (reason.includes('target_hit')) return '목표가 도달';
  if (reason.includes('stop')) return '손절/리스크 제한';
  if (reason.includes('rebalance_buy')) return '리밸런싱 매수';
  if (reason.includes('rebalance_sell')) return '리밸런싱 매도';
  if (reason.includes('time')) return '시간 손절';
  return reason.replace(/[()']/g, '') || '—';
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
    row.cashAfterKrw ?? '',
    row.reason,
    row.reportId ?? '',
  ]);
  downloadCsv('snusmic-trades-filtered.csv', headers, data);
}

function initialUrlQuery(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('q') ?? params.get('symbol') ?? '';
}
