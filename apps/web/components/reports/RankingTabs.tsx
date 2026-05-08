'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { Tabs, type Tab } from '@/components/ui/Tabs';
import type { ReportRow } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';
import { formatAssetPrice } from '@/lib/report-view-model';

type Props = { reports: ReportRow[] };

type Column =
  | { id: 'currentReturn'; label: string }
  | { id: 'targetUpsideAtPub'; label: string }
  | { id: 'targetGapPct'; label: string }
  | { id: 'daysToTarget'; label: string }
  | { id: 'caveatFlags'; label: string };

type Ranking = {
  id: string;
  label: string;
  caption: string;
  rows: ReportRow[];
  metric: Column;
};

export function RankingTabs({ reports }: Props) {
  const rankings = useMemo<Ranking[]>(() => {
    const recent = [...reports].sort((a, b) => b.publicationDate.localeCompare(a.publicationDate)).slice(0, 8);
    const targetHits = reports
      .filter((report) => report.targetHit)
      .sort((a, b) => (a.daysToTarget ?? Number.POSITIVE_INFINITY) - (b.daysToTarget ?? Number.POSITIVE_INFINITY))
      .slice(0, 8);
    const topReturns = reports
      .filter((report) => report.currentReturn !== null)
      .sort((a, b) => (b.currentReturn ?? -Infinity) - (a.currentReturn ?? -Infinity))
      .slice(0, 8);
    const targetGaps = reports
      .filter((report) => !report.targetHit && report.targetGapPct !== null && (report.targetUpsideAtPub ?? 0) > 0)
      .sort((a, b) => (b.targetGapPct ?? -Infinity) - (a.targetGapPct ?? -Infinity))
      .slice(0, 8);
    const flagged = reports
      .filter((report) => report.caveatFlags.length > 0)
      .sort((a, b) => b.caveatFlags.length - a.caveatFlags.length)
      .slice(0, 8);
    return [
      { id: 'recent', label: '최근 발간', caption: '가장 최근에 발간된 SMIC 리포트입니다.', rows: recent, metric: { id: 'currentReturn', label: '현재 수익률' } },
      { id: 'target-hit', label: '목표 도달', caption: '제시 목표가에 도달한 리포트와 도달 소요일입니다.', rows: targetHits, metric: { id: 'daysToTarget', label: '도달 소요일' } },
      { id: 'top-returns', label: '현재 수익 상위', caption: '오늘 기준 현재 수익률이 높은 리포트입니다.', rows: topReturns, metric: { id: 'currentReturn', label: '현재 수익률' } },
      { id: 'target-gaps', label: '목표가 괴리', caption: '아직 목표가에 도달하지 않은 리포트 중 잔여 업사이드가 큰 순서입니다.', rows: targetGaps, metric: { id: 'targetGapPct', label: '잔여 업사이드' } },
      { id: 'risk', label: '리스크 플래그', caption: '데이터 추출이나 시뮬레이션 신뢰도에 주의가 필요한 리포트입니다.', rows: flagged, metric: { id: 'caveatFlags', label: '플래그' } },
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
  if (ranking.rows.length === 0) {
    return <p className="rounded-md border border-base-300 bg-base-100 p-5 text-sm text-base-content/65">{ranking.caption} 현재 표시할 항목이 없습니다.</p>;
  }
  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-1 p-5 pb-3">
        <p className="text-sm text-base-content/65">{ranking.caption}</p>
      </div>
      <div className="overflow-x-auto border-t border-base-300">
        <table className="table table-sm table-zebra">
          <thead>
            <tr>
              <th>회사</th>
              <th>발간일</th>
              <th className="text-right">목표가</th>
              <th className="text-right">{ranking.metric.label}</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {ranking.rows.map((report) => (
              <tr key={report.reportId}>
                <td>
                  <Link className="link link-hover font-bold" href={`/reports/${report.symbol}`}>
                    {report.company || report.symbol}
                  </Link>
                  <div className="mt-1 font-mono text-xs text-base-content/50">
                    {report.symbol}{report.exchange ? ` · ${report.exchange}` : ''}
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
    </article>
  );
}

function renderMetric(column: Column, report: ReportRow): ReactNode {
  switch (column.id) {
    case 'currentReturn': {
      const value = report.currentReturn;
      return <span className={`font-bold ${(value ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{formatPercent(value)}</span>;
    }
    case 'targetUpsideAtPub':
      return <span className="font-bold text-primary">{formatPercent(report.targetUpsideAtPub)}</span>;
    case 'targetGapPct': {
      const value = report.targetGapPct;
      return <span className="font-bold text-primary">{formatPercent(value)}</span>;
    }
    case 'daysToTarget':
      return <span className="font-bold text-success">{formatDays(report.daysToTarget)}</span>;
    case 'caveatFlags':
      return (
        <div className="flex flex-wrap justify-end gap-1">
          {report.caveatFlags.map((flag) => (
            <span key={flag} className="badge badge-warning badge-soft badge-sm">{flag}</span>
          ))}
        </div>
      );
  }
}

function renderStatus(report: ReportRow): ReactNode {
  if (report.targetDirection === 'downside') {
    return report.targetHit
      ? <span className="badge badge-success badge-soft badge-sm">매도 적중</span>
      : <span className="badge badge-warning badge-soft badge-sm">매도 의견</span>;
  }
  if ((report.targetUpsideAtPub ?? 0) <= 0) {
    return <span className="badge badge-warning badge-soft badge-sm">비실행</span>;
  }
  if (report.targetHit) {
    return <span className="badge badge-success badge-soft badge-sm">도달 · {formatDays(report.daysToTarget)}</span>;
  }
  return <span className="badge badge-primary badge-soft badge-sm">진행</span>;
}
