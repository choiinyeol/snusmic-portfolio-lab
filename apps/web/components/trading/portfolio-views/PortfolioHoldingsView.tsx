'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { compactTicker, reportTargetHref, stockDisplayName } from '@/components/trading/helpers';
import { PortfolioTables } from '@/components/trading/PortfolioTables';
import type { HoldingRow, ReportTargetDigest } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';
import type { PortfolioViewModel } from './types';

export function PortfolioHoldingsView({ model }: { model: PortfolioViewModel }) {
  const account_id = model.selectedAccount;
  const accountLabel = model.accountLabels[account_id] ?? account_id;
  const holdings = useMemo(
    () => model.holdings.filter((row) => row.account_id === account_id),
    [model.holdings, account_id],
  );
  const cashKrw = model.cashByAccount[account_id] ?? 0;
  const allocationHoldings = useMemo(
    () => withCashHolding(holdings, cashKrw, account_id),
    [cashKrw, holdings, account_id],
  );
  const totalValue = allocationHoldings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const topHoldings = useMemo(
    () => [...holdings].sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0)).slice(0, 4),
    [holdings],
  );
  const hrefBySymbol = useMemo(
    () =>
      Object.fromEntries(
        Object.values(model.targetsBySymbol).map((target) => [target.symbol, reportTargetHref(target)]),
      ),
    [model.targetsBySymbol],
  );

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)]">
        <article className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                current allocation
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">현재 보유 비중</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {accountLabel}의 보유 종목과 현금/RP를 하나의 실제 계좌 비중으로 봅니다.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-500">{formatKrw(totalValue)}</span>
          </div>
          <HoldingsTreemap
            holdings={allocationHoldings}
            height={420}
            compact
            hrefBySymbol={hrefBySymbol}
            caption="면적은 평가액, 색은 미실현 수익률입니다. 현금/RP도 계좌 비중에 포함합니다."
          />
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              risk focus
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">리스크 집중</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              현재 위험은 보유 비중 상위 종목이 결정합니다. 비중, 미실현 수익률, 보유일, 최근 리포트 맥락을 한 번에
              확인합니다.
            </p>
          </div>
          <div className="grid gap-2">
            {topHoldings.map((holding, index) => (
              <HoldingEvidenceCard
                holding={holding}
                index={index}
                key={`${holding.account_id}-${holding.symbol}`}
                target={model.targetsBySymbol[holding.symbol]}
                totalValue={totalValue}
              />
            ))}
            {!topHoldings.length ? <p className="text-sm text-slate-500">현재 보유 종목이 없습니다.</p> : null}
          </div>
        </article>
      </section>

      <PortfolioTables
        capitalByAccount={model.capitalByAccount}
        holdings={model.holdings}
        account_id={model.selectedAccount}
        accountLabels={model.accountLabels}
        targetsBySymbol={model.targetsBySymbol}
      />
    </div>
  );
}

function HoldingEvidenceCard({
  holding,
  index,
  target,
  totalValue,
}: {
  holding: HoldingRow;
  index: number;
  target: ReportTargetDigest | undefined;
  totalValue: number;
}) {
  const weight = totalValue > 0 ? (holding.marketValueKrw ?? 0) / totalValue : null;
  const href = target ? reportTargetHref(target) : `/portfolio/${encodeURIComponent(holding.account_id)}/holdings`;
  const displayName = stockDisplayName(holding.symbol, holding.company);
  const ticker = compactTicker(holding.symbol);
  return (
    <Link
      className="grid gap-2 rounded-md border border-slate-200 p-3 transition-colors hover:border-slate-400 hover:bg-slate-50"
      href={href}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded bg-slate-950 font-mono text-[10px] font-bold text-white">
              {index + 1}
            </span>
            <span className="truncate font-semibold text-slate-950">{displayName}</span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500">
            {displayName !== ticker ? `${ticker} · ` : ''}
            {target?.publicationDate ?? '리포트 날짜 없음'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-semibold tabular-nums text-slate-950">{formatPercent(weight)}</div>
          <div className="font-mono text-[11px] text-slate-500">{formatKrw(holding.marketValueKrw)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] font-medium">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
          {target ? '최근 리포트' : '리포트 없음'}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 ${(holding.unrealizedReturn ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
        >
          미실현 {formatPercent(holding.unrealizedReturn)}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
          보유 {formatHoldingDays(holding.holdingDays)}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
          목표가 {formatKrw(target?.targetPriceKrw)}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
          발간시 상승여력 {formatPercent(target?.targetUpsideAtPub)}
        </span>
      </div>
    </Link>
  );
}

function formatHoldingDays(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${Math.round(value).toLocaleString('ko-KR')}일`;
}

function withCashHolding(holdings: HoldingRow[], cashKrw: number, account_id: string): HoldingRow[] {
  if (cashKrw <= 0) return holdings;
  return [
    ...holdings,
    {
      account_id,
      symbol: 'CASH',
      company: '현금/RP',
      qty: null,
      avgCostKrw: null,
      lastCloseKrw: 1,
      lastCloseNative: 1,
      currency: 'KRW',
      marketValueKrw: cashKrw,
      unrealizedPnlKrw: 0,
      unrealizedReturn: 0,
      holdingDays: null,
      firstBuyDate: null,
    },
  ];
}
