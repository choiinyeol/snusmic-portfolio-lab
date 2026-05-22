'use client';

import { DailyEquityHistory } from '@/components/trading/DailyEquityHistory';
import type { PortfolioViewModel } from './types';

export function PortfolioEquityView({ model }: { model: PortfolioViewModel }) {
  return (
    <DailyEquityHistory
      equity={model.equity}
      benchmarkAccounts={model.benchmarkAccounts}
      account_id={model.selectedAccount}
      accountLabels={model.accountLabels}
      trades={model.trades}
    />
  );
}
