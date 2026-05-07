import { PortfolioHistory } from '@/components/trading/PortfolioHistory';
import { PortfolioTables } from '@/components/trading/PortfolioTables';
import { TradesTable } from '@/components/trading/TradesTable';
import { KpiTile } from '@/components/ui/KpiTile';
import { Section } from '@/components/ui/Section';
import { Tabs } from '@/components/ui/Tabs';
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
import { formatKrw, formatPercent } from '@/lib/format';

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

  const totalValue = holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const totalPnl = holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const cost = totalValue - totalPnl;
  const realizedPnl = episodes.reduce((sum, episode) => sum + (episode.realizedPnlKrw ?? 0), 0);
  const latestMonth = monthly.reduce((latest, row) => (row.monthEnd > latest ? row.monthEnd : latest), '');
  const buyCount = trades.filter((trade) => trade.side === 'buy').length;
  const sellCount = trades.filter((trade) => trade.side === 'sell').length;

  return (
    <>
      <section className="hero-summary">
        <div className="hero-summary__lede">
          <span className="hero-summary__eyebrow">Portfolio</span>
          <h1 className="display-1">현재 보유, 월말 스냅샷, 체결 원장 — 한 화면.</h1>
          <p className="hero-summary__sub">
            과거 별도 페이지로 흩어졌던 보유·월말·매매를 하나의 페이지 세 탭으로 모았습니다. 같은
            데이터를 다른 각도로 봅니다.
          </p>
          <div className="hero-summary__signals">
            <span>현재 보유 {holdings.length}종목</span>
            <span>월말 행 {monthly.length.toLocaleString('ko-KR')}</span>
            <span>체결 {trades.length.toLocaleString('ko-KR')}건</span>
            <span>최신 스냅샷 {latestMonth || '—'}</span>
          </div>
        </div>
        <div className="hero-summary__kpis">
          <KpiTile
            label="평가액 합계"
            value={<span className="display-num">{formatKrw(totalValue)}</span>}
            caption={`${personas.length}개 전략 · ${personas.map((p) => personaLabels[p]).join(' · ')}`}
            tone="accent"
            emphasis
          />
          <KpiTile
            label="미실현 손익"
            value={<span className="display-num">{formatKrw(totalPnl)}</span>}
            delta={formatPercent(cost > 0 ? totalPnl / cost : null)}
            tone={totalPnl >= 0 ? 'good' : 'bad'}
          />
          <KpiTile
            label="실현 손익 누적"
            value={<span className="display-num">{formatKrw(realizedPnl)}</span>}
            delta={`${episodes.filter((e) => e.status === 'closed').length}건 청산`}
            tone={realizedPnl >= 0 ? 'good' : 'bad'}
          />
          <KpiTile
            label="체결 통계"
            value={<span className="display-num">{trades.length.toLocaleString('ko-KR')}</span>}
            delta={`매수 ${buyCount.toLocaleString('ko-KR')} · 매도 ${sellCount.toLocaleString('ko-KR')}`}
          />
        </div>
      </section>

      <Section eyebrow="One book" title="세 가지 시점에서 같은 자산을 본다" caption="현재 / 월말 / 체결을 탭으로 전환합니다.">
        <Tabs
          tabs={[
            {
              id: 'current',
              label: '현재 보유',
              meta: holdings.length.toString(),
              content: (
                <PortfolioTables
                  holdings={holdings}
                  personaLabels={personaLabels}
                  capitalByPersona={capitalByPersona}
                  targetsBySymbol={targetsBySymbol}
                />
              ),
            },
            {
              id: 'history',
              label: '월말 히스토리',
              meta: monthly.length.toString(),
              content: (
                <PortfolioHistory
                  monthly={monthly}
                  personaLabels={personaLabels}
                  targetsBySymbol={targetsBySymbol}
                />
              ),
            },
            {
              id: 'trades',
              label: '체결 원장',
              meta: trades.length.toString(),
              content: (
                <TradesTable
                  trades={trades}
                  episodes={episodes}
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
      </Section>
    </>
  );
}
