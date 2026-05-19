'use client';

import { useMemo, useState } from 'react';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { KpiTile } from '@/components/ui/KpiTile';
import type { EquityPoint, TradeRow } from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';

type Props = {
  equity: EquityPoint[];
  trades: TradeRow[];
  persona: string;
  personaLabels: Record<string, string>;
};

const PAGE_SIZE_OPTIONS = [30, 90, 180, 365] as const;

export function DailyEquityHistory({ equity, trades, persona, personaLabels }: Props) {
  const [windowSize, setWindowSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(90);

  const personaEquity = useMemo(
    () => equity.filter((row) => row.persona === persona).sort((a, b) => a.date.localeCompare(b.date)),
    [equity, persona],
  );
  const personaTrades = useMemo(
    () => trades.filter((row) => row.persona === persona).sort((a, b) => b.date.localeCompare(a.date)),
    [trades, persona],
  );

  const summary = useMemo(() => {
    if (!personaEquity.length) return null;
    const first = personaEquity[0];
    const last = personaEquity[personaEquity.length - 1];
    const peak = personaEquity.reduce(
      (best, point) => ((point.equityKrw ?? 0) > (best.equityKrw ?? 0) ? point : best),
      first,
    );
    const trough = personaEquity.reduce(
      (worst, point) => ((point.equityKrw ?? Infinity) < (worst.equityKrw ?? Infinity) ? point : worst),
      first,
    );
    const peakEquity = peak.equityKrw ?? 0;
    const drawdown = peakEquity > 0 && last.equityKrw !== null ? last.equityKrw / peakEquity - 1 : null;
    return { first, last, peak, trough, drawdown };
  }, [personaEquity]);

  const chartSeries = useMemo<ReturnSeries[]>(
    () => [
      {
        id: persona,
        label: personaLabels[persona] ?? persona,
        color: '#1b64da',
        points: personaEquity
          .filter((row) => row.cumulativeReturn !== null)
          .map((row) => ({ time: row.date, value: row.cumulativeReturn ?? 0 })),
      },
    ],
    [persona, personaEquity, personaLabels],
  );

  const recentDays = useMemo(() => personaEquity.slice(-windowSize).reverse(), [personaEquity, windowSize]);
  const tradeCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const trade of personaTrades) {
      map.set(trade.date, (map.get(trade.date) ?? 0) + 1);
    }
    return map;
  }, [personaTrades]);

  if (!summary) {
    return (
      <p className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-500">
        해당 전략의 일별 평가 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="시작 평가" value={formatKrw(summary.first.equityKrw)} caption={summary.first.date} />
        <KpiTile
          label="현재 평가"
          value={formatKrw(summary.last.equityKrw)}
          delta={formatPercent(summary.last.cumulativeReturn)}
          tone={(summary.last.cumulativeReturn ?? 0) >= 0 ? 'good' : 'bad'}
          caption={summary.last.date}
        />
        <KpiTile
          label="최고 평가"
          value={formatKrw(summary.peak.equityKrw)}
          delta={formatPercent(summary.peak.cumulativeReturn)}
          tone="accent"
          caption={summary.peak.date}
        />
        <KpiTile
          label="최고 대비"
          value={formatPercent(summary.drawdown)}
          tone={(summary.drawdown ?? 0) >= 0 ? 'good' : 'bad'}
          caption="현재가 최고 평가 대비"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-600">누적 수익률 (일별)</h3>
            <span className="text-xs text-slate-950/55">{personaEquity.length.toLocaleString('ko-KR')}거래일</span>
          </div>
          <CumulativeReturnChart series={chartSeries} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-600">최근 일별 평가</h3>
            <label className="flex items-center gap-2 text-xs text-slate-950/55">
              <span>일수</span>
              <select
                className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                value={windowSize}
                onChange={(event) => setWindowSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    최근 {size}일
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th className="text-right">평가액</th>
                  <th className="text-right">누적 수익률</th>
                  <th className="text-right">체결 건</th>
                </tr>
              </thead>
              <tbody>
                {recentDays.map((row) => (
                  <tr key={row.date}>
                    <td className="whitespace-nowrap font-mono text-xs">{row.date}</td>
                    <td className="text-right tabular-nums">{formatKrw(row.equityKrw)}</td>
                    <td
                      className={`text-right tabular-nums ${(row.cumulativeReturn ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      {formatPercent(row.cumulativeReturn)}
                    </td>
                    <td className="text-right tabular-nums text-slate-500">{tradeCountByDate.get(row.date) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
