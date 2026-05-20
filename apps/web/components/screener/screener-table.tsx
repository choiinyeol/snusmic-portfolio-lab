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
import { SearchX } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useCallback, useDeferredValue, useMemo, useReducer, useState } from 'react';
import { CsvDownloadButton, downloadCsv } from '@/components/ui/data-panel';
import { BlockPagination } from '@/components/trading/TableControls';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useSearchShortcut } from '@/components/ui/use-search-shortcut';
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
  maStack: boolean | null;
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
  'maStack',
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
/** Per-column filter metadata: kind drives `rowPassesColumnFilters` matching and
 * the ColumnFilterControl input variant, placeholder is the input hint. Adding
 * a new column means adding one row here — no more five-Set scatter. */
type ColumnFilterKind = 'percent' | 'number' | 'boolean' | 'text';

const COLUMN_META: Record<string, { kind: ColumnFilterKind; placeholder: string }> = {
  symbol: { kind: 'text', placeholder: 'ticker/company' },
  company: { kind: 'text', placeholder: 'company' },
  currency: { kind: 'text', placeholder: 'ccy' },
  rankBasis: { kind: 'text', placeholder: 'contains' },
  caveatFlags: { kind: 'text', placeholder: 'contains' },
  latestReportDate: { kind: 'text', placeholder: 'YYYY-MM-DD' },
  lastCloseNative: { kind: 'number', placeholder: '>=100' },
  volumeLatest: { kind: 'number', placeholder: '>=1M' },
  entryPriceNative: { kind: 'number', placeholder: '>=100' },
  targetPriceNative: { kind: 'number', placeholder: '>=100' },
  daysToTarget: { kind: 'number', placeholder: '<=120' },
  candidateScore: { kind: 'number', placeholder: '>=0.5' },
  targetUpsideAtPub: { kind: 'percent', placeholder: '>=30' },
  targetGapPct: { kind: 'percent', placeholder: '>-10' },
  targetRemainingPct: { kind: 'percent', placeholder: '>=0' },
  targetProgressPct: { kind: 'percent', placeholder: '>=70' },
  currentReturn: { kind: 'percent', placeholder: '>=0' },
  peakReturn: { kind: 'percent', placeholder: '>=50' },
  troughReturn: { kind: 'percent', placeholder: '<=-20' },
  ytdReturn: { kind: 'percent', placeholder: '>=0' },
  return1y: { kind: 'percent', placeholder: '>=0' },
  distanceFrom52wHigh: { kind: 'percent', placeholder: '>=-10' },
  targetHit: { kind: 'boolean', placeholder: '전체' },
  expired: { kind: 'boolean', placeholder: '전체' },
  above20ma: { kind: 'boolean', placeholder: '전체' },
  above50ma: { kind: 'boolean', placeholder: '전체' },
  above200ma: { kind: 'boolean', placeholder: '전체' },
  maStack: { kind: 'boolean', placeholder: '전체' },
  // candidateBucket has its own rendering and matching branch — intentionally absent here.
};

function downloadScreenerRows(rows: ScreenerBoardRow[]) {
  const headers = [
    'symbol',
    'company',
    'exchange',
    'currency',
    'latest_report_id',
    'latest_report_date',
    'report_age_days',
    'report_count',
    'last_close_native',
    'last_close_krw',
    'target_price_krw',
    'target_upside_at_pub',
    'target_gap_pct',
    'target_progress_pct',
    'current_return',
    'peak_return',
    'trough_return',
    'target_hit',
    'expired',
    'candidate_bucket',
    'candidate_score',
    'return_1m',
    'return_3m',
    'ytd_return',
    'return_1y',
    'distance_from_52w_high',
    'rs_rank_1m',
    'above_20ma',
    'above_50ma',
    'above_200ma',
    'ma_stack',
  ];
  const data = rows.map((row) => [
    row.symbol,
    row.company,
    row.exchange,
    row.currency,
    row.latestReportId,
    row.latestReportDate,
    row.reportAgeDays ?? '',
    row.reportCount,
    row.lastCloseNative ?? '',
    row.lastCloseKrw ?? '',
    row.targetPriceKrw ?? '',
    row.targetUpsideAtPub ?? '',
    row.targetGapPct ?? '',
    row.targetProgressPct ?? '',
    row.currentReturn ?? '',
    row.peakReturn ?? '',
    row.troughReturn ?? '',
    row.targetHit ? 'true' : 'false',
    row.expired ? 'true' : 'false',
    row.candidateBucket ?? '',
    row.candidateScore ?? '',
    row.return1m ?? '',
    row.return3m ?? '',
    row.ytdReturn ?? '',
    row.return1y ?? '',
    row.distanceFrom52wHigh ?? '',
    row.rsRank1m ?? '',
    row.above20ma === null ? '' : row.above20ma ? 'true' : 'false',
    row.above50ma === null ? '' : row.above50ma ? 'true' : 'false',
    row.above200ma === null ? '' : row.above200ma ? 'true' : 'false',
    row.maStack === null ? '' : row.maStack ? 'true' : 'false',
  ]);
  downloadCsv('snusmic-screener-filtered.csv', headers, data);
}

function columnFilterKind(columnId: string): ColumnFilterKind | undefined {
  return COLUMN_META[columnId]?.kind;
}

function columnFilterPlaceholder(columnId: string): string {
  return COLUMN_META[columnId]?.placeholder ?? 'filter';
}

type FilterState = {
  activePreset: PresetId;
  bucketFilter: string;
  returnFilter: SignFilter;
  targetHitFilter: BooleanFilter;
  expiredFilter: BooleanFilter;
  caveatFilter: BooleanFilter;
  maFilter: MaFilter;
  nearHighOnly: boolean;
  columnFilters: ColumnFilterValues;
  page: number;
};

type FilterAction =
  | { type: 'APPLY_PRESET'; preset: Preset }
  | { type: 'SET_BUCKET'; value: string }
  | { type: 'SET_RETURN'; value: SignFilter }
  | { type: 'SET_TARGET_HIT'; value: BooleanFilter }
  | { type: 'SET_EXPIRED'; value: BooleanFilter }
  | { type: 'SET_MA'; value: MaFilter }
  | { type: 'TOGGLE_NEAR_HIGH' }
  | { type: 'SET_COLUMN_FILTER'; columnId: string; value: string }
  | { type: 'CLEAR_COLUMN_FILTERS' }
  | { type: 'SET_PAGE'; page: number };

const INITIAL_FILTER_STATE: FilterState = {
  activePreset: 'all',
  bucketFilter: 'all',
  returnFilter: 'all',
  targetHitFilter: 'all',
  expiredFilter: 'no',
  caveatFilter: 'all',
  maFilter: 'all',
  nearHighOnly: false,
  columnFilters: {},
  page: 0,
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'APPLY_PRESET': {
      const preset = action.preset;
      return {
        ...state,
        activePreset: preset.id,
        returnFilter: preset.returnFilter ?? 'all',
        targetHitFilter: preset.targetHit ?? 'all',
        expiredFilter: preset.expired ?? 'no',
        caveatFilter: preset.caveat ?? 'all',
        maFilter: preset.maStack ? 'above' : 'all',
        nearHighOnly: Boolean(preset.nearHigh),
        page: 0,
      };
    }
    case 'SET_BUCKET':
      return { ...state, bucketFilter: action.value, page: 0 };
    case 'SET_RETURN':
      return { ...state, returnFilter: action.value, page: 0 };
    case 'SET_TARGET_HIT':
      return { ...state, targetHitFilter: action.value, page: 0 };
    case 'SET_EXPIRED':
      return { ...state, expiredFilter: action.value, page: 0 };
    case 'SET_MA':
      return { ...state, maFilter: action.value, page: 0 };
    case 'TOGGLE_NEAR_HIGH':
      return { ...state, nearHighOnly: !state.nearHighOnly, page: 0 };
    case 'SET_COLUMN_FILTER': {
      const next = { ...state.columnFilters };
      if (action.value.trim()) next[action.columnId] = action.value;
      else delete next[action.columnId];
      return { ...state, columnFilters: next, page: 0 };
    }
    case 'CLEAR_COLUMN_FILTERS':
      return { ...state, columnFilters: {}, page: 0 };
    case 'SET_PAGE':
      return { ...state, page: action.page };
  }
}

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
    label: '정배열',
    caption: '현재가 ≥ 20SMA ≥ 50SMA ≥ 200SMA를 모두 만족하는 후보입니다.',
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
  const [columnMode, setColumnMode] = useState<ColumnMode>('price');
  const [globalFilter, setGlobalFilter] = useState('');
  const deferredGlobalFilter = useDeferredValue(globalFilter);
  const clearGlobalFilter = useCallback(() => setGlobalFilter(''), []);
  const searchInputRef = useSearchShortcut(clearGlobalFilter);
  const [filters, dispatchFilters] = useReducer(filterReducer, INITIAL_FILTER_STATE);
  const {
    activePreset,
    bucketFilter,
    returnFilter,
    targetHitFilter,
    expiredFilter,
    caveatFilter,
    maFilter,
    nearHighOnly,
    columnFilters,
    page,
  } = filters;
  const setPage = useCallback((next: number) => dispatchFilters({ type: 'SET_PAGE', page: next }), []);

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
    state: { sorting, globalFilter: deferredGlobalFilter, columnVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalTextFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedRows = table.getSortedRowModel().rows;
  const filteredRows = useMemo(
    () =>
      sortedRows.filter(
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
      ),
    [
      sortedRows,
      bucketFilter,
      returnFilter,
      targetHitFilter,
      expiredFilter,
      caveatFilter,
      maFilter,
      nearHighOnly,
      columnFilters,
    ],
  );
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleRows = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const resetPage = useCallback(() => dispatchFilters({ type: 'SET_PAGE', page: 0 }), []);
  const applyPreset = useCallback((presetId: PresetId) => {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setSorting(preset.sort);
    dispatchFilters({ type: 'APPLY_PRESET', preset });
  }, []);
  const updateColumnFilter = useCallback((columnId: string, value: string) => {
    dispatchFilters({ type: 'SET_COLUMN_FILTER', columnId, value });
  }, []);
  const clearColumnFilters = useCallback(() => dispatchFilters({ type: 'CLEAR_COLUMN_FILTERS' }), []);
  const tableMinWidthClass =
    columnMode === 'all' ? 'min-w-[1900px]' : columnMode === 'price' ? 'min-w-[1480px]' : 'min-w-[1220px]';

  return (
    <section className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <BoardMetric label="종목" value={`${rows.length.toLocaleString('ko-KR')}개`} caption="유니버스" />
        <BoardMetric
          label="현재 플러스"
          value={`${boardStats.positiveCount}개`}
          caption={formatPercent(boardStats.positiveShare, 1)}
        />
        <BoardMetric label="52주 고점 -10% 이내" value={`${boardStats.nearHighCount}개`} caption="가격 시계열" />
        <BoardMetric
          label="정배열"
          value={`${boardStats.aboveAllMaCount}개`}
          caption="현재가 ≥ 20SMA ≥ 50SMA ≥ 200SMA"
        />
      </div>

      <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid gap-3 border-b border-slate-200 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                리서치 보드
              </div>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                리포트 유니버스 × 가격 시계열
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {activePresetConfig.caption} 기본값은 발간 후 2년 경과 리포트 제외입니다. Market cap, P/E, sector는 현재
                artifact에 없어 숨깁니다.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2" aria-label="컬럼 보기">
                <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  컬럼
                </span>
                <div className="inline-flex min-w-max overflow-hidden rounded-md border border-slate-200 bg-white">
                  {(['core', 'price', 'all'] as const).map((mode, index) => {
                    const isActive = columnMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={isActive}
                        className={[
                          'inline-flex h-8 min-w-12 items-center justify-center whitespace-nowrap px-3 text-xs font-semibold transition-colors',
                          index > 0 ? 'border-l border-slate-200' : '',
                          isActive
                            ? 'bg-slate-950 text-white'
                            : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                        ].join(' ')}
                        onClick={() => setColumnMode(mode)}
                      >
                        {modeLabel(mode)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <CsvDownloadButton
                label="CSV"
                onClick={() => downloadScreenerRows(filteredRows.map((row) => row.original))}
              />
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

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(300px,1.5fr)_repeat(6,minmax(140px,1fr))]">
            <label className="grid gap-1 text-xs font-medium text-slate-500" htmlFor="screener-search">
              <span>
                검색 <span className="font-mono text-[10px] text-slate-400">(/ 단축키)</span>
              </span>
              <input
                ref={searchInputRef}
                id="screener-search"
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
              label="후보 유형"
              value={bucketFilter}
              onChange={(value) => dispatchFilters({ type: 'SET_BUCKET', value })}
              options={buckets}
            />
            <Select<SignFilter>
              label="수익률 방향"
              value={returnFilter}
              onChange={(value) => dispatchFilters({ type: 'SET_RETURN', value })}
              options={['all', 'positive', 'negative'] as const}
            />
            <Select<BooleanFilter>
              label="목표 도달"
              value={targetHitFilter}
              onChange={(value) => dispatchFilters({ type: 'SET_TARGET_HIT', value })}
              options={['all', 'yes', 'no'] as const}
            />
            <Select<BooleanFilter>
              label="만료"
              value={expiredFilter}
              onChange={(value) => dispatchFilters({ type: 'SET_EXPIRED', value })}
              options={['no', 'all', 'yes'] as const}
            />
            <Select<MaFilter>
              label="이동평균"
              value={maFilter}
              onChange={(value) => dispatchFilters({ type: 'SET_MA', value })}
              options={['all', 'above', 'below'] as const}
            />
            <div className="grid gap-1 text-xs font-medium text-slate-500">
              <span>52주 고점</span>
              <button
                type="button"
                aria-pressed={nearHighOnly}
                className={toggleClass(nearHighOnly)}
                onClick={() => dispatchFilters({ type: 'TOGGLE_NEAR_HIGH' })}
              >
                -10% 이내
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <span>
            열 제목으로 정렬 · <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">/</kbd> 검색 ·{' '}
            {activeColumnFilterCount > 0 ? `컬럼 필터 ${activeColumnFilterCount}개 적용 중 · ` : ''}
            가격 지표는 getPriceSeries(symbol)
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
          <table
            className={`${tableMinWidthClass} w-full border-separate border-spacing-0 text-[11px] leading-4 [&_td]:border-b [&_td]:border-slate-100 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border-b [&_th]:border-slate-200 [&_th]:px-2 [&_th]:py-1.5 [&_tr:hover_td]:bg-slate-50`}
          >
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
              {visibleRows.length === 0 ? (
                <tr>
                  <td className="p-8" colSpan={table.getVisibleLeafColumns().length}>
                    <div className="mx-auto grid max-w-md gap-3 text-center">
                      <SearchX aria-hidden="true" className="mx-auto size-6 text-slate-400" />
                      <div className="text-sm font-semibold text-slate-950">조건에 맞는 종목이 없습니다</div>
                      <p className="text-xs leading-5 text-slate-500">
                        프리셋·필터·컬럼 필터·검색어가 동시에 적용되면 종목이 모두 제외될 수 있습니다.
                      </p>
                      <div>
                        <button
                          type="button"
                          className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
                          onClick={() => {
                            setGlobalFilter('');
                            dispatchFilters({ type: 'SET_BUCKET', value: 'all' });
                            clearColumnFilters();
                            applyPreset('all');
                          }}
                        >
                          필터 초기화
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id}>
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
      header: '종목',
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
      header: '회사',
      cell: ({ getValue }) => (
        <span className="block max-w-[150px] truncate" title={getValue<string>()}>
          {getValue<string>()}
        </span>
      ),
    },
    {
      id: 'currency',
      accessorKey: 'currency',
      header: '통화',
      cell: ({ getValue }) => <span className="font-mono text-slate-500">{getValue<string>() || '—'}</span>,
    },
    {
      id: 'latestReportDate',
      accessorKey: 'latestReportDate',
      header: '리포트',
      cell: ({ getValue }) => <span className="font-mono tabular-nums">{formatDateKo(getValue<string>())}</span>,
    },
    {
      id: 'lastCloseNative',
      accessorKey: 'lastCloseNative',
      header: '현재가',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {formatNative(row.original.lastCloseNative, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'volumeLatest',
      accessorKey: 'volumeLatest',
      header: '거래량',
      cell: ({ getValue }) => <span className={numCellClass}>{formatCompact(getValue<number | null>())}</span>,
    },
    {
      id: 'entryPriceNative',
      accessorKey: 'entryPriceNative',
      header: '진입가',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {formatNative(row.original.entryPriceNative, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'targetPriceNative',
      accessorKey: 'targetPriceNative',
      header: '목표가',
      cell: ({ row }) => (
        <span className="font-mono tabular-nums">
          {formatNative(row.original.targetPriceNative, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'targetUpsideAtPub',
      accessorKey: 'targetUpsideAtPub',
      header: '상승여력',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'targetGapPct',
      accessorKey: 'targetGapPct',
      header: '목표 갭',
      cell: ({ getValue }) => <HighGapCell value={getValue<number | null>()} positiveIsGood />,
    },
    {
      id: 'targetRemainingPct',
      accessorKey: 'targetRemainingPct',
      header: '목표 잔여',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'targetProgressPct',
      accessorKey: 'targetProgressPct',
      header: '달성률',
      cell: ({ getValue }) => <ProgressCell value={getValue<number | null>()} />,
    },
    {
      id: 'targetHit',
      accessorKey: 'targetHit',
      header: '목표달성',
      cell: ({ row }) => <HitCell row={row.original} />,
    },
    {
      id: 'daysToTarget',
      accessorKey: 'daysToTarget',
      header: '도달일수',
      cell: ({ getValue }) => <span className={numCellClass}>{formatDaysShort(getValue<number | null>())}</span>,
    },
    {
      id: 'expired',
      accessorKey: 'expired',
      header: '만료',
      cell: ({ getValue }) => <BooleanMark value={getValue<boolean>()} />,
    },
    {
      id: 'currentReturn',
      accessorKey: 'currentReturn',
      header: '현재 수익률',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'peakReturn',
      accessorKey: 'peakReturn',
      header: '고점',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'troughReturn',
      accessorKey: 'troughReturn',
      header: '저점',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} />,
    },
    {
      id: 'ytdReturn',
      accessorKey: 'ytdReturn',
      header: 'YTD',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} heat />,
    },
    {
      id: 'sparkline',
      accessorKey: 'sparkline',
      header: '1년 차트',
      enableSorting: false,
      cell: ({ row }) => <Sparkline values={row.original.sparkline} />,
    },
    {
      id: 'return1y',
      accessorKey: 'return1y',
      header: '1년',
      cell: ({ getValue }) => <PercentCell value={getValue<number | null>()} heat />,
    },
    {
      id: 'distanceFrom52wHigh',
      accessorKey: 'distanceFrom52wHigh',
      header: '52주 고점',
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
      id: 'maStack',
      accessorKey: 'maStack',
      header: '정배열',
      cell: ({ getValue }) => <TrendMark value={getValue<boolean | null>()} />,
    },
    {
      id: 'candidateBucket',
      accessorKey: 'candidateBucket',
      header: '후보 유형',
      cell: ({ getValue }) => (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 font-mono">
          {getValue<string | null>() ?? '—'}
        </span>
      ),
    },
    {
      id: 'candidateScore',
      accessorKey: 'candidateScore',
      header: '점수',
      cell: ({ getValue }) => <span className={numCellClass}>{formatScore(getValue<number | null>())}</span>,
    },
    {
      id: 'rankBasis',
      accessorKey: 'rankBasis',
      header: '근거',
      cell: ({ getValue }) => (
        <span className="block max-w-[160px] truncate text-slate-600" title={getValue<string | null>() ?? ''}>
          {getValue<string | null>() ?? '—'}
        </span>
      ),
    },
    {
      id: 'caveatFlags',
      accessorKey: 'caveatFlags',
      header: '경고',
      cell: ({ getValue }) => <CaveatCell flags={getValue<string[]>()} />,
    },
    {
      id: 'detail',
      header: '상세',
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
  if (filters.maFilter === 'above' && !row.maStack) return false;
  if (filters.maFilter === 'below' && row.maStack) return false;
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
  if (columnId === 'latestReportDate') return matchesDateFilter(row.latestReportDate, filterValue);
  const kind = columnFilterKind(columnId);
  if (kind === 'boolean') return matchesBoolean(columnValue(row, columnId), filterValue);
  if (kind === 'percent') return matchesNumberFilter(asNumber(columnValue(row, columnId), 100), filterValue);
  if (kind === 'number') return matchesNumberFilter(asNumber(columnValue(row, columnId)), filterValue);
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
  const operator = filterValue.match(/^(<=|>=|<|>|=)\s*(\d{4}-\d{2}-\d{2})$/);
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
  const operator = normalized.match(/^(<=|>=|<|>|=)?\s*(-?\d+(?:\.\d+)?)([kKmMbB])?$/);
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
  const match = value.match(/^(-?\d+(?:\.\d+)?)([kKmMbB])?$/);
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
  'maStack',
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

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1 text-xs font-medium text-slate-500">
      <span>{label}</span>
      <NativeSelect aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <NativeSelectOption key={option} value={option}>
            {filterOptionLabel(option)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
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
      <NativeSelect
        aria-label={`${columnLabel(columnId)} 컬럼 필터`}
        className="h-8 w-full px-1.5 text-[11px] font-normal normal-case tracking-normal text-slate-700"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {buckets.map((bucket) => (
          <NativeSelectOption key={bucket} value={bucket === 'all' ? '' : bucket}>
            {bucket === 'all' ? '전체' : bucket}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }
  if (columnFilterKind(columnId) === 'boolean') {
    return (
      <NativeSelect
        aria-label={`${columnLabel(columnId)} 컬럼 필터`}
        className="h-8 w-full px-1.5 text-[11px] font-normal normal-case tracking-normal text-slate-700"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <NativeSelectOption value="">전체</NativeSelectOption>
        <NativeSelectOption value="yes">Y</NativeSelectOption>
        <NativeSelectOption value="no">N</NativeSelectOption>
      </NativeSelect>
    );
  }
  return (
    <input
      aria-label={`${columnLabel(columnId)} 컬럼 필터`}
      className="h-7 w-full min-w-[72px] rounded border border-slate-200 bg-white px-1.5 font-mono text-[11px] font-normal normal-case tracking-normal text-slate-700 outline-none placeholder:text-slate-300 focus:border-slate-400"
      value={value}
      placeholder={columnFilterPlaceholder(columnId)}
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

/** Sparkline that plots each row's price path as "% return from first point",
 * auto-scaled per row so the line never flattens at a clamp edge. The dashed
 * horizontal baseline marks the start price (zero return) so direction stays
 * visible across rows. */
function Sparkline({ values }: { values: number[] }) {
  const points = sparklinePoints(values, 72, 22);
  if (!points) return <span className="text-slate-400">—</span>;
  const first = values[0];
  const last = values.at(-1);
  const positive = first !== undefined && last !== undefined && last >= first;
  return (
    <svg className="h-6 w-[72px] overflow-visible" viewBox="0 0 72 22" role="img" aria-label="1년 가격 경로">
      <line x1={0} x2={72} y1={11} y2={11} stroke="#e2e8f0" strokeWidth={0.6} strokeDasharray="2 2" />
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
  if (row.targetHit)
    return (
      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">도달</span>
    );
  if (row.expired)
    return <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">만료</span>;
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">진행</span>;
}

function CaveatCell({ flags }: { flags: string[] }) {
  if (!flags.length) return <span className="text-slate-400">—</span>;
  return (
    <span
      className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
      title={flags.join(', ')}
    >
      {flags.length}개
    </span>
  );
}

function sparklinePoints(values: number[], width: number, height: number): { line: string } | null {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) return null;
  const first = clean[0];
  if (!first || first === 0) return null;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const midY = height / 2;
  // Per-row auto-scale anchored at zero so the start price sits on the baseline
  // and the path uses the cell's full vertical range without clamping flat.
  const returns = clean.map((value) => value / first - 1);
  const peak = Math.max(...returns.map(Math.abs));
  const scale = peak > 0 ? peak : 1;
  return {
    line: returns
      .map((r, index) => {
        const x = (index / Math.max(1, returns.length - 1)) * width;
        const y = midY - (r / scale) * (usableHeight / 2);
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
    aboveAllMaCount: rows.filter((row) => row.maStack).length,
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
    ? 'inline-flex h-8 items-center whitespace-nowrap rounded-md border border-slate-950 bg-slate-950 px-2.5 text-xs font-semibold text-white'
    : 'inline-flex h-8 items-center whitespace-nowrap rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-950';
}

function modeLabel(mode: ColumnMode): string {
  if (mode === 'core') return '핵심';
  if (mode === 'price') return '가격';
  return '전체 컬럼';
}

function columnLabel(columnId: string): string {
  return (
    {
      symbol: '종목',
      company: '회사',
      currency: '통화',
      latestReportDate: '리포트',
      lastCloseNative: '현재가',
      volumeLatest: '거래량',
      entryPriceNative: '진입가',
      targetPriceNative: '목표가',
      targetUpsideAtPub: '상승여력',
      targetGapPct: '목표 갭',
      targetRemainingPct: '목표 잔여',
      targetProgressPct: '달성률',
      targetHit: '목표달성',
      daysToTarget: '도달일수',
      expired: '만료',
      currentReturn: '현재 수익률',
      peakReturn: '고점',
      troughReturn: '저점',
      ytdReturn: 'YTD',
      return1y: '1년',
      distanceFrom52wHigh: '52주 고점',
      above20ma: '20SMA',
      above50ma: '50SMA',
      above200ma: '200SMA',
      maStack: '정배열',
      candidateBucket: '후보 유형',
      candidateScore: '점수',
      rankBasis: '근거',
      caveatFlags: '경고',
    }[columnId] ?? columnId
  );
}

function sortIndicator(direction: false | 'asc' | 'desc'): string {
  if (direction === 'asc') return ' ↑';
  if (direction === 'desc') return ' ↓';
  return '';
}
