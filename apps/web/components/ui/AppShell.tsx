'use client';

import { ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { APP_NAV, GITHUB_NAV_ITEM } from '@/components/ui/app-shell-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SidebarNav } from '@/components/ui/SidebarNav';
import { cn } from '@/lib/utils';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('snusmic.sidebar-collapsed') === '1',
  );
  const toggleSidebar = () => {
    setSidebarCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem('snusmic.sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };
  const sidebarMetrics: ShellMetric[] = [
    { label: '기준일', value: snapshotDate || '—' },
    { label: '리포트', value: reportCount.toLocaleString('ko-KR'), caption: reportRangeLabel(reportRange) },
    { label: '가격', value: priceRange.end || '—', caption: reportRangeLabel(priceRange) },
    { label: '전략 수', value: strategyCount.toLocaleString('ko-KR'), caption: primaryBookLabel },
  ];

  return (
    <div className="ui-shell min-h-dvh bg-slate-50 text-slate-950">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white/95 py-4 transition-[width,padding] duration-200 lg:flex lg:flex-col',
          sidebarCollapsed ? 'w-16 px-2' : 'w-64 px-3',
        )}
      >
        <Link
          className={cn('flex items-center rounded-lg px-2 py-2', sidebarCollapsed ? 'justify-center gap-0' : 'gap-3')}
          href="/main"
          aria-label="SNUSMIC Portfolio Lab 메인"
        >
          <span className="grid size-8 place-items-center rounded-md bg-slate-950 text-xs font-semibold text-white">
            SM
          </span>
          <span className={cn('min-w-0 gap-0.5', sidebarCollapsed ? 'hidden' : 'grid')}>
            <span className="truncate text-sm font-semibold tracking-tight">SNUSMIC</span>
            <span className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-slate-500">
              Portfolio Lab
            </span>
          </span>
        </Link>

        <button
          type="button"
          className="mt-1 inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-950"
          aria-label={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          title={sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>

        <Separator className="my-3" />
        <SidebarNav items={APP_NAV} compact={sidebarCollapsed} />

        <div className="mt-auto grid gap-3">
          <Card className={cn('rounded-lg shadow-none', sidebarCollapsed && 'hidden')}>
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
          <Button
            asChild
            className={cn('justify-start', sidebarCollapsed && 'justify-center px-0')}
            size="sm"
            variant="outline"
          >
            <Link href={GITHUB_NAV_ITEM.href} target="_blank" rel="noreferrer">
              <span className={cn(sidebarCollapsed && 'sr-only')}>GitHub</span>
              <ExternalLink className={cn('size-3.5', !sidebarCollapsed && 'ml-auto')} />
            </Link>
          </Button>
        </div>
      </aside>

      <div className={cn('min-w-0 transition-[padding] duration-200', sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex min-h-12 items-center justify-end gap-2 px-4 sm:px-6 lg:px-8">
            <Badge className="hidden font-mono sm:inline-flex" variant="outline">
              {snapshotDate || '—'}
            </Badge>
            <Badge variant="success">읽기 전용</Badge>
            <Button asChild size="sm" variant="outline">
              <Link href="/guide">읽는 법</Link>
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-4 lg:px-5" id="main-content">
          {children}
        </main>
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
