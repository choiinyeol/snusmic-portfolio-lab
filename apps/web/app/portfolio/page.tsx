import { PortfolioStrategyView } from '@/components/trading/PortfolioStrategyView';
import { PageHero } from '@/components/ui/PageHero';
import {
  getCurrentHoldings,
  getLatestReportTargetsBySymbol,
  getMonthlyHoldings,
  getPersonaLabel,
  getPositionEpisodes,
  getReportSymbolById,
  getReportTargetsById,
  getSummaryRows,
  getTrades,
} from '@/lib/artifacts';

export default function PortfolioPage() {
  const holdings = getCurrentHoldings();
  const monthly = getMonthlyHoldings();
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
  const latestMonth = monthly.reduce((latest, row) => (row.monthEnd > latest ? row.monthEnd : latest), '');

  return (
    <>
      <PageHero
        eyebrow="PORTFOLIO"
        title="포트폴리오 원장"
        badges={[
          { label: '전략', value: `${personas.length}개` },
          { label: '체결', value: trades.length.toLocaleString('ko-KR') },
          { label: '월말 스냅샷', value: latestMonth || '—' },
        ]}
      />

      <PortfolioStrategyView
        holdings={holdings}
        monthly={monthly}
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
