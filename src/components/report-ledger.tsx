import Link from "next/link";
import { dateLabel, getDisplayName, SCHOOL_LABELS, type ReportRecord } from "@/lib/report-model";
import { horizonColumns, schoolShort, signColor, stampTone, tickerSlug, verdictOf } from "@/lib/verdict";
import { cn, formatPct, formatPrice } from "@/lib/utils";

/** 학회/종목 페이지 공용 리포트 장부 테이블 (최신순 정렬은 호출자가 보장). */
export function ReportLedger({
  reports,
  showSchool = false,
  linkStocks = true,
}: {
  reports: ReportRecord[];
  showSchool?: boolean;
  linkStocks?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full min-w-[920px] border-collapse text-sm">
        <thead>
          <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-3 py-2.5 text-left font-semibold">발간일</th>
            {showSchool && <th className="px-3 py-2.5 text-left font-semibold">학회</th>}
            <th className="px-3 py-2.5 text-left font-semibold">종목</th>
            <th className="px-3 py-2.5 text-left font-semibold">의견</th>
            <th className="px-3 py-2.5 text-right font-semibold">목표가</th>
            {horizonColumns.map((col) => (
              <th key={col.key} className="px-2 py-2.5 text-right font-semibold">
                {col.label}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold">판정</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => {
            const verdict = verdictOf(report);
            const slug = tickerSlug(report);
            return (
              <tr key={report.source_name} className="border-b border-dashed border-border transition last:border-b-0 hover:bg-secondary/60">
                <td className="tnum whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">{dateLabel(report.report_date)}</td>
                {showSchool && <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-bold">{schoolShort[report.school]}</td>}
                <td className="max-w-[15rem] px-3 py-2.5">
                  {linkStocks && slug ? (
                    <Link href={`/stocks/${slug}`} className="font-bold transition hover:text-stamp">
                      {getDisplayName(report)}
                    </Link>
                  ) : (
                    <span className="font-bold">{getDisplayName(report)}</span>
                  )}
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{report.ticker ?? ""}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold">{report.rating ?? "—"}</td>
                <td className="tnum whitespace-nowrap px-3 py-2.5 text-right font-mono text-xs">{formatPrice(report.target_price, report.market)}</td>
                {horizonColumns.map((col) => {
                  const value = report[col.key] as number | null;
                  return (
                    <td key={col.key} className={cn("tnum whitespace-nowrap px-2 py-2.5 text-right font-mono text-xs font-bold", signColor(value))}>
                      {formatPct(value, 0)}
                    </td>
                  );
                })}
                <td className={cn("whitespace-nowrap px-3 py-2.5 text-right text-xs font-black", stampTone[verdict.tone])}>{verdict.stamp}</td>
              </tr>
            );
          })}
          {reports.length === 0 && (
            <tr>
              <td colSpan={showSchool ? 12 : 11} className="px-4 py-10 text-center text-sm text-muted-foreground">
                리포트가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
