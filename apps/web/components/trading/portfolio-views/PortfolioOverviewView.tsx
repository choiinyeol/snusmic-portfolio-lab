'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SortHeader, sortRows, type SortState } from '@/components/trading/TableControls';
import { Money } from '@/components/ui/Money';
import type { HoldingRow, ReportTargetDigest, TradeRow } from '@/lib/artifacts';
import { formatDays, formatKrw, formatMultiple, formatPercent, signedTextClass } from '@/lib/format';
import { compactTicker, nativeFromKrw, reportTargetHref, stockDisplayName, tradeDisplayName } from '../helpers';
import { PortfolioEquityTradeChart } from './PortfolioEquityTradeChart';
import { portfolioRoleLabel } from '@/lib/portfolio-labels';
import type { PortfolioOverviewModel } from './types';

export function PortfolioOverviewView({ model }: { model: PortfolioOverviewModel }) {
  const accountId = model.accountId;
  const accountLabel = model.chart.accountLabel;
  const diagnostics = model.diagnostics;
  const context = model.context;

  const holdings = useMemo(
    () => [...model.holdings].sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0)),
    [model.holdings],
  );
  const holdingPreview = holdings.slice(0, 8);
  const recentTrades = useMemo(
    () => [...model.tradeTable.trades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [model.tradeTable.trades],
  );

  return (
    <div className="grid min-w-0 gap-4">
      <section id="chart" className="rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  canonical equity
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">누적 성과와 벤치마크</h2>
                <p className="mt-1 text-sm text-slate-500">
                  이 계좌의 기준 차트입니다. 전체 보유·거래 원장은 아래 링크에서 엽니다.
                </p>
              </div>
              <div className="font-mono text-xs text-slate-400">updated {model.chart.latestEquityDate || '-'}</div>
            </div>
            <PortfolioEquityTradeChart
              equity={model.chart.equity}
              benchmarkAccounts={model.chart.benchmarkAccounts}
              trades={model.chart.trades}
              account_id={accountId}
              label={accountLabel}
              accountLabels={model.chart.accountLabels}
              height={420}
            />
          </div>

          <aside className="grid gap-3">
            <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded bg-white px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">
                  {portfolioRoleLabel(context.role)}
                </span>
                <span className="text-xs text-slate-500">{context.category}</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{context.title}</div>
              <div className="mt-1 text-xs text-slate-500">{context.subtitle}</div>
              {context.shortlistReason ? (
                <p className="mt-2 text-xs leading-5 text-slate-600">{context.shortlistReason}</p>
              ) : null}
              <p className="mt-2 text-xs leading-5 text-slate-600">{context.comparisonPrompt}</p>
            </section>

            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <MetricCell
                label="누적수익률"
                value={formatPercent(diagnostics.cumulativeReturn)}
                tone={diagnostics.cumulativeReturn}
              />
              <MetricCell
                label="MDD"
                value={formatPercent(diagnostics.maxDrawdown)}
                tone={-Math.abs(diagnostics.maxDrawdown ?? 0)}
              />
              <MetricCell label="승률" value={formatPercent(diagnostics.winRate)} />
              <MetricCell label="손익비" value={formatMultiple(diagnostics.payoffRatio)} />
            </section>

            <section className="grid gap-2">
              <RouteCard
                href={`/portfolio/${accountId}/holdings`}
                label="보유 전체 원장"
                value={`${holdings.length.toLocaleString('ko-KR')}개 종목`}
                caption="전체 보유 비중과 손익은 holdings에서 확인합니다."
              />
              <RouteCard
                href={`/portfolio/${accountId}/trades`}
                label="거래 전체 원장"
                value={`${model.tradeTable.trades.length.toLocaleString('ko-KR')}건 체결`}
                caption="체결 로그와 사유별 흐름은 trades에서 확인합니다."
              />
            </section>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <section id="positions" className="rounded-md border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                상위 보유 종목 <span className="text-sm font-medium text-slate-400">({holdings.length}개)</span>
              </h2>
              <p className="mt-1 text-sm text-slate-500">개요에서는 현재 비중이 큰 종목만 미리 봅니다.</p>
            </div>
            <Link
              className="text-sm font-semibold text-slate-700 hover:text-slate-950 hover:underline"
              href={`/portfolio/${accountId}/holdings`}
            >
              전체 보유 보기
            </Link>
          </div>
          <CompactHoldingsTable holdings={holdingPreview} targetsBySymbol={model.targetsBySymbol} />
        </section>

        <section id="history" className="rounded-md border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">최근 체결 증거</h2>
              <p className="mt-1 text-sm text-slate-500">최근 체결만 빠르게 확인하고, 전체 로그는 trades에서 엽니다.</p>
            </div>
            <Link
              className="text-sm font-semibold text-slate-700 hover:text-slate-950 hover:underline"
              href={`/portfolio/${accountId}/trades`}
            >
              전체 거래 보기
            </Link>
          </div>
          <RecentTradesPreview trades={recentTrades} />
        </section>
      </section>
    </div>
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

function RouteCard({ href, label, value, caption }: { href: string; label: string; value: string; caption: string }) {
  return (
    <Link className="rounded-md border border-slate-200 bg-white p-3 transition hover:bg-slate-50" href={href}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{caption}</div>
    </Link>
  );
}

function RecentTradesPreview({ trades }: { trades: TradeRow[] }) {
  if (!trades.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
        최근 체결 기록이 없습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {trades.map((trade) => (
        <article
          className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
          key={`${trade.date}-${trade.side}-${trade.symbol}-${trade.grossKrw}`}
        >
          <span
            className={`inline-flex min-h-7 items-center rounded px-2 py-1 text-xs font-semibold ${
              trade.side === 'sell' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {trade.side === 'sell' ? '매도' : '매수'}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">
              {tradeDisplayName(trade.symbol, trade.company)}
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-500">
              {trade.date} · {trade.reasonDetail || trade.reason || '기록된 사유 없음'}
            </div>
          </div>
          <div className="text-right font-mono text-sm font-semibold tabular-nums text-slate-950">
            {formatKrw(Math.abs(trade.grossKrw ?? 0))}
          </div>
        </article>
      ))}
    </div>
  );
}
