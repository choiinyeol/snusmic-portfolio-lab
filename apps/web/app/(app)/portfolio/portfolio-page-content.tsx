import Link from 'next/link';
import type { ReactNode } from 'react';
import { PortfolioEquityView } from '@/components/trading/portfolio-views/PortfolioEquityView';
import { PortfolioHoldingsView } from '@/components/trading/portfolio-views/PortfolioHoldingsView';
import { displayPortfolioName, strategyMeta } from '@/components/trading/portfolio-views/strategy-display';
import { PortfolioLandingView } from '@/components/trading/portfolio-views/PortfolioLandingView';
import { PortfolioOverviewView } from '@/components/trading/portfolio-views/PortfolioOverviewView';
import { PortfolioAccountFrame } from '@/components/trading/portfolio-views/PortfolioAccountFrame';
import { PortfolioTradesView } from '@/components/trading/portfolio-views/PortfolioTradesView';
import type { PortfolioViewModel } from '@/components/trading/portfolio-views/types';
import { Button } from '@/components/ui/button';
import { formatKrw, formatMultiple, formatPercent } from '@/lib/format';
import {
  buildPortfolioLandingModel,
  buildPortfolioViewModel,
  getPortfolioStaticParams as getStaticParams,
} from './portfolio-view-model';

export type PortfolioRouteView = 'ledger' | 'holdings' | 'equity' | 'trades';

export function PortfolioPageContent() {
  return <PortfolioLandingView model={buildPortfolioLandingModel()} />;
}

export function EmptyPortfolioRouteContent() {
  return <PortfolioPageContent />;
}

export function PortfolioPageShell({ children, model }: { children: ReactNode; model: PortfolioViewModel }) {
  const accountId = model.selectedAccount;
  const label = model.accountLabels[accountId] ?? accountId;
  const fallback = model.accountOptions.find((row) => row.id === accountId)?.shortLabel ?? label;
  const shortLabel = displayPortfolioName(accountId, fallback);
  const diagnostics = model.ledgerDiagnostics;
  const meta = strategyMeta(accountId);

  return (
    <div className="grid gap-5">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              account ledger
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{shortLabel} 원장</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              현재 보유, 실현손익, 미실현손익, 승률과 손익비를 한 화면에서 확인합니다.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">포트폴리오 홈</Link>
          </Button>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {meta.role}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{meta.subtitle}</div>
          <p className="mt-1 max-w-5xl text-sm leading-6 text-slate-600">{meta.description}</p>
        </div>

        <FactsTable
          rows={[
            { label: '평가액', value: formatKrw(diagnostics.currentValueKrw), tone: 'neutral' },
            {
              label: '누적수익률',
              value: formatPercent(diagnostics.cumulativeReturn),
              tone: (diagnostics.cumulativeReturn ?? 0) >= 0 ? 'good' : 'bad',
            },
            {
              label: '실현손익',
              value: formatKrw(diagnostics.realizedPnlKrw),
              tone: (diagnostics.realizedPnlKrw ?? 0) >= 0 ? 'good' : 'bad',
            },
            {
              label: '미실현손익',
              value: formatKrw(diagnostics.unrealizedPnlKrw),
              tone: (diagnostics.unrealizedPnlKrw ?? 0) >= 0 ? 'good' : 'bad',
            },
            {
              label: '승률',
              value: formatPercent(diagnostics.winRate),
              caption: `${diagnostics.closedEpisodeCount.toLocaleString('ko-KR')}개 마감 포지션`,
            },
            { label: '손익비', value: formatMultiple(diagnostics.payoffRatio) },
          ]}
        />
      </section>
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
  return (
    <PortfolioPageShell model={model}>
      <PortfolioRouteContentFromModel model={model} view={view} />
    </PortfolioPageShell>
  );
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
    <section className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="계좌 핵심 지표">
      <dl className="grid grid-cols-2 lg:grid-cols-6 [&>div]:border-b [&>div]:border-r [&>div]:border-slate-100">
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
