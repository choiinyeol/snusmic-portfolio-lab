import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ReportsTable } from '@/components/reports/ReportsTable';
import { Button } from '@/components/ui/button';
import { getArtifactHealth, getCurrentHoldings, getSummaryRows } from '@/lib/artifacts';
import { getDashboardViewModel } from '@/lib/dashboard-view-model';
import { formatDateKo, formatKrw, formatPercent } from '@/lib/format';
import { displayPortfolioName } from '@/lib/portfolio-labels';
import { getReportBoardViewModel } from '@/lib/view-models/report-board';

export default function OverviewPage() {
  const board = getReportBoardViewModel();
  const view = getDashboardViewModel();
  const health = getArtifactHealth();
  const selected = view.selectedAccountRow;
  const benchmarkToBeat = view.benchmarkToBeat;
  const benchmarkExcess =
    selected?.benchmarkExcess ??
    (selected?.id === benchmarkToBeat?.id
      ? 0
      : selected?.returnPct != null && benchmarkToBeat?.returnPct != null
        ? selected.returnPct - benchmarkToBeat.returnPct
        : null);
  const summaryRow = selected ? getSummaryRows().find((row) => row.account_id === selected.id) : null;
  const holdingsCount = selected ? getCurrentHoldings().filter((row) => row.account_id === selected.id).length : 0;
  const attentionRows = (board.priorityRows.length ? board.priorityRows : board.candidateRows).slice(0, 10);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
      <div className="grid gap-4">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Board</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">오늘 먼저 볼 리포트</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                최신 가격 기준으로 아직 열어봐야 할 리포트와 대표 계좌 한 권만 빠르게 확인합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default">
                <Link href="/reports">
                  Reports <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/portfolio">Portfolio</Link>
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-slate-500">
            <span>{health.as_of.price_date ? `price ${formatDateKo(health.as_of.price_date)}` : 'price -'}</span>
            <span>{health.as_of.report_date ? `report ${formatDateKo(health.as_of.report_date)}` : 'report -'}</span>
            <span>후보 {board.candidateRows.length.toLocaleString('ko-KR')}건</span>
            <span>전체 {board.reportTable.rows.length.toLocaleString('ko-KR')}건</span>
          </div>
        </section>

        <ReportsTable
          rows={attentionRows}
          subtitle="같은 기준의 리포트 원장에서 지금 먼저 확인할 후보"
          title="Attention ledger"
        />
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Primary book</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">대표 계좌 snapshot</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              오늘 리포트 확인 뒤 바로 비교할 기준 계좌 한 권만 붙여 둡니다.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">Portfolio</Link>
          </Button>
        </div>

        {selected ? (
          <div className="mt-4 grid gap-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <Link className="block min-w-0 hover:text-slate-950" href={selected.href}>
                <div className="truncate text-sm font-semibold text-slate-950">
                  {displayPortfolioName(selected.id, selected.shortLabel)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {selected.objectivePassed ? '현재 shortlist 통과' : '비교 기준'} · 거래{' '}
                  {selected.tradeCount?.toLocaleString('ko-KR') ?? '-'}건
                </div>
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <PrimaryBookStat label="수익률" tone={selected.returnPct} value={formatPercent(selected.returnPct)} />
              <PrimaryBookStat
                label="KODEX 대비"
                tone={benchmarkExcess}
                value={formatNullablePercent(benchmarkExcess)}
              />
              <PrimaryBookStat label="MDD" tone={selected.maxDrawdown} value={formatPercent(selected.maxDrawdown)} />
              <PrimaryBookStat label="평가액" value={formatKrw(summaryRow?.finalEquityKrw)} />
              <PrimaryBookStat label="보유" value={`${holdingsCount.toLocaleString('ko-KR')}종목`} />
              <PrimaryBookStat label="판정" value={selected.objectivePassed ? '통과' : '비교용'} />
            </dl>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-slate-200 px-3 py-6 text-sm text-slate-500">
            대표 계좌 snapshot이 아직 준비되지 않았습니다.
          </div>
        )}

        <p className="mt-4 text-xs text-slate-500">
          정적 export 기준 화면입니다. 리포트·가격·계좌 기록은 같은 기준일로 맞춰졌지만 실시간 데이터는 아닙니다.
        </p>
      </section>
    </div>
  );
}

function PrimaryBookStat({ label, value, tone }: { label: string; value: string; tone?: number | null }) {
  return (
    <div className="rounded-md border border-slate-200 px-3 py-2">
      <dt className="text-[11px] font-medium text-slate-500">{label}</dt>
      <dd className={`font-mono text-sm font-semibold tabular-nums ${signedToneClass(tone)}`}>{value}</dd>
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
