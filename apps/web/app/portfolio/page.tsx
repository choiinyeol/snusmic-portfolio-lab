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

export default function PortfolioPage() {
  const holdings = getCurrentHoldings();
  const equity = getEquityDaily();
  const summaries = getSummaryRows();
  const trades = getTrades();
  const episodes = getPositionEpisodes();
  const targetsBySymbol = getLatestReportTargetsBySymbol();
  const targetsByReportId = getReportTargetsById();

  const personas = Array.from(new Set(holdings.map((row) => row.persona))).sort();
  const personaLabels = Object.fromEntries(personas.map((persona) => [persona, getPersonaLabel(persona)]));
  const capitalByPersona = Object.fromEntries(
    summaries.map((row) => [row.persona, row.totalContributedKrw ?? row.finalEquityKrw ?? 0]),
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
          { label: '전략', value: `${personas.length}개` },
          { label: '체결', value: trades.length.toLocaleString('ko-KR') },
          { label: '최근 평가', value: latestEquity || '—' },
          { label: 'Mode', value: 'Static Artifacts' },
          { label: 'Trading', value: 'No live trading' },
        ]}
      />

      <PortfolioStrategyView
        holdings={holdings}
        equity={equity}
        trades={trades}
        episodes={episodes}
        personas={personas}
        personaLabels={personaLabels}
        capitalByPersona={capitalByPersona}
        reportSymbolsById={reportSymbolsById}
        targetsBySymbol={targetsBySymbol}
        targetsByReportId={targetsByReportId}
      />
    </>
  );
}
