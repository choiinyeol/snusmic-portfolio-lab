import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ReportLedger, StatStrip } from "@/components/report-ledger";
import { reportDataset, SCHOOL_LABELS, type School } from "@/lib/report-model";
import { clubStats, median, signColor } from "@/lib/verdict";
import { formatPct } from "@/lib/utils";

const SCHOOLS: School[] = ["smic", "yig", "star", "kuvic"];

export function generateStaticParams() {
  return SCHOOLS.map((school) => ({ school }));
}

export async function generateMetadata({ params }: { params: Promise<{ school: string }> }): Promise<Metadata> {
  const { school } = await params;
  const label = SCHOOL_LABELS[school as School];
  return { title: label ? `${label} 성적표 — 판결 아카이브` : "학회 성적표" };
}

export default async function ClubPage({ params }: { params: Promise<{ school: string }> }) {
  const { school } = await params;
  if (!SCHOOLS.includes(school as School)) notFound();
  const club = school as School;

  const records = reportDataset.records
    .filter((r) => r.school === club)
    .sort((a, b) => String(b.report_date ?? "").localeCompare(String(a.report_date ?? "")));
  const stats = clubStats(records);

  const yearGroups = new Map<string, typeof records>();
  for (const record of records) {
    const year = record.report_date?.slice(0, 4) ?? "????";
    yearGroups.set(year, [...(yearGroups.get(year) ?? []), record]);
  }
  const years = [...yearGroups.entries()].sort(([a], [b]) => b.localeCompare(a));

  return (
    <main className="mx-auto max-w-[1500px] space-y-8 px-4 py-6 sm:px-8">
      <SiteHeader eyebrow={`Club Scorecard — ${SCHOOL_LABELS[club]}`} />

      <header>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-6xl">{SCHOOL_LABELS[club]}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          {SCHOOL_LABELS[club]}의 리포트 {stats.total}건을 point-in-time 시세로 채점한 성적표입니다. 최신 발간 순으로 정렬되어 있습니다.
        </p>
      </header>

      <StatStrip
        items={[
          { label: "리포트", value: `${stats.total}건` },
          { label: "가격 검증", value: `${stats.priced}건` },
          { label: "목표가 적중", value: `${stats.hits}건`, tone: "text-stamp" },
          { label: "적중률", value: formatPct(stats.hitRate, 1).replace("+", "") },
          { label: "수익률 중앙값", value: formatPct(stats.medianReturn), tone: signColor(stats.medianReturn) },
          { label: "문샷 (+100%↑)", value: `${stats.moonshots}건` },
        ]}
      />

      <section aria-label="연도별 요약">
        <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">연도별 요약</h2>
        <div className="flex flex-wrap gap-2">
          {years.map(([year, list]) => {
            const returns = list.filter((r) => r.return_latest_pct !== null).map((r) => r.return_latest_pct as number);
            const med = median(returns);
            const hits = list.filter((r) => r.target_hit_until_latest).length;
            return (
              <div key={year} className="rounded-md border border-border bg-card px-3 py-2">
                <p className="font-display text-base font-black leading-none">{year}</p>
                <p className="tnum mt-1 font-mono text-[10px] text-muted-foreground">
                  {list.length}건 · 적중 {hits} · <span className={signColor(med)}>{formatPct(med, 0)}</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="리포트 전체 목록">
        <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">전체 기록 — 최신순</h2>
        <ReportLedger reports={records} />
      </section>
    </main>
  );
}
