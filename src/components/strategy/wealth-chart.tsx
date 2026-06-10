"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

type WealthPoint = {
  month: number;
  date: string;
  contributed: number;
  strategy_value: number;
  KOSPI_value?: number;
  SP500_value?: number;
  NASDAQ_value?: number;
  AllWeather_value?: number;
  // legacy single-benchmark fallback
  benchmark_value?: number;
};

function fmt만(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-mono font-semibold text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="tnum font-mono">
          {p.name}: {fmt만(p.value)}
        </p>
      ))}
    </div>
  );
}

export function WealthChart({ series }: { series: WealthPoint[] }) {
  const hasMultiBench =
    series.length > 0 &&
    (series[0].KOSPI_value !== undefined ||
      series[0].SP500_value !== undefined ||
      series[0].NASDAQ_value !== undefined);

  const data = series.map((s) => {
    const base: Record<string, string | number> = {
      date: s.date.slice(0, 7),
      납입금: s.contributed,
      전략: s.strategy_value,
    };
    if (hasMultiBench) {
      if (s.KOSPI_value !== undefined) base["KOSPI"] = s.KOSPI_value;
      if (s.SP500_value !== undefined) base["S&P500"] = s.SP500_value;
      if (s.NASDAQ_value !== undefined) base["NASDAQ"] = s.NASDAQ_value;
      if (s.AllWeather_value !== undefined) base["올웨더"] = s.AllWeather_value;
    } else {
      base["KOSPI벤치마크"] = s.benchmark_value ?? 0;
    }
    return base;
  });

  const allVals = series.flatMap((s) =>
    [
      s.strategy_value,
      s.KOSPI_value,
      s.SP500_value,
      s.NASDAQ_value,
      s.AllWeather_value,
      s.benchmark_value,
    ].filter((v): v is number => v !== undefined)
  );
  const maxVal = Math.max(...allVals);
  const domainMax = Math.ceil(maxVal / 50_000_000) * 50_000_000;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}
          tickLine={false}
          axisLine={false}
          interval={11}
        />
        <YAxis
          tickFormatter={fmt만}
          tick={{ fontSize: 10, fontFamily: "var(--font-mono, monospace)" }}
          tickLine={false}
          axisLine={false}
          width={64}
          domain={[0, domainMax]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)" }}
          iconType="plainline"
        />
        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="납입금"
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          legendType="plainline"
        />
        <Line
          type="monotone"
          dataKey="전략"
          stroke="hsl(var(--stamp))"
          strokeWidth={2.5}
          dot={false}
          legendType="plainline"
        />
        {hasMultiBench ? (
          <>
            <Line
              type="monotone"
              dataKey="KOSPI"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              dot={false}
              legendType="plainline"
            />
            <Line
              type="monotone"
              dataKey="S&P500"
              stroke="#60a5fa"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
              legendType="plainline"
            />
            <Line
              type="monotone"
              dataKey="NASDAQ"
              stroke="#34d399"
              strokeWidth={1.5}
              strokeDasharray="3 3"
              dot={false}
              legendType="plainline"
            />
            <Line
              type="monotone"
              dataKey="올웨더"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="8 2"
              dot={false}
              legendType="plainline"
            />
          </>
        ) : (
          <Line
            type="monotone"
            dataKey="KOSPI벤치마크"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            dot={false}
            legendType="plainline"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
