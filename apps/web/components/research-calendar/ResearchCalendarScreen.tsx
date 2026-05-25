'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { ResearchCalendarViewModel } from '@/lib/view-models/research-calendar';
import type { ResearchCalendarRow } from '@/lib/artifacts';
import { formatDateKo, formatPercent, signedTextClass } from '@/lib/format';
import { cn } from '@/lib/utils';

type CalendarFilter = 'all' | 'fresh' | 'momentum' | 'near-high' | 'positive-latest';
type SortKey =
  | 'rank'
  | 'company'
  | 'publicationDate'
  | 'boardScore'
  | 'currentReturn'
  | 'forwardReturnLatest'
  | 'targetGapPct'
  | 'distanceFrom52wHigh'
  | 'forwardReturn63d'
  | 'forwardReturn252d'
  | 'forwardReturn500d';
type SortDirection = 'asc' | 'desc';

const filterLabels: Record<CalendarFilter, string> = {
  all: '전체',
  fresh: '최근 1Y 리포트',
  momentum: '추세 통과',
  'near-high': '고점 근처',
  'positive-latest': '현재까지 상승',
};

export function ResearchCalendarScreen({ model }: { model: ResearchCalendarViewModel }) {
  const [selectedDate, setSelectedDate] = useState(model.latestDate);
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('publicationDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const selectedSummary =
    model.dates.find((summary) => summary.date === selectedDate) ?? model.dates.at(-1) ?? model.dates[0];

  const visibleRows = useMemo(() => {
    const rows = model.rows.filter((row) => row.asOfDate === selectedDate).filter((row) => rowMatches(row, filter));
    return [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDirection));
  }, [model.rows, selectedDate, filter, sortKey, sortDirection]);

  const months = useMemo(() => buildMonthGroups(model.dates), [model.dates]);

  const updateSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'company' ? 'asc' : 'desc');
  };

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4">
          <aside className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">관측월</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  월별 스냅샷을 고르면 당시 후보와 발간 후 수익률을 한 번에 확인합니다.
                </p>
              </div>
              <div className="font-mono text-xs text-slate-500">
                {model.dates.length.toLocaleString('ko-KR')}개 스냅샷
              </div>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-3">
                {months.map((month) => (
                  <div className="grid min-w-[17rem] gap-1.5" key={month.id}>
                    <div className="font-mono text-[11px] font-semibold text-slate-400">{month.label}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {month.dates.map((date) => {
                        const selected = date.date === selectedDate;
                        return (
                          <button
                            key={date.date}
                            type="button"
                            onClick={() => setSelectedDate(date.date)}
                            className={cn(
                              'min-h-14 rounded-md border px-2.5 py-2 text-left transition-colors',
                              selected
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                            )}
                          >
                            <span className="block font-mono text-xs tabular-nums">{formatDateKo(date.date)}</span>
                            <span
                              className={cn('mt-0.5 block text-[11px]', selected ? 'text-slate-300' : 'text-slate-500')}
                            >
                              {date.candidateCount}개 · {dateVerificationLabel(date)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="grid min-w-0 gap-3">
            <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold tabular-nums text-slate-500">
                  {formatDateKo(selectedDate)}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">그날 기준 후보</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  선택일 기준 열과 PIT 점수는 당시 이미 알 수 있던 값이고, 현재까지·3M·1Y·2Y는 발간일 이후 수익률입니다.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <SummaryPill label="후보" value={selectedSummary?.candidateCount ?? 0} />
                <SummaryPill label="최근 1Y" value={selectedSummary?.freshCount ?? 0} />
                <SummaryPill label="추세" value={selectedSummary?.momentumCount ?? 0} />
                <SummaryPill label="고점근처" value={selectedSummary?.nearHighCount ?? 0} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl<CalendarFilter>
                ariaLabel="후보 보기"
                value={filter}
                onValueChange={setFilter}
                options={(Object.keys(filterLabels) as CalendarFilter[]).map((value) => ({
                  value,
                  label: filterLabels[value],
                  count: model.rows.filter((row) => row.asOfDate === selectedDate && rowMatches(row, value)).length,
                }))}
              />
              <div className="font-mono text-xs text-slate-500">
                {visibleRows.length.toLocaleString('ko-KR')} /{' '}
                {(selectedSummary?.candidateCount ?? 0).toLocaleString('ko-KR')}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="max-h-[65vh] overflow-y-auto overflow-x-hidden">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[15%]" />
                    <col className="w-[6%]" />
                    <col className="w-[6%]" />
                    <col className="w-[8%]" />
                    <col className="w-[8%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500">
                    <tr className="border-b border-slate-200">
                      <SortHead
                        label="종목/발간일"
                        sortKey="publicationDate"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                      />
                      <SortHead
                        label="순위"
                        sortKey="rank"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <SortHead
                        label="PIT 점수"
                        sortKey="boardScore"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <SortHead
                        label="선택일"
                        sortKey="currentReturn"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <SortHead
                        label="목표까지"
                        sortKey="targetGapPct"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <SortHead
                        label="52주"
                        sortKey="distanceFrom52wHigh"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <th className="px-3 py-2 text-center font-medium">추세</th>
                      <SortHead
                        label="현재까지"
                        sortKey="forwardReturnLatest"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <SortHead
                        label="사후 3M"
                        sortKey="forwardReturn63d"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <SortHead
                        label="사후 1Y"
                        sortKey="forwardReturn252d"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <SortHead
                        label="사후 2Y"
                        sortKey="forwardReturn500d"
                        active={sortKey}
                        direction={sortDirection}
                        onSort={updateSort}
                        align="right"
                      />
                      <th className="px-3 py-2 text-left font-medium">기록</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleRows.map((row) => (
                      <tr className="transition-colors hover:bg-slate-50" key={`${row.asOfDate}-${row.reportId}`}>
                        <td className="px-3 py-2">
                          <Link className="block min-w-0" href={row.href}>
                            <span className="block truncate font-semibold text-slate-950">{displayName(row)}</span>
                            <span className="block truncate font-mono text-[11px] text-slate-400">
                              {formatDateKo(row.publicationDate)}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{dash(row.rank)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-950">
                          {numberText(row.boardScore, 2)}
                        </td>
                        <SignedCell value={row.currentReturn} />
                        <SignedCell value={row.targetGapPct} />
                        <SignedCell value={row.distanceFrom52wHigh} />
                        <td className="px-3 py-2 text-center">
                          <TrendDots row={row} />
                        </td>
                        <SignedCell value={row.forwardReturnLatest} mutedNull />
                        <HorizonCell value={row.forwardReturn63d} />
                        <HorizonCell value={row.forwardReturn252d} />
                        <HorizonCell value={row.forwardReturn500d} />
                        <td className="px-3 py-2 text-xs text-slate-500">
                          <span className="line-clamp-2">{basisLabel(row)}</span>
                          {row.forwardObservedDays !== null && row.forwardObservedDays > 0 ? (
                            <span className="mt-0.5 block font-mono text-[10px] text-slate-400">
                              발간 후 {row.forwardObservedDays.toLocaleString('ko-KR')}일 추적
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {visibleRows.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-500">
                    선택한 조건에 맞는 후보가 없습니다.
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums text-slate-950">{value.toLocaleString('ko-KR')}</div>
    </div>
  );
}

function SortHead({
  label,
  sortKey,
  active,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const selected = active === sortKey;
  return (
    <th className={cn('px-3 py-2 font-medium', align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end')}
      >
        {label}
        <span className="font-mono text-[10px] text-slate-400">
          {selected ? (direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

function SignedCell({ value, inverse, mutedNull }: { value: number | null; inverse?: boolean; mutedNull?: boolean }) {
  const toneValue = inverse && value !== null ? -value : value;
  return (
    <td
      className={cn(
        'px-3 py-2 text-right font-mono tabular-nums',
        mutedNull && value === null ? 'text-slate-300' : signedTextClass(toneValue),
      )}
    >
      {value === null ? '—' : formatPercent(value)}
    </td>
  );
}

function HorizonCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-3 py-2 text-right font-mono text-[11px] tabular-nums text-slate-300">—</td>;
  }
  return <SignedCell value={value} />;
}

function TrendDots({ row }: { row: ResearchCalendarRow }) {
  const values = [row.above20ma, row.above50ma, row.above200ma];
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`20/50/200 이동평균 ${values.map(trendText).join('/')}`}
    >
      {values.map((value, index) => (
        <span
          key={`ma-${index}`}
          className={cn(
            'h-2 w-2 rounded-full',
            value === true ? 'bg-emerald-500' : value === false ? 'bg-rose-400' : 'bg-slate-200',
          )}
        />
      ))}
    </span>
  );
}

function rowMatches(row: ResearchCalendarRow, filter: CalendarFilter): boolean {
  if (filter === 'fresh') return row.reportAgeDays !== null && row.reportAgeDays >= 0 && row.reportAgeDays <= 365;
  if (filter === 'momentum') return row.above20ma === true && row.above50ma === true && row.above200ma === true;
  if (filter === 'near-high') return row.distanceFrom52wHigh !== null && row.distanceFrom52wHigh >= -0.1;
  if (filter === 'positive-latest') return row.forwardReturnLatest !== null && row.forwardReturnLatest > 0;
  return true;
}

function compareRows(a: ResearchCalendarRow, b: ResearchCalendarRow, key: SortKey, direction: SortDirection): number {
  const modifier = direction === 'asc' ? 1 : -1;
  if (key === 'company') return modifier * displayName(a).localeCompare(displayName(b), 'ko-KR');
  if (key === 'publicationDate') {
    const dateCompare = a.publicationDate.localeCompare(b.publicationDate);
    if (dateCompare !== 0) return modifier * dateCompare;
    return (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY);
  }
  const av = a[key] ?? (direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  const bv = b[key] ?? (direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  return modifier * (av - bv);
}

function buildMonthGroups(dates: ResearchCalendarViewModel['dates']) {
  const groups = new Map<string, ResearchCalendarViewModel['dates']>();
  for (const date of [...dates].reverse()) {
    const key = date.date.slice(0, 7);
    const bucket = groups.get(key) ?? [];
    bucket.push(date);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries()).map(([id, values]) => ({
    id,
    label: id.replace('-', '.'),
    dates: values,
  }));
}

function dateVerificationLabel(date: ResearchCalendarViewModel['dates'][number]): string {
  if (date.forwardPositiveLatestSample > 0) {
    return `현재까지 ${formatPercent(date.forwardPositiveLatestCount / date.forwardPositiveLatestSample, 0)}`;
  }
  return '사후 가격 없음';
}

function displayName(row: ResearchCalendarRow): string {
  if (row.symbol.endsWith('.KS') || row.symbol.endsWith('.KQ')) return row.company || row.symbol;
  return row.symbol;
}

function basisLabel(row: ResearchCalendarRow): string {
  if (row.targetHit) return '목표 도달';
  if (row.expired) return '관측 만료';
  if (row.reportAgeDays !== null && row.reportAgeDays >= 0 && row.reportAgeDays <= 365) return '최근 1Y 리포트';
  return row.rankBasis || '후보';
}

function trendText(value: boolean | null): string {
  if (value === true) return '상회';
  if (value === false) return '하회';
  return '없음';
}

function dash(value: number | null): string {
  return value === null ? '—' : value.toLocaleString('ko-KR');
}

function numberText(value: number | null, digits = 2): string {
  return value === null ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: digits });
}
