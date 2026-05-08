import Link from 'next/link';
import { PortfolioHistory } from '@/components/trading/PortfolioHistory';
import { PortfolioTables } from '@/components/trading/PortfolioTables';
import { TradesTable } from '@/components/trading/TradesTable';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
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
      <PageHero
        eyebrow="PORTFOLIO"
        title="포트폴리오 원장"
        badges={[
          { label: '보유', value: `${holdings.length}종목` },
          { label: '월말', value: monthly.length.toLocaleString('ko-KR') },
          { label: '체결', value: trades.length.toLocaleString('ko-KR') },
          { label: '최신 스냅샷', value: latestMonth || '—' },
        ]}
        kpis={
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <KpiTile
              label="평가액"
              value={formatKrw(totalValue)}
              caption={personas.map((p) => personaLabels[p]).join(' · ')}
              tone="accent"
            />
            <KpiTile
              label="미실현 손익"
              value={formatKrw(totalPnl)}
              delta={formatPercent(cost > 0 ? totalPnl / cost : null)}
              tone={totalPnl >= 0 ? 'good' : 'bad'}
            />
            <KpiTile
              label="실현 손익"
              value={formatKrw(realizedPnl)}
              delta={`${episodes.filter((e) => e.status === 'closed').length}건 청산`}
              tone={realizedPnl >= 0 ? 'good' : 'bad'}
            />
            <KpiTile
              label="체결"
              value={trades.length.toLocaleString('ko-KR')}
              delta={`매수 ${buyCount} · 매도 ${sellCount}`}
            />
          </div>
        }
      />

      <Section eyebrow="Contribution" title="기여 상위 / 점검 상위">
        <div className="grid gap-4 lg:grid-cols-2">
          <ContributionCard
            title="수익 기여 상위"
            rows={[...holdings].sort((a, b) => (b.unrealizedPnlKrw ?? 0) - (a.unrealizedPnlKrw ?? 0)).slice(0, 5)}
            tone="good"
          />
          <ContributionCard
            title="손실 기여 상위"
            rows={[...holdings].sort((a, b) => (a.unrealizedPnlKrw ?? 0) - (b.unrealizedPnlKrw ?? 0)).slice(0, 5)}
            tone="bad"
          />
        </div>
      </Section>

      <Section eyebrow="View" title="시점별 잔고와 체결">
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
                <PortfolioHistory monthly={monthly} personaLabels={personaLabels} targetsBySymbol={targetsBySymbol} />
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

function ContributionCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: ReturnType<typeof getCurrentHoldings>;
  tone: 'good' | 'bad';
}) {
  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="card-title">{title}</h3>
          <span className={`badge badge-soft ${tone === 'good' ? 'badge-success' : 'badge-error'}`}>
            {tone === 'good' ? '기여' : '점검'}
          </span>
        </div>
        <div className="grid gap-2">
          {rows.map((row) => (
            <Link
              key={`${title}-${row.persona}-${row.symbol}`}
              href={`/reports/${row.symbol}`}
              className="flex items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200/40 p-3 transition hover:border-primary/40"
            >
              <div className="min-w-0">
                <strong className="block truncate">{row.company || row.symbol}</strong>
                <span className="text-xs text-base-content/50">
                  {row.symbol} · {row.currency}
                </span>
              </div>
              <div className="text-right">
                <strong className={tone === 'good' ? 'text-success' : 'text-error'}>
                  {formatKrw(row.unrealizedPnlKrw)}
                </strong>
                <span className="block text-xs text-base-content/50">{formatPercent(row.unrealizedReturn)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}
