"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ReportPathChart } from "@/components/report-path-chart";
import { SourceLinks } from "@/components/source-links";
import { dateLabel, getDisplayName, SCHOOL_LABELS, type ReportRecord } from "@/lib/report-meta";
import {
  bucketBadgeClass,
  bucketLabels,
  bucketThresholds,
  isBuy,
  maturityLabels,
  ratingClassLabels,
  schoolShort,
  signColor,
  stampTone,
  tickerSlug,
  verdictOf,
} from "@/lib/verdict";
import { SortableTh, useSortable, type SortColumn } from "@/components/sortable";
import { cn, formatPct, formatPrice } from "@/lib/utils";

/** 수익률(%) → 25%p 구간 정수 (null 허용) */
function pctBand(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.floor(v / 25);
}

/** 날짜 ISO 문자열 → 연-월 (YYYY-MM) 구간 */
function monthBand(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.slice(0, 7);
}

/** 보유일 → 30일 구간 정수 */
function dayBand(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return Math.floor(v / 30);
}

const sortColumns: SortColumn<ReportRecord>[] = [
  { key: "date",   value: (r) => r.report_date,              groupValue: (r) => monthBand(r.report_date) },
  { key: "school", value: (r) => schoolShort[r.school] },
  { key: "name",   value: (r) => getDisplayName(r) },
  { key: "rating", value: (r) => r.rating },
  { key: "price",  value: (r) => r.report_current_price,     firstDir: "desc" },
  { key: "target", value: (r) => r.target_price,             firstDir: "desc" },
  { key: "upside", value: (r) => r.stated_upside_pct,        firstDir: "desc", groupValue: (r) => pctBand(r.stated_upside_pct) },
  { key: "r90",    value: (r) => r.return_90d_pct,           firstDir: "desc", groupValue: (r) => pctBand(r.return_90d_pct) },
  { key: "r365",   value: (r) => r.return_365d_pct,          firstDir: "desc", groupValue: (r) => pctBand(r.return_365d_pct) },
  { key: "latest", value: (r) => r.return_latest_pct,        firstDir: "desc", groupValue: (r) => pctBand(r.return_latest_pct) },
  { key: "alpha",  value: (r) => r.alpha_latest_pct,         firstDir: "desc", groupValue: (r) => pctBand(r.alpha_latest_pct) },
  { key: "peak",   value: (r) => r.peak_return_24m_pct,      firstDir: "desc", groupValue: (r) => pctBand(r.peak_return_24m_pct) },
  { key: "bucket", value: (r) => r.return_latest_pct,        firstDir: "desc", groupValue: (r) => pctBand(r.return_latest_pct) },
  { key: "days",   value: (r) => r.days_to_target,                              groupValue: (r) => dayBand(r.days_to_target) },
];

/** 학회/종목 페이지 공용 리포트 장부 — 정렬 가능, 기본은 매수 의견만. */
export function ReportLedger({
  reports,
  showSchool = false,
  linkStocks = true,
}: {
  reports: ReportRecord[];
  showSchool?: boolean;
  linkStocks?: boolean;
}) {
  const [showReference, setShowReference] = useState(false);
  /** 펼쳐진 가격 경로 — 한 번에 한 행만 차트를 마운트한다 (성능 상한) */
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const buys = useMemo(() => reports.filter(isBuy), [reports]);
  const softBuys = useMemo(() => reports.filter((r) => r.rating_class === "soft_buy"), [reports]);
  const sells = useMemo(() => reports.filter((r) => r.rating_class === "sell"), [reports]);
  const visible = useMemo(() => (showReference ? reports : buys), [showReference, reports, buys]);

  const sort = useSortable(visible, sortColumns, [{ key: "date", dir: "desc" }]);
  const referenceCount = softBuys.length + sells.length;

  return (
    <div className="space-y-2">
      {referenceCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowReference((prev) => !prev)}
            aria-pressed={showReference}
            className={cn(
              "chip rounded-full border border-dashed px-3 py-1.5 font-mono text-[11px] font-semibold transition",
              showReference
                ? "border-foreground/60 bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground",
            )}
          >
            참고: 약한 매수 {softBuys.length}건{sells.length > 0 ? ` · 매도 ${sells.length}건` : ""} {showReference ? "숨기기" : "보기"}
          </button>
          <p className="font-mono text-[10px] text-muted-foreground">참고 기록은 성적 집계에서 제외됩니다</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="ledger-table w-full min-w-[1320px] border-collapse text-sm">
          <thead>
            <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <SortableTh sortKey="date" sort={sort} title="발간일 — ▸ 를 누르면 가격 경로가 펼쳐집니다">발간일</SortableTh>
              {showSchool && <SortableTh sortKey="school" sort={sort}>학회</SortableTh>}
              <SortableTh sortKey="name" sort={sort}>종목</SortableTh>
              <SortableTh sortKey="rating" sort={sort}>의견</SortableTh>
              <SortableTh sortKey="price" sort={sort} align="right">발간가</SortableTh>
              <SortableTh sortKey="target" sort={sort} align="right">목표가</SortableTh>
              <SortableTh sortKey="upside" sort={sort} align="right" title="발간 당시 제시한 상승여력">괴리율</SortableTh>
              <SortableTh sortKey="r90" sort={sort} align="right">3M</SortableTh>
              <SortableTh sortKey="r365" sort={sort} align="right">1Y</SortableTh>
              <SortableTh sortKey="latest" sort={sort} align="right">발간이후</SortableTh>
              <SortableTh sortKey="alpha" sort={sort} align="right" title="같은 기간 시장지수 대비 초과수익">알파</SortableTh>
              <SortableTh sortKey="peak" sort={sort} align="right" title="발간 후 24개월 내 장중 최고가 수익률 — 보고서의 전성기">전성기</SortableTh>
              <SortableTh sortKey="bucket" sort={sort} align="right">등급</SortableTh>
              <SortableTh sortKey="days" sort={sort} align="right" title="목표가 도달까지 걸린 시간">판결</SortableTh>
            </tr>
          </thead>
          <tbody>
            {sort.sorted.map((report) => {
              const verdict = verdictOf(report);
              const slug = tickerSlug(report);
              const reference = !isBuy(report);
              const hasChart = Boolean(slug && report.report_date);
              // 차트가 없어도 원문 링크가 있으면 펼친다 — 파싱이 어긋난 기록일수록 원문 추적이 절실하다
              const expandable = hasChart || Boolean(report.source_md_url || report.source_pdf_url);
              const open = expandedName === report.source_name;
              return (
                <Fragment key={report.source_name}>
                <tr
                  className={cn(
                    "border-b border-dashed border-border transition last:border-b-0 hover:bg-secondary/60",
                    reference && "opacity-55",
                    open && "bg-secondary/50",
                  )}
                >
                  <td className="tnum whitespace-nowrap px-1.5 py-1 font-mono text-xs text-muted-foreground">
                    {expandable ? (
                      <button
                        type="button"
                        onClick={() => setExpandedName(open ? null : report.source_name)}
                        aria-expanded={open}
                        title={open ? "접기" : hasChart ? "발간 이후 가격 경로 펼치기" : "원문 링크 펼치기"}
                        className="flex min-h-[2.25rem] w-full items-center gap-1 rounded px-1.5 text-left transition hover:text-foreground"
                      >
                        <ChevronRight className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90 text-stamp")} aria-hidden="true" />
                        {dateLabel(report.report_date)}
                      </button>
                    ) : (
                      <span className="block px-1.5 py-1.5 pl-[1.45rem]">{dateLabel(report.report_date)}</span>
                    )}
                  </td>
                  {showSchool && (
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold" title={SCHOOL_LABELS[report.school]}>
                      {schoolShort[report.school]}
                    </td>
                  )}
                  <td className="max-w-[15rem] px-3 py-2.5">
                    {linkStocks && slug ? (
                      <Link href={`/stocks/${slug}`} className="font-bold transition hover:text-stamp">
                        {getDisplayName(report)}
                      </Link>
                    ) : (
                      <span className="font-bold">{getDisplayName(report)}</span>
                    )}
                    {report.maturity === "fresh" && (
                      <span
                        className="ml-1.5 inline-block rounded-sm border border-dashed border-warn px-1 py-px align-middle font-mono text-[9px] font-bold text-warn"
                        title={`발간 ${report.age_days ?? "?"}일 — 90일 미만 신생 리포트, 성과 집계 제외`}
                      >
                        {maturityLabels.fresh}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold" title={ratingClassLabels[report.rating_class]}>
                    {report.rating ?? (reference ? ratingClassLabels[report.rating_class] : "—")}
                  </td>
                  <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {formatPrice(report.report_current_price, report.market)}
                  </td>
                  <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs font-bold">
                    {formatPrice(report.target_price, report.market)}
                    {report.target_seq !== null && (report.target_seq_total ?? 0) > 1 && (
                      <span
                        className="ml-1.5 inline-block rounded-sm border border-border px-1 py-px align-middle font-mono text-[9px] font-bold text-muted-foreground"
                        title={`같은 학회가 이 종목에 제시한 ${report.target_seq}번째 목표 (총 ${report.target_seq_total}회)`}
                      >
                        목표 {report.target_seq}/{report.target_seq_total}
                      </span>
                    )}
                  </td>
                  <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                    {formatPct(report.stated_upside_pct, 0)}
                  </td>
                  {(["return_90d_pct", "return_365d_pct", "return_latest_pct"] as const).map((key) => (
                    <td key={key} className={cn("tnum whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs font-bold", signColor(report[key]))}>
                      {formatPct(report[key], 0)}
                    </td>
                  ))}
                  <td
                    className={cn("tnum whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs font-bold", signColor(report.alpha_latest_pct))}
                    title={`지수 동기간 ${formatPct(report.benchmark_return_pct, 0)}`}
                  >
                    {formatPct(report.alpha_latest_pct, 0)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <span className={cn("tnum font-mono text-xs font-bold", signColor(report.peak_return_24m_pct))}>
                      {formatPct(report.peak_return_24m_pct, 0)}
                    </span>
                    {report.peak_return_24m_pct !== null && report.bucket_peak !== "No quote" && (
                      <span
                        className={cn("ml-1.5 inline-block rounded-sm border px-1 py-px align-middle font-mono text-[9px]", bucketBadgeClass[report.bucket_peak])}
                        title={`전성기 ${bucketLabels[report.bucket_peak]} — ${bucketThresholds[report.bucket_peak]} · 최고가 도달 ${dateLabel(report.peak_date_24m)}`}
                      >
                        {bucketLabels[report.bucket_peak]}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <span
                      className={cn("inline-block rounded-sm border px-1.5 py-0.5 font-mono text-[10px]", bucketBadgeClass[report.performance_bucket])}
                      title={`${bucketLabels[report.performance_bucket]} — ${bucketThresholds[report.performance_bucket]}`}
                    >
                      {bucketLabels[report.performance_bucket]}
                    </span>
                  </td>
                  <td className={cn("whitespace-nowrap px-3 py-2.5 text-right text-xs font-black", stampTone[verdict.tone])} title={verdict.detail}>
                    {verdict.stamp}
                    {report.target_hit_until_latest && report.days_to_target !== null && (
                      <span className="tnum ml-1 font-mono text-[10px] font-bold text-muted-foreground">D+{report.days_to_target}</span>
                    )}
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-dashed border-border">
                    <td colSpan={showSchool ? 15 : 14} className="bg-secondary/30 px-3 py-3 sm:px-4">
                      <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1", hasChart && "mb-2")}>
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {getDisplayName(report)} — {hasChart ? "발간 이후 가격 경로 · 기준선은 발간가" : "가격 경로 없음 · 원문으로 확인"}
                        </p>
                        <SourceLinks report={report} />
                      </div>
                      {hasChart && slug && report.report_date && (
                        <ReportPathChart
                          slug={slug}
                          market={report.market}
                          reportDate={report.report_date}
                          targetPrice={report.target_price}
                          hitDate={report.first_target_hit_date}
                          eager
                          className="h-[180px] sm:h-[220px]"
                        />
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
            {sort.sorted.length === 0 && (
              <tr>
                <td colSpan={showSchool ? 15 : 14} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  리포트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatStrip({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="bg-card px-4 py-3">
          <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</dt>
          <dd className={cn("tnum mt-1.5 font-display text-2xl font-black tracking-tight", item.tone)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { SCHOOL_LABELS };
