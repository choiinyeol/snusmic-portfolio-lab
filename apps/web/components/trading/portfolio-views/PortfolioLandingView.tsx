'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { SeriesToggleChart } from '@/components/charts/SeriesToggleChart';
import { formatKrw, formatPercent } from '@/lib/format';
import type { PortfolioLandingModel } from './types';
import { displayPortfolioName, portfolioRoleLabel } from '@/lib/portfolio-labels';

const SERIES_COLORS = ['#111827', '#2563eb', '#059669', '#f29423', '#7c3aed', '#dc2626', '#64748b'];

export function PortfolioLandingView({ model }: { model: PortfolioLandingModel }) {
  const benchmarkRows = model.frontierRows.filter((row) => row.kind === 'benchmark');
  const chartSeries = useMemo<ReturnSeries[]>(() => {
    const rows = [...model.accounts, ...benchmarkRows];
    return rows.map((account, index) => ({
      id: account.id,
      label: displayPortfolioName(account.id, account.shortLabel),
      shortLabel: displayPortfolioName(account.id, account.shortLabel),
      color: SERIES_COLORS[index % SERIES_COLORS.length],
      points: model.equity
        .filter((point) => point.account_id === account.id && point.cumulativeReturn !== null)
        .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
    }));
  }, [benchmarkRows, model.accounts, model.equity]);

  const bestReturn = useMemo(
    () =>
      [...model.accounts].sort(
        (a, b) => (b.moneyWeightedReturn ?? -Infinity) - (a.moneyWeightedReturn ?? -Infinity),
      )[0],
    [model.accounts],
  );
  const shallowestDrawdown = useMemo(
    () => [...model.accounts].sort((a, b) => (a.maxDrawdown ?? Infinity) - (b.maxDrawdown ?? Infinity))[0],
    [model.accounts],
  );
  const candidateCount = model.accounts.filter((account) => account.context.role === 'candidate').length;

  if (!model.accounts.length) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
        표시할 포트폴리오 원장이 없습니다. 데이터 아티팩트와 계좌 catalog를 먼저 확인해야 합니다.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              portfolio frontier
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">포트폴리오 비교</h1>
            <p className="mt-1 text-sm text-slate-500">
              대표 원장의 수익률, 낙폭, 평가액을 먼저 비교한 뒤 상세 원장으로 들어갑니다.
            </p>
          </div>
          <div className="font-mono text-xs text-slate-500">updated {model.latestEquityDate || '-'}</div>
        </div>

        <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="공개 원장"
            value={`${model.accounts.length.toLocaleString('ko-KR')}개`}
            caption={`숨김 ${model.hiddenResearchAccountCount.toLocaleString('ko-KR')}개`}
          />
          <MetricTile
            label="최고 수익률"
            value={formatPercent(bestReturn?.moneyWeightedReturn)}
            caption={bestReturn ? displayPortfolioName(bestReturn.id, bestReturn.shortLabel) : '-'}
            tone={bestReturn?.moneyWeightedReturn}
          />
          <MetricTile
            label="최저 낙폭"
            value={formatPercent(shallowestDrawdown?.maxDrawdown)}
            caption={
              shallowestDrawdown ? displayPortfolioName(shallowestDrawdown.id, shallowestDrawdown.shortLabel) : '-'
            }
          />
          <MetricTile
            label="후보 원장"
            value={`${candidateCount.toLocaleString('ko-KR')}개`}
            caption="현재 우선 검토 대상"
          />
        </dl>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">누적 경로 비교</h2>
            <p className="mt-1 text-xs text-slate-500">대표 원장과 벤치마크를 같은 축에 올립니다.</p>
          </div>
          <div className="font-mono text-xs text-slate-400">{chartSeries.length.toLocaleString('ko-KR')} series</div>
        </div>
        <SeriesToggleChart series={chartSeries} />
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">대표 원장</h2>
            <p className="mt-1 text-xs text-slate-500">설명보다 숫자를 먼저 보고, 필요한 계좌만 엽니다.</p>
          </div>
          <div className="text-xs text-slate-500">
            기본 계좌 {displayPortfolioName(model.defaultAccount, model.defaultAccount)}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-0 py-2">계좌</th>
                <th className="px-3 py-2">역할</th>
                <th className="px-3 py-2 text-right">수익률</th>
                <th className="px-3 py-2 text-right">MDD</th>
                <th className="px-3 py-2 text-right">평가액</th>
                <th className="px-3 py-2 text-right">거래</th>
                <th className="px-3 py-2 text-right">보유</th>
                <th className="px-3 py-2 text-right">현금비중</th>
              </tr>
            </thead>
            <tbody>
              {model.accounts.map((account) => (
                <tr className="border-b border-slate-100 last:border-b-0" key={account.id}>
                  <td className="px-0 py-2.5">
                    <Link className="block min-w-0 hover:text-slate-950" href={account.href}>
                      <div className="truncate font-medium text-slate-900">
                        {displayPortfolioName(account.id, account.shortLabel)}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {account.context.title} · 비중 {formatPercent(account.topHoldingWeight)}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{portfolioRoleLabel(account.context.role)}</td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono tabular-nums ${signedToneClass(account.moneyWeightedReturn)}`}
                  >
                    {formatPercent(account.moneyWeightedReturn)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {formatPercent(account.maxDrawdown)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">
                    {formatKrw(account.finalEquityKrw)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {account.tradeCount?.toLocaleString('ko-KR') ?? '-'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {account.holdingCount.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {formatPercent(account.cashWeight)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricTile({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: number | null;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-1 font-mono text-lg font-semibold tabular-nums ${signedToneClass(tone)}`}>{value}</dd>
      <dd className="mt-1 truncate text-xs text-slate-500">{caption}</dd>
    </div>
  );
}

function signedToneClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'text-slate-700';
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-rose-600';
  return 'text-slate-700';
}
