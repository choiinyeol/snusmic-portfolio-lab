'use client';

import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BlockPagination } from '@/components/trading/TableControls';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type Row,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { CsvDownloadButton, downloadCsv } from '@/components/ui/data-panel';
import { useSearchShortcut } from '@/components/ui/use-search-shortcut';
import type { ReportRow } from '@/lib/artifacts';
import { formatDateKo, formatDays, formatNative, formatPercent } from '@/lib/format';

type HitFilter = 'all' | 'hit' | 'open' | 'expired';
type ReturnFilter = 'all' | 'positive' | 'negative';
const PAGE_SIZE = 20;
type SortPresetId = 'recent' | 'review' | 'target-hit' | 'top-return' | 'target-progress' | 'near-target' | 'upside';
type SortPreset = {
  id: SortPresetId;
  label: string;
  caption: string;
  sort: SortingState;
  hitFilter: HitFilter;
  returnFilter: ReturnFilter;
  count: (report: ReportRow) => boolean;
};

type ReportsTableProps = {
  reports: ReportRow[];
};

export function ReportsTable({ reports }: ReportsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'publicationDate', desc: true }]);
  const [activePreset, setActivePreset] = useState<SortPresetId>('recent');
  const [globalFilter, setGlobalFilter] = useState('');
  const deferredGlobalFilter = useDeferredValue(globalFilter);
  const clearGlobalFilter = useCallback(() => setGlobalFilter(''), []);
  const searchInputRef = useSearchShortcut(clearGlobalFilter);
  const [exchangeFilter, setExchangeFilter] = useState('all');
  const [hitFilter, setHitFilter] = useState<HitFilter>('all');
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>('all');
  const [page, setPage] = useState(0);

  const exchanges = useMemo(
    () => ['all', ...Array.from(new Set(reports.map((report) => report.exchange).filter(Boolean))).sort()],
    [reports],
  );
  const presetCounts = useMemo(
    () => Object.fromEntries(SORT_PRESETS.map((preset) => [preset.id, reports.filter(preset.count).length])),
    [reports],
  );
  const activePresetConfig = SORT_PRESETS.find((preset) => preset.id === activePreset) ?? SORT_PRESETS[0];

  const columns = useMemo<ColumnDef<ReportRow>[]>(
    () => [
      {
        accessorKey: 'company',
        header: '리포트',
        cell: ({ row }) => (
          <div className="report-title-cell">
            <Link href={reportDetailHref(row.original)}>{row.original.company}</Link>
            <span className="text-xs text-slate-950/55">
              {row.original.symbol} · {row.original.exchange || '—'}
            </span>
          </div>
        ),
      },
      {
        id: 'marketRegion',
        header: '시장',
        accessorFn: (report) => marketLabel(marketRegionForSymbol(report.symbol, report.exchange)),
        cell: ({ row }) => (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
            {marketLabel(marketRegionForSymbol(row.original.symbol, row.original.exchange))}
          </span>
        ),
      },
      {
        accessorKey: 'publicationDate',
        header: '게시일',
        cell: ({ getValue }) => formatDateKo(getValue<string | null>()),
      },
      {
        accessorKey: 'entryPriceNative',
        header: '진입가',
        cell: ({ row }) => formatNative(row.original.entryPriceNative, row.original.currency),
      },
      {
        accessorKey: 'targetPriceNative',
        header: '목표가',
        cell: ({ row }) => formatNative(row.original.targetPriceNative, row.original.currency),
      },
      {
        accessorKey: 'targetUpsideAtPub',
        header: '제시 상승여력',
        cell: ({ getValue }) => formatPercent(getValue<number | null>()),
      },
      {
        accessorKey: 'currentReturn',
        header: () => <span title="만료 행은 만료일 종가 기준 최종 수익률입니다.">현재 수익률</span>,
        cell: ({ row }) => {
          const value = row.original.currentReturn;
          const className = (value ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600';
          if (row.original.expired) {
            return (
              <span className={className} title={`만료(${row.original.expiryDate ?? ''}) 종가 기준 최종 수익률`}>
                {formatPercent(value)}
                <span className="ml-1 text-xs text-slate-950/55">(최종)</span>
              </span>
            );
          }
          return <span className={className}>{formatPercent(value)}</span>;
        },
      },
      {
        accessorKey: 'targetRemainingPct',
        header: () => <span title="현재가 → 목표가까지 추가로 필요한 변화율">목표 잔여</span>,
        cell: ({ row }) => {
          const value = row.original.targetRemainingPct;
          if (row.original.targetHit) {
            return <span className="text-emerald-600">도달</span>;
          }
          if (value === null) return '—';
          return <span className="text-blue-600">+{formatPercent(value)}</span>;
        },
      },
      {
        accessorKey: 'targetProgressPct',
        header: () => (
          <span title="(현재가 - 진입가) / (목표가 - 진입가). 음수는 목표 반대 방향, 100% 초과는 목표가 이후 초과 이동입니다.">
            달성률
          </span>
        ),
        cell: ({ row }) => {
          const value = row.original.targetProgressPct;
          if (value === null) return '—';
          const tone = value < 0 ? 'bg-rose-500' : value >= 1 ? 'bg-blue-600' : 'bg-slate-950';
          return (
            <div className="flex items-center justify-end gap-2">
              <span className="tabular-nums">{formatPercent(value)}</span>
              <div className="relative h-2.5 w-20 rounded-full bg-slate-100">
                <div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-slate-400" />
                <div className={`absolute top-0 h-full rounded-full ${tone}`} style={progressBarStyle(value)} />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'peakReturn',
        header: '최고',
        cell: ({ getValue }) => <span className="text-emerald-600">{formatPercent(getValue<number | null>())}</span>,
      },
      {
        accessorKey: 'troughReturn',
        header: '최저',
        cell: ({ getValue }) => <span className="text-rose-600">{formatPercent(getValue<number | null>())}</span>,
      },
      {
        accessorKey: 'targetHit',
        header: '목표 달성',
        cell: ({ row }) => {
          if (row.original.targetDirection === 'downside') {
            return row.original.targetHit ? (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                매도 적중 · {formatDays(row.original.daysToTarget)}
              </span>
            ) : row.original.expired ? (
              <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">
                매도 의견 · 만료
              </span>
            ) : (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                매도 의견 · 미달성
              </span>
            );
          }
          if ((row.original.targetUpsideAtPub ?? 0) <= 0) {
            return (
              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                이미 초과/비실행
              </span>
            );
          }
          if (row.original.targetHit) {
            return (
              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                달성 · {formatDays(row.original.daysToTarget)}
              </span>
            );
          }
          if (row.original.expired) {
            return (
              <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">만료</span>
            );
          }
          return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">미달성</span>;
        },
      },
      {
        accessorKey: 'daysToTarget',
        header: '도달 소요일',
        cell: ({ row }) =>
          row.original.targetHit ? (
            <span className="font-mono font-bold text-emerald-600 tabular-nums">
              {formatDays(row.original.daysToTarget)}
            </span>
          ) : (
            <span className="text-slate-950/35">—</span>
          ),
      },
      {
        accessorKey: 'lastCloseDate',
        header: () => <span title="만료 행은 만료일 = 최근 가격일">최근 가격일</span>,
        cell: ({ getValue }) => formatDateKo(getValue<string | null>()),
      },
    ],
    [],
  );

  // TanStack Table intentionally returns imperative helpers; this component does not pass them into memoized children.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: reports,
    columns,
    state: { sorting, globalFilter: deferredGlobalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalTextFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filteredRows = table.getSortedRowModel().rows.filter((row) => {
    const report = row.original;
    if (exchangeFilter !== 'all' && report.exchange !== exchangeFilter) return false;
    if (hitFilter === 'hit' && !report.targetHit) return false;
    if (hitFilter === 'open' && (report.targetHit || report.expired)) return false;
    if (hitFilter === 'expired' && !report.expired) return false;
    if (returnFilter === 'positive' && (report.currentReturn ?? -Infinity) < 0) return false;
    if (returnFilter === 'negative' && (report.currentReturn ?? Infinity) >= 0) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const router = useRouter();
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      if (visibleRows.length === 0) return;
      if (event.key === 'j') {
        event.preventDefault();
        setActiveRowIdx((idx) => (idx === null ? 0 : Math.min(visibleRows.length - 1, idx + 1)));
      } else if (event.key === 'k') {
        event.preventDefault();
        setActiveRowIdx((idx) => (idx === null ? 0 : Math.max(0, idx - 1)));
      } else if (event.key === 'Enter') {
        if (activeRowIdx === null) return;
        const row = visibleRows[Math.min(activeRowIdx, visibleRows.length - 1)];
        if (row) {
          event.preventDefault();
          router.push(reportDetailHref(row.original));
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeRowIdx, router, visibleRows]);

  useEffect(() => {
    if (activeRowIdx === null) return;
    const row = tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr')[activeRowIdx];
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeRowIdx]);

  const resetPage = () => setPage(0);

  const applyPreset = (preset: SortPresetId) => {
    const config = SORT_PRESETS.find((item) => item.id === preset);
    if (!config) {
      throw new Error(`Unknown reports table preset: ${preset}`);
    }
    setActivePreset(config.id);
    setHitFilter(config.hitFilter);
    setReturnFilter(config.returnFilter);
    setSorting(config.sort);
    setPage(0);
  };

  return (
    <section className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid gap-4 border-b border-slate-200 bg-white p-4" aria-label="리포트 표 필터">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">보기 방식</div>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="관심별 정렬 프리셋">
              {SORT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className={[
                    'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors',
                    activePreset === preset.id
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                  ].join(' ')}
                  type="button"
                  title={preset.caption}
                  onClick={() => applyPreset(preset.id)}
                >
                  {preset.label}
                  <span className="font-mono text-[11px] opacity-70 tabular-nums">
                    {presetCounts[preset.id]?.toLocaleString('ko-KR') ?? 0}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-500">
              {activePresetConfig.caption}. 후보 탐색, 전체 리포트, 목표가 검증은 같은 표에서 정렬 조건만 바꿔 봅니다.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="font-mono font-semibold tabular-nums text-slate-950">
                {filteredRows.length.toLocaleString('ko-KR')}
              </span>
              개 표시 · 전체 {reports.length.toLocaleString('ko-KR')}개
            </div>
            <CsvDownloadButton label="CSV" onClick={() => downloadReports(filteredRows.map((row) => row.original))} />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[minmax(240px,1.4fr)_repeat(3,minmax(0,.7fr))]">
          <label className="grid gap-1 text-xs font-medium text-slate-500" htmlFor="reports-search">
            <span>
              검색 <span className="font-mono text-[10px] text-slate-400">(/ 단축키)</span>
            </span>
            <input
              ref={searchInputRef}
              id="reports-search"
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
              value={globalFilter ?? ''}
              onChange={(event) => {
                setGlobalFilter(event.target.value);
                resetPage();
              }}
              placeholder="기업명, 심볼, 제목"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500" htmlFor="reports-exchange">
            <span>거래소</span>
            <NativeSelect
              id="reports-exchange"
              className="h-10 text-sm"
              value={exchangeFilter}
              onChange={(event) => {
                setExchangeFilter(event.target.value);
                resetPage();
              }}
            >
              {exchanges.map((exchange) => (
                <NativeSelectOption key={exchange} value={exchange}>
                  {exchange === 'all' ? '전체' : exchange}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500" htmlFor="reports-hit">
            <span>목표 달성</span>
            <NativeSelect
              id="reports-hit"
              className="h-10 text-sm"
              value={hitFilter}
              onChange={(event) => {
                setHitFilter(event.target.value as HitFilter);
                resetPage();
              }}
            >
              <NativeSelectOption value="all">전체</NativeSelectOption>
              <NativeSelectOption value="hit">달성</NativeSelectOption>
              <NativeSelectOption value="open">진행 중</NativeSelectOption>
              <NativeSelectOption value="expired">만료</NativeSelectOption>
            </NativeSelect>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-500" htmlFor="reports-return">
            <span>현재 수익률</span>
            <NativeSelect
              id="reports-return"
              className="h-10 text-sm"
              value={returnFilter}
              onChange={(event) => {
                setReturnFilter(event.target.value as ReturnFilter);
                resetPage();
              }}
            >
              <NativeSelectOption value="all">전체</NativeSelectOption>
              <NativeSelectOption value="positive">0% 이상</NativeSelectOption>
              <NativeSelectOption value="negative">0% 미만</NativeSelectOption>
            </NativeSelect>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
        <span>
          열 제목으로 정렬 · <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">/</kbd> 검색,{' '}
          <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">j</kbd>/
          <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">k</kbd> 행 이동,{' '}
          <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">Enter</kbd> 상세
        </span>
        <span>페이지당 {PAGE_SIZE}개</span>
      </div>

      <div className="w-full min-w-0 max-h-[72vh] overflow-auto">
        <table className="w-full min-w-[1120px] text-sm [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-3 [&_td]:py-3 [&_th]:border-b [&_th]:border-slate-200 [&_th]:px-3 [&_th]:py-2 [&_tr:hover_td]:bg-slate-50">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    aria-sort={ariaSort(header.column.getIsSorted())}
                    className="sticky top-0 z-10 whitespace-nowrap bg-slate-100 text-left font-mono text-[11px] uppercase tracking-[0.04em] text-slate-600"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className="sort-button"
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span aria-hidden="true">{sortIndicator(header.column.getIsSorted())}</span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody ref={tbodyRef}>
            {visibleRows.length === 0 ? (
              <tr>
                <td className="p-8" colSpan={columns.length}>
                  <div className="mx-auto grid max-w-md gap-3 text-center">
                    <SearchX aria-hidden="true" className="mx-auto size-6 text-slate-400" />
                    <div className="text-sm font-semibold text-slate-950">조건에 맞는 리포트가 없습니다</div>
                    <p className="text-xs leading-5 text-slate-500">
                      검색어, 거래소, 목표 달성, 현재 수익률 필터 중 일부가 결합되어 모두 제외했을 수 있습니다.
                    </p>
                    <div>
                      <button
                        type="button"
                        className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                        onClick={() => {
                          setGlobalFilter('');
                          setExchangeFilter('all');
                          setHitFilter('all');
                          setReturnFilter('all');
                          applyPreset('recent');
                        }}
                      >
                        필터 초기화
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row, index) => (
                <tr key={row.id} data-active={activeRowIdx !== null && index === activeRowIdx ? 'true' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 border-t border-slate-200 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <span className="text-center text-xs text-slate-500 sm:text-left">
          {filteredRows.length ? safePage * PAGE_SIZE + 1 : 0}–
          {Math.min(filteredRows.length, (safePage + 1) * PAGE_SIZE)} / {filteredRows.length.toLocaleString('ko-KR')}
        </span>
        <div className="flex justify-center">
          <BlockPagination page={safePage} pageCount={totalPages} onPageChange={setPage} />
        </div>
        <span aria-hidden="true" />
      </div>
    </section>
  );
}

function downloadReports(rows: ReportRow[]) {
  const headers = [
    'report_id',
    'symbol',
    'company',
    'exchange',
    'publication_date',
    'currency',
    'entry_price_native',
    'entry_price_krw',
    'target_price_native',
    'target_price_krw',
    'target_upside_at_pub',
    'target_hit',
    'target_hit_date',
    'days_to_target',
    'current_return',
    'peak_return',
    'trough_return',
    'expiry_date',
    'expired',
  ];
  const data = rows.map((row) => [
    row.reportId,
    row.symbol,
    row.company,
    row.exchange,
    row.publicationDate,
    row.currency,
    row.entryPriceNative ?? '',
    row.entryPriceKrw ?? '',
    row.targetPriceNative ?? '',
    row.targetPriceKrw ?? '',
    row.targetUpsideAtPub ?? '',
    row.targetHit ? 'true' : 'false',
    row.targetHitDate ?? '',
    row.daysToTarget ?? '',
    row.currentReturn ?? '',
    row.peakReturn ?? '',
    row.troughReturn ?? '',
    row.expiryDate ?? '',
    row.expired ? 'true' : 'false',
  ]);
  downloadCsv('snusmic-reports-filtered.csv', headers, data);
}

function globalTextFilter(row: Row<ReportRow>, _columnId: string, filterValue: string): boolean {
  const needle = filterValue.trim().toLocaleLowerCase('ko-KR');
  if (!needle) return true;
  const report = row.original;
  return [report.company, report.symbol, report.exchange, report.title, report.publicationDate]
    .filter(Boolean)
    .some((value) => value.toLocaleLowerCase('ko-KR').includes(needle));
}

function sortIndicator(direction: false | 'asc' | 'desc'): string {
  if (direction === 'asc') return ' ↑';
  if (direction === 'desc') return ' ↓';
  return '';
}

function ariaSort(direction: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  if (direction === 'asc') return 'ascending';
  if (direction === 'desc') return 'descending';
  return 'none';
}

function reportDetailHref(report: ReportRow): string {
  if (!report.reportId) {
    throw new Error(`Report table row is missing reportId for ${report.symbol}`);
  }
  return `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`;
}

function progressBarStyle(value: number): { left: string; width: string } {
  const bounded = Math.max(-1, Math.min(1, value));
  if (bounded >= 0) {
    return { left: '50%', width: `${Math.max(2, bounded * 50)}%` };
  }
  return { left: `${50 + bounded * 50}%`, width: `${Math.max(2, Math.abs(bounded) * 50)}%` };
}

const SORT_PRESETS: SortPreset[] = [
  {
    id: 'recent',
    label: '최근 발간',
    caption: '발간일 최신순',
    sort: [{ id: 'publicationDate', desc: true }],
    hitFilter: 'all',
    returnFilter: 'all',
    count: () => true,
  },
  {
    id: 'review',
    label: '검토 후보',
    caption: '아직 목표에 닿지 않았고 만료되지 않은 표본을 목표 진행률 높은 순으로 표시',
    sort: [{ id: 'targetProgressPct', desc: true }],
    hitFilter: 'open',
    returnFilter: 'all',
    count: (report) => !report.targetHit && !report.expired && (report.targetUpsideAtPub ?? 0) > 0,
  },
  {
    id: 'target-hit',
    label: '목표 도달',
    caption: '목표를 달성한 리포트를 도달 소요일 오름차순으로 표시',
    sort: [{ id: 'daysToTarget', desc: false }],
    hitFilter: 'hit',
    returnFilter: 'all',
    count: (report) => report.targetHit,
  },
  {
    id: 'top-return',
    label: '현재 수익률',
    caption: '현재 수익률 내림차순',
    sort: [{ id: 'currentReturn', desc: true }],
    hitFilter: 'all',
    returnFilter: 'all',
    count: (report) => report.currentReturn !== null,
  },
  {
    id: 'target-progress',
    label: '목표 진행률',
    caption: '진입가 대비 목표가까지의 진행률 내림차순',
    sort: [{ id: 'targetProgressPct', desc: true }],
    hitFilter: 'all',
    returnFilter: 'all',
    count: (report) => report.targetProgressPct !== null,
  },
  {
    id: 'near-target',
    label: '목표 근접',
    caption: '진행 중 리포트 중 목표 잔여 변화율이 낮은 순서',
    sort: [{ id: 'targetRemainingPct', desc: false }],
    hitFilter: 'open',
    returnFilter: 'all',
    count: (report) => !report.targetHit && !report.expired && report.targetRemainingPct !== null,
  },
  {
    id: 'upside',
    label: '업사이드',
    caption: '발간 시점 제시 상승여력 내림차순',
    sort: [{ id: 'targetUpsideAtPub', desc: true }],
    hitFilter: 'all',
    returnFilter: 'all',
    count: (report) => report.targetUpsideAtPub !== null,
  },
];

function marketLabel(region: 'domestic' | 'overseas'): string {
  return region === 'domestic' ? '국내' : '해외';
}

function marketRegionForSymbol(symbol: string, exchange?: string): 'domestic' | 'overseas' {
  const upperExchange = (exchange ?? '').toUpperCase();
  if (
    symbol.endsWith('.KS') ||
    symbol.endsWith('.KQ') ||
    upperExchange === 'KRX' ||
    upperExchange === 'KOSPI' ||
    upperExchange === 'KOSDAQ'
  )
    return 'domestic';
  return 'overseas';
}
