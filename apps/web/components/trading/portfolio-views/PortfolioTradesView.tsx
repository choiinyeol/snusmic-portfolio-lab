'use client';

import { TradesTable } from '@/components/trading/TradesTable';
import type { PortfolioTradesModel } from './types';

export function PortfolioTradesView({ model }: { model: PortfolioTradesModel }) {
  const trades = model.trades;

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">거래 전체 원장</h2>
            <p className="mt-1 text-sm text-slate-500">언제 무엇을 사고팔았는지 한 원장에서 바로 확인합니다.</p>
          </div>
          <span className="font-mono text-xs font-semibold text-slate-500">
            {trades.length.toLocaleString('ko-KR')}건
          </span>
        </div>
      </section>

      <TradesTable
        account_id={model.accountId}
        accountLabels={model.accountLabels}
        reportSymbolsById={model.reportSymbolsById}
        targetsByReportId={model.targetsByReportId}
        targetsBySymbol={model.targetsBySymbol}
        trades={trades}
      />
    </div>
  );
}
