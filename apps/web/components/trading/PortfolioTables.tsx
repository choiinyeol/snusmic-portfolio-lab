'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import type { HoldingRow, ReportTargetDigest } from '@/lib/artifacts';
import { formatDays, formatKrw, formatNativeWithKrw, formatPercent } from '@/lib/format';
import { PaginationControls, SortHeader, defaultPersonaFor, pageRows, sortRows, useUrlBackedStrategy, type SortState } from './TableControls';

type Props = {
  holdings: HoldingRow[];
  personaLabels: Record<string, string>;
  capitalByPersona: Record<string, number>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
};

type HoldingSortKey = 'strategy' | 'market' | 'symbol' | 'target' | 'qty' | 'avgCost' | 'lastClose' | 'marketValue' | 'stockReturn' | 'contribution' | 'firstBuy';

export function PortfolioTables({ holdings, personaLabels, capitalByPersona = {}, targetsBySymbol }: Props) {
  const personas = useMemo(() => Array.from(new Set(holdings.map((row) => row.persona))).sort(), [holdings]);
  const [persona, setPersona] = useState(() => defaultPersonaFor(personas));
  const [sort, setSort] = useState<SortState<HoldingSortKey>>({ key: 'marketValue', direction: 'desc' });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  useUrlBackedStrategy(persona, setPersona, personas);
  const currentRows = useMemo(() => sortRows(holdings.filter((row) => row.persona === persona), sort, {
    strategy: (row) => personaLabels[row.persona] ?? row.persona,
    market: (row) => marketLabel(targetsBySymbol[row.symbol]?.marketRegion),
    symbol: (row) => row.company || row.symbol,
    target: (row) => targetsBySymbol[row.symbol]?.targetPriceNative ?? targetsBySymbol[row.symbol]?.targetPriceKrw,
    qty: (row) => row.qty,
    avgCost: (row) => row.avgCostKrw,
    lastClose: (row) => row.lastCloseKrw,
    marketValue: (row) => row.marketValueKrw,
    stockReturn: (row) => row.unrealizedReturn,
    contribution: (row) => capitalContribution(row.unrealizedPnlKrw, capitalByPersona[row.persona]),
    firstBuy: (row) => row.firstBuyDate,
  }), [capitalByPersona, holdings, persona, personaLabels, sort, targetsBySymbol]);
  const visibleRows = useMemo(() => pageRows(currentRows, page, pageSize), [currentRows, page, pageSize]);
  const updateSort = (key: HoldingSortKey) => {
    setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
    setPage(0);
  };

  return (
    <div className="grid gap-4">
      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-5"><h2 className="card-title">전략 선택</h2>
        <div className="tabs tabs-box w-fit max-w-full overflow-x-auto bg-base-200" role="group" aria-label="전략 선택">
          {personas.map((item) => (
            <button type="button" key={item} aria-pressed={persona === item} className={persona === item ? 'tab tab-active font-bold' : 'tab'} onClick={() => { setPersona(item); setPage(0); }}>
              {personaLabels[item] ?? item}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="포트폴리오 필터">
          <button className="btn btn-sm btn-outline" type="button" onClick={() => downloadHoldings(currentRows, targetsBySymbol)}>현재 포트폴리오 CSV</button>
        </div>
        </div>
      </section>

      <section className="card border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body gap-2 p-5">
        <h2 className="card-title">현재 보유 포트폴리오</h2>
        <p className="text-base-content/65">현재 어떤 종목을 얼마나 들고 있는지, 목표가·시장구분·평단·최근가·미실현 손익을 바로 확인합니다.</p>
        <PaginationControls page={page} pageCount={Math.ceil(currentRows.length / pageSize)} totalRows={currentRows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(0); }} />
        <div className="table-wrap inset overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
          <table className="table table-sm table-zebra">
            <thead><tr>
              <th><SortHeader label="전략" sortKey="strategy" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="시장" sortKey="market" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="종목" sortKey="symbol" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="목표가" sortKey="target" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="수량" sortKey="qty" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="평단" sortKey="avgCost" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="최근가" sortKey="lastClose" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="평가액" sortKey="marketValue" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="종목 수익률" sortKey="stockReturn" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="자본 기여" sortKey="contribution" sort={sort} onSort={updateSort} /></th>
              <th><SortHeader label="최초 매수" sortKey="firstBuy" sort={sort} onSort={updateSort} /></th>
            </tr></thead>
            <tbody>
              {visibleRows.map((row) => {
                const contribution = capitalContribution(row.unrealizedPnlKrw, capitalByPersona[row.persona]);
                const target = targetsBySymbol[row.symbol];
                return (
                  <tr key={`${row.persona}-${row.symbol}`}>
                    <td>{personaLabels[row.persona] ?? row.persona}</td>
                    <td><span className="badge badge-ghost badge-sm">{marketLabel(target?.marketRegion)}</span></td>
                    <td><strong><Link href={`/reports/${row.symbol}`}>{row.company || row.symbol}</Link></strong><div className="muted">{row.symbol}</div></td>
                    <td>{formatTarget(target)}<div className="muted">{target?.publicationDate ?? '—'}</div></td>
                    <td>{row.qty?.toLocaleString('ko-KR') ?? '—'}</td>
                    <td>{formatHoldingPrice(nativeFromKrw(row.avgCostKrw, row.lastCloseNative, row.lastCloseKrw), row.avgCostKrw, row.currency)}</td>
                    <td>{(() => {
                      const { primary, secondary } = formatNativeWithKrw(row.lastCloseNative, row.lastCloseKrw, row.currency);
                      return (
                        <>
                          {primary}
                          {secondary ? <div className="muted" style={{ fontSize: '.74rem' }}>{secondary}</div> : null}
                        </>
                      );
                    })()}</td>
                    <td>{(() => {
                      const nativeValue = row.lastCloseNative !== null && row.qty !== null ? row.lastCloseNative * row.qty : null;
                      const { primary, secondary } = formatNativeWithKrw(nativeValue, row.marketValueKrw, row.currency);
                      return (
                        <>
                          {primary}
                          <div className="muted">{secondary ?? `손익 ${formatKrw(row.unrealizedPnlKrw)}`}</div>
                          {secondary ? <div className="muted">손익 {formatKrw(row.unrealizedPnlKrw)}</div> : null}
                        </>
                      );
                    })()}</td>
                    <td className={(row.unrealizedReturn ?? 0) >= 0 ? 'good' : 'bad'}>{formatPercent(row.unrealizedReturn)}</td>
                    <td className={(contribution ?? 0) >= 0 ? 'good' : 'bad'}>{formatPercent(contribution)}</td>
                    <td>{row.firstBuyDate}<div className="muted">{formatDays(row.holdingDays)}</div></td>
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

function downloadHoldings(rows: HoldingRow[], targetsBySymbol: Record<string, ReportTargetDigest>) {
  const headers = ['persona', 'market_region', 'symbol', 'company', 'currency', 'target_price_krw', 'target_publication_date', 'qty', 'avg_cost_krw', 'last_close_native', 'last_close_krw', 'market_value_krw', 'unrealized_pnl_krw', 'unrealized_return', 'first_buy_date'];
  const csv = [headers.join(','), ...rows.map((row) => {
    const target = targetsBySymbol[row.symbol];
    return [row.persona, target?.marketRegion ?? '', row.symbol, row.company, row.currency, target?.targetPriceKrw ?? '', target?.publicationDate ?? '', row.qty ?? '', row.avgCostKrw ?? '', row.lastCloseNative ?? '', row.lastCloseKrw ?? '', row.marketValueKrw ?? '', row.unrealizedPnlKrw ?? '', row.unrealizedReturn ?? '', row.firstBuyDate ?? ''].map(csvEscape).join(',');
  })].join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'snusmic-current-portfolio.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function capitalContribution(pnl: number | null, capital: number | undefined): number | null {
  if (pnl === null || pnl === undefined || !capital || capital <= 0) return null;
  return pnl / capital;
}

function marketLabel(region: 'domestic' | 'overseas' | undefined): string {
  return region === 'domestic' ? '국내' : '해외';
}

function formatTarget(target: ReportTargetDigest | undefined): ReactNode {
  if (!target) return '—';
  const { primary, secondary } = formatNativeWithKrw(target.targetPriceNative, target.targetPriceKrw, target.currency);
  return (
    <>
      {primary}
      {secondary ? <div className="muted" style={{ fontSize: '.74rem' }}>{secondary}</div> : null}
    </>
  );
}

function formatHoldingPrice(
  native: number | null,
  krw: number | null,
  currency: string,
): ReactNode {
  const { primary, secondary } = formatNativeWithKrw(native, krw, currency);
  return (
    <>
      {primary}
      {secondary ? <div className="muted" style={{ fontSize: '.74rem' }}>{secondary}</div> : null}
    </>
  );
}

function nativeFromKrw(
  krw: number | null,
  nativeReference: number | null,
  krwReference: number | null,
): number | null {
  if (krw === null || nativeReference === null || krwReference === null || krwReference <= 0) return krw;
  return krw * nativeReference / krwReference;
}
