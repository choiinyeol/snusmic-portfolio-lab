'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { Button } from '@/components/ui/button';
import type { HoldingRow, ReportTargetDigest, TradeRow } from '@/lib/artifacts';
import { formatKrw } from '@/lib/format';
import { PortfolioEquityTradeChart } from './PortfolioEquityTradeChart';
import type { PortfolioViewModel } from './types';

export function PortfolioOverviewView({ model }: { model: PortfolioViewModel }) {
  const persona = model.selectedPersona;
  const personaHoldings = useMemo(
    () => model.holdings.filter((row) => row.persona === persona),
    [model.holdings, persona],
  );
  const cashKrw = model.cashByPersona[persona] ?? 0;
  const treemapHoldings = useMemo(
    () => withCashHolding(personaHoldings, cashKrw, persona),
    [cashKrw, personaHoldings, persona],
  );
  const reportHrefBySymbol = useMemo(
    () =>
      Object.fromEntries(
        Object.values(model.targetsBySymbol).map((target) => [target.symbol, reportTargetHref(target)]),
      ),
    [model.targetsBySymbol],
  );
  const recentTrades = useMemo(
    () =>
      [...model.trades]
        .filter((row) => row.persona === persona)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8),
    [model.trades, persona],
  );
  const method = model.methodsByPersona[persona];
  const personaLabel = model.personaLabels[persona] ?? persona;

  return (
    <div className="grid min-w-0 gap-5">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)]">
        <article className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                pnl ledger
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">손익 경로와 매매 시점</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                리포트 상세의 가격 경로처럼, 포트폴리오 평가 곡선 위에 매수·매도 마커를 같이 표시합니다.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/portfolio/${encodeURIComponent(persona)}/equity`}>일별 평가</Link>
            </Button>
          </div>
          <PortfolioEquityTradeChart
            equity={model.equity}
            trades={model.trades}
            persona={persona}
            label={personaLabel}
            height={460}
          />
          <TradeEventTimeline
            trades={recentTrades.slice(0, 6)}
            targetsByReportId={model.targetsByReportId}
            targetsBySymbol={model.targetsBySymbol}
          />
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                allocation
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">현재 보유 비중</h2>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/portfolio/${encodeURIComponent(persona)}/holdings`}>보유 표</Link>
            </Button>
          </div>
          <HoldingsTreemap
            holdings={treemapHoldings}
            height={460}
            compact
            hrefBySymbol={reportHrefBySymbol}
            caption="면적 = 평가액, 색 = 미실현 수익률. RP 대기자금도 포트폴리오 비중으로 포함합니다."
          />
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,.95fr)_minmax(360px,1.05fr)]">
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                latest fills
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">최근 매매</h2>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/portfolio/${encodeURIComponent(persona)}/trades`}>전체 ledger</Link>
            </Button>
          </div>
          <RecentTradeList trades={recentTrades} />
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                logic
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">매매 로직</h2>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/portfolio/${encodeURIComponent(persona)}/methodology`}>규칙 보기</Link>
            </Button>
          </div>
          {method ? (
            <div className="grid gap-3">
              <p className="text-sm leading-6 text-slate-600">{method.summary}</p>
              <div className="grid gap-3 md:grid-cols-3">
                <RulePreview title="매수" items={method.buyRules} />
                <RulePreview title="매도" items={method.sellRules} />
                <RulePreview title="위험" items={method.riskControls} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">기록된 운용 규칙이 없습니다.</p>
          )}
        </article>
      </section>
    </div>
  );
}

function TradeEventTimeline({
  trades,
  targetsByReportId,
  targetsBySymbol,
}: {
  trades: TradeRow[];
  targetsByReportId: Record<string, ReportTargetDigest>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
}) {
  if (!trades.length) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
        거래 이벤트 타임라인에 표시할 최근 체결이 없습니다.
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-md border border-slate-100 bg-slate-50/70 p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">거래 이벤트 타임라인</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            차트 마커를 hover하지 않아도 최근 체결 사유와 리포트 근거를 바로 읽을 수 있습니다.
          </p>
        </div>
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          latest {trades.length}
        </span>
      </div>
      <ol className="mt-3 grid gap-2">
        {trades.map((trade) => {
          const target = (trade.reportId && targetsByReportId[trade.reportId]) || targetsBySymbol[trade.symbol];
          const href = target
            ? reportTargetHref(target)
            : trade.reportId
              ? `/reports/${encodeURIComponent(trade.symbol)}/${encodeURIComponent(trade.reportId)}`
              : `/reports/${encodeURIComponent(trade.symbol)}`;
          const sideLabel = trade.side === 'sell' ? '매도' : '매수';
          return (
            <li
              className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
              key={`${trade.date}-${trade.symbol}-${trade.side}-${trade.qty}-${trade.grossKrw}`}
            >
              <div className="font-mono text-xs font-semibold text-slate-500">{trade.date}</div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-bold leading-normal ${
                      trade.side === 'sell' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {sideLabel}
                  </span>
                  <strong className="truncate text-sm text-slate-950">{trade.symbol}</strong>
                  <span className="font-mono text-xs text-slate-500">{formatKrw(Math.abs(trade.grossKrw ?? 0))}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                  {trade.reason || '기록된 체결 사유 없음'}
                </p>
              </div>
              <Link
                className="self-center text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
                href={href}
              >
                근거 보기
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function RecentTradeList({ trades }: { trades: TradeRow[] }) {
  if (!trades.length) return <p className="text-sm text-slate-500">최근 체결이 없습니다.</p>;
  return (
    <ol className="divide-y divide-slate-100">
      {trades.map((trade) => (
        <li
          className="grid grid-cols-[5rem_minmax(0,1fr)_auto] gap-3 py-2 text-sm"
          key={`${trade.date}-${trade.symbol}-${trade.side}-${trade.qty}`}
        >
          <time className="font-mono text-xs text-slate-500">{trade.date}</time>
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-950">
              {trade.side === 'sell' ? '매도' : '매수'} {trade.symbol}
            </div>
            <div className="truncate text-xs text-slate-500">{trade.reason || '기록된 사유 없음'}</div>
          </div>
          <div
            className={`font-mono text-xs font-semibold ${trade.side === 'sell' ? 'text-rose-600' : 'text-emerald-600'}`}
          >
            {formatKrw(trade.grossKrw)}
          </div>
        </li>
      ))}
    </ol>
  );
}

function RulePreview({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <h3 className="text-xs font-semibold text-slate-950">{title}</h3>
      <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-600">
        {items.slice(0, 3).map((item) => (
          <li key={item}>• {item}</li>
        ))}
        {!items.length ? <li>—</li> : null}
      </ul>
    </div>
  );
}

function reportTargetHref(target: ReportTargetDigest): string {
  return `/reports/${encodeURIComponent(target.symbol)}/${encodeURIComponent(target.reportId)}`;
}

function withCashHolding(holdings: HoldingRow[], cashKrw: number, persona: string): HoldingRow[] {
  if (cashKrw <= 0) return holdings;
  return [
    ...holdings,
    {
      persona,
      symbol: 'CASH',
      company: 'RP 대기자금',
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
