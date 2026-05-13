import { ArrowUpRight, DatabaseZap, FileText, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { buildDecisionBrief, type DecisionTone } from '@/lib/decision-brief';
import { getDashboardViewModel } from '@/lib/dashboard-view-model';
import { formatKrw, formatPercent } from '@/lib/format';

export default function OverviewPage() {
  const view = getDashboardViewModel();
  const brief = buildDecisionBrief(view);
  const { overview, selectedStrategy } = view;

  return (
    <div className="grid gap-5">
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">기준일 {overview.snapshotDate || '—'}</Badge>
              <Badge variant="success">읽기 전용</Badge>
              <Badge variant="secondary">{selectedStrategy?.shortLabel || overview.portfolio.label}</Badge>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">스냅샷</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                오늘 확인할 원장 상태, 재검토 항목, 데이터 신뢰도를 먼저 보여줍니다. 세부 차트와 표는 각
                원장·리포트·전략 화면에서 확인합니다.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/reports">리포트 확인</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/portfolio">
                원장 열기 <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label="상태 판정">
        {brief.state.map((item) => (
          <Card className="shadow-sm" key={item.label}>
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`font-mono text-xl font-semibold tabular-nums ${toneText(item.tone)}`}>{item.value}</div>
              <p className="mt-1 truncate text-xs text-slate-500">{item.caption}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>확인할 항목</CardTitle>
                <CardDescription>보유, 후보, 만료, 데이터 플래그를 하나의 검토 대기열로 정리합니다.</CardDescription>
              </div>
              <Badge variant="outline">{brief.decisions.length.toLocaleString('ko-KR')}개</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {brief.decisions.map((item) => (
                <Link
                  className="grid gap-3 p-4 transition-colors hover:bg-slate-50 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center"
                  href={item.href}
                  key={item.id}
                >
                  <div>
                    <Badge variant={badgeVariant(item.tone)}>{item.label}</Badge>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-950">{item.title}</div>
                    <div className="mt-1 text-sm leading-5 text-slate-500">{item.reason}</div>
                  </div>
                  <div className={`font-mono text-sm font-semibold tabular-nums ${toneText(item.tone)}`}>
                    {item.metric}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle>원장 상태</CardTitle>
              <CardDescription>홈에서는 위험 판정만 보여주고, 보유 상세는 원장에서 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 p-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">평가액</span>
                  <strong className="font-mono tabular-nums">{formatKrw(overview.portfolio.finalEquityKrw)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">현금</span>
                  <strong className="font-mono tabular-nums">{formatKrw(overview.portfolio.cashKrw)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">현재 보유</span>
                  <strong className="font-mono tabular-nums">
                    {overview.portfolio.holdingCount.toLocaleString('ko-KR')}개
                  </strong>
                </div>
              </div>
              <Separator />
              <div className="grid gap-2">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-sm text-slate-500">현금 비중</span>
                  <strong className="font-mono text-3xl font-semibold tracking-tight tabular-nums">
                    {formatPercent(overview.portfolio.cashWeight)}
                  </strong>
                </div>
                <Progress value={(overview.portfolio.cashWeight ?? 0) * 100} />
                <p className="text-xs leading-5 text-slate-500">
                  현재 선택 원장은 보유 종목보다 현금 대기가 핵심 상태입니다. 보유/체결 원인은 원장 화면에서 추적합니다.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle>바로가기</CardTitle>
              <CardDescription>세부 분석은 전용 화면에서만 다룹니다.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 p-3">
              <Drilldown href="/portfolio" icon={<ShieldCheck />} title="원장" caption="보유·현금·체결·포지션 근거" />
              <Drilldown href="/reports" icon={<FileText />} title="리포트" caption="목표가 검증·재검토 후보" />
              <Drilldown href="/strategies" icon={<DatabaseZap />} title="전략" caption="벤치마크·규칙·위험 성과" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,.65fr)_minmax(0,.85fr)]">
        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle>리포트 품질</CardTitle>
            <CardDescription>후보를 보기 전에 제외·누락·검토 플래그를 먼저 확인합니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-4">
            {brief.quality.map((item) => (
              <div
                className="flex items-start justify-between gap-4 rounded-lg border border-slate-100 p-3"
                key={item.label}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-950">{item.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.caption}</div>
                </div>
                <div className={`font-mono text-sm font-semibold tabular-nums ${toneText(item.tone)}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle>최근 변경</CardTitle>
            <CardDescription>새로 반영된 리포트, 후보, 원장 이벤트입니다.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {brief.changes.map((item) => (
                <Link
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 p-4 transition-colors hover:bg-slate-50"
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
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Drilldown({
  href,
  icon,
  title,
  caption,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  caption: string;
}) {
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
