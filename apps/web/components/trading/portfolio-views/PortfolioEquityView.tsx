'use client';

import { DailyEquityHistory } from '@/components/trading/DailyEquityHistory';
import type { PortfolioViewModel } from './types';

export function PortfolioEquityView({ model }: { model: PortfolioViewModel }) {
  return (
    <DailyEquityHistory
      equity={model.equity}
      persona={model.selectedPersona}
      personaLabels={model.personaLabels}
      trades={model.trades}
    />
  );
}
