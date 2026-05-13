import type { Metadata } from 'next';
import { AppShell } from '@/components/ui/AppShell';
import { getArtifactManifest, getOverview, getPersonaLabel } from '@/lib/artifacts';
import { getDefaultPortfolioPersona } from '@/lib/product-model';
import './globals.css';
import './reports/report-detail.css';

export const metadata: Metadata = {
  title: 'SNUSMIC Portfolio Lab',
  description: '리서치 추천, 포트폴리오 원장, 전략 검증을 한 곳에서 추적하는 읽기 전용 투자 리서치 대시보드.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const overview = getOverview();
  const manifest = getArtifactManifest();
  const snapshotDate = overview.simulation_window?.price_end ?? overview.simulation_window?.report_end ?? '—';
  const primaryBookLabel = getPersonaLabel(getDefaultPortfolioPersona());

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
        <AppShell
          priceRange={manifest.price_range}
          primaryBookLabel={primaryBookLabel}
          reportCount={manifest.row_counts.reports}
          reportRange={manifest.report_range}
          snapshotDate={snapshotDate}
          strategyCount={manifest.row_counts.strategy_catalog}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
