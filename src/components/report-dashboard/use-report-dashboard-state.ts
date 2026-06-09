"use client";

import { useMemo, useState } from "react";
import { getDisplayName, reportDataset, type Market, type ReportRecord } from "@/lib/report-model";

type MarketFilter = "ALL" | Market;
type BucketFilter = "ALL" | ReportRecord["performance_bucket"];

export type ChartPoint = ReportRecord & {
  x: number;
  y: number;
  label: string;
};

export const bucketFilters: BucketFilter[] = ["ALL", "Moonshot", "Winner", "Positive", "Negative", "Wrecked", "No quote"];

export function useReportDashboardState() {
  const [market, setMarket] = useState<MarketFilter>("ALL");
  const [bucket, setBucket] = useState<BucketFilter>("ALL");
  const [query, setQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reportDataset.records.filter((report) => {
      if (market !== "ALL" && report.market !== market) return false;
      if (bucket !== "ALL" && report.performance_bucket !== bucket) return false;
      if (!q) return true;
      return [report.company, report.ticker, report.source_name, report.rating]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [bucket, market, query]);

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

  const kpis = useMemo(() => {
    const priced = sorted.filter((report) => !report.data_issue && report.return_latest_pct !== null);
    const up = priced.filter((report) => (report.return_latest_pct ?? 0) >= 0).length;
    const targetHits = priced.filter((report) => report.target_hit_until_latest).length;
    const returns = priced.map((report) => report.return_latest_pct ?? 0).sort((a, b) => a - b);
    const midpoint = Math.floor(returns.length / 2);
    const median = returns.length === 0 ? null : returns.length % 2 ? returns[midpoint] : (returns[midpoint - 1] + returns[midpoint]) / 2;
    return {
      total: sorted.length,
      priced: priced.length,
      up,
      targetHits,
      median,
    };
  }, [sorted]);

  return {
    market,
    setMarket,
    bucket,
    setBucket,
    query,
    setQuery,
    selected,
    setSelectedName,
    sorted,
    chartPoints,
    kpis,
    bestReturn,
  };
}

export type ReportDashboardState = ReturnType<typeof useReportDashboardState>;
export type { BucketFilter, MarketFilter };
