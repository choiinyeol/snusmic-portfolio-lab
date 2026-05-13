import { AppShell } from '@/components/ui/AppShell';
import { getArtifactManifest, getOverview, getPersonaLabel } from '@/lib/artifacts';
import { getDefaultPortfolioPersona } from '@/lib/product-model';
import './reports/report-detail.css';

export default function AppRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const overview = getOverview();
  const manifest = getArtifactManifest();
  const snapshotDate = overview.simulation_window?.price_end ?? overview.simulation_window?.report_end ?? '—';
  const primaryBookLabel = getPersonaLabel(getDefaultPortfolioPersona());

  return (
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
  );
}
