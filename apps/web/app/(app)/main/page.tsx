import { ArrowUpRight, BarChart3, DatabaseZap, FileText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { buildDecisionBrief, type DecisionTone } from '@/lib/decision-brief';
import { getDashboardViewModel } from '@/lib/dashboard-view-model';
import { formatKrw, formatPercent } from '@/lib/format';

export default function OverviewPage() {
  const view = getDashboardViewModel();
  const brief = buildDecisionBrief(view);
  const { overview, selectedStrategy } = view;
  const reportStats = overview.reportStats;

  return (
    <div className="grid gap-7">
      <header className="border-b border-slate-200 pb-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="max-w-5xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">{overview.snapshotDate || '기준일 없음'}</Badge>
              <Badge variant="secondary">{selectedStrategy?.shortLabel || overview.portfolio.label}</Badge>
              <Badge variant="success">읽기 전용</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-slate-950 md:text-5xl">메인화면</h1>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
              오늘 판단에 필요한 것만 먼저 봅니다. 보유 포지션의 재검토 사유, 현금과 손익의 관계, 리포트 통계로 넘어갈
              근거를 한 화면에 모으고 세부 차트는 전용 페이지에서 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/reports/statistics">통계 보기</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/portfolio">
                포트폴리오 <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="border-y border-slate-200 bg-white" aria-label="핵심 상태">
        <div className="grid divide-y divide-slate-100 md:grid-cols-5 md:divide-x md:divide-y-0">
          {brief.state.map((item) => (
            <div className="min-w-0 p-4" key={item.label}>
              <div className="text-xs font-medium text-slate-500">{item.label}</div>
              <div className={`mt-2 truncate font-mono text-xl font-semibold tabular-nums ${toneText(item.tone)}`}>
                {item.value}
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{item.caption}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(360px,.72fr)]">
        <article className="min-w-0 border-t border-slate-200 bg-white">
          <div className="grid gap-2 border-b border-slate-200 px-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Review queue
              </div>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-slate-950">확인할 항목</h2>
            </div>
            <span className="font-mono text-xs text-slate-500">{brief.decisions.length}개</span>
          </div>
          <div className="divide-y divide-slate-100">
            {brief.decisions.map((item, index) => (
              <Link
                className="grid gap-3 px-1 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[3.5rem_7rem_minmax(0,1fr)_9rem_auto] sm:items-center"
                href={item.href}
                key={item.id}
              >
                <span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                <Badge className="w-fit" variant={badgeVariant(item.tone)}>
                  {item.label}
                </Badge>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-950">{item.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-slate-500">{item.reason}</span>
                </span>
                <span className={`font-mono text-sm font-semibold tabular-nums sm:text-right ${toneText(item.tone)}`}>
                  {item.metric}
                </span>
                <ArrowUpRight className="hidden size-4 text-slate-400 sm:block" />
              </Link>
            ))}
          </div>
        </article>

        <aside className="grid gap-4">
          <section className="border-t border-slate-200 bg-white px-1 py-3">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Portfolio
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">포트폴리오 상태</h2>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href="/portfolio">상세</Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <MetricLine label="평가액" value={formatKrw(overview.portfolio.finalEquityKrw)} />
              <MetricLine label="현금" value={formatKrw(overview.portfolio.cashKrw)} />
              <MetricLine label="현재 보유" value={`${overview.portfolio.holdingCount.toLocaleString('ko-KR')}개`} />
            </div>
            <div className="mt-4 pt-2">
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm text-slate-500">현금 비중</span>
                <strong className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-slate-950">
                  {formatPercent(overview.portfolio.cashWeight)}
                </strong>
              </div>
              <Progress className="mt-2" value={(overview.portfolio.cashWeight ?? 0) * 100} />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                현금은 확정손익 누계가 아니라 보유 포지션 원가를 차감한 대기 자금입니다. 숫자가 어긋나 보이면 포트폴리오
                화면의 조정표를 먼저 확인합니다.
              </p>
            </div>
          </section>

          <section className="border-t border-slate-200 bg-white px-1 py-3">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Reports
                </div>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">리포트 통계</h2>
              </div>
              <Button asChild size="sm" variant="ghost">
                <Link href="/reports/statistics">열기</Link>
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 text-center">
              <Stat label="도달률" value={formatPercent(reportStats.targetHitRate)} />
              <Stat label="현재 플러스" value={formatPercent(reportStats.positiveReturnRate)} />
              <Stat label="중앙값" value={formatPercent(reportStats.medianCurrentReturn)} />
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              평균보다 분포와 경로를 먼저 봅니다. 0.8x 목표, 발간 후 지연 진입, 목표 도달 후 보유 성과는 통계 페이지에서
              인터랙티브하게 확인합니다.
            </p>
          </section>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,.75fr)_minmax(0,.85fr)]">
        <article className="border-t border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-1 py-3">
            <h2 className="text-base font-semibold text-slate-950">데이터 품질</h2>
            <p className="mt-1 text-xs text-slate-500">후보보다 제외·누락·검토 플래그를 먼저 봅니다.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {brief.quality.map((item) => (
              <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-4 px-1 py-3" key={item.label}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-950">{item.label}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{item.caption}</div>
                </div>
                <div className={`font-mono text-sm font-semibold tabular-nums text-right ${toneText(item.tone)}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="border-t border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-1 py-3">
            <h2 className="text-base font-semibold text-slate-950">최근 변경</h2>
            <p className="mt-1 text-xs text-slate-500">새로 반영된 리포트, 후보, 매매 이벤트입니다.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {brief.changes.map((item) => (
              <Link
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-1 py-3 transition-colors hover:bg-slate-50"
                href={item.href}
                key={`${item.title}-${item.caption}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-950">{item.title}</span>
                  <span className="mt-1 block truncate font-mono text-xs text-slate-500">{item.caption}</span>
                </span>
                <ArrowUpRight className="size-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-2 border-t border-slate-200 pt-4 sm:grid-cols-4">
        <Drilldown
          href="/portfolio"
          icon={<ShieldCheck />}
          title="포트폴리오"
          caption="보유·현금·매매내역"
          variant="primary"
        />
        <Drilldown href="/reports" icon={<FileText />} title="리포트" caption="목표가 검증 표" />
        <Drilldown href="/reports/statistics" icon={<BarChart3 />} title="통계" caption="분포·경로·익절선" />
        <Drilldown href="/strategies" icon={<DatabaseZap />} title="전략" caption="벤치마크·위험 성과" />
      </section>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <strong className="font-mono tabular-nums text-slate-950">{value}</strong>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function Drilldown({
  href,
  icon,
  title,
  caption,
  variant = 'default',
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  caption: string;
  variant?: 'default' | 'primary';
}) {
  const isPrimary = variant === 'primary';
  return (
    <Link
      className={
        isPrimary
          ? 'grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 border border-slate-950 bg-slate-950 p-3 text-white transition-colors hover:bg-slate-900'
          : 'grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300 hover:bg-slate-50'
      }
      href={href}
    >
      <span
        className={
          isPrimary
            ? 'grid size-8 place-items-center text-white [&_svg]:size-4'
            : 'grid size-8 place-items-center text-slate-500 [&_svg]:size-4'
        }
      >
        {icon}
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className={isPrimary ? 'font-semibold text-white' : 'font-medium text-slate-950'}>{title}</span>
        <span className={isPrimary ? 'truncate text-xs text-white/70' : 'truncate text-xs text-slate-500'}>
          {caption}
        </span>
      </span>
    </Link>
  );
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
