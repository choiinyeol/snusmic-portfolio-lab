import type { ReactNode } from 'react';
import { ArrowUpRight, DatabaseZap, FileText, ShieldCheck } from 'lucide-react';
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

  return (
    <div className="grid gap-6">
      <header className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline">기준일 {overview.snapshotDate || '—'}</Badge>
              <Badge variant="success">읽기 전용</Badge>
              <Badge variant="secondary">{selectedStrategy?.shortLabel || overview.portfolio.label}</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 md:text-4xl">스냅샷</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              홈은 모든 차트를 압축하지 않습니다. 오늘 봐야 할 원장 상태, 재검토 항목, 데이터 신뢰도만 먼저 정리하고
              세부 분석은 전용 화면으로 넘깁니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/reports">리포트 확인</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/portfolio">
                원장 열기 <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="상태 판정">
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

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">확인할 항목</h2>
              <p className="mt-1 text-xs text-slate-500">
                보유, 후보, 만료, 데이터 플래그를 하나의 검토 대기열로 정리합니다.
              </p>
            </div>
            <Badge variant="outline">{brief.decisions.length.toLocaleString('ko-KR')}개</Badge>
          </div>
          <div className="divide-y divide-slate-100">
            {brief.decisions.map((item) => (
              <Link
                className="grid gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:grid-cols-[7rem_minmax(0,1fr)_9rem_auto] sm:items-center"
                href={item.href}
                key={item.id}
              >
                <Badge className="w-fit" variant={badgeVariant(item.tone)}>
                  {item.label}
                </Badge>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-950">{item.title}</div>
                  <div className="mt-1 text-sm leading-5 text-slate-500">{item.reason}</div>
                </div>
                <div className={`font-mono text-sm font-semibold tabular-nums sm:text-right ${toneText(item.tone)}`}>
                  {item.metric}
                </div>
                <ArrowUpRight className="hidden size-4 text-slate-400 sm:block" />
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-950">원장 상태</h2>
              <Button asChild size="sm" variant="ghost">
                <Link href="/portfolio">상세</Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <MetricLine label="평가액" value={formatKrw(overview.portfolio.finalEquityKrw)} />
              <MetricLine label="현금" value={formatKrw(overview.portfolio.cashKrw)} />
              <MetricLine label="현재 보유" value={`${overview.portfolio.holdingCount.toLocaleString('ko-KR')}개`} />
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-end justify-between gap-3">
                <span className="text-sm text-slate-500">현금 비중</span>
                <strong className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-slate-950">
                  {formatPercent(overview.portfolio.cashWeight)}
                </strong>
              </div>
              <Progress className="mt-2" value={(overview.portfolio.cashWeight ?? 0) * 100} />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                기본 원장은 실제 보유 종목을 우선합니다. 현금 비중이 크면 원장 화면에서 체결·후보 부족·리밸런싱 조건을
                확인합니다.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-950">바로가기</h2>
              <p className="mt-1 text-xs text-slate-500">세부 분석은 전용 화면에서만 다룹니다.</p>
            </div>
            <div className="grid p-2">
              <Drilldown href="/portfolio" icon={<ShieldCheck />} title="원장" caption="보유·현금·체결·포지션 근거" />
              <Drilldown href="/reports" icon={<FileText />} title="리포트" caption="목표가 검증·재검토 후보" />
              <Drilldown href="/strategies" icon={<DatabaseZap />} title="전략" caption="벤치마크·규칙·위험 성과" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,.65fr)_minmax(0,.85fr)]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-950">리포트 품질</h2>
            <p className="mt-1 text-xs text-slate-500">후보보다 제외·누락·검토 플래그를 먼저 봅니다.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {brief.quality.map((item) => (
              <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-4 px-4 py-3" key={item.label}>
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
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-950">최근 변경</h2>
            <p className="mt-1 text-xs text-slate-500">새로 반영된 리포트, 후보, 원장 이벤트입니다.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {brief.changes.map((item) => (
              <Link
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50"
                href={item.href}
                key={`${item.title}-${item.caption}`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-950">{item.title}</div>
                  <div className="mt-1 truncate font-mono text-xs text-slate-500">{item.caption}</div>
                </div>
                <ArrowUpRight className="size-4 text-slate-400" />
              </Link>
            ))}
          </div>
        </div>
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

function Drilldown({ href, icon, title, caption }: { href: string; icon: ReactNode; title: string; caption: string }) {
  return (
    <Button asChild className="h-auto justify-start p-3" variant="ghost">
      <Link href={href}>
        <span className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-500 [&_svg]:size-4">
          {icon}
        </span>
        <span className="grid min-w-0 gap-0.5 text-left">
          <span className="font-medium text-slate-950">{title}</span>
          <span className="truncate text-xs font-normal text-slate-500">{caption}</span>
        </span>
      </Link>
    </Button>
  );
}

function toneText(tone?: DecisionTone) {
  if (tone === 'ok') return 'text-emerald-600';
  if (tone === 'review') return 'text-amber-600';
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
