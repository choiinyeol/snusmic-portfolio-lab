'use client';

import { useMemo, useState, useEffect } from 'react';
import { DailyEquityHistory } from '@/components/trading/DailyEquityHistory';
import { PositionDecisionPanel } from '@/components/trading/PositionDecisionPanel';
import { PortfolioTables } from '@/components/trading/PortfolioTables';
import { TradesTable } from '@/components/trading/TradesTable';
import { KpiTile } from '@/components/ui/KpiTile';
import { Tabs } from '@/components/ui/Tabs';
import type { EquityPoint, HoldingRow, PositionEpisodeRow, ReportTargetDigest, TradeRow } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';

type Props = {
  holdings: HoldingRow[];
  equity: EquityPoint[];
  trades: TradeRow[];
  episodes: PositionEpisodeRow[];
  personas: string[];
  personaLabels: Record<string, string>;
  capitalByPersona: Record<string, number>;
  reportSymbolsById: Record<string, string>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
  targetsByReportId: Record<string, ReportTargetDigest>;
};

const URL_STRATEGY_PARAM = 'strategy';

export function PortfolioStrategyView({
  holdings,
  equity,
  trades,
  episodes,
  personas,
  personaLabels,
  capitalByPersona,
  reportSymbolsById,
  targetsBySymbol,
  targetsByReportId,
}: Props) {
  const defaultPersona = personas.includes('smic_follower_v2') ? 'smic_follower_v2' : (personas[0] ?? '');
  const [persona, setPersona] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultPersona;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get(URL_STRATEGY_PARAM);
    return fromUrl && personas.includes(fromUrl) ? fromUrl : defaultPersona;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const current = params.get(URL_STRATEGY_PARAM);
    if (current === persona) return;
    if (persona) params.set(URL_STRATEGY_PARAM, persona);
    else params.delete(URL_STRATEGY_PARAM);
    const url = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState(null, '', url);
  }, [persona]);

  const personaHoldings = useMemo(() => holdings.filter((row) => row.persona === persona), [holdings, persona]);
  const personaEpisodes = useMemo(() => episodes.filter((row) => row.persona === persona), [episodes, persona]);
  const personaTrades = useMemo(() => trades.filter((row) => row.persona === persona), [trades, persona]);

  const totalValue = personaHoldings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const totalPnl = personaHoldings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const cost = totalValue - totalPnl;
  const realizedPnl = personaEpisodes.reduce((sum, episode) => sum + (episode.realizedPnlKrw ?? 0), 0);
  const closedCount = personaEpisodes.filter((e) => e.status === 'closed').length;
  const buyCount = personaTrades.filter((t) => t.side === 'buy').length;
  const sellCount = personaTrades.filter((t) => t.side === 'sell').length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/55">전략</span>
        <div
          className="tabs tabs-box w-fit max-w-full overflow-x-auto bg-base-200"
          role="tablist"
          aria-label="전략 선택"
        >
          {personas.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={persona === item}
              className={persona === item ? 'tab tab-active font-bold' : 'tab'}
              onClick={() => setPersona(item)}
            >
              {personaLabels[item] ?? item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="평가액" value={formatKrw(totalValue)} caption={`${personaHoldings.length}종목`} tone="accent" />
        <KpiTile
          label="미실현 손익"
          value={formatKrw(totalPnl)}
          delta={formatPercent(cost > 0 ? totalPnl / cost : null)}
          tone={totalPnl >= 0 ? 'good' : 'bad'}
        />
        <KpiTile
          label="실현 손익"
          value={formatKrw(realizedPnl)}
          delta={`${closedCount}건 청산`}
          tone={realizedPnl >= 0 ? 'good' : 'bad'}
        />
        <KpiTile
          label="체결"
          value={personaTrades.length.toLocaleString('ko-KR')}
          delta={`매수 ${buyCount} · 매도 ${sellCount}`}
        />
      </div>

      <PositionDecisionPanel
        holdings={holdings}
        trades={trades}
        persona={persona}
        targetsBySymbol={targetsBySymbol}
        targetsByReportId={targetsByReportId}
        reportSymbolsById={reportSymbolsById}
      />

      <Tabs
        tabs={[
          {
            id: 'current',
            label: '현재 보유',
            meta: personaHoldings.length.toString(),
            content: (
              <PortfolioTables
                holdings={holdings}
                persona={persona}
                personaLabels={personaLabels}
                capitalByPersona={capitalByPersona}
                targetsBySymbol={targetsBySymbol}
              />
            ),
          },
          {
            id: 'history',
            label: '일별 평가액',
            meta: equity.filter((row) => row.persona === persona).length.toString(),
            content: (
              <DailyEquityHistory equity={equity} trades={trades} persona={persona} personaLabels={personaLabels} />
            ),
          },
          {
            id: 'trades',
            label: '체결 원장',
            meta: personaTrades.length.toString(),
            content: (
              <TradesTable
                trades={trades}
                episodes={episodes}
                persona={persona}
                personaLabels={personaLabels}
                capitalByPersona={capitalByPersona}
                reportSymbolsById={reportSymbolsById}
                targetsBySymbol={targetsBySymbol}
                targetsByReportId={targetsByReportId}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
