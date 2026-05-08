'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { BlockPagination } from '@/components/trading/TableControls';
import { Tabs, type Tab } from '@/components/ui/Tabs';
import type { ReportRow } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';
import { formatAssetPrice } from '@/lib/report-view-model';

type Props = { reports: ReportRow[] };

type MetricId = 'currentReturn' | 'targetUpsideAtPub' | 'targetRemainingPct' | 'daysToTarget' | 'caveatFlags';

type Column = { id: MetricId; label: string };

type Ranking = {
  id: string;
  label: string;
  caption: string;
  rows: ReportRow[];
  metric: Column;
};

type SortColumn = 'company' | 'publicationDate' | 'targetPriceNative' | 'metric';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export function RankingTabs({ reports }: Props) {
  const rankings = useMemo<Ranking[]>(() => {
    const recent = [...reports].sort((a, b) => b.publicationDate.localeCompare(a.publicationDate));
    const targetHits = reports
      .filter((report) => report.targetHit)
      .sort((a, b) => (a.daysToTarget ?? Number.POSITIVE_INFINITY) - (b.daysToTarget ?? Number.POSITIVE_INFINITY));
    const topReturns = reports
      .filter((report) => report.currentReturn !== null)
      .sort((a, b) => (b.currentReturn ?? -Infinity) - (a.currentReturn ?? -Infinity));
    // 목표 도달까지 남은 변화율이 적은 순서 — 즉, "거의 도달" 리포트가 먼저.
    const targetGaps = reports
      .filter(
        (report) =>
          !report.targetHit &&
          !report.expired &&
          report.targetRemainingPct !== null &&
          (report.targetUpsideAtPub ?? 0) > 0,
      )
      .sort((a, b) => (a.targetRemainingPct ?? Infinity) - (b.targetRemainingPct ?? Infinity));
    const flagged = reports
      .filter((report) => report.caveatFlags.length > 0)
      .sort((a, b) => b.caveatFlags.length - a.caveatFlags.length);
    return [
      {
        id: 'recent',
        label: '최근 발간',
        caption: '가장 최근에 발간된 SMIC 리포트입니다.',
        rows: recent,
        metric: { id: 'currentReturn', label: '현재 수익률' },
      },
      {
        id: 'target-hit',
        label: '목표 도달',
        caption: '제시 목표가에 도달한 리포트와 도달 소요일입니다.',
        rows: targetHits,
        metric: { id: 'daysToTarget', label: '도달 소요일' },
      },
      {
        id: 'top-returns',
        label: '현재 수익 상위',
        caption: '오늘 기준 현재 수익률이 높은 리포트입니다.',
        rows: topReturns,
        metric: { id: 'currentReturn', label: '현재 수익률' },
      },
      {
        id: 'target-gaps',
        label: '도달까지 거리',
        caption: '아직 목표가에 도달하지 않은 진행 리포트 중 추가 변화율이 적은 (가까운) 순서입니다.',
        rows: targetGaps,
        metric: { id: 'targetRemainingPct', label: '추가 변화율' },
      },
      {
        id: 'risk',
        label: '리스크 플래그',
        caption: '데이터 추출이나 시뮬레이션 신뢰도에 주의가 필요한 리포트입니다.',
        rows: flagged,
        metric: { id: 'caveatFlags', label: '플래그' },
      },
    ];
  }, [reports]);

  const tabs: Tab[] = rankings.map((ranking) => ({
    id: ranking.id,
    label: ranking.label,
    meta: ranking.rows.length ? `${ranking.rows.length}` : undefined,
    content: <RankingTable ranking={ranking} />,
  }));

  return <Tabs tabs={tabs} defaultTabId="recent" />;
}

function RankingTable({ ranking }: { ranking: Ranking }) {
  const [sortBy, setSortBy] = useState<SortColumn>(ranking.id === 'recent' ? 'publicationDate' : 'metric');
  const [sortDir, setSortDir] = useState<SortDir>(ranking.id === 'target-gaps' ? 'asc' : 'desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  const sorted = useMemo(() => {
    const rows = [...ranking.rows];
    rows.sort((a, b) => {
      const aValue = sortValueFor(a, sortBy, ranking.metric);
      const bValue = sortValueFor(b, sortBy, ranking.metric);
      let primary = 0;
      if (aValue === null && bValue === null) primary = 0;
      else if (aValue === null) primary = 1;
      else if (bValue === null) primary = -1;
      else {
        primary =
          typeof aValue === 'string' && typeof bValue === 'string'
            ? aValue.localeCompare(bValue)
            : Number(aValue) - Number(bValue);
        primary = sortDir === 'asc' ? primary : -primary;
      }
      if (primary !== 0 || sortBy === 'publicationDate') return primary;
      // Tie-break: latest publication first.
      return b.publicationDate.localeCompare(a.publicationDate);
    });
    return rows;
  }, [ranking, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visible = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  if (ranking.rows.length === 0) {
    return (
      <p className="rounded-md border border-base-300 bg-base-100 p-5 text-sm text-base-content/65">
        {ranking.caption} 현재 표시할 항목이 없습니다.
      </p>
    );
  }

  const onSortClick = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir(column === 'metric' && ranking.id === 'target-gaps' ? 'asc' : 'desc');
    }
    setPage(0);
  };

  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-1 p-5 pb-3">
        <p className="text-sm text-base-content/65">{ranking.caption}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-base-300 bg-base-200/40 px-4 py-2 text-xs text-base-content/60">
        <span>
          {sorted.length.toLocaleString('ko-KR')}개 · 페이지 {safePage + 1} / {totalPages}
        </span>
        <label className="flex items-center gap-2">
          <span>페이지 크기</span>
          <select
            className="select select-xs select-bordered"
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
      <div className="overflow-x-auto">
        <table className="table table-sm table-zebra">
          <thead>
            <tr>
              <SortableTh active={sortBy === 'company'} dir={sortDir} onClick={() => onSortClick('company')}>
                회사
              </SortableTh>
              <SortableTh
                active={sortBy === 'publicationDate'}
                dir={sortDir}
                onClick={() => onSortClick('publicationDate')}
              >
                발간일
              </SortableTh>
              <SortableTh
                align="right"
                active={sortBy === 'targetPriceNative'}
                dir={sortDir}
                onClick={() => onSortClick('targetPriceNative')}
              >
                목표가
              </SortableTh>
              <SortableTh
                align="right"
                active={sortBy === 'metric'}
                dir={sortDir}
                onClick={() => onSortClick('metric')}
              >
                {ranking.metric.label}
              </SortableTh>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((report) => (
              <tr key={report.reportId}>
                <td>
                  <Link className="link link-hover font-bold" href={`/reports/${report.symbol}`}>
                    {report.company || report.symbol}
                  </Link>
                  <div className="mt-1 font-mono text-xs text-base-content/50">
                    {report.symbol}
                    {report.exchange ? ` · ${report.exchange}` : ''}
                  </div>
                </td>
                <td className="whitespace-nowrap">{report.publicationDate}</td>
                <td className="text-right tabular-nums">{formatAssetPrice(report.targetPriceNative, report)}</td>
                <td className="text-right tabular-nums">{renderMetric(ranking.metric, report)}</td>
                <td>{renderStatus(report)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-base-300 px-4 py-2">
        <span className="text-xs text-base-content/55">
          {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} / {sorted.length}
        </span>
        <BlockPagination page={safePage} pageCount={totalPages} onPageChange={setPage} />
      </div>
    </article>
  );
}

function sortValueFor(report: ReportRow, column: SortColumn, metric: Column): number | string | null {
  switch (column) {
    case 'company':
      return report.company || report.symbol;
    case 'publicationDate':
      return report.publicationDate;
    case 'targetPriceNative':
      return report.targetPriceNative ?? report.targetPriceKrw;
    case 'metric': {
      switch (metric.id) {
        case 'currentReturn':
          return report.currentReturn;
        case 'targetUpsideAtPub':
          return report.targetUpsideAtPub;
        case 'targetRemainingPct':
          return report.targetRemainingPct;
        case 'daysToTarget':
          return report.daysToTarget;
        case 'caveatFlags':
          return report.caveatFlags.length;
      }
    }
  }
}

type SortableThProps = {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: 'left' | 'right';
  children: ReactNode;
};

function SortableTh({ active, dir, onClick, align = 'left', children }: SortableThProps) {
  return (
    <th className={align === 'right' ? 'text-right' : ''}>
      <button type="button" className="link-hover inline-flex items-center gap-1 font-semibold" onClick={onClick}>
        {children}
        <span className="text-xs text-base-content/40">{active ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </th>
  );
}

function renderMetric(column: Column, report: ReportRow): ReactNode {
  switch (column.id) {
    case 'currentReturn': {
      const value = report.currentReturn;
      return (
        <span className={`font-bold ${(value ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{formatPercent(value)}</span>
      );
    }
    case 'targetUpsideAtPub':
      return <span className="font-bold text-primary">{formatPercent(report.targetUpsideAtPub)}</span>;
    case 'targetRemainingPct': {
      const value = report.targetRemainingPct;
      if (value === null) return '—';
      return <span className="font-bold text-primary">+{formatPercent(value)}</span>;
    }
    case 'daysToTarget':
      return <span className="font-bold text-success">{formatDays(report.daysToTarget)}</span>;
    case 'caveatFlags':
      return (
        <div className="flex flex-wrap justify-end gap-1">
          {report.caveatFlags.map((flag) => (
            <span key={flag} className="badge badge-warning badge-soft badge-sm">
              {flag}
            </span>
          ))}
        </div>
      );
  }
}

function renderStatus(report: ReportRow): ReactNode {
  if (report.targetDirection === 'downside') {
    if (report.targetHit) return <span className="badge badge-success badge-soft badge-sm">매도 적중</span>;
    if (report.expired) return <span className="badge badge-error badge-soft badge-sm">매도 만료</span>;
    return <span className="badge badge-warning badge-soft badge-sm">매도 의견</span>;
  }
  if ((report.targetUpsideAtPub ?? 0) <= 0) {
    return <span className="badge badge-warning badge-soft badge-sm">비실행</span>;
  }
  if (report.targetHit) {
    return <span className="badge badge-success badge-soft badge-sm">도달 · {formatDays(report.daysToTarget)}</span>;
  }
  if (report.expired) {
    return <span className="badge badge-error badge-soft badge-sm">만료</span>;
  }
  return <span className="badge badge-primary badge-soft badge-sm">진행</span>;
}
