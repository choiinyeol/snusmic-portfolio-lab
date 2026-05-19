'use client';

import { PortfolioTables } from '@/components/trading/PortfolioTables';
import type { PortfolioViewModel } from './types';

export function PortfolioHoldingsView({ model }: { model: PortfolioViewModel }) {
  return (
    <PortfolioTables
      capitalByPersona={model.capitalByPersona}
      holdings={model.holdings}
      persona={model.selectedPersona}
      personaLabels={model.personaLabels}
      targetsBySymbol={model.targetsBySymbol}
    />
  );
}
