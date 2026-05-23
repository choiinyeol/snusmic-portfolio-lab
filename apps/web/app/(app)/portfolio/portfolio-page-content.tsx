import Link from 'next/link';
import type { ReactNode } from 'react';
import { PortfolioEquityView } from '@/components/trading/portfolio-views/PortfolioEquityView';
import { PortfolioHoldingsView } from '@/components/trading/portfolio-views/PortfolioHoldingsView';
import { PortfolioLandingView } from '@/components/trading/portfolio-views/PortfolioLandingView';
import { PortfolioOverviewView } from '@/components/trading/portfolio-views/PortfolioOverviewView';
import { PortfolioAccountFrame } from '@/components/trading/portfolio-views/PortfolioAccountFrame';
import { PortfolioTradesView } from '@/components/trading/portfolio-views/PortfolioTradesView';
import type { PortfolioViewModel } from '@/components/trading/portfolio-views/types';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/ui/PageHero';
import { formatKrw, formatPercent } from '@/lib/format';
import {
  buildPortfolioLandingModel,
  buildPortfolioViewModel,
  getPortfolioStaticParams as getStaticParams,
} from './portfolio-view-model';

export type PortfolioRouteView = 'overview' | 'holdings' | 'equity' | 'trades';

export function PortfolioPageContent() {
  return <PortfolioLandingView model={buildPortfolioLandingModel()} />;
}

export function EmptyPortfolioRouteContent() {
  return <PortfolioPageContent />;
}

export function PortfolioPageShell({ children, model }: { children: ReactNode; model: PortfolioViewModel }) {
  const account_id = model.selectedAccount;
  const label = model.accountLabels[account_id] ?? account_id;
  const shortLabel = model.accountOptions.find((row) => row.id === account_id)?.shortLabel ?? label;
  const holdingsValue = model.holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const cashKrw = model.cashByAccount[account_id] ?? 0;
  const totalValue = holdingsValue + cashKrw;
  const totalPnl = model.holdings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const latestEquity = [...model.equity].sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="grid gap-5">
      <PageHero
        eyebrow="Portfolio report"
        title={shortLabel}
        subtitle={`${label}의 실제 보유, RP이자, 체결, 손익 경로를 계좌 보고서 형태로 보여줍니다. 벤치마크는 선택 가능한 실제 보유 원장에 섞지 않고 비교 기준선으로만 표시합니다.`}
        badges={[
          { label: '최근 평가', value: model.latestEquityDate || '—' },
          { label: '표시 기준', value: '실제 보유 계좌' },
        ]}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">계좌 선택</Link>
          </Button>
        }
        kpis={
          <FactsTable
            rows={[
              { label: '현재 평가액', value: formatKrw(totalValue), tone: 'neutral' },
              {
                label: 'RP이자 비중',
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
        }
      />
      <PortfolioAccountFrame model={model}>{children}</PortfolioAccountFrame>
    </div>
  );
}

export function PortfolioRouteContent({
  selectedAccount,
  view,
}: {
  selectedAccount: string;
  view: PortfolioRouteView;
}) {
  const model = buildPortfolioViewModel(selectedAccount);
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
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="계좌 핵심 지표">
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
