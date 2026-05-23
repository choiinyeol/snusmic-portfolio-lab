'use client';

import { ExternalLink, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { APP_NAV, GITHUB_NAV_ITEM } from '@/components/ui/app-shell-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommandPalette, type CommandTarget } from '@/components/ui/CommandPalette';
import { Separator } from '@/components/ui/separator';
import { SidebarNav } from '@/components/ui/SidebarNav';
import { useFocusTrap } from '@/components/ui/use-focus-trap';
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
  accountCount: number;
  reportRange: DateRange;
  priceRange: DateRange;
  primaryBookLabel: string;
  commandTargets?: CommandTarget[];
};

export function AppShell({
  children,
  snapshotDate,
  reportCount,
  accountCount,
  reportRange,
  priceRange,
  primaryBookLabel,
  commandTargets,
}: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('snusmic.sidebar-collapsed') === '1',
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopMode, setDesktopMode] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setDesktopMode(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const closeMobileNav = () => setMobileNavOpen(false);
  const drawerRef = useFocusTrap<HTMLElement>(mobileNavOpen, closeMobileNav);
  const pathname = usePathname();
  // Close the mobile drawer whenever the route changes — the drawer is overlay
  // navigation, so each landing on a new page is a successful close gesture.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the change trigger
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);
  const toggleSidebar = () => {
    setSidebarCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem('snusmic.sidebar-collapsed', next ? '1' : '0');
      return next;
    });
  };
  const sidebarMetrics: ShellMetric[] = [
    { label: '기준일', value: snapshotDate || '—' },
    { label: '리포트', value: `${reportCount.toLocaleString('ko-KR')}기`, caption: reportRangeLabel(reportRange) },
    { label: '가격', value: priceRange.end ? '정상' : '확인 필요', caption: reportRangeLabel(priceRange) },
    {
      label: '계좌',
      value: accountCount > 0 ? `${accountCount.toLocaleString('ko-KR')}개` : '연결 안 됨',
      caption: primaryBookLabel,
    },
  ];

  return (
    <div className="ui-shell min-h-dvh bg-slate-50 text-slate-950">
      <CommandPalette targets={commandTargets ?? []} />
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          aria-label="메뉴 닫기"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <aside
        ref={drawerRef}
        aria-label="주요 탐색"
        tabIndex={-1}
        // `inert` removes the off-canvas drawer from the tab order + AT tree while
        // closed on mobile; on desktop the aside is permanently on-canvas via
        // lg:translate-x-0, and desktopMode flips inert off there.
        inert={!mobileNavOpen && !desktopMode}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white py-4 transition-[transform,width,padding] duration-200',
          // Mobile drawer: slide off-canvas unless toggled
          mobileNavOpen ? 'translate-x-0 px-3' : '-translate-x-full px-3',
          // Desktop: always on-canvas, width toggled via collapsed state
          'lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-16 lg:px-2' : 'lg:w-64 lg:px-3',
        )}
      >
        <Link
          className={cn('flex items-center rounded-lg px-2 py-2', sidebarCollapsed ? 'justify-center gap-0' : 'gap-3')}
          href="/"
          aria-label="SNUSMIC Signal Research Board 홈"
        >
          <span className="grid size-8 place-items-center rounded-md bg-slate-950 text-xs font-semibold text-white">
            SM
          </span>
          <span className={cn('min-w-0 gap-0.5', sidebarCollapsed ? 'hidden' : 'grid')}>
            <span className="truncate text-sm font-semibold">SNUSMIC</span>
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
          <section
            className={cn(
              'rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600',
              sidebarCollapsed && 'hidden',
            )}
            aria-label="Data Status"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase text-slate-500">Data Status</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label="정상" />
            </div>
            <div className="grid gap-2">
              {sidebarMetrics.map((metric) => (
                <div className="grid gap-0.5" key={metric.label}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">{metric.label}</span>
                    <strong className="truncate font-mono text-xs tabular-nums text-slate-950">{metric.value}</strong>
                  </div>
                  {metric.caption ? (
                    <div className="truncate font-mono text-[10px] text-slate-400">{metric.caption}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
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
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex min-h-12 items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                aria-label={mobileNavOpen ? '메뉴 닫기' : '메뉴 열기'}
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen((value) => !value)}
              >
                {mobileNavOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 truncate text-sm font-semibold text-slate-950"
                aria-label="SNUSMIC Signal Research Board 홈"
              >
                <span className="grid size-7 place-items-center rounded-md bg-slate-950 text-[10px] font-semibold text-white">
                  SM
                </span>
                <span className="truncate">SNUSMIC</span>
              </Link>
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              <Badge className="hidden font-mono sm:inline-flex" variant="outline">
                {snapshotDate || '—'}
              </Badge>
              <Button asChild size="sm" variant="outline">
                <Link href="/reports">리포트</Link>
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-3 py-4 sm:px-4 lg:px-5" id="main-content">
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
