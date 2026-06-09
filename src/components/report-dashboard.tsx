"use client";

import { Fragment, useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { bucketFilters, type BucketFilter, type MarketFilter, useReportDashboardState } from "@/components/report-dashboard/use-report-dashboard-state";
import { dateLabel, getDisplayName, reportDataQuality, reportDataset, type ReportRecord } from "@/lib/report-model";
import { cn, formatPct, formatPrice } from "@/lib/utils";

const marketFilters: MarketFilter[] = ["ALL", "KR", "US"];
const marketLabels: Record<MarketFilter, string> = { ALL: "전체", KR: "국내", US: "미국" };
const bucketLabels: Record<BucketFilter, string> = {
  ALL: "전체",
  Moonshot: "문샷",
  Winner: "위너",
  Positive: "상승",
  Negative: "하락",
  Wrecked: "붕괴",
  "No quote": "시세없음",
};

const bucketTile: Record<ReportRecord["performance_bucket"], string> = {
  Moonshot: "bg-[#9c0f27] dark:bg-[#ff6177]",
  Winner: "bg-[#d22f4a] dark:bg-[#f04f68]",
  Positive: "bg-[#ec97a6] dark:bg-[#d98897]",
  Negative: "bg-[#9db9ec] dark:bg-[#7fa3e8]",
  Wrecked: "bg-[#1c46a8] dark:bg-[#5e86e8]",
  "No quote": "bg-[#c9c2b4] dark:bg-[#4a4a45]",
};

type Tone = "hit" | "up" | "down" | "warn" | "muted";
type Verdict = { stamp: string; label: string; tone: Tone; detail: string };

const stampTone: Record<Tone, string> = {
  hit: "text-stamp",
  up: "text-warn",
  down: "text-down",
  warn: "text-muted-foreground",
  muted: "text-muted-foreground",
};

function verdictOf(report: ReportRecord): Verdict {
  if (report.data_issue) return { stamp: "불명", label: "시세 확인 불가", tone: "muted", detail: report.data_issue };
  if (report.target_hit_until_latest)
    return { stamp: "적중", label: "목표가 도달", tone: "hit", detail: `${dateLabel(report.first_target_hit_date)} · ${report.days_to_target ?? "?"}일 만에 도달` };
  if (report.target_price === null) return { stamp: "무효", label: "목표가 추출 실패", tone: "warn", detail: report.parse_issue ?? "목표가 미기재" };
  if ((report.return_latest_pct ?? 0) >= 0) return { stamp: "미달", label: "상승 중 · 목표 미도달", tone: "up", detail: `현재 ${formatPct(report.return_latest_pct)}` };
  return { stamp: "하락", label: "하락 · 목표 미도달", tone: "down", detail: `현재 ${formatPct(report.return_latest_pct)}` };
}

function signColor(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-muted-foreground";
  return value >= 0 ? "text-up" : "text-down";
}

function yearOf(report: ReportRecord) {
  return report.report_date?.slice(0, 4) ?? "????";
}

function diffDays(from: string | null, to: string | null) {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function ReportDashboard() {
  const state = useReportDashboardState();
  const selected = state.selected as ReportRecord | undefined;
  const priced = useMemo(() => state.sorted.filter((report) => report.return_latest_pct !== null && !report.data_issue), [state.sorted]);
  const hits = priced.filter((report) => report.target_hit_until_latest).length;
  const hitRate = priced.length ? (hits / priced.length) * 100 : null;
  const selectedIndex = state.sorted.findIndex((report) => report.source_name === selected?.source_name);

  const yearGroups = useMemo(() => {
    const map = new Map<string, ReportRecord[]>();
    for (const report of state.sorted) {
      const year = yearOf(report);
      map.set(year, [...(map.get(year) ?? []), report]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [state.sorted]);

  const { sorted } = state;
  const { setSelectedName } = state;
  const move = useCallback(
    (delta: number) => {
      if (!sorted.length) return;
      const current = sorted.findIndex((report) => report.source_name === selected?.source_name);
      const next = Math.min(sorted.length - 1, Math.max(0, current + delta));
      setSelectedName(sorted[next].source_name);
    },
    [sorted, setSelectedName, selected?.source_name],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  if (!selected) {
    return (
      <main className="flex min-h-screen items-center justify-center px-8 text-center">
        <p className="text-sm leading-7 text-muted-foreground">
          표시할 리포트 데이터가 없습니다.
          <br />
          데이터 파이프라인(scripts/build_report_performance.py)을 먼저 실행해 주세요.
        </p>
      </main>
    );
  }

  const verdict = verdictOf(selected);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[1500px] px-4 pt-6 sm:px-8">
        <Masthead total={reportDataset.records.length} priced={priced.length} hits={hits} hitRate={hitRate} medianReturn={state.kpis.median} />
      </main>

      <div className="mt-8">
        <VerdictTape />
      </div>

      <main className="mx-auto max-w-[1500px] space-y-8 px-4 pb-6 pt-8 sm:px-8">
        <FilterBar state={state} />

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_370px]" aria-label="판결문과 연대기">
          <VerdictPaper
            report={selected}
            verdict={verdict}
            index={selectedIndex}
            total={state.sorted.length}
            onPrev={() => move(-1)}
            onNext={() => move(1)}
          />
          <Chronicle reports={state.sorted} selected={selected} onSelect={state.setSelectedName} />
        </section>

        <MosaicWall groups={yearGroups} selected={selected} onSelect={state.setSelectedName} />

        <footer className="flex flex-col gap-2 border-t-4 border-double border-foreground/50 pb-10 pt-4 font-mono text-[11px] leading-5 text-muted-foreground sm:flex-row sm:items-baseline sm:justify-between">
          <p>
            데이터 생성 {reportDataQuality.generatedAt?.slice(0, 10) ?? "—"} · 시세 이슈 {reportDataQuality.dataIssueCount}건 · 파싱 이슈{" "}
            {reportDataQuality.parseIssueCount}건 · 목표가 누락 {reportDataQuality.missingTargetCount}건
          </p>
          <p>PDF → MARKDOWN 전사 → 목표가 파싱 → POINT-IN-TIME 검증</p>
        </footer>
      </main>
    </div>
  );
}

function Masthead({ total, priced, hits, hitRate, medianReturn }: { total: number; priced: number; hits: number; hitRate: number | null; medianReturn: number | null }) {
  return (
    <header>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-4 border-double border-foreground/70 pb-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.3em]">SNU SMIC · Research Verdict Archive</p>
        <div className="flex items-center gap-3">
          <p className="hidden font-mono text-[11px] text-muted-foreground sm:block">기준일 {dateLabel(reportDataset.as_of)}</p>
          <ThemeToggle />
        </div>
      </div>

      <h1 className="mt-9 font-display text-[2.6rem] font-black leading-[1.12] tracking-tight sm:text-6xl lg:text-7xl">
        모든 리포트는, 결국
        <br />
        <span className="text-stamp">시장의 판결</span>을 받는다.
      </h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
        서울대학교 투자동아리 SMIC의 리포트 PDF {total}건을 전사·파싱해 목표가와 투자의견을 추출하고, point-in-time 시세로 발간 이후의 실제 주가
        경로를 추적했습니다. 그날의 주장과 시간의 판정을 같은 페이지에 둡니다.
      </p>

      <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
        <KpiCell label="검증된 리포트" value={`${priced}건`} sub={`아카이브 전체 ${total}건`} />
        <KpiCell label="목표가 적중" value={`${hits}건`} sub="발간 후 목표가 도달" valueClass="text-stamp" />
        <KpiCell label="적중률" value={formatPct(hitRate, 1).replace("+", "")} sub="가격 검증 가능 건 기준" />
        <KpiCell label="수익률 중앙값" value={formatPct(medianReturn)} sub="발간일 → 최신 종가" valueClass={signColor(medianReturn)} />
      </dl>
    </header>
  );
}

function KpiCell({ label, value, sub, valueClass }: { label: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div className="bg-card px-5 py-4">
      <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
      <dd className={cn("tnum mt-2 font-display text-3xl font-black tracking-tight", valueClass)}>{value}</dd>
      <dd className="mt-1 text-[11px] text-muted-foreground">{sub}</dd>
    </div>
  );
}

function VerdictTape() {
  const items = useMemo(
    () =>
      [...reportDataset.records]
        .filter((report) => report.report_date)
        .sort((a, b) => String(a.report_date).localeCompare(String(b.report_date))),
    [],
  );
  return (
    <div className="tape overflow-hidden border-y-4 border-double border-foreground/60 bg-card py-2.5" aria-hidden="true">
      <div className="tape-track">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center">
            {items.map((report) => (
              <span key={`${copy}-${report.source_name}`} className="mr-8 flex items-center gap-2 whitespace-nowrap font-mono text-xs">
                <span className="text-muted-foreground">{dateLabel(report.report_date).slice(2, 7)}</span>
                <span className="font-semibold text-foreground/85">{getDisplayName(report)}</span>
                <span className={cn("tnum font-bold", signColor(report.return_latest_pct))}>{formatPct(report.return_latest_pct)}</span>
                {report.target_hit_until_latest && <span className="text-[10px] font-black tracking-tight text-stamp">[적중]</span>}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterBar({ state }: { state: ReturnType<typeof useReportDashboardState> }) {
  return (
    <section className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between" aria-label="아카이브 필터">
      <div className="flex items-end gap-5">
        {marketFilters.map((item) => {
          const active = state.market === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => state.setMarket(item)}
              aria-pressed={active}
              className={cn(
                "border-b-[3px] pb-1 font-display text-xl font-black tracking-tight transition",
                active ? "border-stamp text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {marketLabels[item]}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="성과 등급 필터">
        {bucketFilters.map((item) => {
          const active = state.bucket === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => state.setBucket(item)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-bold transition",
                active ? "border-foreground bg-foreground text-background" : "border-border bg-transparent text-muted-foreground hover:border-foreground/50 hover:text-foreground",
              )}
            >
              {bucketLabels[item]}
            </button>
          );
        })}
      </div>

      <label className="relative block w-full lg:max-w-xs">
        <span className="sr-only">회사명, 티커, 파일명 검색</span>
        <Search className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          value={state.query}
          onChange={(event) => state.setQuery(event.target.value)}
          className="w-full border-0 border-b border-border bg-transparent py-1.5 pl-7 pr-2 text-sm outline-none transition placeholder:text-muted-foreground focus:border-stamp"
          placeholder="회사명 · 티커 · 파일명 검색"
        />
      </label>
    </section>
  );
}

function VerdictPaper({
  report,
  verdict,
  index,
  total,
  onPrev,
  onNext,
}: {
  report: ReportRecord;
  verdict: Verdict;
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const targetReturn = report.target_price && report.start_close ? (report.target_price / report.start_close - 1) * 100 : null;
  const horizons = [
    { label: "30일", value: report.return_30d_pct },
    { label: "90일", value: report.return_90d_pct },
    { label: "180일", value: report.return_180d_pct },
    { label: "1년", value: report.return_365d_pct },
    { label: "최고", value: report.max_high_return_pct },
  ];

  return (
    <article
      className="relative overflow-hidden rounded-lg border-2 border-foreground/80 bg-card shadow-[7px_7px_0_0_hsl(var(--foreground)/0.85)]"
      aria-label="선택된 리포트 판결문"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-border px-6 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:px-8">
        <span>판결 기록 제 {index < 0 ? "—" : String(index + 1).padStart(3, "0")} 호</span>
        <span>
          {dateLabel(report.report_date)} 발간 · {report.market ?? "—"} · {report.ticker ?? "—"}
        </span>
      </header>

      <motion.div
        key={report.source_name}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative px-6 py-6 sm:px-8"
      >
        <motion.div
          key={`stamp-${report.source_name}`}
          initial={{ scale: 2.4, opacity: 0, rotate: 4 }}
          animate={{ scale: 1, opacity: 1, rotate: -10 }}
          transition={{ type: "spring", stiffness: 380, damping: 21 }}
          className={cn("stamp right-6 top-2 z-10 select-none text-2xl sm:right-10 sm:text-3xl", stampTone[verdict.tone])}
          aria-hidden="true"
        >
          {verdict.stamp}
        </motion.div>

        <h2 className="max-w-[78%] font-display text-4xl font-black tracking-tight sm:text-5xl">{getDisplayName(report)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className={cn("font-bold", stampTone[verdict.tone])}>{verdict.label}</span> · {verdict.detail}
        </p>

        <div className="mt-7 grid gap-7 lg:grid-cols-2">
          <section aria-label="발간 당시의 주장">
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">그날의 주장 — {dateLabel(report.report_date)}</h3>
            <dl className="mt-3 border-y border-dashed border-border">
              <ClaimRow label="투자의견" value={report.rating ?? "—"} />
              <ClaimRow label="당시 주가" value={formatPrice(report.report_current_price, report.market)} />
              <ClaimRow label="목표 주가" value={formatPrice(report.target_price, report.market)} emphasis />
              <ClaimRow label="제시 상승여력" value={formatPct(report.stated_upside_pct)} />
            </dl>
          </section>

          <section aria-label="시간이 내린 판정">
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">시간의 판정 — {dateLabel(report.latest_trade_date)}</h3>
            <p className={cn("tnum mt-3 font-display text-6xl font-black leading-none tracking-tight", signColor(report.return_latest_pct))}>
              {formatPct(report.return_latest_pct)}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              발간 후 현재까지 수익률 · 최신 종가 {formatPrice(report.latest_close, report.market)}
            </p>
            <div className="mt-4 grid grid-cols-5 divide-x divide-dashed divide-border border-y border-dashed border-border">
              {horizons.map((item) => (
                <div key={item.label} className="px-2 py-2 text-center first:pl-0 last:pr-0">
                  <p className="font-mono text-[10px] text-muted-foreground">{item.label}</p>
                  <p className={cn("tnum mt-1 text-[13px] font-black", signColor(item.value))}>{formatPct(item.value, 0)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <Trajectory report={report} targetReturn={targetReturn} className="mt-7" />

        <div className="mt-7 flex items-center justify-between gap-3 border-t border-dashed border-border pt-4">
          <button
            type="button"
            onClick={onPrev}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-bold transition hover:border-foreground hover:bg-secondary"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" /> 이전 기록
          </button>
          <span className="tnum text-center font-mono text-[11px] text-muted-foreground">
            {index < 0 ? "—" : index + 1} / {total}
            <span className="hidden sm:inline"> · 방향키 ← → 로 넘길 수 있습니다</span>
          </span>
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-bold transition hover:border-foreground hover:bg-secondary"
          >
            다음 기록 <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </motion.div>
    </article>
  );
}

function ClaimRow({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-border py-2.5 last:border-b-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className={cn("tnum text-right font-bold", emphasis ? "font-display text-xl text-stamp underline decoration-stamp/40 decoration-2 underline-offset-4" : "text-sm")}>
        {value}
      </dd>
    </div>
  );
}

function Trajectory({ report, targetReturn, className }: { report: ReportRecord; targetReturn: number | null; className?: string }) {
  const data = useMemo(() => {
    const elapsed = diffDays(report.first_trade_date, report.latest_trade_date);
    const totalDays = Math.max(elapsed ?? 0, 30);
    const raw = [
      { day: 0, ret: 0 as number | null, label: "발간" },
      { day: 30, ret: report.return_30d_pct, label: "30일" },
      { day: 90, ret: report.return_90d_pct, label: "90일" },
      { day: 180, ret: report.return_180d_pct, label: "180일" },
      { day: 365, ret: report.return_365d_pct, label: "1년" },
      { day: totalDays, ret: report.return_latest_pct, label: "현재" },
    ];
    const byDay = new Map<number, { day: number; ret: number; label: string }>();
    for (const point of raw) {
      if (point.ret === null || point.day > totalDays) continue;
      byDay.set(point.day, { day: point.day, ret: point.ret, label: point.label });
    }
    return { totalDays, points: [...byDay.values()].sort((a, b) => a.day - b.day) };
  }, [report]);

  if (data.points.length < 2) {
    return (
      <div className={cn("rounded-md border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground", className)}>
        가격 경로를 그릴 시세 데이터가 없습니다{report.data_issue ? ` — ${report.data_issue}` : "."}
      </div>
    );
  }

  const W = 720;
  const H = 240;
  const padL = 12;
  const padR = 16;
  const padT = 26;
  const padB = 30;
  const returns = data.points.map((point) => point.ret);
  const maxHigh = report.max_high_return_pct;
  const yMaxRaw = Math.max(...returns, targetReturn ?? -Infinity, maxHigh ?? -Infinity, 10);
  const yMinRaw = Math.min(...returns, -8);
  const pad = (yMaxRaw - yMinRaw) * 0.14;
  const yMax = yMaxRaw + pad;
  const yMin = yMinRaw - pad;
  const yRange = yMax - yMin || 1;
  const x = (day: number) => padL + Math.sqrt(day / data.totalDays) * (W - padL - padR);
  const y = (ret: number) => padT + ((yMax - ret) / yRange) * (H - padT - padB);
  const path = data.points.map((point, i) => `${i ? "L" : "M"}${x(point.day).toFixed(1)},${y(point.ret).toFixed(1)}`).join(" ");
  const last = data.points[data.points.length - 1];
  const lineTone = last.ret >= 0 ? "stroke-up" : "stroke-down";

  return (
    <figure className={className}>
      <figcaption className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">가격 경로 — 발간 후 {data.totalDays.toLocaleString()}일</span>
        <span className="font-mono text-[10px] text-muted-foreground">가로축은 √시간 척도</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="발간 이후 구간별 수익률 경로">
        <line x1={padL} x2={W - padR} y1={y(0)} y2={y(0)} className="stroke-border" strokeWidth="1" />
        <text x={W - padR} y={y(0) + 13} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
          발간가 0%
        </text>
        {targetReturn !== null && targetReturn > yMin && targetReturn < yMax && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(targetReturn)} y2={y(targetReturn)} className="stroke-stamp" strokeDasharray="7 5" strokeWidth="1.4" />
            <text x={W - padR} y={y(targetReturn) - 6} textAnchor="end" fontSize="11" fontWeight="700" className="fill-stamp font-mono">
              목표 {formatPct(targetReturn)}
            </text>
          </g>
        )}
        {maxHigh !== null && maxHigh > (last.ret ?? 0) && maxHigh > yMin && maxHigh < yMax && (
          <g>
            <line x1={padL} x2={W - padR} y1={y(maxHigh)} y2={y(maxHigh)} className="stroke-muted-foreground/60" strokeDasharray="2 6" strokeWidth="1" />
            <text x={padL} y={y(maxHigh) - 5} fontSize="10" className="fill-muted-foreground font-mono">
              장중 최고 {formatPct(maxHigh)}
            </text>
          </g>
        )}
        <path d={path} fill="none" className={lineTone} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {data.points.map((point) => (
          <g key={point.day}>
            <circle
              cx={x(point.day)}
              cy={y(point.ret)}
              r={point.label === "현재" ? 5 : 3.2}
              strokeWidth="1.5"
              className={cn("stroke-card", point.ret >= 0 ? "fill-up" : "fill-down")}
            />
            <text x={x(point.day)} y={H - 9} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
              {point.label}
            </text>
            <text
              x={x(point.day)}
              y={y(point.ret) - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              className={cn("font-mono", point.ret >= 0 ? "fill-up" : "fill-down")}
            >
              {formatPct(point.ret, 0)}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}

function Chronicle({ reports, selected, onSelect }: { reports: ReportRecord[]; selected: ReportRecord; onSelect: (sourceName: string) => void }) {
  return (
    <aside className="flex max-h-[920px] flex-col overflow-hidden rounded-lg border border-border bg-card" aria-label="발간 연대기">
      <header className="flex items-baseline justify-between border-b-4 border-double border-border px-4 py-3">
        <h2 className="font-display text-xl font-black tracking-tight">연대기</h2>
        <p className="font-mono text-[11px] text-muted-foreground">{reports.length}건 · 발간순</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {reports.map((report, index) => {
          const active = report.source_name === selected.source_name;
          const divider = index === 0 || yearOf(report) !== yearOf(reports[index - 1]);
          return (
            <Fragment key={report.source_name}>
              {divider && (
                <p className="sticky top-0 z-10 border-y border-border bg-secondary px-4 py-1 font-display text-sm font-black">{yearOf(report)}</p>
              )}
              <button
                type="button"
                onClick={() => onSelect(report.source_name)}
                aria-pressed={active}
                className={cn(
                  "grid w-full grid-cols-[2.6rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-dashed border-border px-4 py-2.5 text-left transition",
                  active ? "bg-foreground text-background" : "hover:bg-secondary",
                )}
              >
                <span className={cn("font-mono text-[11px]", active ? "opacity-70" : "text-muted-foreground")}>{String(index + 1).padStart(3, "0")}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{getDisplayName(report)}</span>
                  <span className={cn("block text-[11px]", active ? "opacity-70" : "text-muted-foreground")}>
                    {dateLabel(report.report_date)} · {report.ticker ?? "—"}
                    {report.target_hit_until_latest ? " · 적중" : ""}
                  </span>
                </span>
                <span className={cn("tnum font-mono text-sm font-bold", active ? "text-background" : signColor(report.return_latest_pct))}>
                  {formatPct(report.return_latest_pct)}
                </span>
              </button>
            </Fragment>
          );
        })}
        {reports.length === 0 && <p className="px-6 py-10 text-center text-sm text-muted-foreground">조건에 맞는 리포트가 없습니다.</p>}
      </div>
    </aside>
  );
}

function MosaicWall({
  groups,
  selected,
  onSelect,
}: {
  groups: [string, ReportRecord[]][];
  selected: ReportRecord;
  onSelect: (sourceName: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card px-6 py-6 sm:px-8" aria-label="연도별 리포트 모자이크">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">The Archive Wall</p>
          <h2 className="mt-1 font-display text-3xl font-black tracking-tight">증거의 서가</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            책등 하나가 리포트 한 건입니다. 높이는 수익률의 크기, 색은 성과 등급 — 6년의 기록을 한 눈에 훑고, 눌러서 판결문을 펼치세요.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="등급 범례">
          {(Object.keys(bucketTile) as ReportRecord["performance_bucket"][]).map((bucket) => (
            <li key={bucket} className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <span className={cn("inline-block h-3 w-2 rounded-[1px]", bucketTile[bucket])} aria-hidden="true" />
              {bucketLabels[bucket]}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-7 space-y-5">
        {groups.map(([year, list]) => {
          const returns = list.filter((report) => report.return_latest_pct !== null).map((report) => report.return_latest_pct as number);
          const hits = list.filter((report) => report.target_hit_until_latest).length;
          const med = median(returns);
          return (
            <div key={year} className="grid grid-cols-[4.8rem_minmax(0,1fr)] items-end gap-4 border-b border-dashed border-border pb-5 last:border-b-0 last:pb-0">
              <div>
                <p className="font-display text-2xl font-black leading-none">{year}</p>
                <p className="mt-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
                  {list.length}건 · 적중 {hits}
                  <br />
                  중앙값 <span className={signColor(med)}>{formatPct(med, 0)}</span>
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-[3px]">
                {list.map((report) => {
                  const active = report.source_name === selected.source_name;
                  const ret = report.return_latest_pct ?? 0;
                  const height = Math.round(Math.min(56, Math.max(14, 14 + Math.abs(ret) * 0.22)));
                  return (
                    <button
                      key={report.source_name}
                      type="button"
                      onClick={() => onSelect(report.source_name)}
                      title={`${getDisplayName(report)} · ${dateLabel(report.report_date)} · ${formatPct(report.return_latest_pct)}`}
                      aria-label={`${getDisplayName(report)} ${dateLabel(report.report_date)} ${formatPct(report.return_latest_pct)}`}
                      className={cn(
                        "w-[9px] rounded-[1px] transition hover:opacity-75",
                        bucketTile[report.performance_bucket],
                        active && "outline outline-2 outline-offset-2 outline-foreground",
                      )}
                      style={{ height }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        {groups.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">조건에 맞는 리포트가 없습니다.</p>}
      </div>
    </section>
  );
}
