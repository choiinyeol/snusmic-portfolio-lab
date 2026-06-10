"use client";

import { useMemo, useState } from "react";
import { getDisplayName, reportDataset, type Market, type ReportRecord, type School } from "@/lib/report-model";
import { isBuy, isFresh, median } from "@/lib/verdict";

type MarketFilter = "ALL" | Market;
type BucketFilter = "ALL" | ReportRecord["performance_bucket"];
type SchoolFilter = "ALL" | School;

export type ChartPoint = ReportRecord & {
  x: number;
  y: number;
  label: string;
};

export const bucketFilters: BucketFilter[] = ["ALL", "Tenbagger", "Multibagger", "Double", "Winner", "Positive", "Drawdown", "Wrecked", "No quote"];

export function useReportDashboardState() {
  const [market, setMarket] = useState<MarketFilter>("ALL");
  const [bucket, setBucket] = useState<BucketFilter>("ALL");
  const [school, setSchool] = useState<SchoolFilter>("ALL");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  /** 약한 매수·매도 참고 기록 표시 여부 — 기본은 매수 의견만 */
  const [includeReference, setIncludeReference] = useState(false);

  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reportDataset.records.filter((report) => {
      if (market !== "ALL" && report.market !== market) return false;
      if (bucket !== "ALL" && report.performance_bucket !== bucket) return false;
      if (school !== "ALL" && report.school !== school) return false;
      if (!q) return true;
      return [report.company, report.ticker, report.source_name, report.rating]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [bucket, market, school, query]);

  /** 현재 필터 안의 참고 기록 수 — 토글 칩 라벨용 */
  const referenceCounts = useMemo(
    () => ({
      softBuy: baseFiltered.filter((report) => report.rating_class === "soft_buy").length,
      sell: baseFiltered.filter((report) => report.rating_class === "sell").length,
    }),
    [baseFiltered],
  );

  const filtered = useMemo(
    () => (includeReference ? baseFiltered : baseFiltered.filter(isBuy)),
    [baseFiltered, includeReference],
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => String(a.report_date).localeCompare(String(b.report_date))),
    [filtered],
  );

  const chartPoints = useMemo<ChartPoint[]>(
    () =>
      sorted
        .filter((report) => report.report_date && report.return_latest_pct !== null)
        .map((report) => ({
          ...report,
          x: new Date(report.report_date as string).getTime(),
          y: report.return_latest_pct as number,
          label: getDisplayName(report),
        })),
    [sorted],
  );

  const bestReturn = useMemo(() => [...chartPoints].sort((a, b) => b.y - a.y)[0] ?? sorted[0] ?? reportDataset.records[0], [chartPoints, sorted]);
  const selected = sorted.find((report) => report.source_name === selectedName) ?? bestReturn;

  /** 헤드라인 KPI — 매수 의견만, 신생(<90일)은 성과 산정에서 제외 */
  const kpis = useMemo(() => {
    const buys = sorted.filter(isBuy);
    const fresh = buys.filter(isFresh).length;
    const judged = buys.filter((report) => !isFresh(report));
    const priced = judged.filter((report) => !report.data_issue && report.return_latest_pct !== null);
    const up = priced.filter((report) => (report.return_latest_pct ?? 0) >= 0).length;
    const targetHits = priced.filter((report) => report.target_hit_until_latest).length;
    return {
      total: sorted.length,
      buys: buys.length,
      fresh,
      priced: priced.length,
      up,
      targetHits,
      median: median(priced.map((report) => report.return_latest_pct as number)),
      medianDaysToTarget: median(priced.filter((report) => report.days_to_target !== null).map((report) => report.days_to_target as number)),
    };
  }, [sorted]);

  return {
    market,
    setMarket,
    bucket,
    setBucket,
    school,
    setSchool,
    query,
    setQuery,
    includeReference,
    setIncludeReference,
    referenceCounts,
    selected,
    setSelectedName,
    sorted,
    chartPoints,
    kpis,
    bestReturn,
  };
}

export type ReportDashboardState = ReturnType<typeof useReportDashboardState>;
export type { BucketFilter, MarketFilter, SchoolFilter };
