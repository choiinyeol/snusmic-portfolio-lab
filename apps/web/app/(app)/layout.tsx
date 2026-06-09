import Link from 'next/link';
import { CommandPalette, type CommandTarget } from '@/components/ui/CommandPalette';
import { WORKSTATION_NAV } from '@/components/ui/app-shell-nav';
import { Badge } from '@/components/ui/badge';
import { getAccountCatalog, getArtifactHealth, getArtifactManifest, getOverview, getReportRows } from '@/lib/artifacts';
import { getObjectivePassingRows } from '@/lib/product-model';
import './reports/report-detail.css';

export default function AppRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const overview = getOverview();
  const manifest = getArtifactManifest();
  const health = getArtifactHealth();
  const snapshotDate = overview.simulation_window?.price_end ?? overview.simulation_window?.report_end ?? '—';
  const admittedAccounts = getObjectivePassingRows();
  const commandTargets = buildCommandTargets();

  return (
    <div className="min-h-dvh bg-stone-50 text-stone-950">
      <CommandPalette targets={commandTargets} />
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-[1680px] items-center justify-between gap-4 px-3 sm:px-5">
          <Link className="flex min-w-0 items-center gap-2" href="/" aria-label="SNUSMIC Action Queue 홈">
            <span className="grid size-8 place-items-center rounded-lg bg-stone-950 text-xs font-semibold text-white">SM</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-stone-950">SNUSMIC</span>
              <span className="block truncate text-[11px] text-stone-500">Action Queue Workstation</span>
            </span>
          </Link>
          <nav className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto" aria-label="주요 탐색">
            {WORKSTATION_NAV.map((item) => (
              <Link
                className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-950"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <Badge className="hidden font-mono sm:inline-flex" variant={health.status === 'ok' ? 'success' : 'warning'}>
              {health.status === 'ok' ? '사용 가능' : '검토 필요'}
            </Badge>
            <Badge className="font-mono" variant="outline">
              {snapshotDate}
            </Badge>
            <Badge className="hidden font-mono lg:inline-flex" variant="outline">
              reports {manifest.row_counts.reports.toLocaleString('ko-KR')}
            </Badge>
            <Badge className="hidden font-mono xl:inline-flex" variant="outline">
              books {admittedAccounts.length.toLocaleString('ko-KR')}
            </Badge>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1680px] px-3 py-5 sm:px-5" id="main-content">
        {children}
      </main>
    </div>
  );
}

function buildCommandTargets(): CommandTarget[] {
  const navTargets: CommandTarget[] = WORKSTATION_NAV.map((item) => ({
    kind: 'nav',
    label: item.label,
    description: item.description,
    href: item.href,
    keywords: item.icon,
  }));

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
