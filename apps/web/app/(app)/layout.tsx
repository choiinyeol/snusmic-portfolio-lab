import { AppShell } from '@/components/ui/AppShell';
import type { CommandTarget } from '@/components/ui/CommandPalette';
import { getArtifactManifest, getOverview, getReportRows, getStrategyCatalog } from '@/lib/artifacts';
import { getObjectivePassingRows } from '@/lib/product-model';
import { APP_NAV } from '@/components/ui/app-shell-nav';
import './reports/report-detail.css';

export default function AppRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const overview = getOverview();
  const manifest = getArtifactManifest();
  const snapshotDate = overview.simulation_window?.price_end ?? overview.simulation_window?.report_end ?? '—';
  const admittedStrategies = getObjectivePassingRows();
  const primaryBookLabel = admittedStrategies[0]?.shortLabel ?? admittedStrategies[0]?.label ?? '승인 전략 없음';

  const commandTargets = buildCommandTargets();

  return (
    <AppShell
      commandTargets={commandTargets}
      priceRange={manifest.price_range}
      primaryBookLabel={primaryBookLabel}
      reportCount={manifest.row_counts.reports}
      reportRange={manifest.report_range}
      snapshotDate={snapshotDate}
      strategyCount={admittedStrategies.length}
    >
      {children}
    </AppShell>
  );
}

/** Build the cmd-K command palette index. APP_NAV is the spine; symbols and
 * strategies are appended so power users can jump straight to a ticker or a
 * account_id without going through the screener first. */
function buildCommandTargets(): CommandTarget[] {
  const navTargets: CommandTarget[] = APP_NAV.map((item) => ({
    kind: 'nav',
    label: item.label,
    description: item.description,
    href: item.href,
    keywords: item.icon,
  }));

  // Most-recent report per symbol so the palette doesn't list the same ticker
  // many times with different report IDs.
  const reports = getReportRows();
  const seen = new Set<string>();
  const symbolTargets: CommandTarget[] = [];
  for (const report of reports) {
    if (!report.symbol || seen.has(report.symbol)) continue;
    seen.add(report.symbol);
    symbolTargets.push({
      kind: 'symbol',
      label: report.company || report.symbol,
      description: `${report.symbol} · ${report.exchange || ''}`.trim(),
      href: `/reports/${encodeURIComponent(report.symbol)}`,
      keywords: `${report.symbol} ${report.exchange ?? ''} ${report.company ?? ''}`,
    });
  }

  const admittedIds = new Set(getObjectivePassingRows().map((strategy) => strategy.id));
  const strategyTargets: CommandTarget[] = getStrategyCatalog()
    .filter((strategy) => strategy.isSelectable && admittedIds.has(strategy.strategyId))
    .map((strategy) => ({
      kind: 'strategy',
      label: strategy.label,
      description: strategy.shortLabel || strategy.strategyId,
      href: `/portfolio/${encodeURIComponent(strategy.strategyId)}`,
      keywords: strategy.strategyId,
    }));

  return [...navTargets, ...strategyTargets, ...symbolTargets];
}
