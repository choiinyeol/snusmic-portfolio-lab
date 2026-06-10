"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Contrast, RotateCcw } from "lucide-react";
import { dateLabel, getDisplayName, SCHOOL_LABELS, type ReportRecord, type School } from "@/lib/report-model";
import { bucketBadgeClass, bucketLabels, bucketThresholds, schoolShort, signColor, tickerSlug } from "@/lib/verdict";
import { cn, formatPct, formatPrice } from "@/lib/utils";

type Bucket = ReportRecord["performance_bucket"];

/**
 * 성과 사다리 색 — 급락의 짙은 청색에서 종이색을 지나 상승의 적색으로.
 * 멀티배거는 금장(.wall-gold), 텐배거는 다이아몬드 광채(.wall-prism)가 따로 찍힌다.
 * wall-b-* 클래스는 색약 대비 질감(.wall-pattern) 훅이다.
 */
const squareClass: Record<Bucket, string> = {
  Tenbagger: "wall-prism",
  Multibagger: "wall-gold",
  Double: "wall-b-double bg-[#8f0c22] dark:bg-[#ff4a63]",
  Winner: "wall-b-winner bg-[#c42848] dark:bg-[#ef6479]",
  Positive: "wall-b-positive bg-[#eaa3b0] dark:bg-[#a85f6d]",
  Drawdown: "wall-b-drawdown bg-[#a9c2ec] dark:bg-[#5d7cb8]",
  Wrecked: "wall-b-wrecked bg-[#1c46a8] dark:bg-[#5e86e8]",
  "No quote": "bg-[#d6cfc0] dark:bg-[#3e3e39]",
};

const LEGEND_ORDER: Bucket[] = ["Wrecked", "Drawdown", "Positive", "Winner", "Double", "Multibagger", "Tenbagger", "No quote"];

/** 학회 잉크 — candle-chart의 마커 색 관습을 그대로 따른다 */
const SCHOOL_INK: Record<School, string> = {
  smic: "--stamp",
  yig: "--down",
  star: "--warn",
  kuvic: "--quality",
  ewha: "--ewha",
  voera: "--voera",
};

const SCHOOL_ORDER: School[] = ["smic", "yig", "star", "kuvic", "ewha", "voera"];

type Tip = { report: ReportRecord; x: number; y: number };
type Pop = { report: ReportRecord; x: number; y: number; side: "above" | "below"; anchor: HTMLElement };

/* 색약 질감 모드 — 접근성 설정이라 localStorage에 남고, 서버 렌더(SSG)에선 항상 꺼져 있다 */
const TEXTURE_KEY = "verdict-wall-texture";
const TEXTURE_EVENT = "verdict-wall-texture";

function subscribeTexture(callback: () => void) {
  window.addEventListener(TEXTURE_EVENT, callback);
  return () => window.removeEventListener(TEXTURE_EVENT, callback);
}

function readTexture() {
  try {
    return localStorage.getItem(TEXTURE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeTexture(next: boolean) {
  try {
    localStorage.setItem(TEXTURE_KEY, next ? "1" : "0");
  } catch {
    /* 프라이버시 모드 등 — 저장만 못 할 뿐 */
  }
  window.dispatchEvent(new Event(TEXTURE_EVENT));
}

/**
 * 증거의 서가 — 인생 달력처럼, 사각형 하나가 리포트 한 건.
 * 엄격한 발간 연대순으로 깔린 바둑판에서 6년의 성적이 색으로 드러난다.
 * 서버에서 HTML로 미리 그려지는 싸구려 DOM(차트 라이브러리 없음)이라 SSG에 안전하다.
 *
 * 상호작용 — 범례·학회 칩은 토글 필터(선택 외에는 바램), 셀 첫 클릭은 요약 카드,
 * 같은 셀 두 번째 클릭은 곧장 판결문. ESC·바깥 클릭으로 카드가 닫힌다.
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
  const popRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [buckets, setBuckets] = useState<Set<Bucket>>(() => new Set());
  const [schools, setSchools] = useState<Set<School>>(() => new Set());
  const texture = useSyncExternalStore(subscribeTexture, readTexture, () => false);

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
    const tally = new Map<Bucket, number>();
    for (const report of reports) tally.set(report.performance_bucket, (tally.get(report.performance_bucket) ?? 0) + 1);
    return tally;
  }, [reports]);

  const schoolCounts = useMemo(() => {
    const tally = new Map<School, number>();
    for (const report of reports) tally.set(report.school, (tally.get(report.school) ?? 0) + 1);
    return tally;
  }, [reports]);

  const filterActive = buckets.size > 0 || schools.size > 0;
  const matches = (report: ReportRecord) =>
    (buckets.size === 0 || buckets.has(report.performance_bucket)) && (schools.size === 0 || schools.has(report.school));
  const matched = useMemo(() => {
    if (buckets.size === 0 && schools.size === 0) return reports.length;
    return reports.filter(
      (report) => (buckets.size === 0 || buckets.has(report.performance_bucket)) && (schools.size === 0 || schools.has(report.school)),
    ).length;
  }, [reports, buckets, schools]);

  const toggleBucket = (bucket: Bucket) =>
    setBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });

  const toggleSchool = (school: School) =>
    setSchools((prev) => {
      const next = new Set(prev);
      if (next.has(school)) next.delete(school);
      else next.add(school);
      return next;
    });

  const resetFilters = () => {
    setBuckets(new Set());
    setSchools(new Set());
  };

  const toggleTexture = () => writeTexture(!texture);

  const show = (report: ReportRecord, el: HTMLElement) => {
    if (pop) return; // 카드가 열려 있으면 종이는 한 장만 — 호버 툴팁은 잠시 쉰다
    const host = sectionRef.current?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (!host) return;
    setTip({ report, x: rect.left - host.left + rect.width / 2, y: rect.top - host.top });
  };

  const openPop = (report: ReportRecord, el: HTMLElement) => {
    const host = sectionRef.current?.getBoundingClientRect();
    if (!host) return;
    const rect = el.getBoundingClientRect();
    const center = rect.left - host.left + rect.width / 2;
    const half = 160;
    const x = host.width > half * 2 ? Math.min(Math.max(center, half), host.width - half) : host.width / 2;
    const side: Pop["side"] = rect.top - host.top > 250 ? "above" : "below";
    const y = side === "above" ? rect.top - host.top - 8 : rect.bottom - host.top + 8;
    setTip(null);
    setPop({ report, x, y, side, anchor: el });
  };

  // 카드 닫기 — ESC는 셀로 포커스를 되돌리고, 바깥 클릭은 조용히 접는다 (셀 클릭은 셀이 알아서)
  useEffect(() => {
    if (!pop) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setPop(null);
      pop.anchor.focus({ preventScroll: true });
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-wall-pop]") || target?.closest("[data-wall-cell]")) return;
      setPop(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [pop]);

  // 카드가 열리면 다이얼로그로 포커스 — 키보드 사용자는 바로 Tab으로 행동을 고른다
  useEffect(() => {
    if (pop) popRef.current?.focus({ preventScroll: true });
  }, [pop]);

  return (
    <section
      ref={sectionRef}
      className={cn("relative", texture && "wall-pattern")}
      aria-label="증거의 서가 — 발간 연대순 성과 모자이크"
      onMouseLeave={() => setTip(null)}
    >
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">The Evidence Wall</p>
          <h2 className="mt-1 font-display text-2xl font-black tracking-tight sm:text-3xl">증거의 서가</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
            사각형 하나가 매수 리포트 한 건 — {reports.length}건이 발간 순서 그대로 깔려 있습니다. 짙은 청색일수록 깊은 급락, 짙은
            적색일수록 큰 상승. 금장은 멀티배거, 다이아몬드 광채는 텐배거입니다. 칸을 누르면 요약 카드가, 한 번 더 누르면 판결문이
            열립니다. 범례를 누르면 그 등급만 남습니다.
          </p>
        </div>
        <ul className="flex max-w-md flex-wrap items-center gap-x-0.5 gap-y-0.5 lg:justify-end" role="group" aria-label="등급 범례 — 누르면 해당 등급만 강조">
          {LEGEND_ORDER.map((bucket) => {
            const pressed = buckets.has(bucket);
            const faded = buckets.size > 0 && !pressed;
            return (
              <li key={bucket}>
                <button
                  type="button"
                  onClick={() => toggleBucket(bucket)}
                  aria-pressed={pressed}
                  title={`${bucketThresholds[bucket]} · ${counts.get(bucket) ?? 0}건${pressed ? " — 선택 해제" : " — 이 등급만 강조"}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-1.5 py-1 font-mono text-[10px] font-semibold transition active:scale-[0.94]",
                    pressed ? "bg-secondary text-foreground shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.55)]" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                    faded && "opacity-40",
                  )}
                >
                  <span className={cn("inline-block h-2.5 w-2.5 rounded-[2px]", squareClass[bucket])} aria-hidden="true" />
                  {bucketLabels[bucket]}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-y border-dashed border-border py-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="학회 필터 — 누르면 해당 학회만 강조">
          <span className="mr-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">학회 잉크</span>
          {SCHOOL_ORDER.map((school) => {
            const pressed = schools.has(school);
            const faded = schools.size > 0 && !pressed;
            const ink = `hsl(var(${SCHOOL_INK[school]}))`;
            const count = schoolCounts.get(school) ?? 0;
            return (
              <button
                key={school}
                type="button"
                onClick={() => toggleSchool(school)}
                aria-pressed={pressed}
                disabled={count === 0}
                title={`${SCHOOL_LABELS[school]} · ${count}건${pressed ? " — 선택 해제" : " — 이 학회만 강조"}`}
                style={
                  pressed
                    ? { color: ink, borderColor: `hsl(var(${SCHOOL_INK[school]}) / 0.55)`, background: `hsl(var(${SCHOOL_INK[school]}) / 0.12)` }
                    : undefined
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold transition active:scale-[0.94]",
                  !pressed && "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
                  faded && "opacity-45",
                  count === 0 && "opacity-30",
                )}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: ink }} aria-hidden="true" />
                {schoolShort[school]}
                <span className="tnum font-semibold opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {filterActive && (
            <p className="font-mono text-[10px] text-muted-foreground" role="status">
              강조 <span className="tnum font-black text-foreground">{matched}</span>건 / {reports.length}건 (
              {((matched / Math.max(reports.length, 1)) * 100).toFixed(1)}%)
            </p>
          )}
          {filterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-full border border-stamp/50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-stamp transition hover:bg-stamp hover:text-background active:scale-[0.94]"
            >
              <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" /> 전체 보기
            </button>
          )}
          <button
            type="button"
            onClick={toggleTexture}
            aria-pressed={texture}
            title="색 구분이 어려울 때 — 등급별 질감 무늬를 덧입힙니다 (상승은 점·가로결, 하락은 사선)"
            className={cn(
              "flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold transition active:scale-[0.94]",
              texture ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
            )}
          >
            <Contrast className="h-2.5 w-2.5" aria-hidden="true" /> 질감
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {years.map(([year, list]) => (
          <div key={year} className="grid grid-cols-[2.4rem_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-3">
            <p className="pt-px text-right font-mono text-[10px] font-bold leading-[13px] text-muted-foreground sm:text-[11px] sm:leading-[15px]">
              {year}
            </p>
            <div className="flex flex-wrap gap-[3px]" role="list" aria-label={`${year}년 발간 ${list.length}건`}>
              {list.map((report) => {
                const active = report.source_name === selectedName;
                const popped = pop?.report.source_name === report.source_name;
                return (
                  <button
                    key={report.source_name}
                    type="button"
                    role="listitem"
                    data-wall-cell
                    onClick={(event) => {
                      // 두 번째 클릭은 너그럽게 — 같은 칸이면 곧장 판결문으로
                      if (popped) {
                        setPop(null);
                        onSelect(report.source_name);
                      } else {
                        openPop(report, event.currentTarget);
                      }
                    }}
                    onMouseEnter={(event) => show(report, event.currentTarget)}
                    onFocus={(event) => show(report, event.currentTarget)}
                    onBlur={() => setTip(null)}
                    aria-label={`${getDisplayName(report)} · ${schoolShort[report.school]} · ${dateLabel(report.report_date)} · ${formatPct(report.return_latest_pct)} — 요약 카드 열기`}
                    className={cn(
                      "wall-cell h-[13px] w-[13px] sm:h-[15px] sm:w-[15px]",
                      squareClass[report.performance_bucket],
                      filterActive && !matches(report) && "wall-dim",
                      (active || popped) && "z-[2] outline outline-2 outline-offset-1 outline-foreground",
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

      {pop && <WallPopCard pop={pop} popRef={popRef} onClose={() => setPop(null)} onSelect={onSelect} />}
    </section>
  );
}

/** 셀 요약 카드 — 판결문 미리보기. 판결문 전체 점프 또는 종목 페이지로 가는 두 갈래 */
function WallPopCard({
  pop,
  popRef,
  onClose,
  onSelect,
}: {
  pop: Pop;
  popRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onSelect: (sourceName: string) => void;
}) {
  const report = pop.report;
  const slug = tickerSlug(report);
  const hit = Boolean(report.target_hit_until_latest) && report.days_to_target !== null;
  return (
    <div
      ref={popRef}
      data-wall-pop
      role="dialog"
      aria-label={`${getDisplayName(report)} 판결 요약`}
      tabIndex={-1}
      data-side={pop.side}
      className="wall-pop outline-none"
      style={{ "--pop-x": `${pop.x}px`, "--pop-y": `${pop.y}px` } as React.CSSProperties}
    >
      <div className="wall-pop-in overflow-hidden rounded-lg border-2 border-foreground/80 bg-card shadow-[5px_5px_0_0_hsl(var(--foreground)/0.85)]">
        <div className="flex items-start justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-[10px] text-muted-foreground">
              <span
                className="rounded-sm border px-1 py-px font-bold"
                style={{ color: `hsl(var(${SCHOOL_INK[report.school]}))`, borderColor: `hsl(var(${SCHOOL_INK[report.school]}) / 0.45)` }}
              >
                {schoolShort[report.school]}
              </span>
              <span>{dateLabel(report.report_date)}</span>
              {report.ticker && <span>· {report.ticker}</span>}
            </p>
            <p className="mt-1 truncate font-display text-base font-black leading-tight tracking-tight">{getDisplayName(report)}</p>
          </div>
          <span
            className={cn("inline-block shrink-0 -rotate-2 rounded-md border px-1.5 py-0.5 font-display text-[11px] tracking-tight", bucketBadgeClass[report.performance_bucket])}
            title={`${bucketLabels[report.performance_bucket]} — ${bucketThresholds[report.performance_bucket]}`}
          >
            {bucketLabels[report.performance_bucket]}
          </span>
        </div>

        <dl className="mx-4 mt-2.5 space-y-1 border-y border-dashed border-border py-2 font-mono text-[11px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">발간가 → 목표가</dt>
            <dd className="tnum font-bold">
              {formatPrice(report.report_current_price, report.market)} <span className="font-normal text-muted-foreground">→</span>{" "}
              <span className="text-stamp">{formatPrice(report.target_price, report.market)}</span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">발간 후 수익률</dt>
            <dd className={cn("tnum text-[13px] font-black", signColor(report.return_latest_pct))}>{formatPct(report.return_latest_pct)}</dd>
          </div>
          {hit && (
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">목표가 도달</dt>
              <dd className="tnum font-bold text-stamp">적중 · {report.days_to_target!.toLocaleString("ko-KR")}일</dd>
            </div>
          )}
        </dl>

        <div className="flex gap-2 px-4 pb-3.5 pt-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelect(report.source_name);
            }}
            className="flex-1 rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-bold text-background transition hover:border-stamp hover:bg-stamp sm:py-1.5"
          >
            판결문 보기
          </button>
          {slug && (
            <Link
              href={`/stocks/${slug}`}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-bold transition hover:border-foreground hover:bg-secondary sm:py-1.5"
            >
              종목 페이지 <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>

        <p className="hidden border-t border-dashed border-border px-4 py-1.5 font-mono text-[9px] text-muted-foreground sm:block">
          같은 칸을 한 번 더 누르면 바로 판결문 · ESC 닫기
        </p>
      </div>
    </div>
  );
}
