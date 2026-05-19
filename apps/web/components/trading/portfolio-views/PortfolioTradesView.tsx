'use client';

import { TradesTable } from '@/components/trading/TradesTable';
import type { PortfolioViewModel } from './types';

export function PortfolioTradesView({ model }: { model: PortfolioViewModel }) {
  return (
    <TradesTable
      capitalByPersona={model.capitalByPersona}
      episodes={model.episodes}
      persona={model.selectedPersona}
      personaLabels={model.personaLabels}
      reportSymbolsById={model.reportSymbolsById}
      targetsByReportId={model.targetsByReportId}
      targetsBySymbol={model.targetsBySymbol}
      trades={model.trades}
    />
  );
}
