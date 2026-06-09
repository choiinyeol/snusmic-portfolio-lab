"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dateLabel, getDisplayName, type ReportRecord } from "@/lib/report-model";
import { formatPct } from "@/lib/utils";
import { chartTokens } from "./chart-tokens";
import type { ChartPoint } from "./use-report-dashboard-state";

function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);
  return mounted;
}

function useChartSize() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const attach = useCallback((node: HTMLDivElement | null) => setElement(node), []);

  useEffect(() => {
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };

    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [element]);

  return { attach, size };
}

function buildCumulative(records: ReportRecord[]) {
  let wins = 0;
  let losses = 0;
  let targetHits = 0;
  const priced = records
    .filter((record) => record.report_date && record.return_latest_pct !== null)
    .sort((a, b) => String(a.report_date).localeCompare(String(b.report_date)));
  return priced.map((record, index) => {
    if ((record.return_latest_pct ?? 0) >= 0) wins += 1;
    else losses += 1;
    if (record.target_hit_until_latest) targetHits += 1;
    return {
      index: index + 1,
      date: record.report_date,
      winRate: (wins / (wins + losses)) * 100,
      targetHitRate: (targetHits / (index + 1)) * 100,
    };
  });
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) return null;
  const report = payload[0].payload;
  return (
    <div className="rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
      <p className="font-semibold">{getDisplayName(report)}</p>
      <p className="text-muted-foreground">{report.report_date} · {report.market} · {report.ticker}</p>
      <p className="mt-2 font-bold">최신 수익률 {formatPct(report.return_latest_pct)}</p>
      <p>목표 도달: {report.target_hit_until_latest ? "예" : "아니오"}</p>
    </div>
  );
}

export function PerformanceCharts({ points, records, onSelect }: { points: ChartPoint[]; records: ReportRecord[]; onSelect: (report: ReportRecord) => void }) {
  const mounted = useMounted();
  const cumulative = useMemo(() => buildCumulative(records), [records]);
  const positiveCount = points.filter((point) => point.y >= 0).length;
  const negativeCount = points.length - positiveCount;
  const best = useMemo(() => [...points].sort((a, b) => b.y - a.y)[0], [points]);
  const cumulativeLatest = cumulative.at(-1);
  const topAccessiblePoints = useMemo(() => [...points].sort((a, b) => b.y - a.y).slice(0, 5), [points]);
  const { attach: scatterRef, size: scatterSize } = useChartSize();
  const { attach: areaRef, size: areaSize } = useChartSize();

  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="보조 성과 차트">
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">발간일별 수익률 산점도</CardTitle>
          <p className="text-sm text-muted-foreground">
            보조 분석 차트입니다. 기본 선택/판정은 위 테이블과 판정 카드에서 동일하게 가능합니다. 상승 {positiveCount}건, 하락 {negativeCount}건{best ? `, 최고 ${getDisplayName(best)} ${formatPct(best.y)}` : ""}.
          </p>
          <Legend />
          <ul className="sr-only">
            {topAccessiblePoints.map((point) => (
              <li key={point.source_name}>
                {dateLabel(point.report_date)} {getDisplayName(point)} 최신 수익률 {formatPct(point.return_latest_pct)}, 목표 도달 {point.target_hit_until_latest ? "예" : "아니오"}.
              </li>
            ))}
          </ul>
        </CardHeader>
        <CardContent>
          <div ref={scatterRef} className="h-80 min-h-80 min-w-0 rounded-lg border bg-[hsl(var(--surface-inset))] p-3 timeline-grid" role="img" aria-label="발간일을 x축, 최신 수익률을 y축으로 표시한 보조 산점도">
            {mounted && scatterSize ? (
              <ScatterChart width={scatterSize.width} height={scatterSize.height} margin={{ top: 16, right: 20, bottom: 16, left: 0 }}>
                  <CartesianGrid stroke={chartTokens.grid} opacity={0.7} />
                  <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => new Date(value).getFullYear().toString()} stroke={chartTokens.text} tickLine={false} />
                  <YAxis dataKey="y" type="number" tickFormatter={(value) => `${value}%`} stroke={chartTokens.text} tickLine={false} width={58} />
                  <ReferenceLine y={0} stroke={chartTokens.muted} strokeDasharray="4 4" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTooltip />} />
                  <Scatter
                    data={points}
                    shape={(props: { cx?: number; cy?: number; payload?: ChartPoint }) => {
                      const payload = props.payload;
                      const positive = (payload?.return_latest_pct ?? 0) >= 0;
                      const hit = payload?.target_hit_until_latest;
                      return (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={hit ? 6 : 4}
                          fill={positive ? chartTokens.positive : chartTokens.negative}
                          stroke={hit ? chartTokens.target : chartTokens.surface}
                          strokeWidth={hit ? 2 : 1}
                          className="cursor-pointer"
                          onClick={() => payload && onSelect(payload)}
                        />
                      );
                    }}
                  />
              </ScatterChart>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">차트 준비 중…</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="text-base">누적 상승 비율 / 목표 도달률</CardTitle>
          <p className="text-sm text-muted-foreground">
            시간이 지날수록 리포트 판정 품질이 어떻게 누적되는지 보여주는 보조 차트입니다.
            {cumulativeLatest ? ` 현재 필터 기준 누적 상승 비율은 ${formatPct(cumulativeLatest.winRate)}, 목표 도달률은 ${formatPct(cumulativeLatest.targetHitRate)}입니다.` : ""}
          </p>
          <Legend />
        </CardHeader>
        <CardContent>
          <div ref={areaRef} className="h-80 min-h-80 min-w-0 rounded-lg border bg-[hsl(var(--surface-inset))] p-3" role="img" aria-label="시간 순서대로 누적 상승 비율과 목표 도달률을 표시한 면적 차트">
            {mounted && areaSize ? (
              <AreaChart width={areaSize.width} height={areaSize.height} data={cumulative} margin={{ top: 12, right: 20, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke={chartTokens.grid} opacity={0.7} />
                  <XAxis dataKey="index" stroke={chartTokens.text} tickLine={false} />
                  <YAxis tickFormatter={(value) => `${value}%`} stroke={chartTokens.text} tickLine={false} />
                  <Tooltip contentStyle={{ background: chartTokens.surface, color: chartTokens.foreground, border: `1px solid ${chartTokens.grid}`, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="winRate" name="상승 비율" stroke={chartTokens.positive} fill={chartTokens.positive} fillOpacity={0.16} strokeWidth={2} />
                  <Area type="monotone" dataKey="targetHitRate" name="목표 도달률" stroke={chartTokens.target} fill={chartTokens.target} fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">차트 준비 중…</div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label="차트 범례">
      <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-positive))]" />상승</span>
      <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-negative))]" />하락</span>
      <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-target))]" />목표 도달</span>
    </div>
  );
}
