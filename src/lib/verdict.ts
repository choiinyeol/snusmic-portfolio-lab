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

export const ratingClassLabels: Record<ReportRecord["rating_class"], string> = {
  buy: "매수",
  soft_buy: "약한 매수",
  sell: "매도",
};

export function isBuy(report: ReportRecord) {
  return report.rating_class === "buy";
}

export function verdictOf(report: ReportRecord): Verdict {
  if (report.report_type === "sector")
    return { stamp: "산업", label: "산업/전략 리포트", tone: "muted", detail: "개별 종목 목표가 채점 대상이 아닙니다" };
  if (report.rating_class === "sell")
    return { stamp: "매도", label: "매도 의견 — 참고 기록", tone: "muted", detail: `목표가 채점 대상 외 · 현재 ${formatPct(report.return_latest_pct)}` };
  if (report.data_issue) return { stamp: "불명", label: "시세 확인 불가", tone: "muted", detail: report.data_issue };
  if (report.target_hit_until_latest)
    return { stamp: "적중", label: "목표가 도달", tone: "hit", detail: `${dateLabel(report.first_target_hit_date)} · 판결까지 ${report.days_to_target ?? "?"}일` };
  if (report.target_price === null) {
    if (report.rating_class !== "buy")
      return { stamp: "참고", label: "약한 매수 — 참고 기록", tone: "muted", detail: `목표가 없는 의견 리포트 · 현재 ${formatPct(report.return_latest_pct)}` };
    return { stamp: "무효", label: "목표가 추출 실패", tone: "warn", detail: report.parse_issue ?? "목표가 미기재" };
  }
  if ((report.return_latest_pct ?? 0) >= 0) return { stamp: "미달", label: "상승 중 · 목표 미도달", tone: "up", detail: `현재 ${formatPct(report.return_latest_pct)}` };
  return { stamp: "하락", label: "하락 · 목표 미도달", tone: "down", detail: `현재 ${formatPct(report.return_latest_pct)}` };
}

export function signColor(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-muted-foreground";
  return value >= 0 ? "text-up" : "text-down";
}

/* 성과 사다리 — 위로 갈수록 드물고, 금장이 찍힌다 */
export const bucketLabels: Record<ReportRecord["performance_bucket"], string> = {
  Tenbagger: "텐배거",
  Multibagger: "멀티배거",
  Double: "더블",
  Winner: "승소",
  Positive: "상승",
  Drawdown: "조정",
  Wrecked: "패소",
  "No quote": "시세없음",
};

export const bucketThresholds: Record<ReportRecord["performance_bucket"], string> = {
  Tenbagger: "+900% 이상",
  Multibagger: "+300% 이상",
  Double: "+100% 이상",
  Winner: "+30% 이상",
  Positive: "0 ~ +30%",
  Drawdown: "0 ~ −30%",
  Wrecked: "−30% 이하",
  "No quote": "시세 확인 불가",
};

/** 등급 배지 — 상위 등급일수록 강한 인장. 표·카드 공용 */
export const bucketBadgeClass: Record<ReportRecord["performance_bucket"], string> = {
  Tenbagger: "tier-gold font-black",
  Multibagger: "tier-gold font-black",
  Double: "border-up/70 bg-[hsl(var(--up-bg))] text-up font-black",
  Winner: "border-up/60 bg-[hsl(var(--up-bg))] text-up font-bold",
  Positive: "border-up/30 bg-transparent text-up/90 font-semibold",
  Drawdown: "border-down/30 bg-transparent text-down/90 font-semibold",
  Wrecked: "border-down/60 bg-[hsl(var(--down-bg))] text-down font-bold",
  "No quote": "border-border bg-muted text-muted-foreground font-semibold",
};

/* 리포트 연령 — 판결에는 시간이 필요하다 */
export const maturityLabels: Record<NonNullable<ReportRecord["maturity"]>, string> = {
  fresh: "신생",
  developing: "진행",
  seasoned: "성숙",
  veteran: "장기",
};

export function isFresh(report: ReportRecord) {
  return report.maturity === "fresh";
}

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
  /** 매수 의견 리포트 수 (성적표의 모집단) */
  total: number;
  priced: number;
  /** 90일 미만 신생 — 성과 판단에서 분리 */
  fresh: number;
  /** 약한 매수·매도 등 참고 기록 수 */
  reference: number;
  hits: number;
  hitRate: number | null;
  medianReturn: number | null;
  medianDaysToTarget: number | null;
  moonshots: number;
};

/** 학회 성적표 — modern 시대 매수 의견만 채점하고, 신생(<90일)은 적중률·중앙값 산정에서 제외 */
export function clubStats(records: ReportRecord[]): ClubStats {
  const modern = records.filter((r) => r.era === "modern");
  const buys = modern.filter(isBuy);
  const judged = buys.filter((r) => !isFresh(r));
  const priced = judged.filter((r) => r.return_latest_pct !== null && !r.data_issue);
  const hits = priced.filter((r) => r.target_hit_until_latest).length;
  return {
    total: buys.length,
    priced: priced.length,
    fresh: buys.filter(isFresh).length,
    reference: modern.length - buys.length,
    hits,
    hitRate: priced.length ? (hits / priced.length) * 100 : null,
    medianReturn: median(priced.map((r) => r.return_latest_pct as number)),
    medianDaysToTarget: median(priced.filter((r) => r.days_to_target !== null).map((r) => r.days_to_target as number)),
    moonshots: judged.filter((r) => r.performance_bucket === "Tenbagger" || r.performance_bucket === "Multibagger" || r.performance_bucket === "Double").length,
  };
}

export function tickerSlug(report: ReportRecord) {
  return report.ticker ? `${report.market ?? "KR"}-${report.ticker}`.toLowerCase() : null;
}
