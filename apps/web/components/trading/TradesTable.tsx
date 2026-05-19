'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import { Money } from '@/components/ui/Money';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { CsvDownloadButton, DataPanel, EmptyTableState, downloadCsv } from '@/components/ui/data-panel';
import type { PositionEpisodeRow, ReportTargetDigest, TradeRow } from '@/lib/artifacts';
import { formatDays, formatKrw, formatPercent } from '@/lib/format';
import { capitalContribution, marketLabel, reportTargetHref } from './helpers';
import { SortHeader, pageRows, sortRows, type SortState } from './TableControls';

type Props = {
  trades: TradeRow[];
  episodes: PositionEpisodeRow[];
  /** Strategy controlled by the parent — single source of truth. */
  persona: string;
  personaLabels: Record<string, string>;
  capitalByPersona: Record<string, number>;
  reportSymbolsById: Record<string, string>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
  targetsByReportId: Record<string, ReportTargetDigest>;
};

type EpisodeSortKey =
  | 'strategy'
  | 'market'
  | 'symbol'
  | 'target'
  | 'openDate'
  | 'closeDate'
  | 'holdingDays'
  | 'entry'
  | 'exit'
  | 'stockReturn'
  | 'contribution'
  | 'reason';
type TradeSortKey =
  | 'date'
  | 'strategy'
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
  episodes,
  persona,
  personaLabels,
  capitalByPersona = {},
  reportSymbolsById,
  targetsBySymbol,
  targetsByReportId,
}: Props) {
  const [query, setQuery] = useState(() => initialUrlQuery());
  const [side, setSide] = useState('all');
  const [episodeSort, setEpisodeSort] = useState<SortState<EpisodeSortKey>>({ key: 'openDate', direction: 'desc' });
  const [tradeSort, setTradeSort] = useState<SortState<TradeSortKey>>({ key: 'date', direction: 'desc' });
  const [episodePage, setEpisodePage] = useState(0);
  const [tradePage, setTradePage] = useState(0);
  const [episodePageSize, setEpisodePageSize] = useState(25);
  const [tradePageSize, setTradePageSize] = useState(50);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredTrades = useMemo(
    () =>
      trades.filter((trade) => {
        if (trade.persona !== persona) return false;
        if (side !== 'all' && trade.side !== side) return false;
        const haystack = `${trade.symbol} ${trade.reason} ${trade.reportId ?? ''}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [normalizedQuery, persona, side, trades],
  );
  const filteredEpisodes = useMemo(
    () =>
      episodes.filter((episode) => {
        if (episode.persona !== persona) return false;
        const haystack = `${episode.symbol} ${episode.company} ${episode.exitReasons}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      }),
    [episodes, normalizedQuery, persona],
  );
  const sortedEpisodes = useMemo(
    () =>
      sortRows(filteredEpisodes, episodeSort, {
        strategy: (row) => personaLabels[row.persona] ?? row.persona,
        market: (row) => marketLabel(targetsBySymbol[row.symbol]?.marketRegion),
        symbol: (row) => row.company || row.symbol,
        target: (row) => targetsBySymbol[row.symbol]?.targetPriceNative ?? targetsBySymbol[row.symbol]?.targetPriceKrw,
        openDate: (row) => row.openDate,
        closeDate: (row) => row.closeDate ?? '9999-99-99',
        holdingDays: (row) => row.holdingDays,
        entry: (row) => row.avgEntryPriceKrw,
        exit: (row) => row.avgExitPriceKrw ?? row.lastCloseKrw,
        stockReturn: (row) => positionReturn(row),
        contribution: (row) =>
          capitalContribution(
            row.status === 'closed' ? row.realizedPnlKrw : row.unrealizedPnlKrw,
            capitalByPersona[row.persona],
          ),
        reason: (row) => row.exitReasons,
      }),
    [capitalByPersona, episodeSort, filteredEpisodes, personaLabels, targetsBySymbol],
  );
  const sortedTrades = useMemo(
    () =>
      sortRows(filteredTrades, tradeSort, {
        date: (row) => row.date,
        strategy: (row) => personaLabels[row.persona] ?? row.persona,
        market: (row) =>
          marketLabel(
            (row.reportId ? targetsByReportId[row.reportId]?.marketRegion : undefined) ??
              targetsBySymbol[row.symbol]?.marketRegion,
          ),
        side: (row) => row.side,
        symbol: (row) => row.symbol,
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
    [filteredTrades, personaLabels, targetsByReportId, targetsBySymbol, tradeSort],
  );
  const episodeRows = useMemo(
    () => pageRows(sortedEpisodes, episodePage, episodePageSize),
    [episodePage, episodePageSize, sortedEpisodes],
  );
  const tradeRows = useMemo(
    () => pageRows(sortedTrades, tradePage, tradePageSize),
    [sortedTrades, tradePage, tradePageSize],
  );
  const updateEpisodeSort = (key: EpisodeSortKey) => {
    setEpisodeSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
    setEpisodePage(0);
  };
  const updateTradeSort = (key: TradeSortKey) => {
    setTradeSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
    setTradePage(0);
  };
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setEpisodePage(0);
    setTradePage(0);
  };
  const handleSideChange = (value: string) => {
    setSide(value);
    setTradePage(0);
  };

  return (
    <div className="grid gap-4">
      {/* Shared filter row drives both episodes + trades since the user
       * cross-references one against the other. Putting it once at the
       * top keeps each DataPanel header focused on the table itself. */}
      <div
        className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3"
        aria-label="매매 필터"
      >
        <input
          type="search"
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="심볼·사유·리포트 ID"
          aria-label="검색"
          className="h-8 w-64 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-slate-500"
        />
        <NativeSelect
          value={side}
          onChange={(event) => handleSideChange(event.target.value)}
          aria-label="매수/매도 필터"
          className="h-8 w-28 rounded-md border border-slate-200 bg-white px-2 text-xs"
        >
          <NativeSelectOption value="all">전체</NativeSelectOption>
          <NativeSelectOption value="buy">매수</NativeSelectOption>
          <NativeSelectOption value="sell">매도</NativeSelectOption>
        </NativeSelect>
      </div>

      <DataPanel
        title="포지션 단위 매수·매도"
        subtitle={`${sortedEpisodes.length.toLocaleString('ko-KR')}건`}
        actions={
          <CsvDownloadButton label="에피소드 CSV" onClick={() => downloadEpisodes(sortedEpisodes, targetsBySymbol)} />
        }
        pagination={{
          page: episodePage,
          pageCount: Math.ceil(sortedEpisodes.length / episodePageSize),
          totalRows: sortedEpisodes.length,
          pageSize: episodePageSize,
          onPageChange: setEpisodePage,
          onPageSizeChange: (size) => {
            setEpisodePageSize(size);
            setEpisodePage(0);
          },
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left">
                <SortHeader label="전략" sortKey="strategy" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="시장" sortKey="market" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="종목" sortKey="symbol" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="목표가" sortKey="target" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="매수 시작" sortKey="openDate" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="매도/상태" sortKey="closeDate" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="보유일" sortKey="holdingDays" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="평균 진입" sortKey="entry" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="평균 청산/최근" sortKey="exit" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="종목 수익률" sortKey="stockReturn" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-right">
                <SortHeader label="자본 기여" sortKey="contribution" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader label="매도 기준" sortKey="reason" sort={episodeSort} onSort={updateEpisodeSort} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {episodeRows.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <EmptyTableState
                    message="조건에 맞는 포지션이 없습니다"
                    actionLabel="검색 초기화"
                    onAction={() => handleQueryChange('')}
                  />
                </td>
              </tr>
            ) : (
              episodeRows.map((episode) => {
                const pnl = episode.status === 'closed' ? episode.realizedPnlKrw : episode.unrealizedPnlKrw;
                const stockReturn = positionReturn(episode);
                const contribution = capitalContribution(pnl, capitalByPersona[episode.persona]);
                const target = targetsBySymbol[episode.symbol];
                return (
                  <tr
                    key={`${episode.persona}-${episode.symbol}-${episode.openDate}-${episode.closeDate ?? 'open'}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-sm">{personaLabels[episode.persona] ?? episode.persona}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                        {marketLabel(target?.marketRegion)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        className="font-semibold text-slate-950 hover:underline"
                        href={target ? reportTargetHref(target) : `/reports/${encodeURIComponent(episode.symbol)}`}
                      >
                        {episode.company || episode.symbol}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{episode.symbol}</div>
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
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-slate-950">{episode.openDate}</span>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{episode.buyFills ?? 0}회 매수</div>
                    </td>
                    <td className="px-3 py-2">
                      {episode.closeDate ? (
                        <span className="font-mono text-xs text-slate-950">{episode.closeDate}</span>
                      ) : (
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                          보유중
                        </span>
                      )}
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">{episode.status}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{formatDays(episode.holdingDays)}</td>
                    <td className="px-3 py-2">
                      <Money
                        native={episode.avgEntryPriceNative}
                        krw={episode.avgEntryPriceKrw}
                        currency={episode.currency}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Money
                        native={episode.avgExitPriceNative ?? episode.lastCloseNative}
                        krw={episode.avgExitPriceKrw ?? episode.lastCloseKrw}
                        currency={episode.currency}
                      />
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">손익 {formatKrw(pnl)}</div>
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        (stockReturn ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatPercent(stockReturn)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-mono tabular-nums ${
                        (contribution ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatPercent(contribution)}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{humanReason(episode.exitReasons)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DataPanel>

      <DataPanel
        title="매매내역"
        subtitle={`${sortedTrades.length.toLocaleString('ko-KR')}건`}
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
                <SortHeader label="전략" sortKey="strategy" sort={tradeSort} onSort={updateTradeSort} />
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
                <SortHeader label="현금잔고" sortKey="cash" sort={tradeSort} onSort={updateTradeSort} />
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
                    key={`${trade.persona}-${trade.date}-${trade.symbol}-${trade.side}-${trade.qty ?? 'q'}-${trade.fillPriceKrw ?? 'p'}-${trade.grossKrw ?? 'g'}-${trade.reportId ?? 'no-report'}-${trade.cashAfterKrw ?? 'cash'}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-950">{trade.date}</td>
                    <td className="px-3 py-2 text-sm">{personaLabels[trade.persona] ?? trade.persona}</td>
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
                        {trade.symbol}
                      </Link>
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
    'persona',
    'side',
    'symbol',
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
    row.persona,
    row.side,
    row.symbol,
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

function downloadEpisodes(rows: PositionEpisodeRow[], targetsBySymbol: Record<string, ReportTargetDigest>) {
  const headers = [
    'persona',
    'symbol',
    'company',
    'currency',
    'open_date',
    'close_date',
    'status',
    'holding_days',
    'avg_entry_price_krw',
    'avg_exit_price_krw',
    'last_close_krw',
    'realized_pnl_krw',
    'unrealized_pnl_krw',
    'exit_reasons',
    'target_price_krw',
    'target_publication_date',
  ];
  const data = rows.map((row) => {
    const target = targetsBySymbol[row.symbol];
    return [
      row.persona,
      row.symbol,
      row.company,
      row.currency,
      row.openDate,
      row.closeDate ?? '',
      row.status,
      row.holdingDays ?? '',
      row.avgEntryPriceKrw ?? '',
      row.avgExitPriceKrw ?? '',
      row.lastCloseKrw ?? '',
      row.realizedPnlKrw ?? '',
      row.unrealizedPnlKrw ?? '',
      row.exitReasons ?? '',
      target?.targetPriceKrw ?? '',
      target?.publicationDate ?? '',
    ];
  });
  downloadCsv('snusmic-episodes-filtered.csv', headers, data);
}

function positionReturn(episode: PositionEpisodeRow): number | null {
  const exitOrLast = episode.avgExitPriceKrw ?? episode.lastCloseKrw;
  if (!episode.avgEntryPriceKrw || !exitOrLast || episode.avgEntryPriceKrw <= 0) return null;
  return exitOrLast / episode.avgEntryPriceKrw - 1;
}

function initialUrlQuery(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('q') ?? params.get('symbol') ?? '';
}
