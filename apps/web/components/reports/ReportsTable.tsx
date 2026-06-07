'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import type { ReportBoardRow } from '@/components/report-board/report-board-table';
import { CsvDownloadButton, DataPanel, EmptyTableState, downloadCsv } from '@/components/ui/data-panel';
import { Money } from '@/components/ui/Money';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectMenu } from '@/components/ui/select-menu';
import type { ReportRow } from '@/lib/artifacts';
import { formatDateKo, formatDays, formatPercent, signedTextClass } from '@/lib/format';
import type { ReportVerificationDisplayRow } from '@/lib/view-models/shared';

type ReportsTableProps = {
  reports: ReportRow[];
  marketRows?: ReportBoardRow[];
  viewRows?: ReportVerificationDisplayRow[];
};

type SortId = 'recent' | 'top-return' | 'target-progress' | 'near-target';
type HitFilter = 'all' | 'hit' | 'open' | 'expired';
type ReturnFilter = 'all' | 'positive' | 'negative';
type ColumnMode = 'core' | 'price' | 'all';
type SortDirection = 'asc' | 'desc';
type ColumnSortKey =
  | 'company'
  | 'publicationDate'
  | 'entryPriceNative'
  | 'lastCloseNative'
  | 'targetPriceNative'
  | 'targetUpsideAtPub'
  | 'currentReturn'
  | 'ytdReturn'
  | 'return1y'
  | 'distanceFrom52wHigh'
  | 'maTrend'
  | 'targetProgressPct'
  | 'peakReturn'
  | 'troughReturn'
  | 'daysToTarget'
  | 'status';
type ColumnSortState = { key: ColumnSortKey; direction: SortDirection };

const PAGE_SIZE = 25;

const SORT_OPTIONS: Array<{ value: SortId; label: string; description: string }> = [
  { value: 'recent', label: '최근 발간', description: '최신 리포트부터 봅니다.' },
  { value: 'top-return', label: '수익률 상위', description: '현재 수익률이 높은 순서입니다.' },
  { value: 'target-progress', label: '목표 진행률', description: '목표가까지 많이 진행된 순서입니다.' },
  { value: 'near-target', label: '목표 근접', description: '현재가가 목표가에 가까운 순서입니다.' },
];

const HIT_FILTER_OPTIONS: Array<{ value: HitFilter; label: string; description?: string }> = [
  { value: 'all', label: '전체' },
  { value: 'hit', label: '도달', description: '목표가에 도달한 리포트' },
  { value: 'open', label: '진행 중', description: '도달 전이며 만료되지 않음' },
  { value: 'expired', label: '만료', description: '검증 기간이 지난 리포트' },
];

const RETURN_FILTER_OPTIONS: Array<{ value: ReturnFilter; label: string; description?: string }> = [
  { value: 'all', label: '전체' },
  { value: 'positive', label: '수익', description: '현재 수익률 0% 이상' },
  { value: 'negative', label: '손실', description: '현재 수익률 0% 미만' },
];

const COLUMN_OPTIONS: Array<{ value: ColumnMode; label: string }> = [
  { value: 'core', label: '핵심' },
  { value: 'price', label: '가격' },
  { value: 'all', label: '전체' },
];

const COLUMN_SORT_LABELS: Record<ColumnSortKey, string> = {
  company: '종목',
  publicationDate: '발간일',
  entryPriceNative: '진입가',
  lastCloseNative: '현재가',
  targetPriceNative: '목표가',
  targetUpsideAtPub: '업사이드',
  currentReturn: '현재 수익률',
  ytdReturn: 'YTD',
  return1y: '1년',
  distanceFrom52wHigh: '52주 고점',
  maTrend: '이평선',
  targetProgressPct: '진행률',
  peakReturn: '고점',
  troughReturn: '저점',
  daysToTarget: '도달일',
  status: '상태',
};

export function ReportsTable({ reports, marketRows = [], viewRows = [] }: ReportsTableProps) {
  const router = useRouter();
  const [sort, setSort] = useState<SortId>('recent');
  const [query, setQuery] = useState('');
  const [hitFilter, setHitFilter] = useState<HitFilter>('all');
  const [returnFilter, setReturnFilter] = useState<ReturnFilter>('all');
  const [columnMode, setColumnMode] = useState<ColumnMode>('core');
  const [columnSort, setColumnSort] = useState<ColumnSortState | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focusedReportId, setFocusedReportId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const displayRowsById = useMemo(() => new Map(viewRows.map((row) => [row.id, row])), [viewRows]);
  const marketRowsBySymbol = useMemo(() => new Map(marketRows.map((row) => [row.symbol, row])), [marketRows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reports.filter((report) => {
      if (hitFilter === 'hit' && !report.targetHit) return false;
      if (hitFilter === 'open' && (report.targetHit || report.expired)) return false;
      if (hitFilter === 'expired' && !report.expired) return false;
      if (returnFilter === 'positive' && (report.currentReturn ?? Number.NEGATIVE_INFINITY) < 0) return false;
      if (returnFilter === 'negative' && (report.currentReturn ?? Number.POSITIVE_INFINITY) >= 0) return false;
      if (!normalizedQuery) return true;
      const haystack = `${report.symbol} ${report.company} ${report.title}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [hitFilter, query, reports, returnFilter]);

  const sortedRows = useMemo(
    () => sortReports(filteredRows, sort, columnSort, marketRowsBySymbol),
    [columnSort, filteredRows, marketRowsBySymbol, sort],
  );
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = sortedRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const focusedReport = useMemo(
    () => sortedRows.find((report) => report.reportId === focusedReportId) ?? visibleRows[0] ?? sortedRows[0] ?? null,
    [focusedReportId, sortedRows, visibleRows],
  );
  const activeFilterCount = Number(hitFilter !== 'all') + Number(returnFilter !== 'all');
  const colSpan = columnMode === 'core' ? 11 : columnMode === 'price' ? 14 : 17;
  const visibleStart = sortedRows.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const visibleEnd = Math.min(sortedRows.length, (safePage + 1) * PAGE_SIZE);
  const filteredTotalLabel =
    sortedRows.length === reports.length
      ? `${sortedRows.length.toLocaleString('ko-KR')}건`
      : `${sortedRows.length.toLocaleString('ko-KR')}건 · 전체 ${reports.length.toLocaleString('ko-KR')}건`;
  const activeSortLabel = columnSort
    ? `${COLUMN_SORT_LABELS[columnSort.key]} ${columnSort.direction === 'asc' ? '오름차순' : '내림차순'}`
    : (SORT_OPTIONS.find((option) => option.value === sort)?.label ?? '최근 발간');
  const appliedFilters = [
    query.trim() ? `검색 “${query.trim()}”` : null,
    hitFilter !== 'all' ? `목표 ${HIT_FILTER_OPTIONS.find((option) => option.value === hitFilter)?.label}` : null,
    returnFilter !== 'all'
      ? `수익률 ${RETURN_FILTER_OPTIONS.find((option) => option.value === returnFilter)?.label}`
      : null,
  ].filter((filter): filter is string => Boolean(filter));
  const handleColumnSort = (key: ColumnSortKey) => {
    setColumnSort((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: defaultDirectionForColumn(key) };
    });
    setPage(0);
  };

  return (
    <DataPanel
      title="리포트 테이블"
      subtitle={`전체 리포트 기준 · ${sortedRows.length.toLocaleString('ko-KR')}건`}
      search={{
        value: query,
        onChange: (value) => {
          setQuery(value);
          setPage(0);
        },
        placeholder: '종목 또는 리포트 검색',
        ariaLabel: '리포트 검색',
      }}
      actions={<CsvDownloadButton disabled={sortedRows.length === 0} onClick={() => downloadReports(sortedRows)} />}
      toolbar={
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ToolbarField label="정렬">
              <SelectMenu
                ariaLabel="정렬"
                className="w-40"
                onValueChange={(value) => {
                  setSort(value);
                  setColumnSort(null);
                  setPage(0);
                }}
                options={SORT_OPTIONS}
                value={sort}
              />
            </ToolbarField>
            <ToolbarField label="컬럼">
              <SegmentedControl
                ariaLabel="컬럼 보기"
                onValueChange={(value) => {
                  setColumnMode(value);
                  setColumnSort(null);
                }}
                options={COLUMN_OPTIONS}
                value={columnMode}
              />
            </ToolbarField>
            <button
              type="button"
              aria-expanded={filtersOpen}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-white hover:text-slate-950"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              필터
              {activeFilterCount > 0 ? (
                <span className="font-mono text-[10px] text-slate-400 tabular-nums">{activeFilterCount}</span>
              ) : null}
            </button>
          </div>
          {filtersOpen || activeFilterCount > 0 ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
              <span className="px-1 text-xs font-semibold text-slate-500">필터 조건</span>
              <SelectMenu
                ariaLabel="목표 도달"
                className="w-36"
                onValueChange={(value) => {
                  setHitFilter(value);
                  setPage(0);
                }}
                options={HIT_FILTER_OPTIONS}
                value={hitFilter}
              />
              <SelectMenu
                ariaLabel="수익률 방향"
                className="w-32"
                onValueChange={(value) => {
                  setReturnFilter(value);
                  setPage(0);
                }}
                options={RETURN_FILTER_OPTIONS}
                value={returnFilter}
              />
            </div>
          ) : null}
        </div>
      }
      pagination={{
        page: safePage,
        pageCount,
        totalRows: sortedRows.length,
        pageSize: PAGE_SIZE,
        onPageChange: setPage,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700">현재 보기</span>
        <span className="font-mono tabular-nums">
          {visibleStart.toLocaleString('ko-KR')}-{visibleEnd.toLocaleString('ko-KR')} / {filteredTotalLabel}
        </span>
        <span>페이지 {`${safePage + 1}/${pageCount}`}</span>
        <span>정렬 {activeSortLabel}</span>
        <span>{appliedFilters.length > 0 ? appliedFilters.join(' · ') : '필터 없음'}</span>
      </div>
      {focusedReport ? (
        <FocusedReportSummary report={focusedReport} market={marketRowsBySymbol.get(focusedReport.symbol)} />
      ) : null}
      <table className="w-full table-fixed border-collapse text-xs">
        <ReportTableColGroup columnMode={columnMode} />
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <Th columnSort={columnSort} onSort={handleColumnSort} sortKey="company">
              종목
            </Th>
            <Th columnSort={columnSort} onSort={handleColumnSort} sortKey="publicationDate">
              발간일
            </Th>
            {columnMode !== 'core' ? (
              <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="entryPriceNative">
                진입가
              </Th>
            ) : null}
            <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="lastCloseNative">
              현재가
            </Th>
            {columnMode !== 'core' ? (
              <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="targetPriceNative">
                목표가
              </Th>
            ) : null}
            {columnMode !== 'core' ? (
              <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="targetUpsideAtPub">
                업사이드
              </Th>
            ) : null}
            <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="currentReturn">
              현재 수익률
            </Th>
            <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="ytdReturn">
              YTD
            </Th>
            <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="return1y">
              1년
            </Th>
            <Th>1년 차트</Th>
            <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="distanceFrom52wHigh">
              52주 고점
            </Th>
            <Th className="text-center" columnSort={columnSort} onSort={handleColumnSort} sortKey="maTrend">
              이평선
            </Th>
            <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="targetProgressPct">
              <span title="발간가에서 목표가까지의 경로 중 현재가가 어디까지 움직였는지 표시합니다.">진행률</span>
            </Th>
            {columnMode === 'all' ? (
              <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="peakReturn">
                고점
              </Th>
            ) : null}
            {columnMode === 'all' ? (
              <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="troughReturn">
                저점
              </Th>
            ) : null}
            {columnMode === 'all' ? (
              <Th className="text-right" columnSort={columnSort} onSort={handleColumnSort} sortKey="daysToTarget">
                도달일
              </Th>
            ) : null}
            <Th columnSort={columnSort} onSort={handleColumnSort} sortKey="status">
              상태
            </Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {visibleRows.length > 0 ? (
            visibleRows.map((report) => {
              const market = marketRowsBySymbol.get(report.symbol);
              const href = `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`;
              return (
                <tr
                  key={report.reportId}
                  aria-label={`${report.company || report.symbol} 리포트 보기`}
                  className={`cursor-pointer bg-white transition-colors hover:bg-slate-50 focus-within:bg-slate-50 ${
                    focusedReport?.reportId === report.reportId ? 'bg-slate-50' : ''
                  }`}
                  onFocus={() => setFocusedReportId(report.reportId)}
                  onClick={() => router.push(href)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      router.push(href);
                    }
                  }}
                  onMouseEnter={() => setFocusedReportId(report.reportId)}
                  role="link"
                  tabIndex={0}
                >
                  <Td>
                    <div className="truncate font-semibold text-slate-950">{reportIdentity(report)}</div>
                  </Td>
                  <Td className="font-mono text-[11px] text-slate-600">{formatDateKo(report.publicationDate)}</Td>
                  {columnMode !== 'core' ? (
                    <Td className="text-right">
                      <Money
                        bold
                        currency={report.currency}
                        krw={report.entryPriceKrw}
                        native={report.entryPriceNative}
                        showSecondary={columnMode === 'all'}
                      />
                    </Td>
                  ) : null}
                  <Td className="text-right">
                    <Money
                      currency={report.currency}
                      krw={report.lastCloseKrw}
                      native={report.lastCloseNative}
                      showSecondary={columnMode === 'all'}
                    />
                  </Td>
                  {columnMode !== 'core' ? (
                    <Td className="text-right">
                      <Money
                        currency={report.currency}
                        krw={report.targetPriceKrw}
                        native={report.targetPriceNative}
                        showSecondary={columnMode === 'all'}
                      />
                    </Td>
                  ) : null}
                  {columnMode !== 'core' ? <PercentCell heat value={report.targetUpsideAtPub} /> : null}
                  <PercentCell heat value={report.currentReturn} />
                  <PercentCell heat value={market?.ytdReturn ?? null} />
                  <PercentCell heat value={market?.return1y ?? null} />
                  <Td>
                    <Sparkline values={market?.sparkline ?? []} />
                  </Td>
                  <Td>
                    <HighGapCell value={market?.distanceFrom52wHigh ?? null} />
                  </Td>
                  <Td>
                    <MovingAverageCell
                      above20ma={market?.above20ma ?? null}
                      above50ma={market?.above50ma ?? null}
                      above200ma={market?.above200ma ?? null}
                    />
                  </Td>
                  <Td>
                    <ProgressCell value={report.targetProgressPct} />
                  </Td>
                  {columnMode === 'all' ? <PercentCell heat value={report.peakReturn} /> : null}
                  {columnMode === 'all' ? <PercentCell heat value={report.troughReturn} /> : null}
                  {columnMode === 'all' ? (
                    <Td className="text-right font-mono text-[11px] text-slate-600">
                      {formatDays(report.daysToTarget)}
                    </Td>
                  ) : null}
                  <Td>
                    <StatusBadge report={report} label={displayRowsById.get(report.reportId)?.statusLabel} />
                  </Td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={colSpan}>
                <EmptyTableState
                  actionLabel="필터 초기화"
                  message="조건에 맞는 리포트가 없습니다."
                  onAction={() => {
                    setQuery('');
                    setHitFilter('all');
                    setReturnFilter('all');
                    setPage(0);
                  }}
                />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </DataPanel>
  );
}

function ToolbarField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function ReportTableColGroup({ columnMode }: { columnMode: ColumnMode }) {
  const widths =
    columnMode === 'core'
      ? ['14%', '7%', '8%', '9%', '7%', '7%', '9%', '9%', '10%', '12%', '8%']
      : columnMode === 'price'
        ? ['12%', '6%', '6.5%', '6.5%', '6.5%', '6.5%', '7.5%', '6%', '6%', '7.5%', '7.5%', '8%', '8%', '5.5%']
        : [
            '10.5%',
            '5.5%',
            '5.5%',
            '5.5%',
            '5.5%',
            '5.8%',
            '6.5%',
            '5.5%',
            '5.5%',
            '6.5%',
            '6.5%',
            '7%',
            '7%',
            '5%',
            '5%',
            '5%',
            '4.2%',
          ];
  return (
    <colgroup>
      {widths.map((width, index) => (
        <col key={`${columnMode}-${index}`} style={{ width }} />
      ))}
    </colgroup>
  );
}

function Th({
  children,
  className = '',
  columnSort,
  onSort,
  sortKey,
}: {
  children: ReactNode;
  className?: string;
  columnSort?: ColumnSortState | null;
  onSort?: (key: ColumnSortKey) => void;
  sortKey?: ColumnSortKey;
}) {
  const active = sortKey !== undefined && columnSort?.key === sortKey;
  const ariaSort = active ? (columnSort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const alignClass = className.includes('text-right')
    ? 'ml-auto justify-end'
    : className.includes('text-center')
      ? 'mx-auto justify-center'
      : '';
  if (!sortKey || !onSort) return <th className={`px-1.5 py-2 ${className}`}>{children}</th>;
  return (
    <th aria-sort={ariaSort} className={`px-1.5 py-2 ${className}`}>
      <button
        type="button"
        className={`group inline-flex max-w-full items-center gap-0.5 rounded px-1 py-0.5 text-inherit transition-colors hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 ${alignClass}`}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{children}</span>
        <span
          className={`font-mono text-[10px] transition-opacity ${
            active ? 'text-slate-950 opacity-100' : 'text-slate-300 opacity-0 group-hover:opacity-100'
          }`}
        >
          {active ? (columnSort.direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`min-w-0 overflow-hidden px-1.5 py-2 align-middle ${className}`}>{children}</td>;
}

function FocusedReportSummary({ report, market }: { report: ReportRow; market?: ReportBoardRow }) {
  return (
    <div className="grid gap-2 border-b border-slate-100 bg-white px-3 py-2 md:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,.7fr))] md:items-center">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-950">{reportIdentity(report)}</div>
        <div className="mt-0.5 truncate text-xs text-slate-500">
          {formatDateKo(report.publicationDate)} 발간 · row 클릭 시 원천 리포트로 이동
        </div>
      </div>
      <SummaryMetric label="현재 수익률" tone={report.currentReturn ?? 0} value={formatPercent(report.currentReturn)} />
      <SummaryMetric
        label="진행률"
        tone={report.targetProgressPct ?? 0}
        value={formatPercent(report.targetProgressPct)}
      />
      <SummaryMetric
        label="52주 고점"
        tone={market?.distanceFrom52wHigh ?? 0}
        value={formatPercent(market?.distanceFrom52wHigh)}
      />
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: number }) {
  return (
    <div className="min-w-0 text-right">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className={`truncate font-mono text-xs font-semibold tabular-nums ${signedTextClass(tone)}`}>{value}</div>
    </div>
  );
}

function reportIdentity(report: ReportRow): string {
  const symbol = stripMarketSuffix(report.symbol);
  const exchange = report.exchange.toUpperCase();
  const isKorea =
    exchange === 'KRX' || exchange === 'KOSDAQ' || report.symbol.endsWith('.KS') || report.symbol.endsWith('.KQ');
  if (isKorea) return report.company || symbol;

  const isUsMarket = exchange === 'NASDAQ' || exchange === 'NYSE' || exchange === 'AMEX' || exchange === 'NYSEARCA';
  if (isUsMarket) return symbol;

  const hasReadableLocalName = Array.from(report.company).some((char) => char.charCodeAt(0) > 127);
  return hasReadableLocalName ? report.company : symbol;
}

function stripMarketSuffix(symbol: string): string {
  return symbol.replace(/\.(KS|KQ|KONEX|T|HK|SS|SZ|AS|PA|SW)$/i, '');
}

function PercentCell({ value, heat = false }: { value: number | null; heat?: boolean }) {
  const heatClass = heat && value !== null ? (value >= 0 ? 'bg-emerald-100/80' : 'bg-rose-100/80') : '';
  return (
    <Td className="text-right">
      <span
        className={`inline-flex max-w-full justify-end rounded px-1 font-mono text-[11px] font-semibold tabular-nums ${signedTextClass(
          value,
        )} ${heatClass}`}
      >
        {formatPercent(value)}
      </span>
    </Td>
  );
}

function HighGapCell({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <EmptyNumeric />;
  const normalized = Math.max(0, Math.min(1, 1 + value));
  const color = value >= -0.1 ? 'bg-emerald-500' : value >= -0.25 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5">
      <div className="h-3 w-12 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(5, normalized * 100)}%` }} />
      </div>
      <span className="w-11 text-right font-mono text-[11px] font-semibold tabular-nums text-slate-700">
        {formatPercent(value)}
      </span>
    </div>
  );
}

function ProgressCell({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <EmptyNumeric />;
  const magnitude = Math.min(1, Math.abs(value));
  const positive = value >= 0;
  return (
    <div className="flex min-w-0 items-center justify-end gap-1.5">
      <div className="relative h-3 w-12 overflow-hidden rounded-full bg-slate-100">
        <div className="absolute left-1/2 top-0 h-full w-px bg-slate-300" />
        {positive ? (
          <div
            className="absolute left-1/2 top-0 h-full rounded-r-full bg-emerald-500"
            style={{ width: `${Math.max(4, magnitude * 50)}%` }}
          />
        ) : (
          <div
            className="absolute right-1/2 top-0 h-full rounded-l-full bg-rose-500"
            style={{ width: `${Math.max(4, magnitude * 50)}%` }}
          />
        )}
      </div>
      <span className={`w-11 text-right font-mono text-[11px] font-semibold tabular-nums ${signedTextClass(value)}`}>
        {formatPercent(value)}
      </span>
    </div>
  );
}

function EmptyNumeric() {
  return <div className="text-right font-mono text-[11px] text-slate-400">—</div>;
}

function StatusBadge({ report, label }: { report: ReportRow; label?: string }) {
  const text = label ?? (report.targetHit ? '도달' : report.expired ? '만료' : '진행 중');
  const className = report.targetHit
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : report.expired
      ? 'bg-slate-100 text-slate-500 ring-slate-200'
      : 'bg-blue-50 text-blue-700 ring-blue-200';
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${className}`}
    >
      {text}
    </span>
  );
}

function MovingAverageCell({
  above20ma,
  above50ma,
  above200ma,
}: {
  above20ma: boolean | null;
  above50ma: boolean | null;
  above200ma: boolean | null;
}) {
  const marks = [
    { label: '20', value: above20ma },
    { label: '50', value: above50ma },
    { label: '200', value: above200ma },
  ];
  if (marks.every((mark) => mark.value === null)) return <EmptyNumeric />;
  return (
    <div className="flex justify-end gap-1">
      {marks.map((mark) => (
        <span
          key={mark.label}
          className={`inline-flex h-5 min-w-6 items-center justify-center rounded-full px-1 font-mono text-[10px] tabular-nums ${
            mark.value === null
              ? 'bg-slate-50 text-slate-300 ring-1 ring-slate-100'
              : mark.value
                ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
                : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100'
          }`}
          title={`${mark.label}MA ${mark.value === null ? '데이터 없음' : mark.value ? '상회' : '하회'}`}
        >
          {mark.label}
        </span>
      ))}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const points = sparklinePoints(values, 72, 22);
  if (!points) return <span className="font-mono text-[11px] text-slate-400">—</span>;
  const first = values[0];
  const last = values.at(-1);
  const positive = first !== undefined && last !== undefined && last >= first;
  return (
    <svg className="h-6 w-[72px] overflow-visible" viewBox="0 0 72 22" role="img" aria-label="1년 가격 경로">
      <line x1={0} x2={72} y1={11} y2={11} stroke="#e2e8f0" strokeDasharray="2 2" strokeWidth={0.6} />
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

function sparklinePoints(values: number[], width: number, height: number): { line: string } | null {
  const clean = values.filter((value) => Number.isFinite(value));
  if (clean.length < 2) return null;
  const first = clean[0];
  if (!first || first === 0) return null;
  const padding = 2;
  const usableHeight = height - padding * 2;
  const midY = height / 2;
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

function defaultDirectionForColumn(key: ColumnSortKey): SortDirection {
  if (key === 'company' || key === 'daysToTarget') return 'asc';
  return 'desc';
}

function sortReports(
  rows: ReportRow[],
  sort: SortId,
  columnSort: ColumnSortState | null,
  marketRowsBySymbol: Map<string, ReportBoardRow>,
): ReportRow[] {
  return [...rows].sort((a, b) => {
    if (columnSort) {
      const result = compareSortValues(
        getColumnSortValue(a, columnSort.key, marketRowsBySymbol),
        getColumnSortValue(b, columnSort.key, marketRowsBySymbol),
        columnSort.direction,
      );
      if (result !== 0) return result;
      return b.publicationDate.localeCompare(a.publicationDate) || a.company.localeCompare(b.company, 'ko-KR');
    }
    if (sort === 'top-return') return compareNullable(b.currentReturn, a.currentReturn);
    if (sort === 'target-progress') return compareNullable(b.targetProgressPct, a.targetProgressPct);
    if (sort === 'near-target') return compareNullable(a.targetRemainingPct, b.targetRemainingPct);
    return b.publicationDate.localeCompare(a.publicationDate) || a.company.localeCompare(b.company, 'ko-KR');
  });
}

function getColumnSortValue(
  report: ReportRow,
  key: ColumnSortKey,
  marketRowsBySymbol: Map<string, ReportBoardRow>,
): string | number | boolean | null {
  const market = marketRowsBySymbol.get(report.symbol);
  if (key === 'company') return report.company || report.symbol;
  if (key === 'publicationDate') return report.publicationDate;
  if (key === 'entryPriceNative') return report.entryPriceNative;
  if (key === 'lastCloseNative') return report.lastCloseNative;
  if (key === 'targetPriceNative') return report.targetPriceNative;
  if (key === 'targetUpsideAtPub') return report.targetUpsideAtPub;
  if (key === 'currentReturn') return report.currentReturn;
  if (key === 'ytdReturn') return market?.ytdReturn ?? null;
  if (key === 'return1y') return market?.return1y ?? null;
  if (key === 'distanceFrom52wHigh') return market?.distanceFrom52wHigh ?? null;
  if (key === 'maTrend') return movingAverageScore(market);
  if (key === 'targetProgressPct') return report.targetProgressPct;
  if (key === 'peakReturn') return report.peakReturn;
  if (key === 'troughReturn') return report.troughReturn;
  if (key === 'daysToTarget') return report.daysToTarget;
  if (key === 'status') return report.targetHit ? 2 : report.expired ? 0 : 1;
  return null;
}

function compareSortValues(
  a: string | number | boolean | null,
  b: string | number | boolean | null,
  direction: SortDirection,
): number {
  const aMissing = a === null || a === undefined || (typeof a === 'number' && !Number.isFinite(a));
  const bMissing = b === null || b === undefined || (typeof b === 'number' && !Number.isFinite(b));
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;

  let result = 0;
  if (typeof a === 'string' && typeof b === 'string') {
    result = a.localeCompare(b, 'ko-KR');
  } else if (typeof a === 'boolean' || typeof b === 'boolean') {
    result = Number(a) - Number(b);
  } else {
    result = Number(a) - Number(b);
  }
  return direction === 'asc' ? result : -result;
}

function compareNullable(a: number | null | undefined, b: number | null | undefined): number {
  const aFinite = typeof a === 'number' && Number.isFinite(a);
  const bFinite = typeof b === 'number' && Number.isFinite(b);
  if (!aFinite && !bFinite) return 0;
  if (!aFinite) return 1;
  if (!bFinite) return -1;
  return a - b;
}

function downloadReports(rows: ReportRow[]) {
  downloadCsv(
    'reports.csv',
    ['symbol', 'company', 'publication_date', 'exchange', 'current_return', 'target_progress'],
    rows.map((report) => [
      report.symbol,
      report.company,
      report.publicationDate,
      report.exchange,
      report.currentReturn,
      report.targetProgressPct,
    ]),
  );
}

function movingAverageScore(market: ReportBoardRow | undefined): number | null {
  if (!market) return null;
  const values = [market.above20ma, market.above50ma, market.above200ma].filter((value) => value !== null);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + (value ? 1 : 0), 0);
}
