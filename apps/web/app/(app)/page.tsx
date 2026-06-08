import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { displayPortfolioName } from '@/components/trading/portfolio-views/strategy-display';
import { getArtifactHealth, getCurrentHoldings, getSummaryRows } from '@/lib/artifacts';
import { getDashboardViewModel, type DashboardViewModel } from '@/lib/dashboard-view-model';
import { formatDateKo, formatKrw, formatPercent } from '@/lib/format';
type Candidate = DashboardViewModel['overview']['researchCandidates'][number];

export default function OverviewPage() {
  const view = getDashboardViewModel();
  const health = getArtifactHealth();
  const { overview, benchmarkToBeat } = view;
  const reportStats = overview.reportStats;
  const selected = view.selectedAccountRow;
  const benchmarkExcess =
    selected?.benchmarkExcess ??
    (selected?.id === benchmarkToBeat?.id
      ? 0
      : selected?.returnPct != null && benchmarkToBeat?.returnPct != null
        ? selected.returnPct - benchmarkToBeat.returnPct
        : null);
  const priorityReports = overview.researchCandidates.slice(0, 8);
  const summaries = new Map(getSummaryRows().map((row) => [row.account_id, row]));
  const holdingsCount = getCurrentHoldings().reduce(
    (acc, row) => acc.set(row.account_id, (acc.get(row.account_id) ?? 0) + 1),
    new Map<string, number>(),
  );
  const accountRows = [...view.selectableRows]
    .sort((a, b) => {
      const left = Number(a.objectivePassed) - Number(b.objectivePassed);
      const right = (b.returnPct ?? Number.NEGATIVE_INFINITY) - (a.returnPct ?? Number.NEGATIVE_INFINITY);
      return left !== 0 ? -left : right;
    })
    .slice(0, 8);

  return (
    <div className="grid gap-5">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">오늘 먼저 볼 항목</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              최신 기준일에 맞춘 리포트 결과와 선별 계좌만 빠르게 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default">
              <Link href="/reports">
                리포트 보기 <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/portfolio">포트폴리오 보기</Link>
            </Button>
          </div>
        </div>
        <p className="mt-3 font-mono text-xs text-slate-500">
          static snapshot · report {health.as_of.report_date ? formatDateKo(health.as_of.report_date) : '-'} · price{' '}
          {health.as_of.price_date ? formatDateKo(health.as_of.price_date) : '-'}
        </p>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">데이터 스냅샷</h2>
          <p className="mt-1 text-xs text-slate-500">지금 snapshot이 어느 정도 신뢰할 만한지 먼저 확인합니다.</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 xl:grid-cols-6">
          <SnapshotStat label="공개 리포트" value={view.priceMatchedReports.toLocaleString('ko-KR')} />
          <SnapshotStat label="목표 도달률" value={formatPercent(reportStats.targetHitRate)} />
          <SnapshotStat label="평균 현재 수익률" value={formatPercent(reportStats.averageCurrentReturn)} />
          <SnapshotStat label="중간 현재 수익률" value={formatPercent(reportStats.medianCurrentReturn)} />
          <SnapshotStat label="대표 계좌 수익률" value={formatPercent(selected?.returnPct)} />
          <SnapshotStat label="KODEX 대비" value={formatNullablePercent(benchmarkExcess)} />
        </dl>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">우선 확인할 리포트</h2>
            <p className="mt-1 text-xs text-slate-500">
              현재 후보와 최근 리포트 중 먼저 열어볼 만한 항목만 앞에 둡니다.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/reports">전체 테이블</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-0 py-2">리포트</th>
                <th className="px-3 py-2">발간일</th>
                <th className="px-3 py-2 text-right">현재 수익률</th>
                <th className="px-3 py-2 text-right">목표 도달률</th>
                <th className="px-3 py-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {priorityReports.length ? (
                priorityReports.map((candidate) => {
                  const report = candidate.report;
                  return (
                    <tr className="border-b border-slate-100 last:border-b-0" key={report.reportId}>
                      <td className="px-0 py-2.5">
                        <Link
                          className="block min-w-0 hover:text-slate-950"
                          href={`/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`}
                        >
                          <div className="truncate font-medium text-slate-900">{report.company}</div>
                          <div className="truncate font-mono text-xs text-slate-500">{report.symbol}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-500">
                        {formatDateKo(report.publicationDate)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${signedToneClass(report.currentReturn)}`}
                      >
                        {formatPercent(report.currentReturn)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {formatPercent(report.targetProgressPct)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{bucketLabel(candidate.bucket)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-0 py-6 text-sm text-slate-500" colSpan={5}>
                    우선순위 리포트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">대표 계좌 비교</h2>
            <p className="mt-1 text-xs text-slate-500">
              지금 product shortlist에서 무엇이 살아남았는지 한 줄씩 비교합니다.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">계좌 원장</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                <th className="px-0 py-2">계좌</th>
                <th className="px-3 py-2 text-right">수익률</th>
                <th className="px-3 py-2 text-right">KODEX 대비</th>
                <th className="px-3 py-2 text-right">MDD</th>
                <th className="px-3 py-2 text-right">평가액</th>
                <th className="px-3 py-2 text-right">보유</th>
              </tr>
            </thead>
            <tbody>
              {accountRows.map((row) => (
                <tr className="border-b border-slate-100 last:border-b-0" key={row.id}>
                  <td className="px-0 py-2.5">
                    <Link className="block min-w-0 hover:text-slate-950" href={row.href}>
                      <div className="truncate font-medium text-slate-900">
                        {displayPortfolioName(row.id, row.shortLabel)}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {row.objectivePassed ? '현재 통과' : '비교용'} ·{' '}
                        {row.tradeCount?.toLocaleString('ko-KR') ?? '-'}건
                      </div>
                    </Link>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${signedToneClass(row.returnPct)}`}>
                    {formatPercent(row.returnPct)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono tabular-nums ${signedToneClass(row.benchmarkExcess)}`}
                  >
                    {formatNullablePercent(row.benchmarkExcess)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {formatPercent(row.maxDrawdown)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-900">
                    {formatKrw(summaries.get(row.id)?.finalEquityKrw)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {(holdingsCount.get(row.id) ?? 0).toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        정적 artifact 기준 화면입니다. 리포트와 가격, 계좌 기록은 최신 기준일로 맞춰 export되지만 실시간 데이터는
        아닙니다.
      </p>
    </div>
  );
}

function SnapshotStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-mono text-sm font-semibold tabular-nums text-slate-950">{value}</dd>
    </div>
  );
}

function formatNullablePercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return formatPercent(value);
}

function signedToneClass(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'text-slate-700';
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-rose-600';
  return 'text-slate-700';
}
function bucketLabel(bucket: Candidate['bucket']): string {
  if (bucket === 'fresh') return '최근 리포트';
  if (bucket === 'large-upside') return '상승여력 큼';
  if (bucket === 'near-target') return '목표 근접';
  return '열린 케이스';
}
