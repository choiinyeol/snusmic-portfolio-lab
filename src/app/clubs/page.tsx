import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { reportDataset, SCHOOL_LABELS, type School } from "@/lib/report-model";
import { clubStats, signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

export const metadata: Metadata = { title: "학회별 성적표 — 판결 아카이브" };

const SCHOOL_ORDER: School[] = ["smic", "yig", "star", "kuvic", "ewha", "voera"];
const SCHOOL_DESC: Record<School, string> = {
  smic: "서울대학교 투자연구회 · 2020년부터의 리포트가 수집되어 있습니다",
  yig: "연세대학교 투자동아리 Yonsei Investment Group",
  star: "성균관대학교 금융투자학회 S.T.A.R",
  kuvic: "고려대학교 가치투자연구회 KUVIC",
  ewha: "이화여자대학교 가치투자학회 EIA",
  voera: "홍익대학교 중앙 금융동아리 Voera",
};

export default function ClubsPage() {
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8">
      <SiteHeader eyebrow="Club Scorecards" />
      <h1 className="mt-9 font-display text-4xl font-black tracking-tight sm:text-5xl">학회별 성적표</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-foreground/75">
        여섯 학회의 리포트를 같은 잣대(point-in-time 시세)로 채점했습니다. 성적은 여섯 학회가 나란히 비교되는{" "}
        <strong className="font-bold">2019년 7월 이후 매수 의견</strong>만으로 매기고, 발간 90일 미만의 신생 리포트는 판결을 보류합니다. 학회를
        누르면 전체 기록을 볼 수 있습니다.
      </p>

      <div className="mt-9 grid gap-5 md:grid-cols-2">
        {SCHOOL_ORDER.map((school) => {
          const records = reportDataset.records.filter((r) => r.school === school);
          const stats = clubStats(records);
          const archiveCount = records.filter((r) => r.era === "archive").length;
          return (
            <Link
              key={school}
              href={`/clubs/${school}`}
              className="group rounded-lg border-2 border-foreground/70 bg-card p-6 shadow-[5px_5px_0_0_hsl(var(--foreground)/0.75)] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_hsl(var(--stamp)/0.9)]"
            >
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">{SCHOOL_DESC[school]}</p>
              <h2 className="mt-2 font-display text-3xl font-black tracking-tight transition group-hover:text-stamp">{SCHOOL_LABELS[school]}</h2>
              <dl className="mt-5 grid grid-cols-4 gap-3 border-t border-dashed border-border pt-4">
                <Stat label="매수 리포트" value={`${stats.total}건`} />
                <Stat label="적중" value={`${stats.hits}건`} tone="text-stamp" />
                <Stat label="적중률" value={formatPct(stats.hitRate, 0).replace("+", "")} />
                <Stat label="중앙값" value={formatPct(stats.medianReturn, 1)} tone={signColor(stats.medianReturn)} />
              </dl>
              <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                판결까지 중앙값 {stats.medianDaysToTarget !== null ? `${Math.round(stats.medianDaysToTarget)}일` : "—"}
                {stats.fresh > 0 ? ` · 신생 ${stats.fresh}건 보류` : ""}
                {stats.reference > 0 ? ` · 참고 ${stats.reference}건 제외` : ""}
                {archiveCount > 0 ? ` · 2019-07 이전 아카이브 ${archiveCount}건 채점 제외` : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] text-muted-foreground">{label}</dt>
      <dd className={cn("tnum mt-1 font-display text-xl font-black", tone)}>{value}</dd>
    </div>
  );
}
