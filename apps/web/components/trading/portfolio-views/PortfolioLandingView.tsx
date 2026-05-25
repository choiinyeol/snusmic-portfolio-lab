'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { SeriesToggleChart } from '@/components/charts/SeriesToggleChart';
import { formatKrw, formatPercent } from '@/lib/format';
import type { PortfolioAccountSnapshot, PortfolioLandingModel } from './types';
import { displayPortfolioName, strategyMeta } from './strategy-display';

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
  }, [model.equity, model.accounts, benchmarkRows]);

  if (!model.accounts.length) {
    return (
      <div className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
        표시할 포트폴리오 원장이 없습니다. 데이터 아티팩트와 계좌 catalog를 먼저 확인해야 합니다.
      </div>
    );
  }

  const leader = model.accounts[0];

  return (
    <div className="grid gap-5">
      <PortfolioRoomNav accounts={model.accounts} />

      <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">포트폴리오 원장</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              전략 탐색에서 나온 계좌를 전부 나열하지 않고, 실제 검토할 대표 원장만 비교합니다. 나머지는 과최적화 위험이
              있는 연구 산출물로 분리했습니다.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-500">
            updated {model.latestEquityDate || '-'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <Link
            className="group rounded-md border border-slate-200 bg-slate-950 p-4 text-white transition hover:bg-slate-900"
            href={leader.href}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-300">
                  current candidate
                </div>
                <h2 className="mt-1 text-xl font-semibold">{displayPortfolioName(leader.id, leader.shortLabel)}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{strategyMeta(leader.id).description}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950">원장 보기</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
              <HeroMetric label="MWR" value={formatPercent(leader.moneyWeightedReturn)} />
              <HeroMetric label="MDD" value={formatPercent(leader.maxDrawdown)} />
              <HeroMetric label="체결" value={`${(leader.tradeCount ?? 0).toLocaleString('ko-KR')}건`} />
              <HeroMetric label="보유" value={`${leader.holdingCount.toLocaleString('ko-KR')}종목`} />
            </div>
          </Link>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-amber-700">overfit guard</div>
            <h2 className="mt-1 text-base font-semibold text-slate-950">연구 후보를 선별해서 보여줍니다</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              총 {model.totalResearchAccountCount.toLocaleString('ko-KR')}개 계좌 중{' '}
              {model.accounts.length.toLocaleString('ko-KR')}개만 비교합니다. 숨긴{' '}
              {model.hiddenResearchAccountCount.toLocaleString('ko-KR')}개는 파라미터 탐색 산출물이므로 기본 화면에서
              투자 후보처럼 보이지 않게 분리했습니다.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {model.accounts.map((account) => (
            <StrategyCard account={account} key={account.id} />
          ))}
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">대표 원장 vs 벤치마크</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              선별된 전략 계좌와 KODEX200, All Weather, QQQ, SPY, GLD를 같은 축에서 비교합니다.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400">{chartSeries.length.toLocaleString('ko-KR')} series</span>
        </div>
        <SeriesToggleChart series={chartSeries} />
      </section>
    </div>
  );
}

function PortfolioRoomNav({ accounts }: { accounts: PortfolioAccountSnapshot[] }) {
  return (
    <nav className="flex min-h-12 flex-wrap items-center gap-6 border-b border-slate-200 text-sm font-semibold">
      <span className="border-b-2 border-slate-950 pb-3 text-slate-950">포트폴리오</span>
      {accounts.map((account) => (
        <Link className="pb-3 text-slate-400 transition hover:text-slate-950" href={account.href} key={account.id}>
          {displayPortfolioName(account.id, account.shortLabel)}
        </Link>
      ))}
    </nav>
  );
}

function StrategyCard({ account }: { account: PortfolioAccountSnapshot }) {
  const meta = strategyMeta(account.id);
  const positive = (account.moneyWeightedReturn ?? 0) >= 0;
  return (
    <Link
      className="group grid gap-4 rounded-md border border-slate-200 bg-white p-4 transition hover:border-slate-400 hover:bg-slate-50/60"
      href={account.href}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {meta.role}
          </div>
          <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-950">
            {displayPortfolioName(account.id, account.shortLabel)}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{meta.subtitle}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
          열기
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MiniMetric
          label="MWR"
          value={formatSignedPercent(account.moneyWeightedReturn)}
          tone={positive ? 'good' : 'bad'}
        />
        <MiniMetric label="MDD" value={formatPercent(account.maxDrawdown)} />
        <MiniMetric label="평가액" value={formatKrw(account.finalEquityKrw)} />
        <MiniMetric label="체결" value={`${(account.tradeCount ?? 0).toLocaleString('ko-KR')}건`} />
      </div>

      <p className="text-sm leading-6 text-slate-500">{meta.description}</p>
    </Link>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/10 px-3 py-2">
      <div className="text-xs text-slate-300">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'bad';
}) {
  const toneClass = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-rose-600' : 'text-slate-950';
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 truncate font-mono text-sm font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPercent(value)}`;
}
