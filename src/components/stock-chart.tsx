import { promises as fs } from "node:fs";
import path from "node:path";
import { dateLabel, type ReportRecord } from "@/lib/report-model";
import { schoolShort } from "@/lib/verdict";
import { cn, formatPrice } from "@/lib/utils";

type ChartPoint = { d: string; c: number };

async function loadSeries(slug: string): Promise<ChartPoint[] | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "prices", `${slug}.json`), "utf-8");
    const parsed = JSON.parse(raw) as { points: ChartPoint[] };
    return parsed.points?.length >= 2 ? parsed.points : null;
  } catch {
    return null;
  }
}

/** 종목 가격 경로 + 학회 발간 마커 + 목표가 점 (SSG 시점에 public/prices에서 읽음). */
export async function StockChart({ slug, reports }: { slug: string; reports: ReportRecord[] }) {
  const points = await loadSeries(slug);
  if (!points) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        가격 차트 데이터가 아직 없습니다. (scripts/export_stock_charts.py 실행 필요)
      </div>
    );
  }

  const W = 960;
  const H = 320;
  const padL = 14;
  const padR = 64;
  const padT = 16;
  const padB = 34;
  const t0 = new Date(points[0].d).getTime();
  const t1 = new Date(points[points.length - 1].d).getTime();
  const market = reports[0]?.market;
  const marks = reports
    .filter((r) => r.report_date)
    .map((r) => ({ time: new Date(r.report_date as string).getTime(), report: r }))
    .filter((m) => m.time >= t0 && m.time <= t1);

  const values = points.map((p) => p.c);
  const targets = marks.map((m) => m.report.target_price).filter((v): v is number => v !== null);
  const yMaxRaw = Math.max(...values, ...targets);
  const yMinRaw = Math.min(...values);
  const padY = (yMaxRaw - yMinRaw) * 0.08 || yMaxRaw * 0.05;
  const yMax = yMaxRaw + padY;
  const yMin = Math.max(0, yMinRaw - padY);
  const x = (time: number) => padL + ((time - t0) / (t1 - t0 || 1)) * (W - padL - padR);
  const y = (value: number) => padT + ((yMax - value) / (yMax - yMin || 1)) * (H - padT - padB);
  const linePath = points.map((p, i) => `${i ? "L" : "M"}${x(new Date(p.d).getTime()).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const up = last.c >= first.c;
  const yearTicks: { time: number; label: string }[] = [];
  for (let yearNum = new Date(points[0].d).getFullYear() + 1; yearNum <= new Date(last.d).getFullYear(); yearNum += 1) {
    const time = new Date(`${yearNum}-01-01`).getTime();
    if (time > t0 && time < t1) yearTicks.push({ time, label: String(yearNum) });
  }

  return (
    <figure className="rounded-lg border border-border bg-card p-5">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          가격 경로 — ▲ 발간 시점 · ○ 목표가
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {dateLabel(first.d)} ~ {dateLabel(last.d)} · 주간(최근 60일은 일별)
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="종목 가격 경로와 학회 발간 시점">
        {yearTicks.map((tick) => (
          <g key={tick.label}>
            <line x1={x(tick.time)} x2={x(tick.time)} y1={padT} y2={H - padB} className="stroke-border" strokeWidth="1" strokeDasharray="2 5" />
            <text x={x(tick.time)} y={H - 12} textAnchor="middle" fontSize="10" className="fill-muted-foreground font-mono">
              {tick.label}
            </text>
          </g>
        ))}
        <path d={linePath} fill="none" className={up ? "stroke-up" : "stroke-down"} strokeWidth="1.8" strokeLinejoin="round" />
        {marks.map(({ time, report }) => (
          <g key={report.source_name}>
            <line x1={x(time)} x2={x(time)} y1={padT} y2={H - padB} className="stroke-stamp/40" strokeWidth="1" />
            <path d={`M${x(time) - 5},${padT + 1} L${x(time) + 5},${padT + 1} L${x(time)},${padT + 9} Z`} className="fill-stamp" />
            <text x={x(time)} y={padT - 4} textAnchor="middle" fontSize="9" fontWeight="700" className="fill-stamp font-mono">
              {schoolShort[report.school]}
            </text>
            {report.target_price !== null && report.target_price <= yMax && report.target_price >= yMin && (
              <circle cx={x(time)} cy={y(report.target_price)} r="4" fill="none" strokeWidth="1.6" className="stroke-stamp">
                <title>
                  {schoolShort[report.school]} 목표가 {formatPrice(report.target_price, market)} ({dateLabel(report.report_date)})
                </title>
              </circle>
            )}
          </g>
        ))}
        <text
          x={W - padR + 6}
          y={y(last.c) + 4}
          fontSize="11"
          fontWeight="700"
          className={cn("font-mono", up ? "fill-up" : "fill-down")}
        >
          {formatPrice(last.c, market)}
        </text>
      </svg>
    </figure>
  );
}
