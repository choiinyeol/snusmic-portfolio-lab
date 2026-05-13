import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { APP_NAV, GITHUB_NAV_ITEM } from '@/components/ui/app-shell-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SidebarNav } from '@/components/ui/SidebarNav';

type ShellMetric = {
  label: string;
  value: string;
  caption?: string;
};

type AppShellProps = {
  children: React.ReactNode;
  snapshotDate: string;
  reportCount: number;
  strategyCount: number;
  reportRange: DateRange;
  priceRange: DateRange;
  primaryBookLabel: string;
};

export function AppShell({
  children,
  snapshotDate,
  reportCount,
  strategyCount,
  reportRange,
  priceRange,
  primaryBookLabel,
}: AppShellProps) {
  const sidebarMetrics: ShellMetric[] = [
    { label: '기준일', value: snapshotDate || '—' },
    { label: '리포트', value: reportCount.toLocaleString('ko-KR'), caption: reportRangeLabel(reportRange) },
    { label: '가격', value: priceRange.end || '—', caption: reportRangeLabel(priceRange) },
    { label: '전략 수', value: strategyCount.toLocaleString('ko-KR'), caption: primaryBookLabel },
  ];

  return (
    <div className="ui-shell min-h-dvh bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white/95 px-3 py-4 lg:flex lg:flex-col">
        <Link
          className="flex items-center gap-3 rounded-lg px-2 py-2"
          href="/main"
          aria-label="SNUSMIC Portfolio Lab 메인"
        >
          <span className="grid size-8 place-items-center rounded-md bg-slate-950 text-xs font-semibold text-white">
            SM
          </span>
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate text-sm font-semibold tracking-tight">SNUSMIC</span>
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
              Portfolio Lab
            </span>
          </span>
        </Link>

        <Separator className="my-3" />
        <SidebarNav items={APP_NAV} />

        <div className="mt-auto grid gap-3">
          <Card className="rounded-lg shadow-none">
            <CardContent className="grid gap-3 p-3">
              {sidebarMetrics.map((metric) => (
                <div className="grid gap-1" key={metric.label}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">
                      {metric.label}
                    </span>
                    <strong className="truncate font-mono text-xs tabular-nums text-slate-950">{metric.value}</strong>
                  </div>
                  {metric.caption ? (
                    <div className="truncate font-mono text-[10px] text-slate-400">{metric.caption}</div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
          <Button asChild className="justify-start" size="sm" variant="outline">
            <Link href={GITHUB_NAV_ITEM.href} target="_blank" rel="noreferrer">
              GitHub <ExternalLink className="ml-auto size-3.5" />
            </Link>
          </Button>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
          <div className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-950">SNUSMIC Portfolio Lab</div>
              <div className="hidden truncate text-xs text-slate-500 sm:block">리포트·포트폴리오 분석</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="hidden font-mono sm:inline-flex" variant="outline">
                {snapshotDate || '—'}
              </Badge>
              <Badge variant="success">읽기 전용</Badge>
              <Button asChild size="sm" variant="outline">
                <Link href="/guide">읽는 법</Link>
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

type DateRange = { start: string | null; end: string | null };

function reportRangeLabel(range: DateRange): string {
  if (!range.start && !range.end) return '범위 없음';
  if (range.start === range.end) return range.end ?? range.start ?? '—';
  return `${range.start || '—'} → ${range.end || '—'}`;
}
