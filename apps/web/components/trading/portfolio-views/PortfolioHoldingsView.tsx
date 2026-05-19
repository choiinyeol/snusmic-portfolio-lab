'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { reportTargetHref } from '@/components/trading/helpers';
import { PortfolioTables } from '@/components/trading/PortfolioTables';
import type { HoldingRow, ReportTargetDigest } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';
import type { PortfolioViewModel } from './types';

export function PortfolioHoldingsView({ model }: { model: PortfolioViewModel }) {
  const persona = model.selectedPersona;
  const personaLabel = model.personaLabels[persona] ?? persona;
  const holdings = useMemo(() => model.holdings.filter((row) => row.persona === persona), [model.holdings, persona]);
  const totalValue = holdings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const topHoldings = useMemo(
    () => [...holdings].sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0)).slice(0, 4),
    [holdings],
  );
  const hrefBySymbol = useMemo(
    () =>
      Object.fromEntries(
        Object.values(model.targetsBySymbol).map((target) => [target.symbol, reportTargetHref(target)]),
      ),
    [model.targetsBySymbol],
  );

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,.92fr)]">
        <article className="rounded-md border border-slate-200 bg-white p-3">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                current allocation
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">현재 보유 비중</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                아래 표와 같은 원장입니다. 면적이 큰 종목부터 리포트 근거로 바로 이동할 수 있습니다.
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-500">{formatKrw(totalValue)}</span>
          </div>
          <HoldingsTreemap
            holdings={holdings}
            height={420}
            compact
            hrefBySymbol={hrefBySymbol}
            caption="면적 = 보유 평가액, 색 = 미실현 수익률. 종목을 누르면 연결된 최신 리포트 근거로 이동합니다."
          />
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              evidence links
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">큰 비중부터 근거 확인</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {personaLabel}의 현재 위험은 보유 비중 상위 종목이 결정합니다. 각 행은 최신 리포트 근거와 연결됩니다.
            </p>
          </div>
          <div className="grid gap-2">
            {topHoldings.map((holding, index) => (
              <HoldingEvidenceCard
                holding={holding}
                index={index}
                key={`${holding.persona}-${holding.symbol}`}
                target={model.targetsBySymbol[holding.symbol]}
                totalValue={totalValue}
              />
            ))}
            {!topHoldings.length ? <p className="text-sm text-slate-500">현재 보유 종목이 없습니다.</p> : null}
          </div>
        </article>
      </section>

      <PortfolioTables
        capitalByPersona={model.capitalByPersona}
        holdings={model.holdings}
        persona={model.selectedPersona}
        personaLabels={model.personaLabels}
        targetsBySymbol={model.targetsBySymbol}
      />
    </div>
  );
}

function HoldingEvidenceCard({
  holding,
  index,
  target,
  totalValue,
}: {
  holding: HoldingRow;
  index: number;
  target: ReportTargetDigest | undefined;
  totalValue: number;
}) {
  const weight = totalValue > 0 ? (holding.marketValueKrw ?? 0) / totalValue : null;
  const href = target ? reportTargetHref(target) : `/reports/${encodeURIComponent(holding.symbol)}`;
  return (
    <Link
      className="grid gap-2 rounded-md border border-slate-200 p-3 transition-colors hover:border-slate-400 hover:bg-slate-50"
      href={href}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded bg-slate-950 font-mono text-[10px] font-bold text-white">
              {index + 1}
            </span>
            <span className="truncate font-semibold text-slate-950">{holding.company || holding.symbol}</span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500">
            {holding.symbol} · {target?.publicationDate ?? '리포트 날짜 없음'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-semibold tabular-nums text-slate-950">{formatPercent(weight)}</div>
          <div className="font-mono text-[11px] text-slate-500">{formatKrw(holding.marketValueKrw)}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] font-medium">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
          {target ? '근거 리포트' : '근거 없음'}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 ${(holding.unrealizedReturn ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
        >
          미실현 {formatPercent(holding.unrealizedReturn)}
        </span>
      </div>
    </Link>
  );
}
