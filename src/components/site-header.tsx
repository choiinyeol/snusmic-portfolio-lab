import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { dateLabel, reportDataset } from "@/lib/report-model";

export function SiteHeader({ eyebrow }: { eyebrow: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-double border-foreground/70 pb-3">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em] transition hover:text-stamp">
          ← 판결 아카이브
        </Link>
        <p className="hidden font-mono text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground sm:block">{eyebrow}</p>
      </div>
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" aria-label="사이트 내비게이션">
          <Link href="/clubs" className="text-muted-foreground transition hover:text-stamp">
            학회별 성적표
          </Link>
          <Link href="/strategy" className="text-muted-foreground transition hover:text-stamp">
            모멘텀 전략
          </Link>
        </nav>
        <p className="hidden font-mono text-[11px] text-muted-foreground sm:block">기준일 {dateLabel(reportDataset.as_of)}</p>
        <ThemeToggle />
      </div>
    </div>
  );
}
