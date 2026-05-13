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
    { label: '스냅샷', value: snapshotDate || '—' },
    { label: '리포트', value: `${reportCount.toLocaleString('ko-KR')}건`, caption: reportRangeLabel(reportRange) },
    { label: '가격', value: priceRange.end || '—', caption: reportRangeLabel(priceRange) },
    { label: '전략', value: `${strategyCount.toLocaleString('ko-KR')}개`, caption: primaryBookLabel },
  ];

  return (
    <div className="site-shell">
      <aside className="sidebar border-r border-base-300 bg-base-100/88 backdrop-blur-xl">
        <Link className="brand" href="/" aria-label="SNUSMIC Portfolio Lab 홈">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">
            <span>SNUSMIC</span>
            <span className="brand-kicker">Portfolio Lab</span>
          </span>
        </Link>
        <div className="sidebar__tagline">리서치 · 원장 · 검증</div>
        <SidebarNav items={APP_NAV} />
        <section className="sidebar-card" aria-label="스냅샷 정보">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-black tracking-[-0.02em] text-base-content">스냅샷 정보</div>
            <StatusChip tone="success" dot>
              정적
            </StatusChip>
          </div>
          <dl className="mt-4 grid gap-2 text-xs text-base-content/60">
            {sidebarMetrics.map((metric) => (
              <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2" key={metric.label}>
                <dt className="text-base-content/45">{metric.label}</dt>
                <dd className="min-w-0 text-right">
                  <div className="truncate font-mono font-black text-base-content tabular-nums">{metric.value}</div>
                  {metric.caption ? (
                    <div className="truncate text-[0.68rem] text-base-content/42">{metric.caption}</div>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/5 p-3 text-xs leading-5 text-base-content/62">
            기준 데이터로 만든 읽기 전용 리서치 보드입니다. 주문·호가·실시간 매매 기능은 제공하지 않습니다.
          </div>
        </section>
        <SidebarNav className="side-nav--utility" items={[GITHUB_NAV_ITEM]} />
      </aside>

      <div className="workspace">
        <header className="topbar border-b border-base-300 bg-base-100/88 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="text-lg font-black tracking-[-0.04em] text-base-content md:text-2xl">
              SNUSMIC Portfolio Lab
            </div>
            <div className="max-w-4xl truncate text-xs font-semibold text-base-content/55 md:text-sm">
              리서치 리포트 검증, 포트폴리오 원장, 전략 성과를 한 곳에서 추적하는 정적 스냅샷 기반 투자 리서치 대시보드
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusChip className="hidden md:inline-flex" tone="info">
              <span className="text-base-content/55">스냅샷</span>
              <span className="font-mono text-base-content">{snapshotDate || '—'}</span>
            </StatusChip>
            <StatusChip tone="success" dot>
              정적 스냅샷 · 읽기 전용
            </StatusChip>
            <Link className="btn btn-sm btn-outline" href="/guide">
              읽는 법
            </Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="footer-note footer footer-center bg-base-200 text-base-content/60">
          SNUSMIC Portfolio Lab · 화면의 수치는 정적 산출물로 계산되며, 실시간 주문이나 매매 기능은 제공하지 않습니다.
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
