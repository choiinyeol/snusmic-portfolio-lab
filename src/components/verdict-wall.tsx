"use client";

import { useMemo, useRef, useState } from "react";
import { dateLabel, getDisplayName, type ReportRecord } from "@/lib/report-model";
import { bucketLabels, bucketThresholds, schoolShort, signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

/**
 * 성과 사다리 색 — 급락의 짙은 청색에서 종이색을 지나 상승의 적색으로.
 * 멀티배거는 금장(.wall-gold), 텐배거는 다이아몬드 광채(.wall-prism)가 따로 찍힌다.
 */
const squareClass: Record<ReportRecord["performance_bucket"], string> = {
  Tenbagger: "wall-prism",
  Multibagger: "wall-gold",
  Double: "bg-[#8f0c22] dark:bg-[#ff4a63]",
  Winner: "bg-[#c42848] dark:bg-[#ef6479]",
  Positive: "bg-[#eaa3b0] dark:bg-[#a85f6d]",
  Drawdown: "bg-[#a9c2ec] dark:bg-[#5d7cb8]",
  Wrecked: "bg-[#1c46a8] dark:bg-[#5e86e8]",
  "No quote": "bg-[#d6cfc0] dark:bg-[#3e3e39]",
};

const LEGEND_ORDER: ReportRecord["performance_bucket"][] = [
  "Wrecked",
  "Drawdown",
  "Positive",
  "Winner",
  "Double",
  "Multibagger",
  "Tenbagger",
];

type Tip = { report: ReportRecord; x: number; y: number };

/**
 * 증거의 서가 — 인생 달력처럼, 사각형 하나가 리포트 한 건.
 * 엄격한 발간 연대순으로 깔린 바둑판에서 6년의 성적이 색으로 드러난다.
 * 서버에서 HTML로 미리 그려지는 싸구려 DOM(차트 라이브러리 없음)이라 SSG에 안전하다.
 */
export function VerdictWall({
  reports,
  selectedName,
  onSelect,
}: {
  /** modern 시대 매수 의견 — 호출부에서 걸러서 넘긴다 */
  reports: ReportRecord[];
  selectedName?: string | null;
  onSelect: (sourceName: string) => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const years = useMemo(() => {
    const ordered = [...reports]
      .filter((r) => r.report_date)
      .sort((a, b) => String(a.report_date).localeCompare(String(b.report_date)));
    const map = new Map<string, ReportRecord[]>();
    for (const report of ordered) {
      const year = String(report.report_date).slice(0, 4);
      map.set(year, [...(map.get(year) ?? []), report]);
    }
    return [...map.entries()];
  }, [reports]);

  const counts = useMemo(() => {
    const tally = new Map<ReportRecord["performance_bucket"], number>();
    for (const report of reports) tally.set(report.performance_bucket, (tally.get(report.performance_bucket) ?? 0) + 1);
    return tally;
  }, [reports]);

  const show = (report: ReportRecord, el: HTMLElement) => {
    const host = sectionRef.current?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (!host) return;
    setTip({ report, x: rect.left - host.left + rect.width / 2, y: rect.top - host.top });
  };

  return (
    <section
      ref={sectionRef}
      className="relative"
      aria-label="증거의 서가 — 발간 연대순 성과 모자이크"
      onMouseLeave={() => setTip(null)}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">The Evidence Wall</p>
          <h2 className="mt-1 font-display text-2xl font-black tracking-tight sm:text-3xl">증거의 서가</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            사각형 하나가 매수 리포트 한 건 — {reports.length}건이 발간 순서 그대로 깔려 있습니다. 짙은 청색일수록 깊은 급락, 짙은
            적색일수록 큰 상승. 금장은 멀티배거, 다이아몬드 광채는 텐배거입니다. 눌러서 판결문을 펼치세요.
          </p>
        </div>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="등급 범례">
          {LEGEND_ORDER.map((bucket) => (
            <li
              key={bucket}
              className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-muted-foreground"
              title={`${bucketThresholds[bucket]} · ${counts.get(bucket) ?? 0}건`}
            >
              <span className={cn("wall-cell inline-block h-2.5 w-2.5", squareClass[bucket])} aria-hidden="true" />
              {bucketLabels[bucket]}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 space-y-2.5">
        {years.map(([year, list]) => (
          <div key={year} className="grid grid-cols-[2.4rem_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-3">
            <p className="pt-px text-right font-mono text-[10px] font-bold leading-[13px] text-muted-foreground sm:text-[11px] sm:leading-[15px]">
              {year}
            </p>
            <div className="flex flex-wrap gap-[3px]" role="list" aria-label={`${year}년 발간 ${list.length}건`}>
              {list.map((report) => {
                const active = report.source_name === selectedName;
                return (
                  <button
                    key={report.source_name}
                    type="button"
                    role="listitem"
                    onClick={() => onSelect(report.source_name)}
                    onMouseEnter={(event) => show(report, event.currentTarget)}
                    onFocus={(event) => show(report, event.currentTarget)}
                    onBlur={() => setTip(null)}
                    aria-label={`${getDisplayName(report)} · ${schoolShort[report.school]} · ${dateLabel(report.report_date)} · ${formatPct(report.return_latest_pct)} — 판결문 열기`}
                    className={cn(
                      "wall-cell h-[13px] w-[13px] sm:h-[15px] sm:w-[15px]",
                      squareClass[report.performance_bucket],
                      active && "z-[2] outline outline-2 outline-offset-1 outline-foreground",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {tip && (
        <div
          className="pointer-events-none absolute z-20 w-max max-w-[260px] -translate-x-1/2 -translate-y-full rounded-md border border-foreground/25 bg-popover px-3 py-2 shadow-lg"
          style={{ left: tip.x, top: tip.y - 8 }}
          role="status"
        >
          <p className="truncate text-[13px] font-bold leading-tight">{getDisplayName(tip.report)}</p>
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
            {schoolShort[tip.report.school]} · {dateLabel(tip.report.report_date)}
          </p>
          <p className="mt-0.5 font-mono text-[11px] font-bold">
            <span className={signColor(tip.report.return_latest_pct)}>{formatPct(tip.report.return_latest_pct)}</span>
            <span className="ml-1.5 font-semibold text-muted-foreground">{bucketLabels[tip.report.performance_bucket]}</span>
          </p>
        </div>
      )}
    </section>
  );
}
