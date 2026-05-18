import { PortfolioStrategyView } from '@/components/trading/PortfolioStrategyView';
import { PageHero } from '@/components/ui/PageHero';
import {
  getCurrentHoldings,
  getAccountingReconciliations,
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

const BENCHMARK_COMPARE_IDS = ['benchmark_kodex200', 'benchmark_qqq', 'benchmark_spy'];

export function PortfolioPageContent({ selectedPersona }: { selectedPersona?: string }) {
  const allHoldings = getCurrentHoldings();
  const allAccounting = getAccountingReconciliations();
  const allEquity = getEquityDaily();
  const summaries = getSummaryRows();
  const allTrades = getTrades();
  const allEpisodes = getPositionEpisodes();
  const allTargetsBySymbol = getLatestReportTargetsBySymbol();
  const allTargetsByReportId = getReportTargetsById();
  const strategyRows = getStrategyLeaderboard();
  const defaultPersona = getDefaultPortfolioPersona();

  const strategyById = new Map(strategyRows.map((row) => [row.id, row]));
  const allPersonas = Array.from(
    new Set([
      ...summaries.map((row) => row.persona),
      ...allHoldings.map((row) => row.persona),
      ...allTrades.map((row) => row.persona),
      ...allEquity.map((row) => row.persona),
    ]),
  );
  const orderedStrategyIds = [
    defaultPersona,
    ...strategyRows.filter((row) => row.kind === 'strategy' && row.id !== defaultPersona).map((row) => row.id),
    ...strategyRows.filter((row) => row.kind === 'benchmark').map((row) => row.id),
    ...strategyRows.filter((row) => row.kind === 'oracle').map((row) => row.id),
  ];
  const personas = [
    ...Array.from(new Set(orderedStrategyIds)).filter((persona) => allPersonas.includes(persona)),
    ...allPersonas.filter((persona) => !strategyById.has(persona)).sort(),
  ];
  const activePersona = selectedPersona && personas.includes(selectedPersona) ? selectedPersona : defaultPersona;
  const invalidStrategyId = selectedPersona && !personas.includes(selectedPersona) ? selectedPersona : null;
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
      isDefault: persona === defaultPersona,
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

  const relevantEquityIds = new Set([activePersona, ...BENCHMARK_COMPARE_IDS]);
  const holdings = allHoldings.filter((row) => row.persona === activePersona);
  const accounting = allAccounting.filter((row) => row.persona === activePersona);
  const equity = allEquity.filter((row) => relevantEquityIds.has(row.persona));
  const trades = allTrades.filter((row) => row.persona === activePersona);
  const episodes = allEpisodes.filter((row) => row.persona === activePersona);
  const relevantSymbols = new Set([
    ...holdings.map((row) => row.symbol),
    ...trades.map((row) => row.symbol),
    ...episodes.map((row) => row.symbol),
  ]);
  const relevantReportIds = new Set(
    trades.map((trade) => trade.reportId).filter((value): value is string => Boolean(value)),
  );
  const targetsBySymbol = Object.fromEntries(
    Object.entries(allTargetsBySymbol).filter(([symbol]) => relevantSymbols.has(symbol)),
  );
  const targetsByReportId = Object.fromEntries(
    Object.entries(allTargetsByReportId).filter(
      ([reportId, target]) => relevantReportIds.has(reportId) || relevantSymbols.has(target.symbol),
    ),
  );
  const reportSymbolsById = Object.fromEntries(
    Array.from(relevantReportIds)
      .map((reportId) => [reportId, getReportSymbolById(reportId)])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const latestEquity = allEquity.reduce((latest, row) => (row.date > latest ? row.date : latest), '');

  return (
    <>
      <PageHero
        eyebrow="보유 현황"
        title="포트폴리오"
        subtitle="보유 종목, 매매내역, 현금 흐름, 연결 리포트 근거를 저장된 데이터 기준으로 확인합니다."
        badges={[
          { label: '선택 전략', value: `${strategyPersonas.length}개` },
          { label: '벤치마크', value: `${benchmarkPersonas.length}개` },
          { label: '매매내역', value: allTrades.length.toLocaleString('ko-KR') },
          { label: '최근 평가', value: latestEquity || '—' },
          { label: '데이터', value: '저장 기준' },
          { label: '거래', value: '실시간 매매 아님' },
        ]}
      />

      <PortfolioStrategyView
        holdings={holdings}
        accounting={accounting}
        equity={equity}
        trades={trades}
        episodes={episodes}
        personas={personas}
        personaLabels={personaLabels}
        strategyOptions={strategyOptions}
        strategyRows={strategyRows}
        defaultPersona={defaultPersona}
        selectedPersona={activePersona}
        invalidStrategyId={invalidStrategyId}
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

export function getPortfolioStaticParams() {
  const strategyRows = getStrategyLeaderboard();
  const summaries = getSummaryRows();
  const summaryIds = new Set(summaries.map((row) => row.persona));
  return strategyRows.filter((row) => summaryIds.has(row.id)).map((row) => ({ strategy: row.id }));
}

function inferPersonaKind(persona: string): StrategyKind {
  return isBenchmarkPersona(persona) ? 'benchmark' : 'strategy';
}
