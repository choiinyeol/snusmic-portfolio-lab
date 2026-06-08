'use client';

import { PortfolioTables } from '@/components/trading/PortfolioTables';
import { formatKrw, formatPercent } from '@/lib/format';
import type { PortfolioHoldingsModel } from './types';

export function PortfolioHoldingsView({ model }: { model: PortfolioHoldingsModel }) {
  const holdings = model.holdings;
  const cashKrw = model.cashKrw;
  const totalValue = holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0) + cashKrw;
  const topFive = holdings
    .slice()
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0))
    .slice(0, 5)
    .reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const largestWinner = holdings.reduce<(typeof holdings)[number] | null>(
    (best, row) => ((row.unrealizedReturn ?? -999) > (best?.unrealizedReturn ?? -999) ? row : best),
    null,
  );
  const largestLoser = holdings.reduce<(typeof holdings)[number] | null>(
    (worst, row) => ((row.unrealizedReturn ?? 999) < (worst?.unrealizedReturn ?? 999) ? row : worst),
    null,
  );

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">포지션 전체 보기</h2>
            <p className="mt-1 text-sm text-slate-500">현재 포지션과 비중을 전부 확인하는 화면입니다.</p>
          </div>
          <div className="font-mono text-xs text-slate-500">{holdings.length.toLocaleString('ko-KR')}개 종목</div>
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
        holdings={holdings}
        account_id={model.accountId}
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
