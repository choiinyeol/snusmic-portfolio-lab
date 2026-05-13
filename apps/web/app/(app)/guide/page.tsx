import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getOverview, getReportRows } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';
import { getDefaultPortfolioPersona, getPortfolioSnapshot, getStrategyLeaderboard } from '@/lib/product-model';

export default function GuidePage() {
  const reports = getReportRows();
  const overview = getOverview();
  const strategyRows = getStrategyLeaderboard();
  const defaultPersona = getDefaultPortfolioPersona();
  const portfolio = getPortfolioSnapshot(defaultPersona);
  const reportStats = buildGuideReportStats(reports);
  const bestRealStrategy = strategyRows.find((row) => row.kind === 'strategy' && row.id !== 'weak_oracle');
  const follower = strategyRows.find((row) => row.id === 'smic_follower_v2');
  const kodex = strategyRows.find((row) => row.id === 'benchmark_kodex200');

  const headlineMetrics = [
    ['검증 표본', `${reportStats.total.toLocaleString('ko-KR')}건`, '가격 매칭·목표가 검증 대상'],
    ['목표가 도달', `${reportStats.hitCount}/${reportStats.total}`, `도달률 ${formatPercent(reportStats.hitRate)}`],
    ['목표 근접', `${reportStats.nearTargetCount}/${reportStats.activeCount}`, '미도달 활성 표본 중 80%+ 진행'],
    ['손실 군집', `${reportStats.deepLoserCount}건`, '현재 수익률 -20% 이하'],
    ['기본 원장', portfolio.label, `${portfolio.holdingCount}종목 · 현금 ${formatPercent(portfolio.cashWeight)}`],
  ];

  return (
    <div className="grid gap-8">
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">기준일 {overview.simulation_window?.price_end ?? '—'}</Badge>
              <Badge variant="secondary">가이드가 아니라 검증 보드</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 md:text-4xl">
              무엇을 믿고, 무엇을 더 검정해야 하나
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              사용법·용어 설명은 최소화했습니다. 이 화면은 “리포트가 실제로 맞았나”, “며칠 기다렸을 때 유리했나”,
              “오르는 종목과 떨어지는 종목의 경향이 이어졌나”처럼 투자 규칙으로 바꿀 수 있는 질문만 남깁니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/reports">
                리포트 표본 보기 <ArrowUpRight />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/portfolio">원장 보기</Link>
            </Button>
          </div>
        </div>
      </header>

      <section aria-label="핵심 검증 수치" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid divide-y divide-slate-100 md:grid-cols-5 md:divide-x md:divide-y-0">
          {headlineMetrics.map(([label, value, caption]) => (
            <div className="min-w-0 p-4" key={label}>
              <div className="text-xs font-medium text-slate-500">{label}</div>
              <div className="mt-2 truncate font-mono text-xl font-semibold tabular-nums text-slate-950">{value}</div>
              <div className="mt-1 truncate text-xs text-slate-500">{caption}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3" aria-label="돈 되는 질문">
        <SectionHeader eyebrow="돈 되는 질문" title="규칙으로 바꿀 수 있는 검정 항목" />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <EvidenceRow
            state="현재 검증됨"
            title="서울대 동아리 리포트는 어느 정도 맞았나"
            metric={`${formatPercent(reportStats.hitRate)} · ${reportStats.hitCount}건 도달`}
            body="목표가 도달률, 도달까지 걸린 시간, 현재 수익률 중앙값을 같이 봅니다. 평균 수익률만 보면 몇 개의 대박 종목이 실력을 과장할 수 있습니다."
            href="/reports"
          />
          <EvidenceRow
            state="추가 artifact 필요"
            title="발간 직후 매수보다 며칠 기다렸다 사는 게 유리했나"
            metric={`도달 중앙 ${formatDays(reportStats.medianDaysToTarget)}`}
            body="현재 표본은 목표 도달까지 시간이 필요했다는 힌트만 줍니다. 발간 후 1/5/20일 진입 수익률과 p-value가 생기기 전에는 결론처럼 말하지 않습니다."
            href="/reports"
          />
          <EvidenceRow
            state="검토 대기열"
            title="오르는 건 계속 오르는가"
            metric={`${reportStats.nearTargetCount}개 목표 근접`}
            body="목표 진행률이 높은 미도달 리포트는 추세 지속 검정의 우선 표본입니다. ‘매수 추천’이 아니라, 상승 지속성이 통계적으로 남는지 확인할 후보입니다."
            href="/screener"
          />
          <EvidenceRow
            state="손실 군집"
            title="떨어지는 건 계속 떨어지는가"
            metric={`${reportStats.deepLoserCount}개 -20% 이하`}
            body="손실 표본을 평균 속에 숨기지 않습니다. 손실 군집은 시간 손절, 제외 조건, 리포트 만료 규칙을 만들 때 먼저 봐야 할 실패 데이터입니다."
            href="/reports"
          />
          <EvidenceRow
            state="추가 검정"
            title="목표가를 지나도 가지고 있는 게 괜찮았나"
            metric={`${reportStats.hitCount}개 도달 표본`}
            body="목표 도달 이후 20/60/120일 보유 성과가 별도 artifact로 필요합니다. 표본 수는 충분해졌으니 다음 버전에서 post-hit drift를 검정할 수 있습니다."
            href="/reports"
          />
        </div>
      </section>

      <section className="grid gap-3" aria-label="전략 원장">
        <SectionHeader eyebrow="전략 원장" title="벤치마크를 이겼는지, 위험을 얼마 냈는지" />
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <StrategyRow
            label="상위 고유 전략"
            name={bestRealStrategy?.shortLabel ?? '—'}
            metric={`MWR ${formatPercent(bestRealStrategy?.returnPct)} · MDD ${formatPercent(bestRealStrategy?.maxDrawdown)}`}
            detail="수익률만 높다고 좋은 전략이 아닙니다. MDD, Sharpe, 체결 수, 현금 대기까지 같이 봅니다."
          />
          <StrategyRow
            label="기본 검토 원장"
            name={portfolio.label}
            metric={`MWR ${formatPercent(follower?.returnPct)} · 보유 ${portfolio.holdingCount}개`}
            detail="현재 기본 원장은 실제 보유 종목을 보여줘야 합니다. 트리맵이 현금뿐이면 데이터 선택/기본값 문제로 간주합니다."
          />
          <StrategyRow
            label="시장 기준선"
            name="KODEX 200"
            metric={`MWR ${formatPercent(kodex?.returnPct)} · MDD ${formatPercent(kodex?.maxDrawdown)}`}
            detail="고유 전략은 이 기준선보다 더 벌었는지, 더 큰 낙폭을 감수했는지 분리해서 봅니다."
          />
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        <div className="font-semibold">아직 화면에 결론처럼 올리면 안 되는 것</div>
        <p className="mt-2">
          발간 후 n일 대기 매수, 목표가 도달 후 추가 보유, 상승/하락 모멘텀 지속성은 별도 artifact와 유의성 검정이 생긴
          뒤에만 결론으로 노출합니다. 지금은 검증된 수치와 다음 검정 질문을 명확히 구분합니다.
        </p>
      </section>
    </div>
  );
}

type GuideStats = {
  total: number;
  hitCount: number;
  hitRate: number;
  activeCount: number;
  nearTargetCount: number;
  deepLoserCount: number;
  averageReturn: number | null;
  medianReturn: number | null;
  medianDaysToTarget: number | null;
};

function buildGuideReportStats(reports: ReturnType<typeof getReportRows>): GuideStats {
  const hitRows = reports.filter((report) => report.targetHit);
  const activeRows = reports.filter(
    (report) => !report.targetHit && !report.expired && (report.targetUpsideAtPub ?? 0) > 0,
  );
  const returns = reports.map((report) => report.currentReturn).filter(isFiniteNumber);
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
    averageReturn: average(returns),
    medianReturn: median(returns),
    medianDaysToTarget: median(days),
  };
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="flex items-end justify-between gap-4 border-b border-slate-200 pb-2">
      <div>
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
      </div>
    </header>
  );
}

function EvidenceRow({
  state,
  title,
  metric,
  body,
  href,
}: {
  state: string;
  title: string;
  metric: string;
  body: string;
  href: string;
}) {
  return (
    <article className="grid gap-3 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[9rem_minmax(0,1fr)_14rem_auto] md:items-center">
      <Badge className="w-fit" variant={state.includes('필요') || state.includes('추가') ? 'outline' : 'secondary'}>
        {state}
      </Badge>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums text-slate-950 md:text-right">{metric}</div>
      <Button asChild size="sm" variant="ghost">
        <Link href={href}>열기</Link>
      </Button>
    </article>
  );
}

function StrategyRow({ label, name, metric, detail }: { label: string; name: string; metric: string; detail: string }) {
  return (
    <article className="grid gap-2 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[9rem_minmax(0,1fr)_18rem] md:items-center">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div>
        <div className="text-sm font-semibold text-slate-950">{name}</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums text-slate-950 md:text-right">{metric}</div>
    </article>
  );
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
