'use client';

import { TradesTable } from '@/components/trading/TradesTable';
import type { TradeRow } from '@/lib/artifacts';
import { formatKrw } from '@/lib/format';
import { tradeDisplayName } from '../helpers';
import type { PortfolioViewModel } from './types';

export function PortfolioTradesView({ model }: { model: PortfolioViewModel }) {
  const trades = model.trades.filter((row) => row.account_id === model.selectedAccount);
  const summary = buildTradeNarrative(trades);

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          trade narrative
        </div>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">거래 요약</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              원장 표를 보기 전에 최근 매수·매도 강도, 큰 체결, 사유별 체결 분포를 먼저 확인합니다.
            </p>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-500">
            {summary.latestDate || '-'} 기준 · {trades.length.toLocaleString('ko-KR')}건
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <NarrativeMetric
            label="최근 30일 매수"
            value={formatKrw(summary.recentBuyGross)}
            caption={`${summary.recentBuyCount}건`}
          />
          <NarrativeMetric
            label="최근 30일 매도"
            value={formatKrw(summary.recentSellGross)}
            caption={`${summary.recentSellCount}건`}
          />
          <NarrativeMetric
            label="전체 매수"
            value={formatKrw(summary.totalBuyGross)}
            caption={`${summary.buyCount}건`}
          />
          <NarrativeMetric
            label="전체 매도"
            value={formatKrw(summary.totalSellGross)}
            caption={`${summary.sellCount}건`}
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">큰 체결</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">원장 변화를 실제로 만든 상위 체결입니다.</p>
          <div className="mt-3 grid gap-2">
            {summary.largestTrades.map((trade, index) => (
              <TradeHighlightCard
                trade={trade}
                index={index}
                key={`${trade.date}-${trade.symbol}-${trade.side}-${trade.grossKrw}`}
              />
            ))}
            {!summary.largestTrades.length ? <p className="text-sm text-slate-500">체결 기록이 없습니다.</p> : null}
          </div>
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">사유별 체결</h3>
          <p className="mt-1 text-sm leading-6 text-slate-500">어떤 규칙이나 리포트 사유가 반복됐는지 요약합니다.</p>
          <div className="mt-3 grid gap-2">
            {summary.reasonBuckets.map((bucket) => (
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3" key={bucket.reason}>
                <div className="flex items-center justify-between gap-3">
                  <span className="line-clamp-1 text-sm font-semibold text-slate-950">{bucket.reason}</span>
                  <span className="font-mono text-xs font-semibold text-slate-500">{bucket.count}건</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-slate-950" style={{ width: `${bucket.share * 100}%` }} />
                </div>
                <div className="mt-1 font-mono text-xs text-slate-500">{formatKrw(bucket.grossKrw)}</div>
              </div>
            ))}
            {!summary.reasonBuckets.length ? (
              <p className="text-sm text-slate-500">기록된 체결 사유가 없습니다.</p>
            ) : null}
          </div>
        </article>
      </section>

      <TradesTable
        account_id={model.selectedAccount}
        accountLabels={model.accountLabels}
        reportSymbolsById={model.reportSymbolsById}
        targetsByReportId={model.targetsByReportId}
        targetsBySymbol={model.targetsBySymbol}
        trades={model.trades}
      />
    </div>
  );
}

function NarrativeMetric({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{caption}</div>
    </div>
  );
}

function TradeHighlightCard({ trade, index }: { trade: TradeRow; index: number }) {
  const sideLabel = trade.side === 'sell' ? '매도' : '매수';
  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
      <span className="grid size-6 place-items-center rounded bg-slate-950 font-mono text-[11px] font-bold text-white">
        {index + 1}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-1 text-xs font-bold leading-normal ${
              trade.side === 'sell' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {sideLabel}
          </span>
          <strong className="truncate text-sm text-slate-950">{tradeDisplayName(trade.symbol, trade.company)}</strong>
          <span className="font-mono text-xs text-slate-500">{trade.date}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
          {trade.reasonDetail || trade.reason || '기록된 사유 없음'}
        </p>
      </div>
      <div className="self-center font-mono text-sm font-semibold tabular-nums text-slate-950">
        {formatKrw(Math.abs(trade.grossKrw ?? 0))}
      </div>
    </div>
  );
}

function buildTradeNarrative(trades: TradeRow[]) {
  const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date));
  const latestDate = sorted[0]?.date ?? '';
  const recentCutoff = latestDate ? shiftIsoDate(latestDate, -30) : '';
  const recent = recentCutoff ? sorted.filter((trade) => trade.date >= recentCutoff) : [];
  const buys = trades.filter((trade) => trade.side === 'buy');
  const sells = trades.filter((trade) => trade.side === 'sell');
  const recentBuys = recent.filter((trade) => trade.side === 'buy');
  const recentSells = recent.filter((trade) => trade.side === 'sell');
  const largestTrades = [...trades].sort((a, b) => Math.abs(b.grossKrw ?? 0) - Math.abs(a.grossKrw ?? 0)).slice(0, 5);
  const reasonBuckets = buildReasonBuckets(trades);
  return {
    latestDate,
    buyCount: buys.length,
    sellCount: sells.length,
    recentBuyCount: recentBuys.length,
    recentSellCount: recentSells.length,
    totalBuyGross: sumGross(buys),
    totalSellGross: sumGross(sells),
    recentBuyGross: sumGross(recentBuys),
    recentSellGross: sumGross(recentSells),
    largestTrades,
    reasonBuckets,
  };
}

function buildReasonBuckets(trades: TradeRow[]) {
  const buckets = new Map<string, { reason: string; count: number; grossKrw: number }>();
  for (const trade of trades) {
    const reason = normalizeReason(trade.reasonDetail || trade.reason);
    const current = buckets.get(reason) ?? { reason, count: 0, grossKrw: 0 };
    current.count += 1;
    current.grossKrw += Math.abs(trade.grossKrw ?? 0);
    buckets.set(reason, current);
  }
  return [...buckets.values()]
    .sort((a, b) => b.grossKrw - a.grossKrw)
    .slice(0, 5)
    .map((bucket) => ({ ...bucket, share: bucket.grossKrw / Math.max(1, sumGross(trades)) }));
}

function normalizeReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.includes('retained_cap_trim')) return '보유 비중 조절';
  if (!trimmed) return '기록된 사유 없음';
  return trimmed.length > 44 ? `${trimmed.slice(0, 44)}...` : trimmed;
}

function sumGross(trades: TradeRow[]): number {
  return trades.reduce((sum, trade) => sum + Math.abs(trade.grossKrw ?? 0), 0);
}

function shiftIsoDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}
