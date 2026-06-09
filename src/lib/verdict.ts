import { dateLabel, type ReportRecord } from "@/lib/report-model";
import { formatPct } from "@/lib/utils";

export type Tone = "hit" | "up" | "down" | "warn" | "muted";
export type Verdict = { stamp: string; label: string; tone: Tone; detail: string };

export const stampTone: Record<Tone, string> = {
  hit: "text-stamp",
  up: "text-warn",
  down: "text-down",
  warn: "text-muted-foreground",
  muted: "text-muted-foreground",
};

export function verdictOf(report: ReportRecord): Verdict {
  if (report.data_issue) return { stamp: "불명", label: "시세 확인 불가", tone: "muted", detail: report.data_issue };
  if (report.target_hit_until_latest)
    return { stamp: "적중", label: "목표가 도달", tone: "hit", detail: `${dateLabel(report.first_target_hit_date)} · ${report.days_to_target ?? "?"}일 만에 도달` };
  if (report.target_price === null) return { stamp: "무효", label: "목표가 추출 실패", tone: "warn", detail: report.parse_issue ?? "목표가 미기재" };
  if ((report.return_latest_pct ?? 0) >= 0) return { stamp: "미달", label: "상승 중 · 목표 미도달", tone: "up", detail: `현재 ${formatPct(report.return_latest_pct)}` };
  return { stamp: "하락", label: "하락 · 목표 미도달", tone: "down", detail: `현재 ${formatPct(report.return_latest_pct)}` };
}

export function signColor(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-muted-foreground";
  return value >= 0 ? "text-up" : "text-down";
}

export const bucketLabels: Record<ReportRecord["performance_bucket"], string> = {
  Moonshot: "문샷",
  Winner: "위너",
  Positive: "상승",
  Negative: "하락",
  Wrecked: "붕괴",
  "No quote": "시세없음",
};

export const schoolShort: Record<ReportRecord["school"], string> = { smic: "SMIC", yig: "YIG", star: "STAR", kuvic: "KUVIC" };

export const horizonColumns = [
  { key: "return_30d_pct", label: "1M" },
  { key: "return_90d_pct", label: "3M" },
  { key: "return_180d_pct", label: "6M" },
  { key: "return_365d_pct", label: "1Y" },
  { key: "return_ytd_pct", label: "YTD" },
  { key: "return_latest_pct", label: "발간이후" },
] as const satisfies readonly { key: keyof ReportRecord; label: string }[];

export function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export type ClubStats = {
  total: number;
  priced: number;
  hits: number;
  hitRate: number | null;
  medianReturn: number | null;
  moonshots: number;
};

export function clubStats(records: ReportRecord[]): ClubStats {
  const priced = records.filter((r) => r.return_latest_pct !== null && !r.data_issue);
  const hits = priced.filter((r) => r.target_hit_until_latest).length;
  return {
    total: records.length,
    priced: priced.length,
    hits,
    hitRate: priced.length ? (hits / priced.length) * 100 : null,
    medianReturn: median(priced.map((r) => r.return_latest_pct as number)),
    moonshots: records.filter((r) => r.performance_bucket === "Moonshot").length,
  };
}

export function tickerSlug(report: ReportRecord) {
  return report.ticker ? `${report.market ?? "KR"}-${report.ticker}`.toLowerCase() : null;
}
