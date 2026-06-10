import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { dateLabel, reportDataset } from "@/lib/report-model";

export function SiteHeader({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b-4 border-double border-foreground/70 pb-2">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="nav-link font-mono text-xs font-bold uppercase tracking-[0.28em]"
          aria-label="판결 아카이브 홈으로"
        >
          ← 판결 아카이브
        </Link>
        <p className="hidden font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground md:block">{eyebrow}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <SiteNav />
        <p className="hidden font-mono text-[11px] text-muted-foreground lg:block">기준일 {dateLabel(reportDataset.as_of)}</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
