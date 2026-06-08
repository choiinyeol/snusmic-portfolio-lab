'use client';

import { PortfolioTables } from '@/components/trading/PortfolioTables';
import { formatKrw, formatPercent } from '@/lib/format';
import type { PortfolioViewModel } from './types';

export function PortfolioHoldingsView({ model }: { model: PortfolioViewModel }) {
  const accountId = model.selectedAccount;
  const holdings = model.holdings.filter((row) => row.account_id === accountId);
  const cashKrw = model.cashByAccount[accountId] ?? 0;
  const totalValue = holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0) + cashKrw;
  const topFive = holdings
    .slice()
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0))
    .slice(0, 5)
    .reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const largestWinner = holdings.reduce(
    (best, row) => ((row.unrealizedReturn ?? -999) > (best.unrealizedReturn ?? -999) ? row : best),
    holdings[0],
  );
  const largestLoser = holdings.reduce(
    (worst, row) => ((row.unrealizedReturn ?? 999) < (worst.unrealizedReturn ?? 999) ? row : worst),
    holdings[0],
  );

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">보유 요약</h2>
          <p className="mt-1 text-xs text-slate-500">
            리스크는 보유 상위 종목과 현금 비중이 결정합니다. 아래 표에서 전부 확인합니다.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-5">
          <Stat label="총 평가액" value={formatKrw(totalValue)} />
          <Stat label="현금" value={formatKrw(cashKrw)} />
          <Stat label="상위 5 비중" value={totalValue > 0 ? formatPercent(topFive / totalValue) : '-'} />
          <Stat label="최대 수익" value={largestWinner ? formatPercent(largestWinner.unrealizedReturn) : '-'} />
          <Stat label="최대 손실" value={largestLoser ? formatPercent(largestLoser.unrealizedReturn) : '-'} />
        </dl>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-mono text-sm font-semibold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}
