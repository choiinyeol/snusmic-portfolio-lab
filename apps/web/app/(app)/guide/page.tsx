import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getOverview, getReportRows } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';
import { getDefaultPortfolioAccount, getPortfolioSnapshot, getStrategyLeaderboard } from '@/lib/product-model';

export default function GuidePage() {
  const reports = getReportRows();
  const overview = getOverview();
  const strategyRows = getStrategyLeaderboard();
  const defaultAccount = getDefaultPortfolioAccount();
  const portfolio = getPortfolioSnapshot(defaultAccount);
  const reportStats = buildGuideReportStats(reports);
  const bestRealStrategy = strategyRows.find((row) => row.kind === 'strategy' && row.id !== 'weak_oracle');
  const follower = strategyRows.find((row) => row.id === 'smic_follower_v2');
  const kodex = strategyRows.find((row) => row.id === 'benchmark_kodex200');

  const headlineMetrics: [string, string, string][] = [
    ['검증 표본', `${reportStats.total.toLocaleString('ko-KR')}건`, '가격 매칭·목표가 검증 대상'],
    ['목표가 도달', `${reportStats.hitCount}/${reportStats.total}`, `도달률 ${formatPercent(reportStats.hitRate)}`],
    ['목표 근접', `${reportStats.nearTargetCount}/${reportStats.activeCount}`, '미도달 활성 80%+ 진행'],
    ['손실 군집', `${reportStats.deepLoserCount}건`, '현재 수익률 -20% 이하'],
    ['기본 포트폴리오', portfolio.label, `${portfolio.holdingCount}종목 · RP ${formatPercent(portfolio.cashWeight)}`],
  ];

  const evidenceRows: EvidenceRow[] = [
    {
      state: '현재 검증됨',
      title: '리포트 도달률',
      metric: `${formatPercent(reportStats.hitRate)} · ${reportStats.hitCount}건`,
      href: '/reports',
    },
    {
      state: '추가 검정 필요',
      title: '발간 후 지연 진입 효과',
      metric: `도달 중앙 ${formatDays(reportStats.medianDaysToTarget)}`,
      href: '/statistics',
    },
    {
      state: '검토 대기열',
      title: '상승 모멘텀 지속성',
      metric: `${reportStats.nearTargetCount}개 목표 근접`,
      href: '/reports',
    },
    {
      state: '손실 군집',
      title: '하락 모멘텀 지속성',
      metric: `${reportStats.deepLoserCount}개 -20% 이하`,
      href: '/reports',
    },
    {
      state: '추가 검정 필요',
      title: '목표 도달 후 보유 성과',
      metric: `${reportStats.hitCount}개 도달 표본`,
      href: '/reports',
    },
  ];

  const strategyRowsData: StrategyRow[] = [
    {
      label: '상위 고유 전략',
      name: bestRealStrategy?.shortLabel ?? '—',
      metric: `MWR ${formatPercent(bestRealStrategy?.returnPct)} · MDD ${formatPercent(bestRealStrategy?.maxDrawdown)}`,
    },
    {
      label: '기본 검토 포트폴리오',
      name: portfolio.label,
      metric: `MWR ${formatPercent(follower?.returnPct)} · 보유 ${portfolio.holdingCount}개`,
    },
    {
      label: '시장 기준선',
      name: 'KODEX 200',
      metric: `MWR ${formatPercent(kodex?.returnPct)} · MDD ${formatPercent(kodex?.maxDrawdown)}`,
    },
  ];

  return (
    <div className="grid gap-5">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">기준일 {overview.simulation_window?.price_end ?? '—'}</Badge>
          <Badge variant="secondary">검증 보드</Badge>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-slate-950 md:text-3xl">읽는 법</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href="/reports">
              리포트 표본 보기 <ArrowUpRight />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/portfolio">포트폴리오 보기</Link>
          </Button>
        </div>
      </header>

      <section aria-label="핵심 검증 수치" className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 [&>div]:border-b [&>div]:border-r [&>div]:border-slate-100">
          {headlineMetrics.map(([label, value, caption]) => (
            <div className="grid min-w-0 gap-0.5 p-3" key={label}>
              <dt className="text-xs font-medium text-slate-500">{label}</dt>
              <dd className="truncate font-mono text-sm font-semibold tabular-nums text-slate-950">{value}</dd>
              <dd className="truncate text-xs text-slate-500">{caption}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-2" aria-labelledby="evidence-heading">
        <h2
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
          id="evidence-heading"
        >
          검증 질문
        </h2>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">상태</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">질문</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">지표</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">열기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evidenceRows.map((row) => (
                <tr key={row.title}>
                  <td className="px-3 py-2">
                    <Badge
                      className="w-fit"
                      variant={row.state.includes('필요') || row.state.includes('추가') ? 'outline' : 'secondary'}
                    >
                      {row.state}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-950">{row.title}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.metric}</td>
                  <td className="px-3 py-2 text-right">
                    <Link className="text-xs font-semibold text-slate-700 hover:underline" href={row.href}>
                      열기 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-2" aria-labelledby="strategy-heading">
        <h2
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500"
          id="strategy-heading"
        >
          전략 포트폴리오
        </h2>
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">분류</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">이름</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">지표</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {strategyRowsData.map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 text-xs text-slate-500">{row.label}</td>
                  <td className="px-3 py-2 font-medium text-slate-950">{row.name}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{row.metric}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-950">
        <strong>주의</strong>: 발간 후 n일 대기 매수, 목표가 도달 후 추가 보유, 모멘텀 지속성 같은 가설은 별도
        아티팩트와 유의성 검정이 갖춰지기 전까지 결론처럼 노출하지 않습니다.
      </section>
    </div>
  );
}

type EvidenceRow = { state: string; title: string; metric: string; href: string };
type StrategyRow = { label: string; name: string; metric: string };

type GuideStats = {
  total: number;
  hitCount: number;
  hitRate: number;
  activeCount: number;
  nearTargetCount: number;
  deepLoserCount: number;
  medianDaysToTarget: number | null;
};

function buildGuideReportStats(reports: ReturnType<typeof getReportRows>): GuideStats {
  const hitRows = reports.filter((report) => report.targetHit);
  const activeRows = reports.filter(
    (report) => !report.targetHit && !report.expired && (report.targetUpsideAtPub ?? 0) > 0,
  );
  const days = hitRows.map((report) => report.daysToTarget).filter(isFiniteNumber);
  const nearTargetCount = activeRows.filter(
    (report) =>
      (report.targetProgressPct ?? 0) >= 0.8 || (report.targetRemainingPct ?? Number.POSITIVE_INFINITY) <= 0.1,
  ).length;
  return {
    total: reports.length,
    hitCount: hitRows.length,
    hitRate: hitRows.length / Math.max(1, reports.length),
    activeCount: activeRows.length,
    nearTargetCount,
    deepLoserCount: reports.filter((report) => (report.currentReturn ?? 0) <= -0.2).length,
    medianDaysToTarget: median(days),
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
