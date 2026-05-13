'use client';

import { useMemo, useState, useEffect } from 'react';
import { DailyEquityHistory } from '@/components/trading/DailyEquityHistory';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
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
  personaKinds: Record<string, string>;
  defaultPersona: string;
  methodsByPersona: Record<
    string,
    { summary: string; buyRules: string[]; sellRules: string[]; riskControls: string[] }
  >;
  capitalByPersona: Record<string, number>;
  cashByPersona: Record<string, number>;
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
  personaKinds,
  defaultPersona,
  methodsByPersona,
  capitalByPersona,
  cashByPersona,
  reportSymbolsById,
  targetsBySymbol,
  targetsByReportId,
}: Props) {
  const resolvedDefaultPersona = personas.includes(defaultPersona) ? defaultPersona : (personas[0] ?? '');
  const [persona, setPersona] = useState<string>(() => {
    if (typeof window === 'undefined') return resolvedDefaultPersona;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get(URL_STRATEGY_PARAM);
    return fromUrl && personas.includes(fromUrl) ? fromUrl : resolvedDefaultPersona;
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
  const cashKrw = cashByPersona[persona] ?? 0;
  const treemapHoldings = useMemo(
    () => withCashHolding(personaHoldings, cashKrw, persona),
    [cashKrw, personaHoldings, persona],
  );
  const personaEpisodes = useMemo(() => episodes.filter((row) => row.persona === persona), [episodes, persona]);
  const personaTrades = useMemo(() => trades.filter((row) => row.persona === persona), [trades, persona]);
  const reportHrefBySymbol = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(targetsBySymbol).map((symbol) => [symbol, `/reports/${encodeURIComponent(symbol)}`]),
      ),
    [targetsBySymbol],
  );

  const holdingsValue = personaHoldings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const totalValue = holdingsValue + cashKrw;
  const totalPnl = personaHoldings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const cost = totalValue - totalPnl;
  const realizedPnl = personaEpisodes.reduce((sum, episode) => sum + (episode.realizedPnlKrw ?? 0), 0);
  const closedCount = personaEpisodes.filter((e) => e.status === 'closed').length;
  const buyCount = personaTrades.filter((t) => t.side === 'buy').length;
  const sellCount = personaTrades.filter((t) => t.side === 'sell').length;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="lab-panel p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="snapshot-pill">Strategy selector</span>
          <div
            className="tabs tabs-box min-w-0 flex-1 overflow-x-auto bg-base-200"
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
                <span className="ml-2 badge badge-ghost badge-xs">
                  {personaKinds[item] === 'benchmark' ? 'BM' : '전략'}
                </span>
              </button>
            ))}
          </div>
        </div>
        <p className="m-0 mt-2 text-xs text-base-content/55">
          선택된 원장: <strong className="text-base-content">{personaLabels[persona] ?? persona}</strong> · URL의
          strategy 파라미터와 동기화됩니다. BM은 비교 기준선이고, 전략 표시는 사용자가 선택해 검토할 수 있는 고유
          원장입니다.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiTile
          compact
          label="평가액"
          value={formatKrw(totalValue)}
          caption={`${personaHoldings.length}종목 · 현금 ${formatPercent(totalValue > 0 ? cashKrw / totalValue : null)}`}
          tone="accent"
        />
        <KpiTile compact label="현금" value={formatKrw(cashKrw)} delta="미투자 대기 자금" tone="neutral" />
        <KpiTile
          compact
          label="출자 원금"
          value={formatKrw(capitalByPersona[persona] ?? null)}
          delta="summary artifact"
        />
        <KpiTile
          compact
          label="미실현 손익"
          value={formatKrw(totalPnl)}
          delta={formatPercent(cost > 0 ? totalPnl / cost : null)}
          tone={totalPnl >= 0 ? 'good' : 'bad'}
        />
        <KpiTile
          compact
          label="실현 손익"
          value={formatKrw(realizedPnl)}
          delta={`${closedCount}건 청산`}
          tone={realizedPnl >= 0 ? 'good' : 'bad'}
        />
        <KpiTile
          compact
          label="체결"
          value={personaTrades.length.toLocaleString('ko-KR')}
          delta={`매수 ${buyCount} · 매도 ${sellCount}`}
        />
      </div>

      <article className="lab-panel p-3 md:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="lab-panel__eyebrow">Current holdings</div>
            <h2 className="lab-panel__title">현재 보유 트리맵</h2>
          </div>
          <span className="snapshot-pill">면적=평가액</span>
        </div>
        <HoldingsTreemap holdings={treemapHoldings} height={360} compact hrefBySymbol={reportHrefBySymbol} />
        <p className="mt-3 text-xs leading-5 text-base-content/55">
          매도 후 즉시 다른 종목을 사지 않는 경우는 전략의 리밸런싱/입금 주기, 최대 보유 종목 수, MTT·업사이드·가격
          조건을 동시에 만족하는 후보 부족 때문입니다. 그 구간의 미투자 금액은 현금으로 보존되어 평가액과 트리맵에
          포함됩니다.
        </p>
      </article>

      <StrategyMethodPanel method={methodsByPersona[persona]} personaLabel={personaLabels[persona] ?? persona} />

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

function StrategyMethodPanel({
  method,
  personaLabel,
}: {
  method: { summary: string; buyRules: string[]; sellRules: string[]; riskControls: string[] } | undefined;
  personaLabel: string;
}) {
  if (!method) return null;
  return (
    <article className="lab-panel p-4">
      <div className="mb-3">
        <div className="lab-panel__eyebrow">Strategy method</div>
        <h2 className="lab-panel__title">{personaLabel} 매수·매도 규칙</h2>
        <p className="mt-2 text-sm leading-6 text-base-content/62">{method.summary}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <RuleList title="매수 판단" items={method.buyRules} />
        <RuleList title="매도 판단" items={method.sellRules} />
        <RuleList title="위험 관리" items={method.riskControls} />
      </div>
    </article>
  );
}

function RuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-3">
      <h3 className="text-sm font-black">{title}</h3>
      <ul className="mt-2 grid gap-1.5 text-sm leading-5 text-base-content/65">
        {items.length ? (
          items.map((item) => <li key={item}>• {item}</li>)
        ) : (
          <li className="text-base-content/45">기록된 규칙이 없습니다.</li>
        )}
      </ul>
    </div>
  );
}

function withCashHolding(holdings: HoldingRow[], cashKrw: number, persona: string): HoldingRow[] {
  if (cashKrw <= 0) return holdings;
  return [
    ...holdings,
    {
      persona,
      symbol: 'CASH',
      company: '현금',
      qty: null,
      avgCostKrw: null,
      lastCloseKrw: 1,
      lastCloseNative: 1,
      currency: 'KRW',
      marketValueKrw: cashKrw,
      unrealizedPnlKrw: 0,
      unrealizedReturn: 0,
      holdingDays: null,
      firstBuyDate: null,
    },
  ];
}
