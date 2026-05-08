import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import './reports/report-detail.css';

export const metadata: Metadata = {
  title: 'SNUSMIC Portfolio — research-driven allocation',
  description:
    'SMIC 리포트 기반 포트폴리오를 계좌 현황, 외화 표시, 추세 신호, 리포트 성과 중심으로 요약하는 한국어 정적 대시보드.',
};

const NAV = [
  { href: '/', label: 'Dashboard', kicker: '오늘의 한 화면' },
  { href: '/portfolio', label: 'Portfolio', kicker: '보유 / 월말 / 매매' },
  { href: '/reports', label: 'Research', kicker: '리포트 성과' },
  { href: '/strategies', label: 'Strategies', kicker: '백테스트' },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-theme="corporate" data-scroll-behavior="smooth">
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
          <header className="topbar">
            <Link className="brand" href="/" aria-label="SNUSMIC Portfolio 홈">
              <span className="brand__mark" aria-hidden="true" />
              <span className="brand__name">
                <span>SNUSMIC Portfolio</span>
                <span className="brand-kicker">research-driven allocation</span>
              </span>
            </Link>
            <nav className="nav" aria-label="주요 탐색">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="nav__item">
                  <span className="nav__label">{item.label}</span>
                  <span className="nav__kicker">{item.kicker}</span>
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
          <footer className="footer-note">
            정적 자산만 표시합니다. 모든 숫자는 커밋된 CSV/JSON에서 직접 계산되며, 시장 주문이나 실시간 갱신은 하지 않습니다.
          </footer>
        </div>
      </body>
    </html>
  );
}
