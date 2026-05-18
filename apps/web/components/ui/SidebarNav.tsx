'use client';

import { BarChart3, BookOpenText, FileText, GitBranch, Home, LineChart, Search, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export type NavIconKey = 'dashboard' | 'portfolio' | 'reports' | 'strategies' | 'screener' | 'guide' | 'github';

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
  description?: string;
  activePath?: string | null;
};

const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: Home,
  portfolio: BarChart3,
  reports: FileText,
  strategies: LineChart,
  screener: Search,
  guide: BookOpenText,
  github: GitBranch,
};

export function SidebarNav({
  items,
  className = '',
  compact = false,
}: {
  items: SidebarNavItem[];
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const bestActivePath = items
    .map((item) => (item.href.startsWith('/') ? (item.activePath === undefined ? item.href : item.activePath) : null))
    .filter((activePath): activePath is string =>
      Boolean(activePath && (pathname === activePath || (activePath !== '/' && pathname.startsWith(activePath)))),
    )
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav className={cn('grid gap-1', className)} aria-label="주요 탐색">
      {items.map((item) => {
        const isInternal = item.href.startsWith('/');
        const activePath = item.activePath === undefined ? item.href : item.activePath;
        const isCurrent = isInternal && activePath !== null && activePath === bestActivePath;
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className={cn(
              'group flex min-h-9 items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
              isCurrent
                ? 'bg-slate-950 text-white hover:bg-slate-900'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
              compact && 'justify-center px-2',
            )}
            aria-current={isCurrent ? 'page' : undefined}
            target={isInternal ? undefined : '_blank'}
            rel={isInternal ? undefined : 'noreferrer'}
            title={compact ? item.label : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className={cn('min-w-0 truncate', compact && 'sr-only')}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
