import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getAlphaHypotheses,
  getArtifactHealth,
  getCurrentHoldings,
  getSummaryRows,
  getVerificationCases,
} from '@/lib/artifacts';
import { getDashboardViewModel } from '@/lib/dashboard-view-model';
import { formatDateKo, formatKrw, formatPercent } from '@/lib/format';
import { displayPortfolioName } from '@/lib/portfolio-labels';
import { getReportBoardViewModel } from '@/lib/view-models/report-board';

export default function OverviewPage() {
  const board = getReportBoardViewModel();
  const verificationCases = getVerificationCases();
  const alphaHypotheses = getAlphaHypotheses();
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
  const attentionRows = verificationCases.slice(0, 10);
  const eligibleCaseCount = verificationCases.filter((row) => row.eligibleForAlpha).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.95fr)]">
      <div className="grid gap-4">
        <section className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Verification</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">먼저 검증할 케이스</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                좋은 리포트가 아니라 좋은 증거를 먼저 봅니다. 검증 케이스에서 살아남은 규칙만 알파와 포트폴리오 proof로
                넘어갑니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="default">
                <Link href="/reports">
                  Reports <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/alpha">Alpha</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/portfolio">Portfolio Proof</Link>
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-slate-500">
            <span>{health.as_of.price_date ? `price ${formatDateKo(health.as_of.price_date)}` : 'price -'}</span>
            <span>{health.as_of.report_date ? `report ${formatDateKo(health.as_of.report_date)}` : 'report -'}</span>
            <span>검증 케이스 {verificationCases.length.toLocaleString('ko-KR')}건</span>
            <span>알파 후보 {alphaHypotheses.length.toLocaleString('ko-KR')}건</span>
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">VerificationCase board</h2>
                <p className="mt-1 text-xs text-slate-500">
                  downside-aware quality와 veto를 같이 보면서 어떤 리포트 주장이 살아남는지 먼저 정리합니다.
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/reports">원문 evidence</Link>
              </Button>
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <PrimaryBookStat label="검증 케이스" value={`${verificationCases.length.toLocaleString('ko-KR')}건`} />
              <PrimaryBookStat label="alpha 가능" value={`${eligibleCaseCount.toLocaleString('ko-KR')}건`} />
              <PrimaryBookStat label="리포트 후보" value={`${board.candidateRows.length.toLocaleString('ko-KR')}건`} />
              <PrimaryBookStat label="검증 규칙" value="drawdown + failure tail" />
            </dl>
          </div>
          <div className="overflow-x-auto px-4 py-2">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-0 py-2">케이스</th>
                  <th className="px-3 py-2 text-right">현재 수익률</th>
                  <th className="px-3 py-2 text-right">최대낙폭</th>
                  <th className="px-3 py-2">veto</th>
                  <th className="px-3 py-2">alpha 가능</th>
                </tr>
              </thead>
              <tbody>
                {attentionRows.length ? (
                  attentionRows.map((row) => (
                    <tr className="border-b border-slate-100 last:border-b-0" key={row.caseId}>
                      <td className="px-0 py-2.5">
                        <Link
                          className="block min-w-0 hover:text-slate-950"
                          href={`/reports/${encodeURIComponent(row.symbol)}/${encodeURIComponent(row.reportId)}`}
                        >
                          <div className="truncate font-medium text-slate-900">{row.company}</div>
                          <div className="truncate font-mono text-xs text-slate-500">
                            {row.symbol} · {formatDateKo(row.publicationDate)}
                          </div>
                        </Link>
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${signedToneClass(row.currentReturn)}`}
                      >
                        {formatPercent(row.currentReturn)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${signedToneClass(row.maxDrawdown)}`}
                      >
                        {formatPercent(row.maxDrawdown)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">
                        {row.vetoReasons.length ? row.vetoReasons.join(', ') : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{row.eligibleForAlpha ? 'yes' : 'no'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-0 py-6 text-sm text-slate-500" colSpan={5}>
                      검증 케이스 artifact가 아직 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Portfolio proof</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">대표 전략 snapshot</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              검증 케이스에서 올라온 규칙이 마지막에 어떤 전략 proof를 만들었는지 한 전략만 빠르게 봅니다.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">Portfolio Proof</Link>
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
                  {selected.objectivePassed ? '현재 shortlist 통과' : '비교 기준'} · 전략 trace{' '}
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
              <PrimaryBookStat label="포지션" value={`${holdingsCount.toLocaleString('ko-KR')}종목`} />
              <PrimaryBookStat label="proof 상태" value={selected.objectivePassed ? '통과' : '비교용'} />
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
