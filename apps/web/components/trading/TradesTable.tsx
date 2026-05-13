'use client';

import Link from 'next/link';
import { useDeferredValue, useMemo, useState } from 'react';
import type { PositionEpisodeRow, ReportTargetDigest, TradeRow } from '@/lib/artifacts';
import { Money } from '@/components/ui/Money';
import { formatDays, formatKrw, formatPercent } from '@/lib/format';
import { PaginationControls, SortHeader, pageRows, sortRows, type SortState } from './TableControls';

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

  return (
    <div className="grid gap-4">
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-5">
          <div className="flex flex-wrap items-end gap-3" aria-label="매매 필터">
            <label className="form-control">
              <span className="label-text">매수/매도</span>
              <select
                className="select select-sm select-bordered"
                value={side}
                onChange={(event) => {
                  setSide(event.target.value);
                  setTradePage(0);
                }}
              >
                <option value="all">전체</option>
                <option value="buy">매수</option>
                <option value="sell">매도</option>
              </select>
            </label>
            <label className="form-control min-w-[260px]">
              <span className="label-text">검색</span>
              <input
                className="input input-sm input-bordered"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setEpisodePage(0);
                  setTradePage(0);
                }}
                placeholder="심볼, 사유, 리포트 ID"
              />
            </label>
            <button className="btn btn-sm btn-outline" type="button" onClick={() => downloadTrades(sortedTrades)}>
              CSV 다운로드
            </button>
          </div>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-2 p-5">
          <h2 className="card-title">포지션 단위 매수·매도</h2>
          <PaginationControls
            page={episodePage}
            pageCount={Math.ceil(sortedEpisodes.length / episodePageSize)}
            totalRows={sortedEpisodes.length}
            pageSize={episodePageSize}
            onPageChange={setEpisodePage}
            onPageSizeChange={(size) => {
              setEpisodePageSize(size);
              setEpisodePage(0);
            }}
          />
          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>
                    <SortHeader label="전략" sortKey="strategy" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader label="시장" sortKey="market" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader label="종목" sortKey="symbol" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader label="목표가" sortKey="target" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader label="매수 시작" sortKey="openDate" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader label="매도/상태" sortKey="closeDate" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader label="보유일" sortKey="holdingDays" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader label="평균 진입" sortKey="entry" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader label="평균 청산/최근" sortKey="exit" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                  <th>
                    <SortHeader
                      label="종목 수익률"
                      sortKey="stockReturn"
                      sort={episodeSort}
                      onSort={updateEpisodeSort}
                    />
                  </th>
                  <th>
                    <SortHeader
                      label="자본 기여"
                      sortKey="contribution"
                      sort={episodeSort}
                      onSort={updateEpisodeSort}
                    />
                  </th>
                  <th>
                    <SortHeader label="매도 기준" sortKey="reason" sort={episodeSort} onSort={updateEpisodeSort} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {episodeRows.map((episode) => {
                  const pnl = episode.status === 'closed' ? episode.realizedPnlKrw : episode.unrealizedPnlKrw;
                  const stockReturn = positionReturn(episode);
                  const contribution = capitalContribution(pnl, capitalByPersona[episode.persona]);
                  const target = targetsBySymbol[episode.symbol];
                  return (
                    <tr key={`${episode.persona}-${episode.symbol}-${episode.openDate}-${episode.closeDate ?? 'open'}`}>
                      <td>{personaLabels[episode.persona] ?? episode.persona}</td>
                      <td>
                        <span className="badge badge-ghost badge-sm">{marketLabel(target?.marketRegion)}</span>
                      </td>
                      <td>
                        <strong>
                          <Link className="link link-hover" href={`/reports/${encodeURIComponent(episode.symbol)}`}>
                            {episode.company || episode.symbol}
                          </Link>
                        </strong>
                        <div className="text-xs text-base-content/55">{episode.symbol}</div>
                      </td>
                      <td>
                        {target ? (
                          <Money
                            native={target.targetPriceNative}
                            krw={target.targetPriceKrw}
                            currency={target.currency}
                          />
                        ) : (
                          '—'
                        )}
                        <div className="text-xs text-base-content/55">{target?.publicationDate ?? '—'}</div>
                      </td>
                      <td>
                        <span className="font-mono text-xs">{episode.openDate}</span>
                        <div className="text-xs text-base-content/55">{episode.buyFills ?? 0}회 매수</div>
                      </td>
                      <td>
                        {episode.closeDate ? (
                          <span className="font-mono text-xs">{episode.closeDate}</span>
                        ) : (
                          <span className="badge badge-success badge-soft badge-sm">보유중</span>
                        )}
                        <div className="text-xs text-base-content/55">{episode.status}</div>
                      </td>
                      <td className="tabular-nums">{formatDays(episode.holdingDays)}</td>
                      <td>
                        <Money
                          native={episode.avgEntryPriceNative}
                          krw={episode.avgEntryPriceKrw}
                          currency={episode.currency}
                        />
                      </td>
                      <td>
                        <Money
                          native={episode.avgExitPriceNative ?? episode.lastCloseNative}
                          krw={episode.avgExitPriceKrw ?? episode.lastCloseKrw}
                          currency={episode.currency}
                        />
                        <div className="text-xs text-base-content/55">손익 {formatKrw(pnl)}</div>
                      </td>
                      <td className={`tabular-nums ${(stockReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {formatPercent(stockReturn)}
                      </td>
                      <td className={`tabular-nums ${(contribution ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>
                        {formatPercent(contribution)}
                      </td>
                      <td className="text-sm">{humanReason(episode.exitReasons)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-2 p-5">
          <h2 className="card-title">매매내역</h2>
          <PaginationControls
            page={tradePage}
            pageCount={Math.ceil(sortedTrades.length / tradePageSize)}
            totalRows={sortedTrades.length}
            pageSize={tradePageSize}
            onPageChange={setTradePage}
            onPageSizeChange={(size) => {
              setTradePageSize(size);
              setTradePage(0);
            }}
          />
          <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
            <table className="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>
                    <SortHeader label="일자" sortKey="date" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="전략" sortKey="strategy" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="시장" sortKey="market" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="구분" sortKey="side" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="심볼" sortKey="symbol" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="목표가" sortKey="target" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="수량" sortKey="qty" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="체결가" sortKey="price" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="체결금액" sortKey="gross" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="현금잔고" sortKey="cash" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>
                    <SortHeader label="사유" sortKey="reason" sort={tradeSort} onSort={updateTradeSort} />
                  </th>
                  <th>근거</th>
                </tr>
              </thead>
              <tbody>
                {tradeRows.map((trade) => {
                  const target =
                    (trade.reportId ? targetsByReportId[trade.reportId] : undefined) ?? targetsBySymbol[trade.symbol];
                  return (
                    <tr
                      key={`${trade.persona}-${trade.date}-${trade.symbol}-${trade.side}-${trade.qty ?? 'q'}-${trade.fillPriceKrw ?? 'p'}-${trade.grossKrw ?? 'g'}-${trade.reportId ?? 'no-report'}-${trade.cashAfterKrw ?? 'cash'}`}
                    >
                      <td className="font-mono text-xs">{trade.date}</td>
                      <td>{personaLabels[trade.persona] ?? trade.persona}</td>
                      <td>
                        <span className="badge badge-ghost badge-sm">{marketLabel(target?.marketRegion)}</span>
                      </td>
                      <td>
                        <span
                          className={`badge badge-soft badge-sm ${trade.side === 'buy' ? 'badge-success' : 'badge-warning'}`}
                        >
                          {trade.side === 'buy' ? '매수' : '매도'}
                        </span>
                      </td>
                      <td>
                        <Link className="link link-hover" href={`/reports/${encodeURIComponent(trade.symbol)}`}>
                          {trade.symbol}
                        </Link>
                      </td>
                      <td>
                        {target ? (
                          <Money
                            native={target.targetPriceNative}
                            krw={target.targetPriceKrw}
                            currency={target.currency}
                          />
                        ) : (
                          '—'
                        )}
                        <div className="text-xs text-base-content/55">{target?.publicationDate ?? '—'}</div>
                      </td>
                      <td className="tabular-nums">{trade.qty?.toLocaleString('ko-KR') ?? '—'}</td>
                      <td>
                        <Money native={trade.fillPriceNative} krw={trade.fillPriceKrw} currency={trade.currency} />
                      </td>
                      <td>
                        <Money native={trade.grossNative} krw={trade.grossKrw} currency={trade.currency} />
                      </td>
                      <td className="tabular-nums">{formatKrw(trade.cashAfterKrw)}</td>
                      <td className="text-sm">{humanReason(trade.reason)}</td>
                      <td>
                        {trade.reportId && reportSymbolsById[trade.reportId] ? (
                          <Link
                            className="link link-hover"
                            href={`/reports/${encodeURIComponent(reportSymbolsById[trade.reportId])}`}
                          >
                            리포트
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
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
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      [
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
      ]
        .map(csvEscape)
        .join(','),
    ),
  ].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'snusmic-trades-filtered.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function positionReturn(episode: PositionEpisodeRow): number | null {
  const exitOrLast = episode.avgExitPriceKrw ?? episode.lastCloseKrw;
  if (!episode.avgEntryPriceKrw || !exitOrLast || episode.avgEntryPriceKrw <= 0) return null;
  return exitOrLast / episode.avgEntryPriceKrw - 1;
}

function capitalContribution(pnl: number | null, capital: number | undefined): number | null {
  if (pnl === null || pnl === undefined || !capital || capital <= 0) return null;
  return pnl / capital;
}

function marketLabel(region: 'domestic' | 'overseas' | undefined): string {
  return region === 'domestic' ? '국내' : '해외';
}

function initialUrlQuery(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('q') ?? params.get('symbol') ?? '';
}
