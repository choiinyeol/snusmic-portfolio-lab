'use client';

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type Row,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from '@tanstack/react-table';
import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { BlockPagination } from '@/components/trading/TableControls';
import { formatDateKo, formatNative, formatPercent, numCellClass, signedTextClass } from '@/lib/format';

export type ScreenerBoardRow = {
  symbol: string;
  company: string;
  exchange: string;
  currency: string;
  latestReportId: string;
  latestReportDate: string;
  reportAgeDays: number | null;
  reportCount: number;
  lastCloseNative: number | null;
  lastCloseKrw: number | null;
  lastCloseDate: string | null;
  volumeLatest: number | null;
  entryPriceNative: number | null;
  entryPriceKrw: number | null;
  targetPriceNative: number | null;
  targetPriceKrw: number | null;
  targetUpsideAtPub: number | null;
  targetGapPct: number | null;
  targetRemainingPct: number | null;
  targetProgressPct: number | null;
  currentReturn: number | null;
  peakReturn: number | null;
  troughReturn: number | null;
  targetHit: boolean;
  targetHitDate: string | null;
  daysToTarget: number | null;
  expired: boolean;
  expiredByAge: boolean;
  caveatFlags: string[];
  candidateBucket: string | null;
  candidateScore: number | null;
  rankBasis: string | null;
  return1m: number | null;
  return3m: number | null;
  ytdReturn: number | null;
  return1y: number | null;
  distanceFrom52wHigh: number | null;
  rsRank1m: number | null;
  above20ma: boolean | null;
  above50ma: boolean | null;
  above200ma: boolean | null;
  sparkline: number[];
};

type ScreenerTableProps = {
  rows: ScreenerBoardRow[];
};

type PresetId =
  | 'all'
  | 'recent'
  | 'upside'
  | 'nearTarget'
  | 'topReturn'
  | 'drawdown'
  | 'nearHigh'
  | 'maStack'
  | 'caveat'
  | 'active';
type SignFilter = 'all' | 'positive' | 'negative';
type BooleanFilter = 'all' | 'yes' | 'no';
type MaFilter = 'all' | 'above' | 'below';
type ColumnMode = 'core' | 'price' | 'all';
type ColumnFilterValues = Record<string, string>;

type Preset = {
  id: PresetId;
  label: string;
  caption: string;
  sort: SortingState;
  targetHit?: BooleanFilter;
  expired?: BooleanFilter;
  caveat?: BooleanFilter;
  returnFilter?: SignFilter;
  targetGapRequired?: boolean;
  nearHigh?: boolean;
  maStack?: boolean;
};

const PAGE_SIZE = 20;
const CORE_COLUMN_IDS = new Set([
  'symbol',
  'lastCloseNative',
  'currentReturn',
  'ytdReturn',
  'sparkline',
  'return1y',
  'distanceFrom52wHigh',
  'above20ma',
  'above50ma',
  'above200ma',
  'candidateScore',
  'candidateBucket',
  'detail',
]);
const PRICE_COLUMN_IDS = new Set([
  ...CORE_COLUMN_IDS,
  'targetUpsideAtPub',
  'targetGapPct',
  'targetProgressPct',
  'latestReportDate',
  'rankBasis',
]);
const COLUMN_FILTER_LABELS: Record<string, string> = {
  symbol: 'ticker/company',
  company: 'company',
  currency: 'ccy',
  latestReportDate: 'YYYY-MM-DD',
  lastCloseNative: '>=100',
  volumeLatest: '>=1M',
  entryPriceNative: '>=100',
  targetPriceNative: '>=100',
  targetUpsideAtPub: '>=30',
  targetGapPct: '>-10',
  targetRemainingPct: '>=0',
  targetProgressPct: '>=70',
  targetHit: '전체',
  daysToTarget: '<=120',
  expired: '전체',
  currentReturn: '>=0',
  peakReturn: '>=50',
  troughReturn: '<=-20',
  ytdReturn: '>=0',
  return1y: '>=0',
  distanceFrom52wHigh: '>=-10',
  above20ma: '전체',
  above50ma: '전체',
  above200ma: '전체',
  candidateBucket: '전체',
  candidateScore: '>=0.5',
  rankBasis: 'contains',
  caveatFlags: 'contains',
};
const PERCENT_FILTER_IDS = new Set([
  'targetUpsideAtPub',
  'targetGapPct',
  'targetRemainingPct',
  'targetProgressPct',
  'currentReturn',
  'peakReturn',
  'troughReturn',
  'ytdReturn',
  'return1y',
  'distanceFrom52wHigh',
]);
const NUMBER_FILTER_IDS = new Set([
  'lastCloseNative',
  'volumeLatest',
  'entryPriceNative',
  'targetPriceNative',
  'daysToTarget',
  'candidateScore',
]);
const BOOLEAN_FILTER_IDS = new Set(['targetHit', 'expired', 'above20ma', 'above50ma', 'above200ma']);
const TEXT_FILTER_IDS = new Set(['symbol', 'company', 'currency', 'rankBasis', 'caveatFlags']);

const PRESETS: Preset[] = [
  {
    id: 'all',
    label: '전체',
    caption: '후보 점수 우선, 없으면 YTD 순서입니다.',
    sort: [{ id: 'candidateScore', desc: true }],
  },
  {
    id: 'recent',
    label: '최근 리포트',
    caption: '최신 발간 리포트 대표 종목입니다.',
    sort: [{ id: 'latestReportDate', desc: true }],
  },
  {
    id: 'upside',
    label: '업사이드 큰 후보',
    caption: '목표 상승여력이 큰 후보입니다.',
    sort: [{ id: 'targetUpsideAtPub', desc: true }],
  },
  {
    id: 'nearTarget',
    label: '목표가 근접',
    caption: '목표가까지의 잔여 gap이 작은 후보입니다.',
    sort: [{ id: 'targetGapPct', desc: true }],
    targetGapRequired: true,
  },
  {
    id: 'topReturn',
    label: '현재 수익률 상위',
    caption: '현재 리포트 수익률이 높은 순서입니다.',
    sort: [{ id: 'currentReturn', desc: true }],
    returnFilter: 'positive',
  },
  {
    id: 'drawdown',
    label: '낙폭 큰 후보',
    caption: '52주 고점에서 많이 내려온 후보입니다.',
    sort: [{ id: 'distanceFrom52wHigh', desc: false }],
  },
  {
    id: 'nearHigh',
    label: '52주 고점 근접',
    caption: '52주 고점 대비 -10% 이내 후보입니다.',
    sort: [{ id: 'distanceFrom52wHigh', desc: true }],
    nearHigh: true,
  },
  {
    id: 'maStack',
    label: '20/50/200MA 위',
    caption: '세 이동평균을 모두 위에 둔 후보입니다.',
    sort: [{ id: 'rsRank1m', desc: true }],
    maStack: true,
  },
  {
    id: 'caveat',
    label: 'Caveat 있음',
    caption: '주의 플래그가 있는 후보입니다.',
    sort: [{ id: 'latestReportDate', desc: true }],
    caveat: 'yes',
  },
  {
    id: 'active',
    label: '목표 미달성 Active',
    caption: '목표가에 아직 닿지 않았고 만료되지 않은 후보입니다.',
    sort: [{ id: 'targetProgressPct', desc: true }],
    targetHit: 'no',
    expired: 'no',
  },
];

export function ScreenerTable({ rows }: ScreenerTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'candidateScore', desc: true }]);
  const [activePreset, setActivePreset] = useState<PresetId>('all');
  const [columnMode, setColumnMode] = useState<ColumnMode>('price');
  const [globalFilter, setGlobalFilter] = useState('');
  const [bucketFilter, setBucketFilter] = useState('all');
  const [returnFilter, setReturnFilter] = useState<SignFilter>('all');
  const [targetHitFilter, setTargetHitFilter] = useState<BooleanFilter>('all');
  const [expiredFilter, setExpiredFilter] = useState<BooleanFilter>('no');
  const [caveatFilter, setCaveatFilter] = useState<BooleanFilter>('all');
  const [maFilter, setMaFilter] = useState<MaFilter>('all');
  const [nearHighOnly, setNearHighOnly] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterValues>({});
  const [page, setPage] = useState(0);

  const columns = useMemo<ColumnDef<ScreenerBoardRow>[]>(() => buildColumns(), []);
  const columnVisibility = useMemo<VisibilityState>(() => buildColumnVisibility(columnMode), [columnMode]);
  const buckets = useMemo(
    () => [
      'all',
      ...uniqueSorted(rows.map((row) => row.candidateBucket).filter((value): value is string => Boolean(value))),
    ],
    [rows],
  );
  const presetCounts = useMemo(
    () =>
      Object.fromEntries(PRESETS.map((preset) => [preset.id, rows.filter((row) => presetMatch(row, preset)).length])),
    [rows],
  );
  const boardStats = useMemo(() => buildBoardStats(rows), [rows]);
  const activePresetConfig = PRESETS.find((preset) => preset.id === activePreset) ?? PRESETS[0];
  const activeColumnFilterCount = Object.values(columnFilters).filter((value) => value.trim()).length;

  // TanStack Table intentionally returns imperative helpers; this component keeps all derived rows local.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalTextFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filteredRows = table.getSortedRowModel().rows.filter(
    (row) =>
      rowPassesFilters(row.original, {
        bucketFilter,
        returnFilter,
        targetHitFilter,
        expiredFilter,
        caveatFilter,
        maFilter,
        nearHighOnly,
      }) && rowPassesColumnFilters(row.original, columnFilters),
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const resetPage = () => setPage(0);
  const applyPreset = (presetId: PresetId) => {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) throw new Error(`Unknown screener preset: ${presetId}`);
    setActivePreset(preset.id);
    setSorting(preset.sort);
    setReturnFilter(preset.returnFilter ?? 'all');
    setTargetHitFilter(preset.targetHit ?? 'all');
    setExpiredFilter(preset.expired ?? 'no');
    setCaveatFilter(preset.caveat ?? 'all');
    setNearHighOnly(Boolean(preset.nearHigh));
    setMaFilter(preset.maStack ? 'above' : 'all');
    resetPage();
  };
  const updateColumnFilter = (columnId: string, value: string) => {
    setColumnFilters((current) => {
      const next = { ...current };
      if (value.trim()) next[columnId] = value;
      else delete next[columnId];
      return next;
    });
    resetPage();
  };
  const clearColumnFilters = () => {
    setColumnFilters({});
    resetPage();
  };

  return (
    <section className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <BoardMetric label="종목" value={`${rows.length.toLocaleString('ko-KR')}개`} caption="symbol universe" />
        <BoardMetric
          label="현재 플러스"
          value={`${boardStats.positiveCount}개`}
          caption={formatPercent(boardStats.positiveShare, 1)}
        />
        <BoardMetric label="52주 고점 -10% 이내" value={`${boardStats.nearHighCount}개`} caption="price series" />
        <BoardMetric label="20/50/200MA 위" value={`${boardStats.aboveAllMaCount}개`} caption="trend stack" />
      </div>

      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                The research board
              </div>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Report universe × Price series
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {activePresetConfig.caption} 기본값은 발간 후 2년 경과 리포트 제외입니다. Market cap, P/E, sector는 현재
                artifact에 없어 숨깁니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="컬럼 보기">
              {(['core', 'price', 'all'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={toggleClass(columnMode === mode)}
                  onClick={() => setColumnMode(mode)}
                >
                  {modeLabel(mode)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5" aria-label="스크리너 프리셋">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={toggleClass(activePreset === preset.id)}
                title={preset.caption}
                onClick={() => applyPreset(preset.id)}
              >
                {preset.label}
                <span className="ml-1 font-mono text-[11px] opacity-70 tabular-nums">{presetCounts[preset.id]}</span>
              </button>
            ))}
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1.4fr)_repeat(6,minmax(0,.75fr))]">
            <label className="grid gap-1 text-xs font-medium text-slate-500">
              <span>검색</span>
              <input
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-400"
                value={globalFilter}
                placeholder="symbol, company, caveat, rank basis"
                onChange={(event) => {
                  setGlobalFilter(event.target.value);
                  resetPage();
                }}
              />
            </label>
            <Select
              label="Bucket"
              value={bucketFilter}
              onChange={(value) => {
                setBucketFilter(value);
                resetPage();
              }}
              options={buckets}
            />
            <Select
              label="Return"
              value={returnFilter}
              onChange={(value) => {
                setReturnFilter(value as SignFilter);
                resetPage();
              }}
              options={['all', 'positive', 'negative']}
            />
            <Select
              label="목표 도달"
              value={targetHitFilter}
              onChange={(value) => {
                setTargetHitFilter(value as BooleanFilter);
                resetPage();
              }}
              options={['all', 'yes', 'no']}
            />
            <Select
              label="만료"
              value={expiredFilter}
              onChange={(value) => {
                setExpiredFilter(value as BooleanFilter);
                resetPage();
              }}
              options={['no', 'all', 'yes']}
            />
            <Select
              label="MA"
              value={maFilter}
              onChange={(value) => {
                setMaFilter(value as MaFilter);
                resetPage();
              }}
              options={['all', 'above', 'below']}
            />
            <label className="grid gap-1 text-xs font-medium text-slate-500">
              <span>52W high</span>
              <button
                type="button"
                className={toggleClass(nearHighOnly)}
                onClick={() => {
                  setNearHighOnly((value) => !value);
                  resetPage();
                }}
              >
                -10% 이내
              </button>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <span>
            열 제목 정렬 · 컬럼 필터 {activeColumnFilterCount}개 · 가격 지표는 getPriceSeries(symbol)에서 계산
          </span>
          <span>
            {filteredRows.length.toLocaleString('ko-KR')} / {rows.length.toLocaleString('ko-KR')}개 · 페이지당{' '}
            {PAGE_SIZE}
          </span>
        </div>
        {activeColumnFilterCount > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-3 py-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">적용된 컬럼 필터</span>
            {Object.entries(columnFilters)
              .filter(([, value]) => value.trim())
              .map(([columnId, value]) => (
                <button
                  key={columnId}
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-700 hover:bg-slate-50"
                  title="클릭하면 이 컬럼 필터를 제거합니다."
                  onClick={() => updateColumnFilter(columnId, '')}
                >
                  {columnLabel(columnId)}: {value} ×
                </button>
              ))}
            <button
              type="button"
              className="rounded-full border border-slate-300 bg-slate-950 px-2 py-1 text-[11px] font-semibold text-white"
              onClick={clearColumnFilters}
            >
              모두 지우기
            </button>
          </div>
        ) : null}

        <div className="w-full min-w-0 overflow-x-auto">
          <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-[11px] leading-4 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-1.5 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-slate-200 [&_th]:px-1.5 [&_th]:py-1.5 [&_tr:hover_td]:bg-slate-50">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Fragment key={headerGroup.id}>
                  <tr>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        className="sticky top-0 z-20 whitespace-nowrap bg-slate-100 text-left font-mono text-[11px] uppercase tracking-[0.04em] text-slate-600"
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
                  <tr>
                    {headerGroup.headers.map((header) => (
                      <th key={`${header.id}-filter`} className="sticky top-[31px] z-10 bg-white align-top">
                        {header.isPlaceholder ? null : (
                          <ColumnFilterControl
                            columnId={header.column.id}
                            value={columnFilters[header.column.id] ?? ''}
                            buckets={buckets}
                            onChange={(value) => updateColumnFilter(header.column.id, value)}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                </Fragment>
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

        <div className="grid gap-2 border-t border-slate-200 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <span className="text-center text-xs text-slate-500 sm:text-left">
            {filteredRows.length ? safePage * PAGE_SIZE + 1 : 0}–
            {Math.min(filteredRows.length, (safePage + 1) * PAGE_SIZE)} / {filteredRows.length.toLocaleString('ko-KR')}
          </span>
          <div className="flex justify-center">
            <BlockPagination page={safePage} pageCount={totalPages} onPageChange={setPage} />
          </div>
          <span className="hidden text-right text-xs text-slate-400 sm:block">read-only screener</span>
        </div>
      </div>
    </section>
  );
}

function buildColumns(): ColumnDef<ScreenerBoardRow>[] {
  return [
    {
      id: 'symbol',
      accessorKey: 'symbol',
      header: 'Ticker',
      cell: ({ row }) => (
        <div className="grid min-w-[130px] grid-cols-[22px_minmax(0,1fr)] items-center gap-2">
          <span className="grid size-5 place-items-center rounded-sm bg-slate-950 font-mono text-[10px] font-bold text-white">
            {row.original.symbol.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <Link
              className="font-mono font-semibold text-slate-950 underline-offset-2 hover:underline"
              href={detailHref(row.original)}
            >
              {row.original.symbol}
            </Link>
            <div className="truncate text-[11px] text-slate-500" title={row.original.company}>
              {row.original.company}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'company',
      accessorKey: 'company',
      header: 'Company',
      cell: ({ getValue }) => (
        <span className="block max-w-[150px] truncate" title={getValue<string>()}>
          {getValue<string>()}
        </span>
      ),
    },
    {
      id: 'currency',
      accessorKey: 'currency',
      header: 'Ccy',
      cell: ({ getValue }) => <span className="font-mono text-slate-500">{getValue<string>() || '—'}</span>,
    },
    {
      id: 'latestReportDate',
      accessorKey: 'latestReportDate',
      header: 'Report',
      cell: ({ getValue }) => <span className="font-mono tabular-nums">{formatDateKo(getValue<string>())}</span>,
    },
    {
      id: 'lastCloseNative',
      accessorKey: 'lastCloseNative',
      header: 'Price',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {formatNative(row.original.lastCloseNative, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'volumeLatest',
      accessorKey: 'volumeLatest',
      header: 'Vol',
      cell: ({ getValue }) => <span className={numCellClass}>{formatCompact(getValue<number | null>())}</span>,
    },
    {
      id: 'entryPriceNative',
      accessorKey: 'entryPriceNative',
      header: 'Entry',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {formatNative(row.original.entryPriceNative, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'targetPriceNative',
      accessorKey: 'targetPriceNative',
      header: 'Target',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {formatNative(row.original.targetPriceNative, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'targetUpsideAtPub',
      accessorKey: 'targetUpsideAtPub',
      header: 'Target Up',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'targetGapPct',
      accessorKey: 'targetGapPct',
      header: 'Gap',
      cell: ({ getValue }) => <HighGapCell value={getValue<number | null>()} positiveIsGood />,
    },
    {
      id: 'targetRemainingPct',
      accessorKey: 'targetRemainingPct',
      header: 'Remain',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'targetProgressPct',
      accessorKey: 'targetProgressPct',
      header: 'Progress',
      cell: ({ getValue }) => <ProgressCell value={getValue<number | null>()} />,
    },
    { id: 'targetHit', accessorKey: 'targetHit', header: 'Hit', cell: ({ row }) => <HitCell row={row.original} /> },
    {
      id: 'daysToTarget',
      accessorKey: 'daysToTarget',
      header: 'Days',
      cell: ({ getValue }) => <span className={numCellClass}>{formatDaysShort(getValue<number | null>())}</span>,
    },
    {
      id: 'expired',
      accessorKey: 'expired',
      header: 'Exp',
      cell: ({ getValue }) => <BooleanMark value={getValue<boolean>()} />,
    },
    {
      id: 'currentReturn',
      accessorKey: 'currentReturn',
      header: 'Current',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'peakReturn',
      accessorKey: 'peakReturn',
      header: 'Peak',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'troughReturn',
      accessorKey: 'troughReturn',
      header: 'Trough',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'ytdReturn',
      accessorKey: 'ytdReturn',
      header: '% YTD',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} heat />,
    },
    {
      id: 'sparkline',
      accessorKey: 'sparkline',
      header: 'Chart 1Y',
      enableSorting: false,
      cell: ({ row }) => <Sparkline values={row.original.sparkline} />,
    },
    {
      id: 'return1y',
      accessorKey: 'return1y',
      header: '% 1Y',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} heat />,
    },
    {
      id: 'distanceFrom52wHigh',
      accessorKey: 'distanceFrom52wHigh',
      header: 'Δ Highs',
      cell: ({ getValue }) => <HighGapCell value={getValue<number | null>()} />,
    },
    {
      id: 'above20ma',
      accessorKey: 'above20ma',
      header: '20SMA',
      cell: ({ getValue }) => <TrendMark value={getValue<boolean | null>()} />,
    },
    {
      id: 'above50ma',
      accessorKey: 'above50ma',
      header: '50SMA',
      cell: ({ getValue }) => <TrendMark value={getValue<boolean | null>()} />,
    },
    {
      id: 'above200ma',
      accessorKey: 'above200ma',
      header: '200SMA',
      cell: ({ getValue }) => <TrendMark value={getValue<boolean | null>()} />,
    },
    {
      id: 'candidateBucket',
      accessorKey: 'candidateBucket',
      header: 'Bucket',
      cell: ({ getValue }) => (
        <span className="badge badge-ghost badge-sm font-mono">{getValue<string | null>() ?? '—'}</span>
      ),
    },
    {
      id: 'candidateScore',
      accessorKey: 'candidateScore',
      header: 'Score',
      cell: ({ getValue }) => <span className={numCellClass}>{formatScore(getValue<number | null>())}</span>,
    },
    {
      id: 'rankBasis',
      accessorKey: 'rankBasis',
      header: 'Basis',
      cell: ({ getValue }) => (
        <span className="block max-w-[160px] truncate text-slate-600" title={getValue<string | null>() ?? ''}>
          {getValue<string | null>() ?? '—'}
        </span>
      ),
    },
    {
      id: 'caveatFlags',
      accessorKey: 'caveatFlags',
      header: 'Caveat',
      cell: ({ getValue }) => <CaveatCell flags={getValue<string[]>()} />,
    },
    {
      id: 'detail',
      header: 'Open',
      enableSorting: false,
      cell: ({ row }) => (
        <Link
          className="inline-flex h-6 items-center rounded border border-slate-200 px-2 text-[11px] font-semibold hover:bg-slate-50"
          href={detailHref(row.original)}
        >
          보기
        </Link>
      ),
    },
  ];
}

function rowPassesFilters(
  row: ScreenerBoardRow,
  filters: {
    bucketFilter: string;
    returnFilter: SignFilter;
    targetHitFilter: BooleanFilter;
    expiredFilter: BooleanFilter;
    caveatFilter: BooleanFilter;
    maFilter: MaFilter;
    nearHighOnly: boolean;
  },
) {
  if (filters.bucketFilter !== 'all' && row.candidateBucket !== filters.bucketFilter) return false;
  if (filters.returnFilter === 'positive' && (row.currentReturn ?? -Infinity) < 0) return false;
  if (filters.returnFilter === 'negative' && (row.currentReturn ?? Infinity) >= 0) return false;
  if (filters.targetHitFilter === 'yes' && !row.targetHit) return false;
  if (filters.targetHitFilter === 'no' && row.targetHit) return false;
  if (filters.expiredFilter === 'yes' && !row.expired) return false;
  if (filters.expiredFilter === 'no' && row.expired) return false;
  if (filters.caveatFilter === 'yes' && row.caveatFlags.length === 0) return false;
  if (filters.caveatFilter === 'no' && row.caveatFlags.length > 0) return false;
  if (filters.maFilter === 'above' && !(row.above20ma && row.above50ma && row.above200ma)) return false;
  if (filters.maFilter === 'below' && row.above20ma && row.above50ma && row.above200ma) return false;
  if (filters.nearHighOnly && ((row.distanceFrom52wHigh ?? -Infinity) < -0.1 || row.distanceFrom52wHigh === null))
    return false;
  return true;
}

function rowPassesColumnFilters(row: ScreenerBoardRow, filters: ColumnFilterValues): boolean {
  for (const [columnId, rawValue] of Object.entries(filters)) {
    const filterValue = rawValue.trim();
    if (!filterValue) continue;
    if (!matchesColumnFilter(row, columnId, filterValue)) return false;
  }
  return true;
}

function matchesColumnFilter(row: ScreenerBoardRow, columnId: string, filterValue: string): boolean {
  if (columnId === 'symbol') {
    return textIncludes(`${row.symbol} ${row.company}`, filterValue);
  }
  if (columnId === 'candidateBucket') return row.candidateBucket === filterValue;
  if (BOOLEAN_FILTER_IDS.has(columnId)) return matchesBoolean(columnValue(row, columnId), filterValue);
  if (PERCENT_FILTER_IDS.has(columnId))
    return matchesNumberFilter(asNumber(columnValue(row, columnId), 100), filterValue);
  if (NUMBER_FILTER_IDS.has(columnId)) return matchesNumberFilter(asNumber(columnValue(row, columnId)), filterValue);
  if (columnId === 'latestReportDate') return matchesDateFilter(row.latestReportDate, filterValue);
  if (TEXT_FILTER_IDS.has(columnId)) return textIncludes(String(columnValue(row, columnId) ?? ''), filterValue);
  return textIncludes(String(columnValue(row, columnId) ?? ''), filterValue);
}

function columnValue(row: ScreenerBoardRow, columnId: string): unknown {
  if (columnId === 'caveatFlags') return row.caveatFlags.join(' ');
  return row[columnId as keyof ScreenerBoardRow];
}

function matchesBoolean(value: unknown, filterValue: string): boolean {
  if (filterValue === 'yes') return value === true;
  if (filterValue === 'no') return value === false;
  return true;
}

function matchesDateFilter(value: string | null, filterValue: string): boolean {
  if (!value) return false;
  const range = filterValue.split('..').map((item) => item.trim());
  if (range.length === 2) {
    const [min, max] = range;
    return (!min || value >= min) && (!max || value <= max);
  }
  const operator = filterValue.match(/^(<=|>=|<|>|=)\\s*(\\d{4}-\\d{2}-\\d{2})$/);
  if (operator) {
    const [, op, date] = operator;
    if (op === '<=') return value <= date;
    if (op === '>=') return value >= date;
    if (op === '<') return value < date;
    if (op === '>') return value > date;
    return value === date;
  }
  return textIncludes(value, filterValue);
}

function matchesNumberFilter(value: number | null, filterValue: string): boolean {
  if (value === null || !Number.isFinite(value)) return false;
  const normalized = filterValue.replaceAll(',', '').replaceAll('%', '').trim();
  const range = normalized.split('..').map((item) => item.trim());
  if (range.length === 2) {
    const min = parseMetricNumber(range[0]);
    const max = parseMetricNumber(range[1]);
    return (min === null || value >= min) && (max === null || value <= max);
  }
  const operator = normalized.match(/^(<=|>=|<|>|=)?\\s*(-?\\d+(?:\\.\\d+)?)([kKmMbB])?$/);
  if (!operator) return textIncludes(String(value), filterValue);
  const [, op = '=', rawNumber, suffix] = operator;
  const target = scaleMetricNumber(Number(rawNumber), suffix);
  if (op === '<=') return value <= target;
  if (op === '>=') return value >= target;
  if (op === '<') return value < target;
  if (op === '>') return value > target;
  return Math.abs(value - target) < 0.000001;
}

function parseMetricNumber(value: string): number | null {
  if (!value) return null;
  const match = value.match(/^(-?\\d+(?:\\.\\d+)?)([kKmMbB])?$/);
  if (!match) return null;
  return scaleMetricNumber(Number(match[1]), match[2]);
}

function scaleMetricNumber(value: number, suffix?: string): number {
  const unit = suffix?.toLowerCase();
  if (unit === 'k') return value * 1_000;
  if (unit === 'm') return value * 1_000_000;
  if (unit === 'b') return value * 1_000_000_000;
  return value;
}

function asNumber(value: unknown, multiplier = 1): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value * multiplier;
}

function textIncludes(value: string, filterValue: string): boolean {
  return value.toLocaleLowerCase('ko-KR').includes(filterValue.toLocaleLowerCase('ko-KR'));
}

function presetMatch(row: ScreenerBoardRow, preset: Preset): boolean {
  return (
    rowPassesFilters(row, {
      bucketFilter: 'all',
      returnFilter: preset.returnFilter ?? 'all',
      targetHitFilter: preset.targetHit ?? 'all',
      expiredFilter: preset.expired ?? 'no',
      caveatFilter: preset.caveat ?? 'all',
      maFilter: preset.maStack ? 'above' : 'all',
      nearHighOnly: Boolean(preset.nearHigh),
    }) &&
    (!preset.targetGapRequired || row.targetGapPct !== null)
  );
}

function globalTextFilter(row: Row<ScreenerBoardRow>, _columnId: string, filterValue: string): boolean {
  const needle = filterValue.trim().toLocaleLowerCase('ko-KR');
  if (!needle) return true;
  const item = row.original;
  return [
    item.symbol,
    item.company,
    item.exchange,
    item.currency,
    item.candidateBucket,
    item.rankBasis,
    ...item.caveatFlags,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase('ko-KR').includes(needle));
}

function buildColumnVisibility(mode: ColumnMode): VisibilityState {
  const visible = mode === 'core' ? CORE_COLUMN_IDS : mode === 'price' ? PRICE_COLUMN_IDS : null;
  if (!visible) return {};
  return Object.fromEntries(ALL_COLUMN_IDS.map((id) => [id, visible.has(id)]));
}

const ALL_COLUMN_IDS = [
  'symbol',
  'company',
  'currency',
  'latestReportDate',
  'lastCloseNative',
  'volumeLatest',
  'entryPriceNative',
  'targetPriceNative',
  'targetUpsideAtPub',
  'targetGapPct',
  'targetRemainingPct',
  'targetProgressPct',
  'targetHit',
  'daysToTarget',
  'expired',
  'currentReturn',
  'peakReturn',
  'troughReturn',
  'ytdReturn',
  'sparkline',
  'return1y',
  'distanceFrom52wHigh',
  'above20ma',
  'above50ma',
  'above200ma',
  'candidateBucket',
  'candidateScore',
  'rankBasis',
  'caveatFlags',
  'detail',
];

function BoardMetric({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{caption}</div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-500">
      <span>{label}</span>
      <select
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-950 outline-none focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {filterOptionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function filterOptionLabel(option: string): string {
  return (
    {
      all: '전체',
      positive: '양수',
      negative: '음수',
      yes: '예',
      no: '아니오',
      above: '모두 위',
      below: '하나 이상 아래',
    }[option] ?? option
  );
}

function ColumnFilterControl({
  columnId,
  value,
  buckets,
  onChange,
}: {
  columnId: string;
  value: string;
  buckets: string[];
  onChange: (value: string) => void;
}) {
  if (columnId === 'sparkline' || columnId === 'detail') return null;
  if (columnId === 'candidateBucket') {
    return (
      <select
        aria-label={`${columnLabel(columnId)} 컬럼 필터`}
        className="h-7 w-full rounded border border-slate-200 bg-white px-1 text-[11px] font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {buckets.map((bucket) => (
          <option key={bucket} value={bucket === 'all' ? '' : bucket}>
            {bucket === 'all' ? '전체' : bucket}
          </option>
        ))}
      </select>
    );
  }
  if (BOOLEAN_FILTER_IDS.has(columnId)) {
    return (
      <select
        aria-label={`${columnLabel(columnId)} 컬럼 필터`}
        className="h-7 w-full rounded border border-slate-200 bg-white px-1 text-[11px] font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">전체</option>
        <option value="yes">Y</option>
        <option value="no">N</option>
      </select>
    );
  }
  return (
    <input
      aria-label={`${columnLabel(columnId)} 컬럼 필터`}
      className="h-7 w-full min-w-[72px] rounded border border-slate-200 bg-white px-1.5 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-700 outline-none placeholder:text-slate-300 focus:border-slate-400"
      value={value}
      placeholder={COLUMN_FILTER_LABELS[columnId] ?? 'filter'}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function PercentCell({ value, heat = false }: { value: number | null; heat?: boolean }) {
  const heatClass = heat && value !== null ? (value >= 0 ? 'bg-emerald-100/80 px-1' : 'bg-rose-100/80 px-1') : '';
  return (
    <span className={`${numCellClass} font-mono ${signedTextClass(value)} ${heatClass}`}>{formatPercent(value)}</span>
  );
}

function HighGapCell({ value, positiveIsGood = false }: { value: number | null; positiveIsGood?: boolean }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-slate-400">—</span>;
  const normalized = positiveIsGood ? Math.max(0, Math.min(1, value + 1)) : Math.max(0, Math.min(1, 1 + value));
  const color = value >= -0.1 ? 'bg-emerald-500' : value >= -0.25 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-4 w-16 bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(4, normalized * 100)}%` }} />
      </div>
      <span className="w-14 text-right font-mono tabular-nums">{formatPercent(value)}</span>
    </div>
  );
}

function ProgressCell({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-4 w-16 bg-slate-100">
        <div
          className="h-full bg-slate-950"
          style={{ width: `${Math.max(3, Math.min(1, Math.max(0, value)) * 100)}%` }}
        />
      </div>
      <span className="w-14 text-right font-mono tabular-nums">{formatPercent(value)}</span>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const points = sparklinePoints(values, 72, 22);
  if (!points) return <span className="text-slate-400">—</span>;
  const first = values[0];
  const last = values.at(-1);
  const positive = first !== undefined && last !== undefined && last >= first;
  return (
    <svg className="h-6 w-[72px] overflow-visible" viewBox="0 0 72 22" role="img" aria-label="1년 가격 경로">
      <path
        d={points.line}
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function TrendMark({ value }: { value: boolean | null }) {
  if (value === null) return <span className="font-mono text-slate-400">—</span>;
  return (
    <span className={`font-mono text-base ${value ? 'text-emerald-500' : 'text-rose-500'}`}>{value ? '▲' : '▼'}</span>
  );
}

function BooleanMark({ value }: { value: boolean }) {
  return <span className={`font-mono ${value ? 'text-rose-500' : 'text-slate-400'}`}>{value ? 'Y' : '—'}</span>;
}

function HitCell({ row }: { row: ScreenerBoardRow }) {
  if (row.targetHit) return <span className="badge badge-success badge-soft badge-sm">도달</span>;
  if (row.expired) return <span className="badge badge-warning badge-soft badge-sm">만료</span>;
  return <span className="badge badge-ghost badge-sm">진행</span>;
}

function CaveatCell({ flags }: { flags: string[] }) {
  if (!flags.length) return <span className="text-slate-400">—</span>;
  return (
    <span className="badge badge-warning badge-soft badge-sm" title={flags.join(', ')}>
      {flags.length}개
    </span>
  );
}

function sparklinePoints(values: number[], width: number, height: number): { line: string } | null {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) return null;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const span = max - min || 1;
  return {
    line: clean
      .map((value, index) => {
        const x = (index / Math.max(1, clean.length - 1)) * width;
        const y = height - 2 - ((value - min) / span) * (height - 4);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' '),
  };
}

function buildBoardStats(rows: ScreenerBoardRow[]) {
  const positiveCount = rows.filter((row) => (row.currentReturn ?? -Infinity) >= 0).length;
  return {
    positiveCount,
    positiveShare: rows.length ? positiveCount / rows.length : null,
    nearHighCount: rows.filter((row) => row.distanceFrom52wHigh !== null && row.distanceFrom52wHigh >= -0.1).length,
    aboveAllMaCount: rows.filter((row) => row.above20ma && row.above50ma && row.above200ma).length,
  };
}

function detailHref(row: ScreenerBoardRow): string {
  return `/reports/${encodeURIComponent(row.symbol)}/${encodeURIComponent(row.latestReportId)}`;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'ko-KR'));
}

function formatScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatDaysShort(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('ko-KR');
}

function toggleClass(active: boolean): string {
  return active
    ? 'inline-flex h-8 items-center rounded-md border border-slate-950 bg-slate-950 px-2.5 text-xs font-semibold text-white'
    : 'inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950';
}

function modeLabel(mode: ColumnMode): string {
  if (mode === 'core') return '핵심';
  if (mode === 'price') return '가격';
  return '전체 컬럼';
}

function columnLabel(columnId: string): string {
  return (
    {
      symbol: 'Ticker',
      company: 'Company',
      currency: 'Ccy',
      latestReportDate: 'Report',
      lastCloseNative: 'Price',
      volumeLatest: 'Vol',
      entryPriceNative: 'Entry',
      targetPriceNative: 'Target',
      targetUpsideAtPub: 'Target Up',
      targetGapPct: 'Gap',
      targetRemainingPct: 'Remain',
      targetProgressPct: 'Progress',
      targetHit: 'Hit',
      daysToTarget: 'Days',
      expired: 'Exp',
      currentReturn: 'Current',
      peakReturn: 'Peak',
      troughReturn: 'Trough',
      ytdReturn: 'YTD',
      return1y: '1Y',
      distanceFrom52wHigh: '52W High',
      above20ma: '20SMA',
      above50ma: '50SMA',
      above200ma: '200SMA',
      candidateBucket: 'Bucket',
      candidateScore: 'Score',
      rankBasis: 'Basis',
      caveatFlags: 'Caveat',
    }[columnId] ?? columnId
  );
}

function sortIndicator(direction: false | 'asc' | 'desc'): string {
  if (direction === 'asc') return ' ↑';
  if (direction === 'desc') return ' ↓';
  return ' ↕';
}
