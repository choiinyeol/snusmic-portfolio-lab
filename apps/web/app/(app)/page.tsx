import {
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Gauge,
  LineChart,
  ListChecks,
  Radar,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';
import { PerformanceChartPanel } from '@/components/charts/PerformanceChartPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { displayPortfolioName, strategyMeta } from '@/components/trading/portfolio-views/strategy-display';
import { buildDecisionBrief, type DecisionTone } from '@/lib/decision-brief';
import { getDashboardViewModel, type DashboardViewModel } from '@/lib/dashboard-view-model';
import { formatDateKo, formatKrw, formatPercent } from '@/lib/format';

type Report = DashboardViewModel['reports'][number];
type AccountPerformanceRow = DashboardViewModel['accountRows'][number];
type Holding = DashboardViewModel['overview']['portfolio']['holdings'][number];
type Trade = DashboardViewModel['recentTrades'][number];
type Candidate = DashboardViewModel['overview']['researchCandidates'][number];

export default function OverviewPage() {
  const view = getDashboardViewModel();
  const brief = buildDecisionBrief(view);
  const { overview, selectedAccountRow, benchmarkToBeat } = view;
  const reportStats = overview.reportStats;
  const watchCandidates = overview.researchCandidates.slice(0, 5);
  const recentSignals = view.recentTrades;
  const recentTrade = recentSignals[0];
  const accountPerformanceRows = accountPerformanceRowsForBoard(view);
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

  return (
    <div className="grid gap-5">
      <section className="rounded-md border border-slate-200 bg-white" aria-label="전략 신호 원장">
        <div className="grid gap-4 p-4 md:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="outline">{overview.snapshotDate || '기준일 없음'}</Badge>
                <span className="font-medium text-slate-700">{strategyName}</span>
                <span aria-hidden="true">·</span>
                <span>{strategy.subtitle}</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">전략 신호 원장</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                최근 리포트와 가격 흐름으로 만든 후보 점수, 실제 매수·매도 신호, 현재 보유 원장을 한 화면에서
                확인합니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button asChild size="sm" variant="secondary">
                <Link href={`/portfolio/${encodeURIComponent(view.selectedAccount)}`}>
                  원장 열기 <ArrowUpRight />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/calendar">신호 달력</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            <MetricStripCard
              icon={<TrendingUp />}
              label="전략 수익률"
              value={formatPercent(selectedLeaderboardRow?.returnPct)}
              helper={strategyName}
              tone="good"
            />
            <MetricStripCard
              icon={<Gauge />}
              label="최대 낙폭"
              value={formatPercent(selectedLeaderboardRow?.maxDrawdown)}
              helper="MDD"
              tone={(selectedLeaderboardRow?.maxDrawdown ?? 0) <= 0.2 ? 'neutral' : 'warn'}
            />
            <MetricStripCard
              icon={<LineChart />}
              label="KODEX 대비"
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
              label="최근 신호"
              value={recentTrade ? tradeSignalLabel(recentTrade) : '기록 없음'}
              helper={
                recentTrade ? `${formatDateKo(recentTrade.date)} · ${companyLabel(recentTrade)}` : '계좌 원장 기준'
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
          objectiveLabel={`${strategyName}와 벤치마크 경로 비교`}
        />
        <aside className="grid gap-3">
          <SignalStack trades={recentSignals.slice(0, 3)} />
          <CandidateStack candidates={watchCandidates.slice(0, 3)} />
          <ScoreFormulaCard />
        </aside>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-3 md:p-4" aria-label="검증 상세">
        <Tabs
          tabs={[
            {
              id: 'performance',
              label: '전략 원장',
              meta: String(accountPerformanceRows.length),
              content: <AccountPerformanceTable rows={accountPerformanceRows} />,
            },
            {
              id: 'holdings',
              label: '보유 종목',
              meta: String(overview.portfolio.holdings.length),
              content: <HoldingsTable holdings={overview.portfolio.holdings.slice(0, 8)} />,
            },
            {
              id: 'trades',
              label: '최근 신호',
              meta: String(recentSignals.length),
              content: <TradesPreview trades={recentSignals.slice(0, 8)} />,
            },
            {
              id: 'candidates',
              label: '매매 직전 후보',
              meta: String(watchCandidates.length),
              content: <CandidatesPreview candidates={watchCandidates.slice(0, 8)} />,
            },
            {
              id: 'logs',
              label: '점수 기준',
              meta: String(reportStats.total),
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

function SignalStack({ trades }: { trades: Trade[] }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-emerald-600">
            <Radar className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-950">최근 발생한 매매 신호</h2>
            <p className="mt-0.5 text-xs text-slate-500">실제 원장에 기록된 체결 기준</p>
          </div>
        </div>
        <Link className="text-xs font-medium text-slate-500 hover:text-slate-950" href="/portfolio">
          전체
        </Link>
      </div>
      <div className="grid gap-2">
        {trades.length ? (
          trades.map((trade) => <SignalLine key={`${trade.date}-${trade.symbol}-${trade.side}`} trade={trade} />)
        ) : (
          <EmptyState label="최근 체결 신호가 없습니다." />
        )}
      </div>
    </article>
  );
}

function SignalLine({ trade }: { trade: Trade }) {
  const sell = trade.side === 'sell';
  return (
    <Link
      className="group grid gap-2 rounded-md border border-slate-100 bg-slate-50/50 p-2.5 transition hover:border-slate-300 hover:bg-white"
      href={tradeHref(trade)}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={sell ? 'warning' : 'success'}>{sell ? '매도' : '매수'}</Badge>
            <span className="font-mono text-xs text-slate-500">{formatDateKo(trade.date)}</span>
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-950">{companyLabel(trade)}</div>
        </div>
        <span className={`font-mono text-sm font-semibold ${sell ? 'text-rose-600' : 'text-emerald-600'}`}>
          {formatKrw(trade.grossKrw)}
        </span>
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-slate-500">{compactReason(trade)}</p>
    </Link>
  );
}

function CandidateStack({ candidates }: { candidates: Candidate[] }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-blue-600">
            <ListChecks className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-950">매매 직전 후보</h2>
            <p className="mt-0.5 text-xs text-slate-500">다음 리밸런싱 때 다시 비교할 상위 후보</p>
          </div>
        </div>
        <Link className="text-xs font-medium text-slate-500 hover:text-slate-950" href="/calendar">
          달력
        </Link>
      </div>
      <div className="grid gap-2">
        {candidates.length ? (
          candidates.map((candidate) => <CandidateLine candidate={candidate} key={candidate.report.reportId} />)
        ) : (
          <EmptyState label="현재 후보가 없습니다." />
        )}
      </div>
    </article>
  );
}

function CandidateLine({ candidate }: { candidate: Candidate }) {
  const report = candidate.report;
  return (
    <Link
      className="grid gap-2 rounded-md border border-slate-100 bg-slate-50/50 p-2.5 transition hover:border-slate-300 hover:bg-white"
      href={reportHref(report)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{report.company || report.symbol}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">{formatDateKo(report.publicationDate)}</div>
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

function ScoreFormulaCard() {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700">
          <BarChart3 className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-950">점수는 이렇게 봅니다</h2>
          <p className="mt-0.5 text-xs text-slate-500">높을수록 다음 검토 우선순위가 높습니다</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-600">
        <ScoreLine label="기본" value="목표 여력 × 1.4 + 양수 수익률" />
        <ScoreLine label="추세" value="YTD, 3M, 6M, 1Y, 52주 고점, 이평 정배열" />
        <ScoreLine label="감점" value="이미 목표가 위로 과열된 구간" />
      </div>
    </article>
  );
}

function ScoreLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-2 rounded-md bg-slate-50 px-2.5 py-2">
      <span className="font-semibold text-slate-950">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function AccountPerformanceTable({ rows }: { rows: AccountPerformanceRow[] }) {
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
          <TableHead>조건</TableHead>
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
            <TableCell>
              <div className="font-medium text-slate-950">{companyLabel(trade)}</div>
              <div className="mt-0.5 font-mono text-xs text-slate-500">{trade.symbol}</div>
            </TableCell>
            <TableCell className="max-w-md text-xs leading-5 text-slate-500">{compactReason(trade)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-slate-950">
              {formatKrw(trade.grossKrw)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CandidatesPreview({ candidates }: { candidates: Candidate[] }) {
  if (!candidates.length) return <EmptyState label="현재 후보가 없습니다." />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>후보</TableHead>
          <TableHead className="text-right">점수</TableHead>
          <TableHead className="text-right">현재</TableHead>
          <TableHead className="text-right">목표까지</TableHead>
          <TableHead className="text-right">근거</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {candidates.map((candidate) => {
          const report = candidate.report;
          return (
            <TableRow key={report.reportId}>
              <TableCell>
                <Link className="font-medium text-slate-950 hover:underline" href={reportHref(report)}>
                  {report.company || report.symbol}
                </Link>
                <div className="mt-0.5 font-mono text-xs text-slate-500">
                  {formatDateKo(report.publicationDate)} · {report.symbol}
                </div>
              </TableCell>
              <TableCell className="text-right font-mono font-semibold tabular-nums text-blue-600">
                {candidate.score.toFixed(2)}
              </TableCell>
              <TableCell
                className={`text-right font-mono font-semibold tabular-nums ${metricText((report.currentReturn ?? 0) >= 0 ? 'good' : 'warn')}`}
              >
                {formatPercent(report.currentReturn)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-slate-700">
                {formatPercent(report.targetRemainingPct)}
              </TableCell>
              <TableCell className="text-right text-xs text-slate-500">{candidate.rankBasis}</TableCell>
            </TableRow>
          );
        })}
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

function accountPerformanceRowsForBoard(view: DashboardViewModel): AccountPerformanceRow[] {
  const accountRows = view.accountRows.filter((row) => row.kind === 'account');
  if (accountRows.length) return accountRows.slice(0, 5);
  return view.benchmarkRows.slice(0, 5);
}

function reportHref(report: Report): string {
  return `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`;
}

function tradeSignalLabel(trade: Trade): string {
  const side = trade.side === 'sell' ? '매도' : '매수';
  return `${side} ${companyLabel(trade)}`;
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
