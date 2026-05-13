import { PortfolioStrategyView } from '@/components/trading/PortfolioStrategyView';
import { PageHero } from '@/components/ui/PageHero';
import {
  getCurrentHoldings,
  getEquityDaily,
  getLatestReportTargetsBySymbol,
  getPersonaLabel,
  getPositionEpisodes,
  getReportSymbolById,
  getReportTargetsById,
  getSummaryRows,
  getTrades,
} from '@/lib/artifacts';
import {
  getDefaultPortfolioPersona,
  getStrategyLeaderboard,
  isBenchmarkPersona,
  portfolioStrategyHref,
  type StrategyKind,
} from '@/lib/product-model';

export default function PortfolioPage() {
  const holdings = getCurrentHoldings();
  const equity = getEquityDaily();
  const summaries = getSummaryRows();
  const trades = getTrades();
  const episodes = getPositionEpisodes();
  const targetsBySymbol = getLatestReportTargetsBySymbol();
  const targetsByReportId = getReportTargetsById();
  const strategyRows = getStrategyLeaderboard();
  const defaultPersona = getDefaultPortfolioPersona();

  const strategyById = new Map(strategyRows.map((row) => [row.id, row]));
  const allPersonas = Array.from(
    new Set([
      ...summaries.map((row) => row.persona),
      ...holdings.map((row) => row.persona),
      ...trades.map((row) => row.persona),
      ...equity.map((row) => row.persona),
    ]),
  );
  const personas = [
    ...strategyRows.map((row) => row.id).filter((persona) => allPersonas.includes(persona)),
    ...allPersonas.filter((persona) => !strategyById.has(persona)).sort(),
  ];
  const strategyPersonas = personas.filter((persona) => (strategyById.get(persona)?.kind ?? 'strategy') === 'strategy');
  const benchmarkPersonas = personas.filter(
    (persona) => (strategyById.get(persona)?.kind ?? inferPersonaKind(persona)) !== 'strategy',
  );
  const personaLabels = Object.fromEntries(
    personas.map((persona) => [persona, strategyById.get(persona)?.label ?? getPersonaLabel(persona)]),
  );
  const strategyOptions = personas.map((persona) => {
    const row = strategyById.get(persona);
    return {
      id: persona,
      label: row?.label ?? getPersonaLabel(persona),
      shortLabel: row?.shortLabel ?? getPersonaLabel(persona),
      kind: row?.kind ?? inferPersonaKind(persona),
      href: portfolioStrategyHref(persona),
    };
  });
  const capitalByPersona = Object.fromEntries(
    summaries.map((row) => [row.persona, row.totalContributedKrw ?? row.finalEquityKrw ?? 0]),
  );
  const cashByPersona = Object.fromEntries(summaries.map((row) => [row.persona, row.finalCashKrw ?? 0]));
  const methodsByPersona = Object.fromEntries(
    strategyRows.map((row) => [
      row.id,
      {
        summary: row.methodologySummary,
        buyRules: row.buyRules,
        sellRules: row.sellRules,
        riskControls: row.riskControls,
      },
    ]),
  );
  const reportSymbolsById = Object.fromEntries(
    Array.from(new Set(trades.map((trade) => trade.reportId).filter((value): value is string => Boolean(value))))
      .map((reportId) => [reportId, getReportSymbolById(reportId)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const latestEquity = equity.reduce((latest, row) => (row.date > latest ? row.date : latest), '');

  return (
    <>
      <PageHero
        eyebrow="PORTFOLIO"
        title="Portfolio — 원장형 보유 대시보드"
        subtitle="전략별 share-based 원장, 현재 보유, 체결 기록, 리포트 근거를 한 화면에서 추적합니다."
        badges={[
          { label: '선택 전략', value: `${strategyPersonas.length}개` },
          { label: '벤치마크', value: `${benchmarkPersonas.length}개` },
          { label: '체결', value: trades.length.toLocaleString('ko-KR') },
          { label: '최근 평가', value: latestEquity || '—' },
          { label: '데이터', value: '기준 데이터' },
          { label: '거래', value: '실시간 매매 아님' },
        ]}
      />

      <PortfolioStrategyView
        holdings={holdings}
        equity={equity}
        trades={trades}
        episodes={episodes}
        personas={personas}
        personaLabels={personaLabels}
        strategyOptions={strategyOptions}
        defaultPersona={defaultPersona}
        methodsByPersona={methodsByPersona}
        capitalByPersona={capitalByPersona}
        cashByPersona={cashByPersona}
        reportSymbolsById={reportSymbolsById}
        targetsBySymbol={targetsBySymbol}
        targetsByReportId={targetsByReportId}
      />
    </>
  );
}

function inferPersonaKind(persona: string): StrategyKind {
  return isBenchmarkPersona(persona) ? 'benchmark' : 'strategy';
}
