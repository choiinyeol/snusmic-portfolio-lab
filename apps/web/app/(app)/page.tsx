import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  LineChart,
  SearchCheck,
  ShieldCheck,
  Target,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import { PerformanceChartPanel } from '@/components/charts/PerformanceChartPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildDecisionBrief, type DecisionTone } from '@/lib/decision-brief';
import { getDashboardViewModel, type DashboardViewModel } from '@/lib/dashboard-view-model';
import { formatDateKo, formatKrw, formatPercent } from '@/lib/format';

type Report = DashboardViewModel['reports'][number];
type StrategyRow = DashboardViewModel['accountRows'][number];
type Holding = DashboardViewModel['overview']['portfolio']['holdings'][number];
type Trade = DashboardViewModel['recentBuys'][number];

export default function OverviewPage() {
  const view = getDashboardViewModel();
  const brief = buildDecisionBrief(view);
  const { overview, selectedAccountRow, benchmarkToBeat } = view;
  const reportStats = overview.reportStats;
  const pastWinner = bestPastSignal(view.reports);
  const activeCandidate = overview.researchCandidates[0]?.report ?? activeReportCandidate(view.reports);
  const recentTrade = view.recentBuys[0];
  const topHolding = overview.portfolio.holdings[0];
  const strategyRows = strategyScoreRows(view);
  const selectedLeaderboardRow = view.accountRows.find((row) => row.id === view.selectedAccount) ?? selectedAccountRow;
  const benchmarkExcess =
    selectedLeaderboardRow?.benchmarkExcess ??
    (selectedLeaderboardRow?.id === benchmarkToBeat?.id
      ? 0
      : selectedLeaderboardRow?.returnPct != null && benchmarkToBeat?.returnPct != null
        ? selectedLeaderboardRow.returnPct - benchmarkToBeat.returnPct
        : null);

  return (
    <div className="grid gap-5">
      <section className="rounded-md border border-slate-200 bg-white" aria-label="리포트 성과 검증">
        <div className="grid gap-4 p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="outline">{overview.snapshotDate || '기준일 없음'}</Badge>
                <span className="font-medium text-slate-700">
                  {selectedLeaderboardRow?.shortLabel || overview.portfolio.label}
                </span>
                <span aria-hidden="true">·</span>
                <span>{reportStats.total.toLocaleString('ko-KR')}기 검증 완료</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">리포트 성과 검증</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                발간일, 목표가, 가격 흐름, 보유 종목, 매매 기록을 기준으로 리포트 신호의 사후 성과를 추적합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button asChild size="sm" variant="secondary">
                <Link href="/reports">
                  지금 볼 종목 <SearchCheck />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/statistics">성과 통계</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            <MetricStripCard
              icon={<Target />}
              label="목표가 도달률"
              value={formatPercent(reportStats.targetHitRate)}
              helper={`${reportStats.hitCount.toLocaleString('ko-KR')}건 도달`}
              tone="good"
            />
            <MetricStripCard
              icon={<TrendingUp />}
              label="현재 수익률"
              value={formatPercent(reportStats.medianCurrentReturn)}
              helper={`양수 비율 ${formatPercent(reportStats.positiveReturnRate)}`}
              tone="neutral"
            />
            <MetricStripCard
              icon={<LineChart />}
              label="벤치마크 대비"
              value={formatNullablePercent(benchmarkExcess)}
              helper={benchmarkToBeat?.shortLabel ? `${benchmarkToBeat.shortLabel} 기준` : '기준선 없음'}
              tone={(benchmarkExcess ?? 0) >= 0 ? 'good' : 'warn'}
            />
            <MetricStripCard
              icon={<WalletCards />}
              label="계좌 평가금액"
              value={formatKrw(overview.portfolio.finalEquityKrw)}
              helper={`${overview.portfolio.holdingCount.toLocaleString('ko-KR')}개 보유`}
              tone="neutral"
            />
            <MetricStripCard
              icon={<CalendarClock />}
              label="최근 매매"
              value={recentTrade ? tradeSignalLabel(recentTrade) : '기록 없음'}
              helper={
                recentTrade
                  ? `${formatDateKo(recentTrade.date)} · ${formatKrw(recentTrade.grossKrw)}`
                  : '계좌 원장 기준'
              }
              tone={recentTrade?.side === 'sell' ? 'warn' : 'good'}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]" aria-label="성과 경로와 판단 요약">
        <PerformanceChartPanel
          series={view.chartSeries}
          benchmarkCount={view.benchmarkRows.length}
          accountCount={view.accountRows.filter((row) => row.kind === 'account').length}
          objectiveLabel="계좌와 벤치마크 경로 비교"
        />
        <aside className="grid gap-3">
          <JudgmentCard
            href={pastWinner ? reportHref(pastWinner) : '/statistics'}
            icon={<BarChart3 />}
            label="과거에 통했던 신호"
            title={pastWinner ? `${pastWinner.company || pastWinner.symbol}` : '검증 표본 없음'}
            metric={pastWinner ? formatPercent(pastWinner.currentReturn) : '—'}
            caption={
              pastWinner
                ? `${formatDateKo(pastWinner.publicationDate)} 발간 이후 현재 수익률입니다. 최고 구간은 ${formatPercent(pastWinner.peakReturn)}입니다.`
                : '가격과 리포트가 연결된 표본이 필요합니다.'
            }
            tone="good"
          />
          <JudgmentCard
            href={activeCandidate ? reportHref(activeCandidate) : '/reports'}
            icon={<SearchCheck />}
            label="지금 다시 볼 신호"
            title={activeCandidate ? `${activeCandidate.company || activeCandidate.symbol}` : '검토 후보 없음'}
            metric={activeCandidate ? activeCandidate.symbol : '—'}
            caption={
              activeCandidate
                ? `목표까지 남은 구간 ${formatPercent(activeCandidate.targetRemainingPct)}, 현재 수익률 ${formatPercent(activeCandidate.currentReturn)}입니다.`
                : '현재 조건에 걸린 후보가 없습니다.'
            }
            tone="accent"
          />
          <JudgmentCard
            href={topHolding ? '/portfolio' : '/reports'}
            icon={<ShieldCheck />}
            label="현재 계좌 노출"
            title={topHolding ? `${topHolding.company || topHolding.symbol}` : '보유 종목 없음'}
            metric={topHolding ? formatPercent(topHolding.unrealizedReturn) : '—'}
            caption={
              topHolding
                ? `${topHolding.symbol} · 평가액 ${formatKrw(topHolding.marketValueKrw)} · 보유 ${formatHoldingDays(topHolding)}`
                : '현재 선택된 계좌에는 열린 포지션이 없습니다.'
            }
            tone={(topHolding?.unrealizedReturn ?? 0) >= 0 ? 'good' : 'warn'}
          />
        </aside>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-3 md:p-4" aria-label="검증 상세">
        <Tabs
          tabs={[
            {
              id: 'performance',
              label: '성과 경로',
              meta: String(strategyRows.length),
              content: <StrategyTable rows={strategyRows} />,
            },
            {
              id: 'holdings',
              label: '보유 종목',
              meta: String(overview.portfolio.holdings.length),
              content: <HoldingsTable holdings={overview.portfolio.holdings.slice(0, 8)} />,
            },
            {
              id: 'trades',
              label: '매매 기록',
              meta: String(view.recentBuys.length),
              content: <TradesPreview trades={view.recentBuys.slice(0, 8)} />,
            },
            {
              id: 'reports',
              label: '원천 리포트',
              meta: String(view.reports.length),
              content: <ReportsPreview reports={view.reports.slice(0, 8)} />,
            },
            {
              id: 'logs',
              label: '검증 로그',
              meta: String(brief.quality.length),
              content: <VerificationLog decisions={brief.decisions} quality={brief.quality} />,
            },
          ]}
        />
      </section>
    </div>
  );
}

function MetricStripCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: 'neutral' | 'good' | 'warn' | 'accent';
}) {
  return (
    <article className="grid h-20 min-w-0 content-between rounded-md border border-slate-200 bg-white p-2.5 sm:h-24 sm:p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-md bg-slate-100 [&_svg]:size-3.5 ${metricText(tone)}`}
        >
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0">
        <div className={`truncate font-mono text-lg font-semibold tabular-nums sm:text-xl ${metricText(tone)}`}>
          {value}
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">{helper}</p>
      </div>
    </article>
  );
}

function JudgmentCard({
  href,
  icon,
  label,
  title,
  metric,
  caption,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  metric: string;
  caption: string;
  tone: 'good' | 'warn' | 'accent';
}) {
  return (
    <Link
      className="group grid min-w-0 gap-3 rounded-md border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50"
      href={href}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 [&_svg]:size-4 ${metricText(tone)}`}
          >
            {icon}
          </span>
          <span className="truncate text-xs font-semibold text-slate-500">{label}</span>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-slate-400 group-hover:text-slate-700" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
          <span className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${metricText(tone)}`}>{metric}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{caption}</p>
      </div>
    </Link>
  );
}

function StrategyTable({ rows }: { rows: StrategyRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>계좌/기준선</TableHead>
          <TableHead className="text-right">수익률</TableHead>
          <TableHead className="text-right">MDD</TableHead>
          <TableHead className="text-right">평가</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <Link className="font-medium text-slate-950 hover:underline" href={row.href}>
                {row.shortLabel}
              </Link>
              <div className="mt-0.5 text-xs text-slate-500">{row.sourceLabel}</div>
            </TableCell>
            <TableCell
              className={`text-right font-mono font-semibold tabular-nums ${metricText((row.returnPct ?? 0) >= 0 ? 'good' : 'warn')}`}
            >
              {formatPercent(row.returnPct)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-slate-700">
              {formatPercent(row.maxDrawdown)}
            </TableCell>
            <TableCell className="text-right">
              <Badge variant={row.objectivePassed ? 'success' : 'secondary'}>
                {row.objectivePassed ? '통과' : '관찰'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HoldingsTable({ holdings }: { holdings: Holding[] }) {
  if (!holdings.length) return <EmptyState label="보유 종목이 없습니다." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>종목</TableHead>
          <TableHead className="text-right">평가금액</TableHead>
          <TableHead className="text-right">수익률</TableHead>
          <TableHead className="text-right">보유일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.map((holding) => (
          <TableRow key={`${holding.symbol}-${holding.firstBuyDate ?? 'open'}`}>
            <TableCell>
              <div className="font-medium text-slate-950">{holding.company || holding.symbol}</div>
              <div className="mt-0.5 font-mono text-xs text-slate-500">{holding.symbol}</div>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-slate-950">
              {formatKrw(holding.marketValueKrw)}
            </TableCell>
            <TableCell
              className={`text-right font-mono font-semibold tabular-nums ${metricText((holding.unrealizedReturn ?? 0) >= 0 ? 'good' : 'warn')}`}
            >
              {formatPercent(holding.unrealizedReturn)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-slate-700">
              {formatHoldingDays(holding)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TradesPreview({ trades }: { trades: Trade[] }) {
  if (!trades.length) return <EmptyState label="최근 매매 기록이 없습니다." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>일자</TableHead>
          <TableHead>액션</TableHead>
          <TableHead>종목</TableHead>
          <TableHead className="text-right">금액</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((trade) => (
          <TableRow key={`${trade.date}-${trade.symbol}-${trade.grossKrw}`}>
            <TableCell className="font-mono text-xs tabular-nums text-slate-700">{formatDateKo(trade.date)}</TableCell>
            <TableCell>
              <Badge variant={trade.side === 'sell' ? 'warning' : 'success'}>
                {trade.side === 'sell' ? '매도' : '매수'}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-slate-950">{trade.symbol}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-slate-950">
              {formatKrw(trade.grossKrw)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReportsPreview({ reports }: { reports: Report[] }) {
  if (!reports.length) return <EmptyState label="표시할 리포트가 없습니다." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>리포트</TableHead>
          <TableHead className="text-right">현재 수익률</TableHead>
          <TableHead className="text-right">목표 잔여</TableHead>
          <TableHead className="text-right">상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.reportId}>
            <TableCell>
              <Link className="font-medium text-slate-950 hover:underline" href={reportHref(report)}>
                {report.company || report.symbol}
              </Link>
              <div className="mt-0.5 font-mono text-xs text-slate-500">
                {report.symbol} · {formatDateKo(report.publicationDate)}
              </div>
            </TableCell>
            <TableCell
              className={`text-right font-mono font-semibold tabular-nums ${metricText((report.currentReturn ?? 0) >= 0 ? 'good' : 'warn')}`}
            >
              {formatPercent(report.currentReturn)}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-slate-700">
              {formatPercent(report.targetRemainingPct)}
            </TableCell>
            <TableCell className="text-right">
              <Badge variant={report.targetHit ? 'success' : report.expired ? 'secondary' : 'outline'}>
                {report.targetHit ? '도달' : report.expired ? '만료' : '진행'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function VerificationLog({
  decisions,
  quality,
}: {
  decisions: ReturnType<typeof buildDecisionBrief>['decisions'];
  quality: ReturnType<typeof buildDecisionBrief>['quality'];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {decisions.map((item, index) => (
          <Link
            className="grid gap-2 p-3 transition-colors hover:bg-slate-50 sm:grid-cols-[2.5rem_7rem_minmax(0,1fr)_8rem_auto] sm:items-center"
            href={item.href}
            key={item.id}
          >
            <span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</span>
            <Badge className="w-fit" variant={badgeVariant(item.tone)}>
              {item.label}
            </Badge>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-950">{item.title}</span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">{item.reason}</span>
            </span>
            <span className={`font-mono text-sm font-semibold tabular-nums sm:text-right ${toneText(item.tone)}`}>
              {item.metric}
            </span>
            <ArrowUpRight className="hidden size-4 text-slate-400 sm:block" />
          </Link>
        ))}
      </div>
      <div className="grid content-start gap-2 rounded-md border border-slate-200 p-3">
        {quality.map((item) => (
          <QualityLine item={item} key={item.label} />
        ))}
      </div>
    </div>
  );
}

function QualityLine({ item }: { item: { label: string; value: string; caption: string; tone?: DecisionTone } }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-950">{item.label}</div>
        <div className="mt-0.5 truncate text-xs text-slate-500">{item.caption}</div>
      </div>
      <div className={`font-mono text-sm font-semibold tabular-nums ${toneText(item.tone)}`}>{item.value}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {label}
    </div>
  );
}

function bestPastSignal(reports: Report[]): Report | undefined {
  return [...reports]
    .filter((report) => Number.isFinite(report.currentReturn))
    .sort((a, b) => (b.currentReturn ?? Number.NEGATIVE_INFINITY) - (a.currentReturn ?? Number.NEGATIVE_INFINITY))[0];
}

function activeReportCandidate(reports: Report[]): Report | undefined {
  return [...reports]
    .filter((report) => !report.expired && !report.targetHit && Number.isFinite(report.targetRemainingPct))
    .sort((a, b) => (b.targetRemainingPct ?? 0) - (a.targetRemainingPct ?? 0))[0];
}

function strategyScoreRows(view: DashboardViewModel): StrategyRow[] {
  const accountRows = view.accountRows.filter((row) => row.kind === 'account');
  if (accountRows.length) return accountRows.slice(0, 5);
  return view.benchmarkRows.slice(0, 5);
}

function reportHref(report: Report): string {
  return `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`;
}

function tradeSignalLabel(trade: Trade): string {
  const side = trade.side === 'sell' ? '매도' : '매수';
  return `${side} ${trade.symbol}`;
}

function formatHoldingDays(holding: Holding): string {
  if (!holding.holdingDays || !Number.isFinite(holding.holdingDays)) return '보유일 없음';
  return `${Math.round(holding.holdingDays).toLocaleString('ko-KR')}일`;
}

function formatNullablePercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatPercent(value);
}

function metricText(tone: 'neutral' | 'good' | 'warn' | 'accent') {
  if (tone === 'good') return 'text-emerald-600';
  if (tone === 'warn') return 'text-amber-600';
  if (tone === 'accent') return 'text-blue-600';
  return 'text-slate-950';
}

function toneText(tone?: DecisionTone) {
  if (tone === 'ok') return 'text-emerald-600';
  if (tone === 'review' || tone === 'watch') return 'text-amber-600';
  if (tone === 'risk') return 'text-red-600';
  if (tone === 'data') return 'text-indigo-600';
  return 'text-slate-950';
}

function badgeVariant(tone: DecisionTone) {
  if (tone === 'ok') return 'success';
  if (tone === 'risk' || tone === 'review') return 'destructive';
  if (tone === 'data') return 'outline';
  return 'secondary';
}
