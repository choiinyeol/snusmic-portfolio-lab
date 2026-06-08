import Link from 'next/link';
import type { ReactNode } from 'react';
import { PortfolioHoldingsView } from '@/components/trading/portfolio-views/PortfolioHoldingsView';
import { displayPortfolioName } from '@/lib/portfolio-labels';
import { PortfolioLandingView } from '@/components/trading/portfolio-views/PortfolioLandingView';
import { PortfolioOverviewView } from '@/components/trading/portfolio-views/PortfolioOverviewView';
import { PortfolioTradesView } from '@/components/trading/portfolio-views/PortfolioTradesView';
import type { PortfolioAccountShellModel, PortfolioRouteModels } from '@/components/trading/portfolio-views/types';
import { Button } from '@/components/ui/button';
import { formatKrw, formatMultiple, formatPercent } from '@/lib/format';
import {
  buildPortfolioLandingModel,
  buildPortfolioRouteModels,
  getPortfolioStaticParams as getStaticParams,
} from './portfolio-view-model';

export type PortfolioRouteView = 'ledger' | 'holdings' | 'trades';

export function PortfolioPageContent() {
  return <PortfolioLandingView model={buildPortfolioLandingModel()} />;
}

export function EmptyPortfolioRouteContent() {
  return <PortfolioPageContent />;
}

export function PortfolioPageShell({ children, model }: { children: ReactNode; model: PortfolioAccountShellModel }) {
  const accountId = model.selectedAccount;
  const selectedOption = model.accountOptions.find((row) => row.id === accountId);
  const label = selectedOption?.label ?? accountId;
  const fallback = selectedOption?.shortLabel ?? label;
  const shortLabel = displayPortfolioName(accountId, fallback);
  const diagnostics = model.ledgerDiagnostics;

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              portfolio account
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{shortLabel}</h1>
            <p className="mt-1 text-sm text-slate-500">
              개요에서 성과 경로를 보고, 보유·거래 trace는 각 상세 화면에서 전부 확인합니다.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">포트폴리오 홈</Link>
          </Button>
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
      <div className="min-w-0">{children}</div>
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
  const models = buildPortfolioRouteModels(selectedAccount);
  return (
    <PortfolioPageShell model={models.shell}>
      <PortfolioRouteContentFromModel model={models} view={view} />
    </PortfolioPageShell>
  );
}

export function PortfolioRouteContentFromModel({
  model,
  view,
}: {
  model: PortfolioRouteModels;
  view: PortfolioRouteView;
}) {
  if (view === 'holdings') return <PortfolioHoldingsView model={model.holdings} />;
  if (view === 'trades') return <PortfolioTradesView model={model.trades} />;
  return <PortfolioOverviewView model={model.overview} />;
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
