import type { Metadata } from 'next';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata: Metadata = {
  title: 'SNUSMIC Signal Research Board',
  description: '발간 리포트, 가격 이력, 계좌 흐름을 같은 기준일로 묶어 사람이 직접 판단할 증거를 보여주는 리서치 보드.',
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
