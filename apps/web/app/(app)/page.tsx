import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  FileSearch,
  Gauge,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import { PerformanceChartPanel } from '@/components/charts/PerformanceChartPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { displayPortfolioName, strategyMeta } from '@/components/trading/portfolio-views/strategy-display';
import { getArtifactHealth } from '@/lib/artifacts';
import { getDashboardViewModel, type DashboardViewModel } from '@/lib/dashboard-view-model';
import { formatDateKo, formatKrw, formatPercent } from '@/lib/format';

type Report = DashboardViewModel['reports'][number];
type Trade = DashboardViewModel['recentTrades'][number];
type Candidate = DashboardViewModel['overview']['researchCandidates'][number];
type HealthCheck = ReturnType<typeof getArtifactHealth>['checks'][number];

export default function OverviewPage() {
  const view = getDashboardViewModel();
  const health = getArtifactHealth();
  const { overview, selectedAccountRow, benchmarkToBeat } = view;
  const reportStats = overview.reportStats;
  const selectedLeaderboardRow = view.accountRows.find((row) => row.id === view.selectedAccount) ?? selectedAccountRow;
  const strategyName = displayPortfolioName(
    view.selectedAccount,
    selectedLeaderboardRow?.shortLabel || overview.portfolio.label,
  );
  const strategy = strategyMeta(view.selectedAccount);
  const benchmarkExcess =
    selectedLeaderboardRow?.benchmarkExcess ??
    (selectedLeaderboardRow?.id === benchmarkToBeat?.id
      ? 0
      : selectedLeaderboardRow?.returnPct != null && benchmarkToBeat?.returnPct != null
        ? selectedLeaderboardRow.returnPct - benchmarkToBeat.returnPct
        : null);
  const watchCandidates = overview.researchCandidates.slice(0, 4);
  const recentSignals = view.recentTrades.slice(0, 4);
  const priorityChecks = [...health.checks].sort((a, b) => healthRank(b.severity) - healthRank(a.severity)).slice(0, 4);

  return (
    <div className="grid gap-5">
      <PageHero
        title="SNUSMIC 운영 허브"
        subtitle="오늘 확인할 데이터 상태와 다음으로 열 화면을 정하는 출발점입니다."
        badges={[
          { label: '상태', value: healthStatusLabel(health.status) },
          { label: '가격', value: health.as_of.price_date ?? '기준일 없음' },
          { label: '대표 계좌', value: strategyName },
          { label: '역할', value: strategy.subtitle },
        ]}
        actions={
          <>
            <Button asChild size="sm" variant="default">
              <Link href="/reports">
                리포트 검증 열기 <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/portfolio">계좌 비교</Link>
            </Button>
          </>
        }
        kpis={
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <KpiTile
              compact
              icon={<ShieldCheck className="size-4" />}
              label="데이터 상태"
              value={healthStatusLabel(health.status)}
              delta={
                health.as_of.report_date ? `리포트 ${formatDateKo(health.as_of.report_date)}` : 'health artifact 기준'
              }
              tone={healthTone(health.status)}
            />
            <KpiTile
              compact
              icon={<FileSearch className="size-4" />}
              label="가격 매칭 리포트"
              value={`${view.priceMatchedReports.toLocaleString('ko-KR')} / ${view.sourceReports.toLocaleString('ko-KR')}`}
              delta={`${formatPercent(reportStats.targetHitRate)} · target hit`}
              tone="accent"
            />
            <KpiTile
              compact
              icon={<TrendingUp className="size-4" />}
              label="대표 계좌 수익률"
              value={formatPercent(selectedLeaderboardRow?.returnPct)}
              delta={strategyName}
              tone={(selectedLeaderboardRow?.returnPct ?? 0) >= 0 ? 'good' : 'warn'}
            />
            <KpiTile
              compact
              icon={<Gauge className="size-4" />}
              label="KODEX 대비"
              value={formatNullablePercent(benchmarkExcess)}
              delta={benchmarkToBeat?.shortLabel ? `${benchmarkToBeat.shortLabel} 기준` : '기준선 없음'}
              tone={(benchmarkExcess ?? 0) >= 0 ? 'good' : 'warn'}
            />
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-label="성과 경로와 이동 경로">
        <PerformanceChartPanel
          series={view.chartSeries}
          benchmarkCount={view.benchmarkRows.length}
          accountCount={view.accountRows.filter((row) => row.kind === 'account').length}
          objectiveLabel={`${strategyName}와 벤치마크 경로 비교`}
        />
        <nav className="grid content-start gap-3" aria-label="주요 작업 경로">
          <RouteCard
            icon={<FileSearch />}
            title="리포트 검증"
            description="전사된 리포트, 가격 매칭, target-hit evidence, 재검토 우선순위를 한 테이블에서 봅니다."
            metric={`${view.reports.length.toLocaleString('ko-KR')}개 visible report`}
            href="/reports"
          />
          <RouteCard
            icon={<WalletCards />}
            title="계좌 리포트"
            description="승인된 shortlist 계좌의 수익률, MDD, 보유·매매 원장을 비교합니다."
            metric={`${view.selectableRows.length.toLocaleString('ko-KR')}개 shortlist`}
            href="/portfolio"
          />
          <RouteCard
            icon={<BarChart3 />}
            title="성과 통계"
            description="표본 전체의 목표가 적중, 무반응, 집중도, 대표 가격 경로를 해석합니다."
            metric={reportStats.total ? `${reportStats.total.toLocaleString('ko-KR')}개 표본` : '표본 없음'}
            href="/statistics"
          />
          <RouteCard
            icon={<CalendarClock />}
            title="리포트 캘린더"
            description="특정 관찰일에 어떤 후보가 보였고 이후 어떤 가격 경로를 만들었는지 봅니다."
            metric={`${watchCandidates.length.toLocaleString('ko-KR')}개 현재 후보`}
            href="/calendar"
          />
        </nav>
      </section>

      <section className="grid gap-4 lg:grid-cols-3" aria-label="운영 점검 큐">
        <DiagnosticPanel title="데이터 점검" caption="배포 전 먼저 볼 health check">
          {priorityChecks.map((check) => (
            <HealthLine check={check} key={check.id} />
          ))}
        </DiagnosticPanel>
        <DiagnosticPanel title="최근 매매 신호" caption="선택 계좌에 실제 기록된 체결">
          {recentSignals.length ? (
            recentSignals.map((trade) => (
              <SignalLine key={`${trade.date}-${trade.symbol}-${trade.side}`} trade={trade} />
            ))
          ) : (
            <EmptyState label="최근 체결 신호가 없습니다." />
          )}
        </DiagnosticPanel>
        <DiagnosticPanel title="현재 리포트 후보" caption="다음 검토 우선순위">
          {watchCandidates.length ? (
            watchCandidates.map((candidate) => <CandidateLine candidate={candidate} key={candidate.report.reportId} />)
          ) : (
            <EmptyState label="현재 후보가 없습니다." />
          )}
        </DiagnosticPanel>
      </section>
    </div>
  );
}

function RouteCard({
  icon,
  title,
  description,
  metric,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  metric: string;
  href: string;
}) {
  return (
    <Link
      className="group grid gap-3 rounded-md border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700 [&_svg]:size-4">
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
            <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-slate-500">{metric}</p>
          </div>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition group-hover:text-slate-700" />
      </div>
      <p className="text-xs leading-5 text-slate-600">{description}</p>
    </Link>
  );
}

function DiagnosticPanel({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{caption}</p>
      </div>
      <div className="grid gap-2">{children}</div>
    </article>
  );
}

function HealthLine({ check }: { check: HealthCheck }) {
  return (
    <Link className="grid gap-1 rounded-md border border-slate-100 bg-slate-50/60 p-2.5 hover:bg-white" href="/reports">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium text-slate-950">{check.label}</span>
        <Badge variant={healthBadgeVariant(check.severity)}>{healthStatusLabel(check.severity)}</Badge>
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-slate-500">{check.action ?? check.detail}</p>
    </Link>
  );
}

function SignalLine({ trade }: { trade: Trade }) {
  const sell = trade.side === 'sell';
  return (
    <Link
      className="grid gap-1 rounded-md border border-slate-100 bg-slate-50/60 p-2.5 hover:bg-white"
      href={tradeHref(trade)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={sell ? 'warning' : 'success'}>{sell ? '매도' : '매수'}</Badge>
            <span className="font-mono text-xs text-slate-500">{formatDateKo(trade.date)}</span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-950">{companyLabel(trade)}</div>
        </div>
        <span
          className={`font-mono text-sm font-semibold tabular-nums ${sell ? 'text-amber-600' : 'text-emerald-600'}`}
        >
          {formatKrw(trade.grossKrw)}
        </span>
      </div>
      <p className="line-clamp-1 text-xs text-slate-500">{compactReason(trade)}</p>
    </Link>
  );
}

function CandidateLine({ candidate }: { candidate: Candidate }) {
  const report = candidate.report;
  return (
    <Link
      className="grid gap-1 rounded-md border border-slate-100 bg-slate-50/60 p-2.5 hover:bg-white"
      href={reportHref(report)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{report.company || report.symbol}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">
            {formatDateKo(report.publicationDate)} · {report.symbol}
          </div>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums text-blue-600">{candidate.score.toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
        <span>현재 {formatPercent(report.currentReturn)}</span>
        <span className="text-right">목표까지 {formatPercent(report.targetRemainingPct)}</span>
      </div>
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="grid min-h-24 place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {label}
    </div>
  );
}

function reportHref(report: Report): string {
  return `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`;
}

function tradeHref(trade: Trade): string {
  if (trade.reportId) return `/reports/${encodeURIComponent(trade.symbol)}/${encodeURIComponent(trade.reportId)}`;
  return `/portfolio/${encodeURIComponent(trade.account_id)}/trades`;
}

function companyLabel(row: { company?: string | null; symbol: string }): string {
  return row.company?.trim() ? row.company : row.symbol;
}

function compactReason(trade: Trade): string {
  if (trade.reasonDetail) return trade.reasonDetail;
  if (trade.reason === 'rebalance_buy') return '후보 조건 통과로 목표 비중까지 매수';
  if (trade.reason === 'rebalance_sell') return '후보 유지 조건 이탈 또는 목표 비중 축소';
  if (trade.reason === 'trailing_profit_trim') return '큰 수익 이후 고점 대비 하락해 이익 보호';
  if (trade.reason === 'retained_cap_trim') return '수익 종목 비중이 커져 일부 축소';
  return trade.reason || '기록된 조건 없음';
}

function formatNullablePercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatPercent(value);
}

function healthRank(status: 'ok' | 'review' | 'stale' | 'fail') {
  if (status === 'fail') return 4;
  if (status === 'stale') return 3;
  if (status === 'review') return 2;
  return 1;
}

function healthTone(status: 'ok' | 'review' | 'stale' | 'fail'): 'good' | 'warn' | 'bad' {
  if (status === 'ok') return 'good';
  if (status === 'fail') return 'bad';
  return 'warn';
}

function healthStatusLabel(status: 'ok' | 'review' | 'stale' | 'fail') {
  if (status === 'ok') return '정상';
  if (status === 'review') return '검토';
  if (status === 'stale') return '오래됨';
  return '실패';
}

function healthBadgeVariant(status: 'ok' | 'review' | 'stale' | 'fail') {
  if (status === 'ok') return 'success';
  if (status === 'fail') return 'destructive';
  if (status === 'stale') return 'warning';
  return 'secondary';
}
