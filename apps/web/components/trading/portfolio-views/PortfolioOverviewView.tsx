'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SortHeader, sortRows, type SortState } from '@/components/trading/TableControls';
import { Money } from '@/components/ui/Money';
import { TradesTable } from '@/components/trading/TradesTable';
import type { HoldingRow, ReportTargetDigest } from '@/lib/artifacts';
import { formatDays, formatKrw, formatMultiple, formatPercent, signedTextClass } from '@/lib/format';
import { compactTicker, nativeFromKrw, reportTargetHref, stockDisplayName } from '../helpers';
import { PortfolioEquityTradeChart } from './PortfolioEquityTradeChart';
import type { PortfolioViewModel } from './types';

export function PortfolioOverviewView({ model }: { model: PortfolioViewModel }) {
  const accountId = model.selectedAccount;
  const accountLabel = model.accountLabels[accountId] ?? accountId;
  const diagnostics = model.ledgerDiagnostics;

  const holdings = useMemo(
    () =>
      model.holdings
        .filter((row) => row.account_id === accountId)
        .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0)),
    [model.holdings, accountId],
  );
  const accountTrades = useMemo(
    () => model.trades.filter((row) => row.account_id === accountId),
    [model.trades, accountId],
  );

  return (
    <div className="grid min-w-0 gap-4">
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <nav className="flex min-h-10 items-center gap-1" aria-label="포트폴리오 요약 섹션">
            <SectionLink href="#positions" label="종목" active />
            <SectionLink href="#chart" label="차트" />
            <SectionLink href="#history" label="내역" />
          </nav>
          <div className="font-mono text-xs text-slate-400">updated {model.latestEquityDate}</div>
        </div>

        <div id="positions" className="p-4">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                보유 종목 <span className="text-sm font-medium text-slate-400">({holdings.length}개)</span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                현재 원장을 움직이는 종목, 매입가, 현재가, 보유일, 수익률만 봅니다.
              </p>
            </div>
          </div>
          <CompactHoldingsTable holdings={holdings} targetsBySymbol={model.targetsBySymbol} />
        </div>
      </section>

      <section id="chart" className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">누적 성과</h2>
            <p className="mt-1 text-sm text-slate-500">
              {accountLabel} 수익률을 벤치마크와 함께 보고, 필요한 매수·매도 마커를 켭니다.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-400">{model.equity.length.toLocaleString('ko-KR')}점</div>
        </div>
        <PortfolioEquityTradeChart
          equity={model.equity}
          benchmarkAccounts={model.benchmarkAccounts}
          trades={model.trades}
          account_id={accountId}
          label={accountLabel}
          accountLabels={model.accountLabels}
          height={430}
        />
      </section>

      <section id="history" className="grid gap-4">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">매매 진단</h2>
              <p className="mt-1 text-sm text-slate-500">승률보다 손익비와 손절 폭이 이 원장을 설명합니다.</p>
            </div>
            <div className="font-mono text-xs text-slate-400">
              closed {diagnostics.closedEpisodeCount.toLocaleString('ko-KR')}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <MetricCell label="승률" value={formatPercent(diagnostics.winRate)} />
            <MetricCell label="손익비" value={formatMultiple(diagnostics.payoffRatio)} />
            <MetricCell label="평균 R" value={formatRMultiple(diagnostics.avgRMultiple)} />
            <MetricCell label="평균 이익" value={formatKrw(diagnostics.avgWinKrw)} tone={diagnostics.avgWinKrw} />
            <MetricCell label="평균 손실" value={formatKrw(diagnostics.avgLossKrw)} tone={diagnostics.avgLossKrw} />
            <MetricCell
              label="최대 연속 손절"
              value={`${diagnostics.maxConsecutiveLosses.toLocaleString('ko-KR')}회`}
            />
          </div>
        </section>

        <TradesTable
          account_id={accountId}
          accountLabels={model.accountLabels}
          reportSymbolsById={model.reportSymbolsById}
          targetsByReportId={model.targetsByReportId}
          targetsBySymbol={model.targetsBySymbol}
          trades={accountTrades}
        />
      </section>
    </div>
  );
}

function SectionLink({ href, label, active = false }: { href: string; label: string; active?: boolean }) {
  return (
    <a
      className={`inline-flex min-h-9 items-center rounded-md px-4 text-sm font-semibold transition ${
        active
          ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950'
      }`}
      href={href}
    >
      {label}
    </a>
  );
}

function CompactHoldingsTable({
  holdings,
  targetsBySymbol,
}: {
  holdings: HoldingRow[];
  targetsBySymbol: Record<string, ReportTargetDigest>;
}) {
  const [sort, setSort] = useState<SortState<HoldingSortKey>>({ key: 'marketValue', direction: 'desc' });
  const sortedHoldings = useMemo(
    () =>
      sortRows(holdings, sort, {
        symbol: (row) => stockDisplayName(row.symbol, row.company),
        avgCost: (row) => row.avgCostKrw,
        lastClose: (row) => row.lastCloseKrw,
        holdingDays: (row) => row.holdingDays,
        returnPct: (row) => row.unrealizedReturn,
        marketValue: (row) => row.marketValueKrw,
      }),
    [holdings, sort],
  );
  const updateSort = (key: HoldingSortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  if (!holdings.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        현재 보유 종목이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium">
              <SortHeader label="종목" sortKey="symbol" sort={sort} onSort={updateSort} />
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <span className="flex justify-end">
                <SortHeader label="매입가" sortKey="avgCost" sort={sort} onSort={updateSort} />
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <span className="flex justify-end">
                <SortHeader label="현재가" sortKey="lastClose" sort={sort} onSort={updateSort} />
              </span>
            </th>
            <th className="px-3 py-2 text-center font-medium">
              <span className="flex justify-center">
                <SortHeader label="보유일" sortKey="holdingDays" sort={sort} onSort={updateSort} />
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <span className="flex justify-end">
                <SortHeader label="수익률" sortKey="returnPct" sort={sort} onSort={updateSort} />
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium">
              <span className="flex justify-end">
                <SortHeader label="평가액" sortKey="marketValue" sort={sort} onSort={updateSort} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedHoldings.map((holding) => {
            const target = targetsBySymbol[holding.symbol];
            const name = stockDisplayName(holding.symbol, holding.company);
            const ticker = compactTicker(holding.symbol);
            return (
              <tr className="hover:bg-slate-50" key={`${holding.account_id}-${holding.symbol}`}>
                <td className="px-3 py-2">
                  {target ? (
                    <Link className="font-semibold text-slate-950 hover:underline" href={reportTargetHref(target)}>
                      {name}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-950">{name}</span>
                  )}
                  {name !== ticker ? <div className="mt-0.5 font-mono text-[11px] text-slate-400">{ticker}</div> : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money
                    native={nativeFromKrw(holding.avgCostKrw, holding.lastCloseNative, holding.lastCloseKrw)}
                    krw={holding.avgCostKrw}
                    currency={holding.currency}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money native={holding.lastCloseNative} krw={holding.lastCloseKrw} currency={holding.currency} />
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="rounded bg-emerald-50 px-2 py-1 font-mono text-xs font-semibold text-emerald-600">
                    {formatDays(holding.holdingDays)}
                  </span>
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono font-semibold tabular-nums ${signedTextClass(
                    holding.unrealizedPnlKrw,
                  )}`}
                >
                  {formatPercent(holding.unrealizedReturn)}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-slate-950">
                  {formatKrw(holding.marketValueKrw)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type HoldingSortKey = 'symbol' | 'avgCost' | 'lastClose' | 'holdingDays' | 'returnPct' | 'marketValue';

function MetricCell({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 font-mono text-lg font-semibold tabular-nums ${signedTextClass(tone)}`}>{value}</div>
    </div>
  );
}

function formatRMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value.toFixed(2)}R`;
}
