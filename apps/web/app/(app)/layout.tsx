import { AppShell } from '@/components/ui/AppShell';
import type { CommandTarget } from '@/components/ui/CommandPalette';
import { getArtifactHealth, getArtifactManifest, getOverview, getReportRows, getAccountCatalog } from '@/lib/artifacts';
import { getObjectivePassingRows } from '@/lib/product-model';
import { APP_NAV } from '@/components/ui/app-shell-nav';
import './reports/report-detail.css';

export default function AppRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const overview = getOverview();
  const manifest = getArtifactManifest();
  const health = getArtifactHealth();
  const healthCheck = health.checks.find((check) => check.severity !== 'ok') ?? health.checks[0];
  const snapshotDate = overview.simulation_window?.price_end ?? overview.simulation_window?.report_end ?? '—';
  const admittedAccounts = getObjectivePassingRows();
  const primaryBookLabel = admittedAccounts[0]?.shortLabel ?? admittedAccounts[0]?.label ?? '승인 계좌 없음';

  const commandTargets = buildCommandTargets();

  return (
    <AppShell
      commandTargets={commandTargets}
      priceRange={manifest.price_range}
      healthStatus={health.status}
      healthCaption={healthCheck?.action ?? healthCheck?.detail ?? '기준일 정렬 완료'}
      primaryBookLabel={primaryBookLabel}
      reportCount={manifest.row_counts.reports}
      reportRange={manifest.report_range}
      snapshotDate={snapshotDate}
      accountCount={admittedAccounts.length}
    >
      {children}
    </AppShell>
  );
}

/** Build the cmd-K command palette index. APP_NAV is the spine; symbols and
 * accounts are appended so power users can jump straight to a ticker or a
 * account_id without going through the review board first. */
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
      href: `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`,
      keywords: `${report.symbol} ${report.exchange ?? ''} ${report.company ?? ''}`,
    });
  }

  const admittedIds = new Set(getObjectivePassingRows().map((account) => account.id));
  const accountTargets: CommandTarget[] = getAccountCatalog()
    .filter((account) => account.isSelectable && admittedIds.has(account.accountId))
    .map((account) => ({
      kind: 'account',
      label: account.label,
      description: account.shortLabel || account.accountId,
      href: `/portfolio/${encodeURIComponent(account.accountId)}`,
      keywords: account.accountId,
    }));

  return [...navTargets, ...accountTargets, ...symbolTargets];
}
