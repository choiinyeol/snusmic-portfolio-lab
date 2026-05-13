import Link from 'next/link';
import { APP_NAV, GITHUB_NAV_ITEM } from '@/components/ui/app-shell-nav';
import { SidebarNav } from '@/components/ui/SidebarNav';
import { StatusChip } from '@/components/ui/StatusChip';

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
    { label: 'SNAPSHOT', value: snapshotDate || '—' },
    { label: 'REPORTS', value: `${reportCount.toLocaleString('ko-KR')}`, caption: reportRangeLabel(reportRange) },
    { label: 'PRICE', value: priceRange.end || '—', caption: reportRangeLabel(priceRange) },
    { label: 'BOOKS', value: `${strategyCount.toLocaleString('ko-KR')}`, caption: primaryBookLabel },
  ];

  return (
    <div className="site-shell site-shell--archive">
      <aside className="sidebar archive-sidebar border-r border-base-300 bg-base-100">
        <Link className="brand brand--archive" href="/" aria-label="SNUSMIC Portfolio Lab 홈">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">
            <span>SNUSMIC</span>
            <span className="brand-kicker">Research Archive</span>
          </span>
        </Link>
        <SidebarNav items={APP_NAV} />
        <section className="archive-sidebar__facts" aria-label="스냅샷 정보">
          {sidebarMetrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              {metric.caption ? <em>{metric.caption}</em> : null}
            </div>
          ))}
        </section>
        <SidebarNav className="side-nav--utility" items={[GITHUB_NAV_ITEM]} />
      </aside>

      <div className="workspace workspace--archive">
        <header className="topbar topbar--archive border-b border-base-300 bg-base-100">
          <div className="topbar--archive__left">
            <span>SNUSMIC Portfolio Lab</span>
            <strong>정적 산출물 / 읽기 전용</strong>
          </div>
          <div className="topbar--archive__right">
            <StatusChip className="hidden md:inline-flex" tone="info">
              <span className="text-base-content/55">SNAPSHOT</span>
              <span className="font-mono text-base-content">{snapshotDate || '—'}</span>
            </StatusChip>
            <StatusChip tone="success" dot>
              No live trading
            </StatusChip>
            <Link className="archive-link-button" href="/guide">
              읽는 법
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer-note footer footer-center bg-base-200 text-base-content/60">
          Static research artifacts only. No order entry, quote stream, or investment advice.
        </footer>
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
