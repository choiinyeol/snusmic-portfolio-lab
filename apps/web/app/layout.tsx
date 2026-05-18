import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'SNUSMIC Portfolio Lab',
  description: '리서치 추천, 포트폴리오, 전략 검증을 한 곳에서 추적하는 읽기 전용 투자 리서치 대시보드.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        {children}
      </body>
    </html>
  );
}
