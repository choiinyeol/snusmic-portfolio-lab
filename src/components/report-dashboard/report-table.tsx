"use client";

import { Badge } from "@/components/ui/badge";
import { dateLabel, getDisplayName, type ReportRecord } from "@/lib/report-model";
import { cn, formatPct, formatPrice } from "@/lib/utils";

function bucketClass(bucket: ReportRecord["performance_bucket"]) {
  switch (bucket) {
    case "Moonshot":
    case "Winner":
    case "Positive":
      return "border-[hsl(var(--finance-positive))] bg-[hsl(var(--finance-positive-bg))] text-[hsl(var(--finance-positive))]";
    case "Wrecked":
    case "Negative":
      return "border-[hsl(var(--finance-negative))] bg-[hsl(var(--finance-negative-bg))] text-[hsl(var(--finance-negative))]";
    default:
      return "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-muted-foreground";
  }
}

export function ReportTable({ reports, selected, onSelect }: { reports: ReportRecord[]; selected: ReportRecord; onSelect: (report: ReportRecord) => void }) {
  return (
    <section className="rounded-xl border bg-card" aria-label="리포트 성과 테이블">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">리포트 판정 테이블</h2>
        <p className="mt-1 text-xs text-muted-foreground">행을 선택하면 오른쪽 판정 카드가 갱신됩니다. 차트보다 이 표가 기본 탐색 표면입니다.</p>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full min-w-[1280px] border-collapse text-sm">
          <caption className="sr-only">발간일, 종목, 목표가, 시작가, 최신가, 수익률, 목표가 도달 여부와 최초 도달일을 비교하는 리포트 성과 테이블</caption>
          <thead className="sticky top-0 z-10 bg-[hsl(var(--surface-subtle))] text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">발간일</th>
              <th className="px-3 py-2 font-medium">리포트</th>
              <th className="px-3 py-2 font-medium">구간</th>
              <th className="px-3 py-2 text-right font-medium">목표가</th>
              <th className="px-3 py-2 text-right font-medium">리포트 현재가</th>
              <th className="px-3 py-2 text-right font-medium">PIT 시작가</th>
              <th className="px-3 py-2 text-right font-medium">최신가</th>
              <th className="px-3 py-2 text-right font-medium">최신 수익률</th>
              <th className="px-3 py-2 font-medium">목표 도달</th>
              <th className="px-3 py-2 text-right font-medium">최초 도달일</th>
              <th className="px-3 py-2 text-right font-medium">도달일수</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const active = report.source_name === selected.source_name;
              const positive = (report.return_latest_pct ?? 0) >= 0;
              return (
                <tr
                  key={report.source_name}
                  className={cn(
                    "border-b transition-colors hover:bg-[hsl(var(--surface-subtle))]",
                    active && "bg-[hsl(var(--finance-selected-bg))]",
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{dateLabel(report.report_date)}</td>
                  <td className="min-w-72 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelect(report)}
                      className="rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-pressed={active}
                    >
                      <span className="block font-semibold text-foreground">{getDisplayName(report)}</span>
                      <span className="block text-xs text-muted-foreground">{report.market} · {report.ticker} · {report.exchange}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2"><Badge className={bucketClass(report.performance_bucket)}>{report.performance_bucket}</Badge></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(report.target_price, report.market)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(report.report_current_price, report.market)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(report.start_close, report.market)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatPrice(report.latest_close, report.market)}</td>
                  <td className={cn("whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums", positive ? "text-[hsl(var(--finance-positive))]" : "text-[hsl(var(--finance-negative))]")}>{formatPct(report.return_latest_pct)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{report.target_hit_until_latest ? "도달" : report.target_price ? "미도달" : "목표 없음"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{dateLabel(report.first_target_hit_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{report.days_to_target ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {reports.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">조건에 맞는 리포트가 없습니다.</div>}
      </div>
    </section>
  );
}
