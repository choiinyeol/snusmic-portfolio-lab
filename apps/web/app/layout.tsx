import type { Metadata } from 'next';
import Link from 'next/link';
import { SidebarNav, type SidebarNavItem } from '@/components/ui/SidebarNav';
import { getArtifactManifest, getOverview } from '@/lib/artifacts';
import './globals.css';
import './reports/report-detail.css';

export const metadata: Metadata = {
  title: 'SNUSMIC Portfolio Lab',
  description: '리서치 추천, 포트폴리오 원장, 전략 검증을 한 곳에서 추적하는 정적 스냅샷 기반 투자 리서치 대시보드.',
};

const NAV: SidebarNavItem[] = [
  { href: '/', label: 'Overview', icon: '⌂' },
  { href: '/portfolio', label: 'Portfolio', icon: '◔' },
  { href: '/reports', label: 'Reports', icon: '▤' },
  { href: '/strategies', label: 'Strategies', icon: '⌁' },
  { href: '/screener', label: 'Screener', icon: '◎' },
  { href: '/guide', label: 'Guide', icon: '?' },
  { href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab', label: 'GitHub', icon: '◈' },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const overview = getOverview();
  const manifest = getArtifactManifest();
  const snapshotDate = overview.simulation_window?.price_end ?? overview.simulation_window?.report_end ?? '—';
  return (
    <html lang="ko" data-theme="snusmic" data-scroll-behavior="smooth">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body>
        <div className="site-shell">
          <aside className="sidebar border-r border-base-300 bg-base-100/80 backdrop-blur-xl">
            <Link className="brand" href="/" aria-label="SNUSMIC Portfolio Lab 홈">
              <span className="brand__mark" aria-hidden="true" />
              <span className="brand__name">
                <span>SNUSMIC Portfolio Lab</span>
                <span className="brand-kicker">Overview · Portfolio · Reports · Strategies · Screener</span>
              </span>
            </Link>
            <SidebarNav items={NAV} />
            <div className="sidebar-card">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/40">기준 정보</div>
              <dl className="mt-4 grid gap-2 text-xs text-base-content/60">
                <div>
                  <dt>기준일</dt>
                  <dd className="font-mono font-bold text-base-content">{snapshotDate}</dd>
                </div>
                <div>
                  <dt>데이터</dt>
                  <dd className="font-bold text-base-content">기준 데이터 · v{manifest.schema_version}</dd>
                </div>
                <div>
                  <dt>리포트 범위</dt>
                  <dd className="font-mono font-bold text-base-content">
                    {manifest.report_range.start} → {manifest.report_range.end}
                  </dd>
                </div>
                <div>
                  <dt>가격 범위</dt>
                  <dd className="font-mono font-bold text-base-content">
                    {manifest.price_range.start} → {manifest.price_range.end}
                  </dd>
                </div>
                <div>
                  <dt>파일</dt>
                  <dd className="font-bold text-base-content">
                    {manifest.artifacts.length} files · reports {manifest.row_counts.reports}
                  </dd>
                </div>
                <div>
                  <dt>거래</dt>
                  <dd className="font-bold text-base-content">실시간 매매 아님</dd>
                </div>
              </dl>
            </div>
          </aside>

          <div className="workspace">
            <header className="topbar border-b border-base-300 bg-base-100/85 backdrop-blur-xl">
              <div className="min-w-0">
                <div className="text-sm font-black tracking-[-0.03em] text-base-content md:text-lg">
                  SNUSMIC Portfolio Lab
                </div>
                <div className="text-xs font-semibold text-base-content/50">
                  Overview · Portfolio · Reports · Strategies · Screener
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="hidden items-center gap-2 text-xs font-semibold text-base-content/55 md:flex">
                  <span>기준일</span>
                  <span className="rounded-full border border-base-300 bg-base-200/70 px-3 py-1 font-mono font-bold text-base-content">
                    {snapshotDate}
                  </span>
                </div>
                <span className="rounded-full border border-success/15 bg-success/10 px-3 py-1 text-xs font-bold text-success">
                  기준 데이터 · 실시간 매매 아님
                </span>
                <Link className="btn btn-sm btn-outline" href="/reports">
                  About SMIC →
                </Link>
              </div>
            </header>
            <main>{children}</main>
            <footer className="footer-note footer footer-center bg-base-200 text-base-content/60">
              SNUSMIC Portfolio Lab · 화면의 수치는 기준 데이터로 계산되며, 실시간 주문이나 매매 기능은 제공하지
              않습니다.
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
