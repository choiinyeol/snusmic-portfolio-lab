import Link from 'next/link';
import type { ReactNode } from 'react';
import { PortfolioEquityView } from '@/components/trading/portfolio-views/PortfolioEquityView';
import { PortfolioHoldingsView } from '@/components/trading/portfolio-views/PortfolioHoldingsView';
import { PortfolioLandingView } from '@/components/trading/portfolio-views/PortfolioLandingView';
import { PortfolioMethodologyView } from '@/components/trading/portfolio-views/PortfolioMethodologyView';
import { PortfolioOverviewView } from '@/components/trading/portfolio-views/PortfolioOverviewView';
import { PortfolioStrategyFrame } from '@/components/trading/portfolio-views/PortfolioStrategyFrame';
import { PortfolioTradesView } from '@/components/trading/portfolio-views/PortfolioTradesView';
import type { PortfolioViewModel } from '@/components/trading/portfolio-views/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatKrw, formatPercent } from '@/lib/format';
import {
  buildPortfolioLandingModel,
  buildPortfolioViewModel,
  getPortfolioStaticParams as getStaticParams,
} from './portfolio-view-model';

export type PortfolioRouteView = 'overview' | 'holdings' | 'equity' | 'trades' | 'methodology';

export function PortfolioPageContent() {
  return <PortfolioLandingView model={buildPortfolioLandingModel()} />;
}

export function PortfolioPageShell({ children, model }: { children: ReactNode; model: PortfolioViewModel }) {
  const persona = model.selectedPersona;
  const label = model.personaLabels[persona] ?? persona;
  const shortLabel = model.strategyOptions.find((row) => row.id === persona)?.shortLabel ?? label;
  const holdingsValue = model.holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const cashKrw = model.cashByPersona[persona] ?? 0;
  const totalValue = holdingsValue + cashKrw;
  const totalPnl = model.holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const latestEquity = [...model.equity].sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="grid gap-5">
      <header className="grid gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">운용 보고서</Badge>
          <Badge variant="secondary">benchmark 제외</Badge>
          <span className="font-mono text-xs text-slate-500">{model.latestEquityDate || '—'} 평가</span>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.75fr)] xl:items-end">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-slate-950 md:text-4xl">{shortLabel}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {label}의 실제 보유, RP 대기자금, 체결, 매매 로직을 투자 보고서 형태로 보여줍니다.
              benchmark·follower·oracle류는 `/strategies` 비교 페이지에 남기고 이 원장에는 섞지 않습니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/portfolio">포트폴리오 선택</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/strategies">전략 비교</Link>
              </Button>
            </div>
          </div>
          <FactsTable
            rows={[
              { label: '현재 평가액', value: formatKrw(totalValue), tone: 'neutral' },
              {
                label: 'RP 비중',
                value: formatPercent(totalValue > 0 ? cashKrw / totalValue : null),
                caption: formatKrw(cashKrw),
              },
              { label: '미실현 손익', value: formatKrw(totalPnl), tone: totalPnl >= 0 ? 'good' : 'bad' },
              {
                label: '누적 수익률',
                value: formatPercent(latestEquity?.cumulativeReturn ?? null),
                tone: (latestEquity?.cumulativeReturn ?? 0) >= 0 ? 'good' : 'bad',
              },
            ]}
          />
        </div>
      </header>
      <PortfolioStrategyFrame model={model}>{children}</PortfolioStrategyFrame>
    </div>
  );
}

export function PortfolioRouteContent({
  selectedPersona,
  view,
}: {
  selectedPersona: string;
  view: PortfolioRouteView;
}) {
  const model = buildPortfolioViewModel(selectedPersona);
  return <PortfolioRouteContentFromModel model={model} view={view} />;
}

export function PortfolioRouteContentFromModel({
  model,
  view,
}: {
  model: PortfolioViewModel;
  view: PortfolioRouteView;
}) {
  if (view === 'holdings') return <PortfolioHoldingsView model={model} />;
  if (view === 'equity') return <PortfolioEquityView model={model} />;
  if (view === 'trades') return <PortfolioTradesView model={model} />;
  if (view === 'methodology') {
    return (
      <PortfolioMethodologyView
        method={model.methodsByPersona[model.selectedPersona]}
        personaLabel={model.personaLabels[model.selectedPersona] ?? model.selectedPersona}
      />
    );
  }
  return <PortfolioOverviewView model={model} />;
}

export const getPortfolioStaticParams = getStaticParams;

type FactRow = {
  label: string;
  value: string;
  caption?: string;
  tone?: 'neutral' | 'good' | 'bad';
};

function FactsTable({ rows }: { rows: FactRow[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="포트폴리오 핵심 지표">
      <dl className="grid grid-cols-2 lg:grid-cols-4 [&>div]:border-b [&>div]:border-r [&>div]:border-slate-100">
        {rows.map((row) => (
          <div className="grid min-w-0 gap-0.5 p-3" key={row.label}>
            <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
            <dd className={`truncate font-mono text-sm font-semibold tabular-nums ${toneClass(row.tone)}`}>
              {row.value}
            </dd>
            {row.caption ? <dd className="truncate text-xs text-slate-500">{row.caption}</dd> : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function toneClass(tone: FactRow['tone']): string {
  if (tone === 'good') return 'text-emerald-600';
  if (tone === 'bad') return 'text-rose-600';
  return 'text-slate-950';
}
