"use client";

import Link from "next/link";
import { useSortable, SortableTh } from "@/components/sortable";
import { SCHOOL_LABELS, type School } from "@/lib/report-meta";
import { cn, formatPct } from "@/lib/utils";
import { signColor } from "@/lib/verdict";
import { FACTOR_SHORT_LABELS, type Candidate, type TopFactor } from "@/components/stats/stats-types";

/** 현재 후보 스크리닝 표 — 정렬 가능, 요인별 체크마크, 종목 페이지 링크 */
export function CandidatesTable({ candidates, factors }: { candidates: Candidate[]; factors: TopFactor[] }) {
  const sort = useSortable<Candidate>(
    candidates,
    [
      { key: "name", value: (r) => r.name },
      { key: "report_date", value: (r) => r.report_date, firstDir: "desc", groupValue: (r) => r.report_date.slice(0, 7) },
      { key: "age_days", value: (r) => r.age_days },
      { key: "return_since", value: (r) => r.return_since_pct, firstDir: "desc", groupValue: (r) => (r.return_since_pct === null ? null : Math.floor(r.return_since_pct / 25)) },
      { key: "score", value: (r) => r.score, firstDir: "desc" },
      ...factors.map((f) => ({
        key: `f_${f.key}`,
        value: (r: Candidate) => r.checks.find((c) => c.key === f.key)?.pass ?? null,
        firstDir: "desc" as const,
      })),
    ],
    [{ key: "score", dir: "desc" }],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground/60 bg-secondary/40 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            <SortableTh sortKey="name" sort={sort}>종목</SortableTh>
            <th scope="col" className="px-3 py-2.5 text-left font-semibold">학회</th>
            <SortableTh sortKey="report_date" sort={sort}>발간일</SortableTh>
            <SortableTh sortKey="age_days" sort={sort} align="right">경과</SortableTh>
            <SortableTh sortKey="return_since" sort={sort} align="right">발간 후</SortableTh>
            <SortableTh sortKey="score" sort={sort} align="right" title="충족한 상위 판별 요인 수 (현재 시점 데이터 기준)">
              충족
            </SortableTh>
            {factors.map((f) => (
              <SortableTh
                key={f.key}
                sortKey={`f_${f.key}`}
                sort={sort}
                align="right"
                title={`${f.label} ${f.cond === ">=" ? "≥" : "≤"} ${f.threshold}${f.unit === "배" ? "배" : f.unit}`}
              >
                {FACTOR_SHORT_LABELS[f.key] ?? f.key}
              </SortableTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {sort.sorted.map((row) => (
            <tr key={`${row.slug}-${row.report_date}`} className="border-b border-dashed border-border/80 transition hover:bg-secondary/30">
              <td className="px-3 py-2">
                <Link href={`/stocks/${row.slug}`} className="font-semibold hover:text-stamp hover:underline">
                  {row.name}
                </Link>
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{row.ticker}</span>
                {row.stale_price && (
                  <span className="ml-1.5 rounded-sm bg-secondary px-1 py-px font-mono text-[9px] text-muted-foreground" title={`시세가 ${row.price_as_of}에 멈춰 있음`}>
                    시세 지연
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {row.schools.map((s) => (
                    <span key={s} className="rounded-sm border border-border bg-secondary/50 px-1 py-px font-mono text-[9px] font-semibold text-muted-foreground">
                      {SCHOOL_LABELS[s as School] ?? s}
                    </span>
                  ))}
                </div>
              </td>
              <td className="tnum px-3 py-2 font-mono text-xs text-muted-foreground">{row.report_date}</td>
              <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{row.age_days}일</td>
              <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-semibold", signColor(row.return_since_pct))}>
                {formatPct(row.return_since_pct)}
              </td>
              <td className="px-3 py-2 text-right">
                <span
                  className={cn(
                    "tnum inline-block rounded-sm px-1.5 py-0.5 font-mono text-xs font-black",
                    row.score >= 4 ? "bg-stamp text-background" : row.score === 3 ? "bg-stamp/15 text-stamp" : "text-muted-foreground",
                  )}
                >
                  {row.score}/{factors.length}
                </span>
              </td>
              {factors.map((f) => {
                const check = row.checks.find((c) => c.key === f.key);
                const pass = check?.pass ?? null;
                return (
                  <td
                    key={f.key}
                    className="px-3 py-2 text-right font-mono text-xs"
                    title={check?.value != null ? `${f.label}: ${check.value}${f.unit === "배" ? "배" : f.unit}` : `${f.label}: 데이터 부족`}
                  >
                    {pass === null ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : pass ? (
                      <span className="font-bold text-stamp">✓</span>
                    ) : (
                      <span className="text-muted-foreground/60">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
