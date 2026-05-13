'use client';

import Link from 'next/link';
import { BlockPagination } from '@/components/trading/TableControls';
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
import { useMemo, useState } from 'react';
import type { ReportRow } from '@/lib/artifacts';
import { formatDays, formatNative, formatPercent } from '@/lib/format';

type HitFilter = 'all' | 'hit' | 'open' | 'expired';
type ReturnFilter = 'all' | 'positive' | 'negative';
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
type SortPresetId = 'recent' | 'target-hit' | 'top-return' | 'target-progress' | 'near-target' | 'upside';
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

const csvHeaders: Array<[string, (report: ReportRow) => string | number | boolean | null]> = [
  ['리포트 ID', (report) => report.reportId],
  ['기업명', (report) => report.company],
  ['심볼', (report) => report.symbol],
  ['거래소', (report) => report.exchange],
  ['시장구분', (report) => marketLabel(marketRegionForSymbol(report.symbol, report.exchange))],
  ['게시일', (report) => report.publicationDate],
  ['통화', (report) => report.currency],
  ['표시통화', (report) => report.displayCurrency],
  ['진입가(표시통화)', (report) => report.entryPriceNative],
  ['목표가(표시통화)', (report) => report.targetPriceNative],
  ['진입가(KRW 환산)', (report) => report.entryPriceKrw],
  ['목표가(KRW 환산)', (report) => report.targetPriceKrw],
  ['목표 방향', (report) => report.targetDirection],
  ['제시 상승여력', (report) => report.targetUpsideAtPub],
  ['현재 수익률', (report) => report.currentReturn],
  ['목표 잔여(추가 변화율)', (report) => report.targetRemainingPct],
  ['달성률', (report) => report.targetProgressPct],
  ['최고 수익률', (report) => report.peakReturn],
  ['최저 수익률', (report) => report.troughReturn],
  ['목표 달성', (report) => report.targetHit],
  ['목표 달성일', (report) => report.targetHitDate],
  ['달성 소요일', (report) => report.daysToTarget],
  ['만료', (report) => report.expired],
  ['만료 예정일', (report) => report.expiryDate],
  ['최근 종가일', (report) => report.lastCloseDate],
  ['PDF URL', (report) => report.pdfUrl],
];

export function ReportsTable({ reports }: ReportsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'publicationDate', desc: true }]);
  const [activePreset, setActivePreset] = useState<SortPresetId>('recent');
  const [globalFilter, setGlobalFilter] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState('all');
  const [hitFilter, setHitFilter] = useState<HitFilter>('all');
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(50);

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
            <Link href={`/reports/${row.original.symbol}`}>{row.original.company}</Link>
            <span className="text-xs text-base-content/55">
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
          <span className="badge badge-ghost badge-sm">
            {marketLabel(marketRegionForSymbol(row.original.symbol, row.original.exchange))}
          </span>
        ),
      },
      { accessorKey: 'publicationDate', header: '게시일' },
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
          const className = (value ?? 0) >= 0 ? 'good' : 'bad';
          if (row.original.expired) {
            return (
              <span className={className} title={`만료(${row.original.expiryDate ?? ''}) 종가 기준 최종 수익률`}>
                {formatPercent(value)}
                <span className="ml-1 text-xs text-base-content/55">(최종)</span>
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
            return <span className="text-success">도달</span>;
          }
          if (value === null) return '—';
          return <span className="text-primary">+{formatPercent(value)}</span>;
        },
      },
      {
        accessorKey: 'targetProgressPct',
        header: () => <span title="(현재가 - 진입가) / (목표가 - 진입가), 목표 도달 시 100%">달성률</span>,
        cell: ({ row }) => {
          const value = row.original.targetProgressPct;
          if (value === null) return '—';
          return (
            <div className="flex items-center justify-end gap-2">
              <span className="tabular-nums">{formatPercent(value)}</span>
              <div className="h-1.5 w-12 rounded-full bg-base-200">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'peakReturn',
        header: '최고',
        cell: ({ getValue }) => <span className="good">{formatPercent(getValue<number | null>())}</span>,
      },
      {
        accessorKey: 'troughReturn',
        header: '최저',
        cell: ({ getValue }) => <span className="bad">{formatPercent(getValue<number | null>())}</span>,
      },
      {
        accessorKey: 'targetHit',
        header: '목표 달성',
        cell: ({ row }) => {
          if (row.original.targetDirection === 'downside') {
            return row.original.targetHit ? (
              <span className="badge badge-success badge-soft badge-sm">
                매도 적중 · {formatDays(row.original.daysToTarget)}
              </span>
            ) : row.original.expired ? (
              <span className="badge badge-error badge-soft badge-sm">매도 의견 · 만료</span>
            ) : (
              <span className="badge badge-warning badge-soft badge-sm">매도 의견 · 미달성</span>
            );
          }
          if ((row.original.targetUpsideAtPub ?? 0) <= 0) {
            return <span className="badge badge-warning badge-soft badge-sm">이미 초과/비실행</span>;
          }
          if (row.original.targetHit) {
            return (
              <span className="badge badge-success badge-soft badge-sm">
                달성 · {formatDays(row.original.daysToTarget)}
              </span>
            );
          }
          if (row.original.expired) {
            return <span className="badge badge-error badge-soft badge-sm">만료</span>;
          }
          return <span className="badge badge-ghost badge-sm">미달성</span>;
        },
      },
      {
        accessorKey: 'daysToTarget',
        header: '도달 소요일',
        cell: ({ row }) =>
          row.original.targetHit ? (
            <span className="font-mono font-bold text-success tabular-nums">
              {formatDays(row.original.daysToTarget)}
            </span>
          ) : (
            <span className="text-base-content/35">—</span>
          ),
      },
      {
        accessorKey: 'lastCloseDate',
        header: () => <span title="만료 행은 만료일 = 최근 가격일">최근 가격일</span>,
      },
    ],
    [],
  );

  // TanStack Table intentionally returns imperative helpers; this component does not pass them into memoized children.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: reports,
    columns,
    state: { sorting, globalFilter },
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

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = filteredRows.slice(safePage * pageSize, safePage * pageSize + pageSize);

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
    <section className="report-table-panel card w-full min-w-0 rounded-box bg-base-100 border border-base-300 shadow-sm">
      <div
        className="table-toolbar card-body sticky top-0 z-10 grid gap-3 rounded-t-box border-b border-base-300 bg-base-100/95 p-4 backdrop-blur md:grid-cols-[minmax(220px,1.3fr)_repeat(3,minmax(140px,.7fr))_auto]"
        aria-label="리포트 표 필터"
      >
        <div className="md:col-span-full">
          <div className="flex flex-wrap items-center gap-2" aria-label="관심별 정렬 프리셋">
            <span className="mr-1 text-xs font-black uppercase tracking-[0.16em] text-base-content/45">
              Sort presets
            </span>
            {SORT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`btn btn-xs gap-1.5 ${activePreset === preset.id ? 'btn-primary' : 'btn-ghost'}`}
                type="button"
                title={preset.caption}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
                <span className="badge badge-xs border-0 bg-base-100/70 text-current">
                  {presetCounts[preset.id]?.toLocaleString('ko-KR') ?? 0}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-base-content/55">
            {activePresetConfig.caption} · 모든 프리셋은 동일한 컬럼을 사용합니다. 관심별 뷰는 별도 표가 아니라
            정렬·필터 조건만 바꿉니다.
          </p>
        </div>
        <label>
          <span>검색</span>
          <input
            className="input input-sm input-bordered"
            value={globalFilter ?? ''}
            onChange={(event) => {
              setGlobalFilter(event.target.value);
              resetPage();
            }}
            placeholder="기업명, 심볼, 리포트 제목 검색"
          />
        </label>
        <label>
          <span>거래소</span>
          <select
            className="select select-sm select-bordered"
            value={exchangeFilter}
            onChange={(event) => {
              setExchangeFilter(event.target.value);
              resetPage();
            }}
          >
            {exchanges.map((exchange) => (
              <option key={exchange} value={exchange}>
                {exchange === 'all' ? '전체' : exchange}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>목표 달성</span>
          <select
            className="select select-sm select-bordered"
            value={hitFilter}
            onChange={(event) => {
              setHitFilter(event.target.value as HitFilter);
              resetPage();
            }}
          >
            <option value="all">전체</option>
            <option value="hit">달성</option>
            <option value="open">진행 중</option>
            <option value="expired">만료</option>
          </select>
        </label>
        <label>
          <span>현재 수익률</span>
          <select
            className="select select-sm select-bordered"
            value={returnFilter}
            onChange={(event) => {
              setReturnFilter(event.target.value as ReturnFilter);
              resetPage();
            }}
          >
            <option value="all">전체</option>
            <option value="positive">0% 이상</option>
            <option value="negative">0% 미만</option>
          </select>
        </label>
        <div className="download-actions">
          <button
            className="btn btn-sm btn-outline"
            type="button"
            onClick={() => downloadCsv('snusmic-reports-all.csv', reports)}
          >
            전체 CSV
          </button>
          <button
            className="btn btn-sm btn-primary"
            type="button"
            onClick={() =>
              downloadCsv(
                'snusmic-reports-current.csv',
                filteredRows.map((row) => row.original),
              )
            }
          >
            현재 보기 CSV
          </button>
        </div>
      </div>

      <div className="table-meta flex flex-wrap justify-between gap-2 border-y border-base-300 bg-base-200/40 px-4 py-3 text-sm text-base-content/60">
        <span>
          현재 {filteredRows.length.toLocaleString('ko-KR')}개 / 전체 {reports.length.toLocaleString('ko-KR')}개
        </span>
        <label className="flex items-center gap-2 text-xs text-base-content/55">
          <span>열 제목 정렬 · 페이지 크기</span>
          <select
            className="select select-xs select-bordered w-auto"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value) as PageSize);
              setPage(0);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap w-full min-w-0 overflow-x-auto rounded-none border-0 shadow-none">
        <table className="table table-sm table-zebra">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
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
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 px-4 py-3">
        <span className="text-xs text-base-content/55">
          {filteredRows.length ? safePage * pageSize + 1 : 0}–{Math.min(filteredRows.length, (safePage + 1) * pageSize)}{' '}
          / {filteredRows.length.toLocaleString('ko-KR')}
        </span>
        <BlockPagination page={safePage} pageCount={totalPages} onPageChange={setPage} />
      </div>
    </section>
  );
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
  return ' ↕';
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

function downloadCsv(filename: string, rows: ReportRow[]) {
  const csv = [
    csvHeaders.map(([label]) => escapeCsv(label)).join(','),
    ...rows.map((report) => csvHeaders.map(([, read]) => escapeCsv(read(report))).join(',')),
  ].join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

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
