'use client';

import Link from 'next/link';
import { Money } from '@/components/ui/Money';
import type { HoldingRow, ReportTargetDigest, TradeRow } from '@/lib/artifacts';
import { formatDateKo, formatDays, formatPercent } from '@/lib/format';

type Props = {
  holdings: HoldingRow[];
  trades: TradeRow[];
  persona: string;
  targetsBySymbol: Record<string, ReportTargetDigest>;
  targetsByReportId: Record<string, ReportTargetDigest>;
  reportSymbolsById: Record<string, string>;
};

type DecisionRow = {
  holding: HoldingRow;
  buyTrades: TradeRow[];
  firstBuy: TradeRow | null;
  lastBuy: TradeRow | null;
  target: ReportTargetDigest | null;
  targetSource: 'trade_report' | 'latest_symbol_report' | 'none';
  targetProgress: number | null;
  targetGap: number | null;
};

export function PositionDecisionPanel({
  holdings,
  trades,
  persona,
  targetsBySymbol,
  targetsByReportId,
  reportSymbolsById,
}: Props) {
  const rows = buildDecisionRows({ holdings, trades, persona, targetsBySymbol, targetsByReportId }).slice(0, 8);
  if (!rows.length) return null;

  return (
    <section className="grid gap-3 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/70">Position tape</p>
          <h2 className="mt-1 text-lg font-black tracking-[-0.03em] text-base-content">무엇을 어떻게 샀나</h2>
          <p className="mt-1 text-sm leading-relaxed text-base-content/60">
            현재 보유 상위 종목을 매수 체결, 리포트 목표가, 평단, 현재가 순서로 압축해 보여줍니다.
          </p>
        </div>
        <div className="rounded-full border border-base-300 bg-base-200/60 px-3 py-1 text-xs font-semibold text-base-content/60">
          현재 보유 {rows.length.toLocaleString('ko-KR')}개 요약
        </div>
      </div>

      <div className="grid gap-3 2xl:grid-cols-2">
        {rows.map((row) => {
          const nativeMarketValue =
            row.holding.lastCloseNative !== null && row.holding.qty !== null
              ? row.holding.lastCloseNative * row.holding.qty
              : null;
          const linkedSymbol = row.lastBuy?.reportId ? reportSymbolsById[row.lastBuy.reportId] : row.target?.symbol;
          return (
            <article
              key={`${row.holding.persona}-${row.holding.symbol}`}
              className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm transition hover:border-primary/30 hover:shadow-md"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(150px,auto)] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/reports/${row.holding.symbol}`}
                      className="min-w-0 truncate text-base font-black link-hover"
                    >
                      {row.holding.company || row.holding.symbol}
                    </Link>
                    <span className="badge badge-ghost badge-sm font-mono">{row.holding.symbol}</span>
                    <span className="badge badge-outline badge-sm">{row.holding.currency}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-base-content/60 sm:grid-cols-4">
                    <Fact label="수량" value={row.holding.qty?.toLocaleString('ko-KR') ?? '—'} />
                    <Fact label="매수 횟수" value={`${row.buyTrades.length}회`} />
                    <Fact label="최초 매수" value={row.firstBuy ? formatDateKo(row.firstBuy.date) : '—'} />
                    <Fact label="보유 기간" value={formatDays(row.holding.holdingDays)} />
                  </div>
                </div>
                <div className="min-w-0 text-left lg:text-right">
                  <div className="text-xs font-semibold text-base-content/50">평가액</div>
                  <Money native={nativeMarketValue} krw={row.holding.marketValueKrw} currency={row.holding.currency} />
                  <div className={(row.holding.unrealizedReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}>
                    <span className="text-xs font-bold tabular-nums">
                      {formatPercent(row.holding.unrealizedReturn)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-2 rounded-xl bg-base-200/50 p-3 lg:grid-cols-3">
                <PriceBlock label="평단" native={null} krw={row.holding.avgCostKrw} currency={row.holding.currency} />
                <PriceBlock
                  label="현재가"
                  native={row.holding.lastCloseNative}
                  krw={row.holding.lastCloseKrw}
                  currency={row.holding.currency}
                />
                <PriceBlock
                  label="목표가"
                  native={row.target?.targetPriceNative ?? null}
                  krw={row.target?.targetPriceKrw ?? null}
                  currency={row.target?.currency ?? row.holding.currency}
                />
              </div>

              <div className="mt-3 grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-base-content/55">목표 진행률</span>
                  <span className="text-right font-bold tabular-nums text-base-content">
                    {row.targetProgress === null ? '—' : formatPercent(row.targetProgress)}
                    {row.targetGap !== null ? ` · 목표까지 ${formatPercent(row.targetGap)}` : ''}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-base-200">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, (row.targetProgress ?? 0) * 100))}%` }}
                  />
                </div>
                <div className="grid gap-2 text-xs text-base-content/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0">
                    최근 매수:{' '}
                    {row.lastBuy ? `${formatDateKo(row.lastBuy.date)} · ${humanReason(row.lastBuy.reason)}` : '—'}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="font-bold text-base-content/70">{sourceLabel(row.targetSource)}</span>
                    {linkedSymbol ? (
                      <Link className="font-bold text-primary link-hover" href={`/reports/${linkedSymbol}`}>
                        {row.targetSource === 'trade_report' ? '리포트 근거 보기 →' : '최신 리포트 보기 →'}
                      </Link>
                    ) : null}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function buildDecisionRows({
  holdings,
  trades,
  persona,
  targetsBySymbol,
  targetsByReportId,
}: Pick<Props, 'holdings' | 'trades' | 'persona' | 'targetsBySymbol' | 'targetsByReportId'>): DecisionRow[] {
  const personaTrades = trades.filter((trade) => trade.persona === persona);
  return holdings
    .filter((holding) => holding.persona === persona)
    .map((holding) => {
      const buyTrades = personaTrades
        .filter((trade) => trade.symbol === holding.symbol && trade.side === 'buy')
        .sort((a, b) => a.date.localeCompare(b.date));
      const firstBuy = buyTrades[0] ?? null;
      const lastBuy = buyTrades.at(-1) ?? null;
      const tradeTarget = lastBuy?.reportId ? (targetsByReportId[lastBuy.reportId] ?? null) : null;
      const latestTarget = targetsBySymbol[holding.symbol] ?? null;
      const target = tradeTarget ?? latestTarget;
      const targetSource: DecisionRow['targetSource'] = tradeTarget
        ? 'trade_report'
        : latestTarget
          ? 'latest_symbol_report'
          : 'none';
      return {
        holding,
        buyTrades,
        firstBuy,
        lastBuy,
        target,
        targetSource,
        targetProgress: targetProgress(holding, target),
        targetGap: targetGap(holding, target),
      };
    })
    .sort((a, b) => (b.holding.marketValueKrw ?? 0) - (a.holding.marketValueKrw ?? 0));
}

function targetProgress(holding: HoldingRow, target: ReportTargetDigest | null): number | null {
  if (!target?.targetPriceKrw || !holding.avgCostKrw || !holding.lastCloseKrw) return null;
  const targetMove = target.targetPriceKrw - holding.avgCostKrw;
  if (targetMove === 0) return null;
  const progress = (holding.lastCloseKrw - holding.avgCostKrw) / targetMove;
  return Math.max(0, Math.min(1, progress));
}

function targetGap(holding: HoldingRow, target: ReportTargetDigest | null): number | null {
  if (!target?.targetPriceKrw || !holding.lastCloseKrw || holding.lastCloseKrw <= 0) return null;
  return Math.max(0, target.targetPriceKrw / holding.lastCloseKrw - 1);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold text-base-content/45">{label}</div>
      <div className="mt-0.5 truncate font-bold text-base-content">{value}</div>
    </div>
  );
}

function PriceBlock({
  label,
  native,
  krw,
  currency,
}: {
  label: string;
  native: number | null;
  krw: number | null;
  currency: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 text-xs font-semibold text-base-content/45">{label}</div>
      {krw !== null ? <Money native={native} krw={krw} currency={currency} /> : <div className="font-bold">—</div>}
    </div>
  );
}

function humanReason(reason: string): string {
  if (reason.includes('target_hit')) return '목표가 도달';
  if (reason.includes('stop')) return '손절/리스크 제한';
  if (reason.includes('rebalance_buy')) return '리밸런싱 매수';
  if (reason.includes('rebalance_sell')) return '리밸런싱 매도';
  if (reason.includes('deposit_buy')) return '입금 후 매수';
  if (reason.includes('top_up')) return '추가 매수';
  if (reason.includes('time')) return '시간 기준 청산';
  return reason.replace(/[()']/g, '') || '—';
}

function sourceLabel(source: DecisionRow['targetSource']): string {
  if (source === 'trade_report') return '리포트 근거';
  if (source === 'latest_symbol_report') return '최신 리포트 목표가 참고';
  return '원장 체결';
}
