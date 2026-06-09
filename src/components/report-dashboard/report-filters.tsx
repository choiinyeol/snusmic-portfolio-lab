"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bucketFilters, type BucketFilter, type MarketFilter } from "./use-report-dashboard-state";

export function ReportFilters({
  market,
  setMarket,
  bucket,
  setBucket,
  query,
  setQuery,
}: {
  market: MarketFilter;
  setMarket: (value: MarketFilter) => void;
  bucket: BucketFilter;
  setBucket: (value: BucketFilter) => void;
  query: string;
  setQuery: (value: string) => void;
}) {
  return (
    <section className="rounded-xl border bg-card p-4" aria-label="리포트 필터와 검색">
      <div className="grid gap-3 xl:grid-cols-[auto_1fr] xl:items-center">
        <div className="flex flex-wrap gap-2" aria-label="시장 필터">
          {(["ALL", "KR", "US"] as MarketFilter[]).map((item) => (
            <Button key={item} variant={market === item ? "default" : "outline"} size="sm" onClick={() => setMarket(item)} aria-pressed={market === item}>
              {item === "ALL" ? "전체" : item === "KR" ? "한국" : "미국"}
            </Button>
          ))}
        </div>
        <label className="relative block min-w-0">
          <span className="sr-only">회사명, 티커, 파일명 검색</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="회사명, 티커, 파일명 검색"
            className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="성과 구간 필터">
        {bucketFilters.map((item) => (
          <Button key={item} variant={bucket === item ? "secondary" : "ghost"} size="sm" onClick={() => setBucket(item)} aria-pressed={bucket === item}>
            {item}
          </Button>
        ))}
      </div>
    </section>
  );
}
