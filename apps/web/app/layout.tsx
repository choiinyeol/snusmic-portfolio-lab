import type { Metadata } from 'next';
import Link from 'next/link';
import { getOverview } from '@/lib/artifacts';
import './globals.css';
import './reports/report-detail.css';

export const metadata: Metadata = {
  title: 'SNUSMIC Portfolio Lab',
  description: '리서치 추천, 포트폴리오 원장, 전략 검증을 한 곳에서 추적하는 정적 스냅샷 기반 투자 리서치 대시보드.',
};

const NAV = [
  { href: '/', label: 'Dashboard', icon: '⌂' },
  { href: '/portfolio', label: 'Portfolio', icon: '◔' },
  { href: '/reports', label: 'Reports', icon: '▤' },
  { href: '/strategies', label: 'Strategies', icon: '⌁' },
  { href: '/strategies', label: 'Backtests', icon: '△' },
  { href: '/reports', label: 'Data', icon: '◎' },
  { href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab', label: 'GitHub', icon: '◈' },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const overview = getOverview();
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
                <span className="brand-kicker">Research · Portfolio · Strategy</span>
              </span>
            </Link>
            <nav className="side-nav" aria-label="주요 탐색">
              {NAV.map((item) => (
                <Link key={`${item.href}-${item.label}`} href={item.href} className="side-nav__item">
                  <span className="side-nav__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="sidebar-card">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/40">Snapshot Info</div>
              <dl className="mt-4 grid gap-2 text-xs text-base-content/60">
                <div>
                  <dt>기준일</dt>
                  <dd className="font-mono font-bold text-base-content">{snapshotDate}</dd>
                </div>
                <div>
                  <dt>데이터</dt>
                  <dd className="font-bold text-base-content">Static Artifacts</dd>
                </div>
                <div>
                  <dt>거래</dt>
                  <dd className="font-bold text-base-content">No live trading</dd>
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
                <div className="text-xs font-semibold text-base-content/50">Research · Portfolio · Strategy</div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="hidden items-center gap-2 text-xs font-semibold text-base-content/55 md:flex">
                  <span>Snapshot</span>
                  <span className="rounded-full border border-base-300 bg-base-200/70 px-3 py-1 font-mono font-bold text-base-content">
                    {snapshotDate}
                  </span>
                </div>
                <span className="rounded-full border border-success/15 bg-success/10 px-3 py-1 text-xs font-bold text-success">
                  Static Artifacts · No live trading
                </span>
                <Link className="btn btn-sm btn-outline" href="/reports">
                  About SMIC →
                </Link>
              </div>
            </header>
            <main>{children}</main>
            <footer className="footer-note footer footer-center bg-base-200 text-base-content/60">
              SNUSMIC Portfolio Lab · 모든 수치는 커밋된 정적 아티팩트에서 산출되며, 실시간 거래나 외부 데이터 호출은
              하지 않습니다.
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}
