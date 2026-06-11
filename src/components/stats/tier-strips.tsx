import type { TierStat } from "@/components/stats/stats-types";

/**
 * 등급별 발간 시점 피처 분포 — 서버 렌더 SVG 박스 스트립.
 * 가는 선 = p10–p90, 굵은 막대 = IQR(q1–q3), 세로 눈금 = 중앙값.
 * recharts 없이 순수 SVG — 클라이언트 번들 0바이트.
 */

const TIER_KO: Record<string, string> = {
  Tenbagger: "텐배거",
  Multibagger: "멀티배거",
  Double: "더블",
  Winner: "순항",
  Positive: "상승",
};

const TIER_COLOR: Record<string, string> = {
  Tenbagger: "hsl(var(--stamp))",
  Multibagger: "hsl(var(--stamp) / 0.75)",
  Double: "hsl(var(--up) / 0.65)",
  Winner: "hsl(var(--foreground) / 0.45)",
  Positive: "hsl(var(--foreground) / 0.3)",
};

function fmtTick(v: number, unit: string) {
  const s = Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1);
  return unit === "배" ? `${s}배` : unit === "%p" ? `${s}p` : `${s}%`;
}

export function TierStrip({
  label,
  unit,
  desc,
  stats,
  tierOrder,
}: {
  label: string;
  unit: string;
  desc?: string;
  stats: Record<string, TierStat>;
  tierOrder: string[];
}) {
  const rows = tierOrder.filter((t) => stats[t] && stats[t].n > 0 && stats[t].median !== null);
  if (!rows.length) return null;

  const values = rows.flatMap((t) => [stats[t].p10, stats[t].p90, stats[t].q1, stats[t].q3, stats[t].median]).filter((v): v is number => v !== null);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.04;
  lo -= pad;
  hi += pad;

  const labelW = 76;
  const width = 320;
  const rowH = 19;
  const axisH = 14;
  const height = rows.length * rowH + axisH;
  const x = (v: number) => labelW + ((v - lo) / (hi - lo)) * (width - labelW - 6);

  return (
    <figure className="rounded-lg border border-border bg-card p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] font-bold tracking-tight" title={desc}>{label}</span>
        <span className="font-mono text-[9px] text-muted-foreground">중앙값·IQR·p10–p90</span>
      </figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-1.5 w-full" role="img" aria-label={`${label} — 등급별 발간 시점 분포`}>
        {lo < 0 && hi > 0 && (
          <line x1={x(0)} x2={x(0)} y1={0} y2={rows.length * rowH} stroke="hsl(var(--border))" strokeDasharray="2 3" />
        )}
        {rows.map((tier, i) => {
          const s = stats[tier];
          const cy = i * rowH + rowH / 2;
          const color = TIER_COLOR[tier] ?? "hsl(var(--foreground) / 0.4)";
          return (
            <g key={tier}>
              <text x={0} y={cy + 3} fontSize={9} fontWeight={700} fill="hsl(var(--foreground) / 0.8)" fontFamily="var(--font-mono, monospace)">
                {TIER_KO[tier] ?? tier}
              </text>
              <text x={labelW - 8} y={cy + 3} fontSize={8} textAnchor="end" fill="hsl(var(--muted-foreground))" fontFamily="var(--font-mono, monospace)">
                {s.n}
              </text>
              {s.p10 !== null && s.p90 !== null && (
                <line x1={x(s.p10)} x2={x(s.p90)} y1={cy} y2={cy} stroke={color} strokeWidth={1} opacity={0.55} />
              )}
              {s.q1 !== null && s.q3 !== null && (
                <rect x={x(s.q1)} y={cy - 3.5} width={Math.max(1.5, x(s.q3) - x(s.q1))} height={7} rx={1.5} fill={color} opacity={0.5} />
              )}
              {s.median !== null && (
                <line x1={x(s.median)} x2={x(s.median)} y1={cy - 5.5} y2={cy + 5.5} stroke={color} strokeWidth={2.2} />
              )}
            </g>
          );
        })}
        <text x={labelW} y={height - 2} fontSize={8} fill="hsl(var(--muted-foreground))" fontFamily="var(--font-mono, monospace)">
          {fmtTick(lo, unit)}
        </text>
        <text x={width - 6} y={height - 2} fontSize={8} textAnchor="end" fill="hsl(var(--muted-foreground))" fontFamily="var(--font-mono, monospace)">
          {fmtTick(hi, unit)}
        </text>
      </svg>
    </figure>
  );
}
