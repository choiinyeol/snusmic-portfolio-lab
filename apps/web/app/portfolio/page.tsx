import Link from 'next/link';
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
      <section className="hero overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="hero-content grid w-full max-w-none gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(360px,.9fr)] md:p-8">
          <div className="grid min-w-0 content-center gap-4">
            <span className="badge badge-primary badge-soft w-fit tracking-[0.16em]">PORTFOLIO LEDGER</span>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.06em] text-base-content md:text-6xl">성과의 원인을 보유·월말·체결 단위로 추적합니다.</h1>
            <p className="max-w-3xl text-lg leading-8 text-base-content/70">
              현재 포지션은 가장 최근 종가 기준, 월말 스냅샷은 매월 말일 잔고, 체결 원장은 매수·매도 단위 기록입니다.
              외화 자산 가격은 현지 통화로 먼저 보고 원화는 합산 가치에서 확인합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-ghost">현재 보유 {holdings.length}종목</span>
              <span className="badge badge-ghost">월말 행 {monthly.length.toLocaleString('ko-KR')}</span>
              <span className="badge badge-ghost">체결 {trades.length.toLocaleString('ko-KR')}건</span>
              <span className="badge badge-ghost">최신 스냅샷 {latestMonth || '—'}</span>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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
        </div>
      </section>


      <Section
        eyebrow="Contribution"
        title="무엇이 성과를 만들고, 무엇이 성과를 깎았나요?"
        caption="탭으로 들어가기 전에 수익 기여 상위와 손실 기여 상위를 먼저 보여줍니다."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ContributionCard title="수익 기여 상위" rows={[...holdings].sort((a, b) => (b.unrealizedPnlKrw ?? 0) - (a.unrealizedPnlKrw ?? 0)).slice(0, 5)} tone="good" />
          <ContributionCard title="손실 기여 상위" rows={[...holdings].sort((a, b) => (a.unrealizedPnlKrw ?? 0) - (b.unrealizedPnlKrw ?? 0)).slice(0, 5)} tone="bad" />
        </div>
      </Section>

      <Section eyebrow="View" title="시점별 잔고와 체결" caption="현재 / 월말 / 체결 탭에서 동일 데이터를 시점에 따라 전환합니다.">
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

function ContributionCard({ title, rows, tone }: { title: string; rows: ReturnType<typeof getCurrentHoldings>; tone: 'good' | 'bad' }) {
  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="card-title">{title}</h3>
          <span className={`badge badge-soft ${tone === 'good' ? 'badge-success' : 'badge-error'}`}>{tone === 'good' ? '기여' : '점검'}</span>
        </div>
        <div className="grid gap-2">
          {rows.map((row) => (
            <Link key={`${title}-${row.persona}-${row.symbol}`} href={`/reports/${row.symbol}`} className="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200/40 p-3 transition hover:border-primary/40">
              <div className="min-w-0">
                <strong className="block truncate">{row.company || row.symbol}</strong>
                <span className="text-xs text-base-content/50">{row.symbol} · {row.currency}</span>
              </div>
              <div className="text-right">
                <strong className={tone === 'good' ? 'text-success' : 'text-error'}>{formatKrw(row.unrealizedPnlKrw)}</strong>
                <span className="block text-xs text-base-content/50">{formatPercent(row.unrealizedReturn)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
