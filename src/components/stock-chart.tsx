import { promises as fs } from "node:fs";
import path from "node:path";
import { CandleChart, type Candle, type ReportMark, type TradeMark } from "@/components/candle-chart";
import { dateLabel, type ReportRecord } from "@/lib/report-model";
import { schoolShort } from "@/lib/verdict";
import { formatPrice } from "@/lib/utils";

async function loadCandles(slug: string): Promise<Candle[] | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "prices", `${slug}.json`), "utf-8");
    const parsed = JSON.parse(raw) as { candles?: Candle[] };
    const valid = (parsed.candles ?? []).filter(
      (c) =>
        typeof c?.time === "string" &&
        [c.open, c.high, c.low, c.close].every((v) => typeof v === "number" && Number.isFinite(v)),
    );
    // lightweight-charts는 시간 오름차순·중복 없는 데이터를 요구한다
    valid.sort((a, b) => a.time.localeCompare(b.time));
    const candles = valid.filter((c, i) => i === 0 || c.time !== valid[i - 1].time);
    return candles.length >= 2 ? candles : null;
  } catch {
    return null;
  }
}

type StrategyMarksFile = {
  strategy_key: string;
  marks: TradeMark[];
  open_stop: { stop_level: number; entry_date: string; as_of: string } | null;
};

/** SOTA 전략 매매 마크 — 헤드라인 전략이 거래한 종목에만 파일이 존재한다 (없으면 null). */
async function loadStrategyMarks(slug: string): Promise<StrategyMarksFile | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "strategy-marks", `${slug}.json`), "utf-8");
    const parsed = JSON.parse(raw) as Partial<StrategyMarksFile>;
    const marks = (parsed.marks ?? []).filter(
      (m): m is TradeMark =>
        typeof m?.date === "string" && (m.side === "buy" || m.side === "sell" || m.side === "stop"),
    );
    if (!marks.length && !parsed.open_stop) return null;
    return {
      strategy_key: typeof parsed.strategy_key === "string" ? parsed.strategy_key : "",
      marks,
      open_stop:
        parsed.open_stop && typeof parsed.open_stop.stop_level === "number"
          ? (parsed.open_stop as StrategyMarksFile["open_stop"])
          : null,
    };
  } catch {
    return null;
  }
}

/** 종목 캔들 차트 — SSG 시점에 public/prices의 캔들을 읽어 클라이언트 차트에 넘긴다. */
export async function StockChart({ slug, reports }: { slug: string; reports: ReportRecord[] }) {
  const [candles, strategyMarks] = await Promise.all([loadCandles(slug), loadStrategyMarks(slug)]);
  if (!candles) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        가격 차트 데이터가 아직 없습니다. (scripts/export_stock_charts.py 실행 필요)
      </div>
    );
  }

  const market = reports[0]?.market ?? null;
  const first = candles[0];
  const last = candles[candles.length - 1];
  const marks: ReportMark[] = reports
    .filter((r) => r.report_date)
    .map((r) => ({
      sourceName: r.source_name,
      school: r.school,
      date: r.report_date as string,
      targetPrice: r.target_price,
      targetSeq: r.target_seq,
      targetSeqTotal: r.target_seq_total,
    }));
  const schools = [...new Set(marks.map((m) => m.school))];
  const hasSequence = marks.some((m) => (m.targetSeqTotal ?? 0) > 1);

  return (
    <figure className="rounded-lg border border-border bg-card p-5">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          가격 경로 — ▲ 발간 시점 · ┄ 학회 목표가
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {dateLabel(first.time)} ~ {dateLabel(last.time)} · 캔들 {candles.length.toLocaleString("ko-KR")}개 · 마지막 종가{" "}
          {formatPrice(last.close, market)}
        </span>
      </figcaption>
      <CandleChart
        candles={candles}
        marks={marks}
        market={market}
        tradeMarks={strategyMarks?.marks}
        currentStop={strategyMarks?.open_stop?.stop_level ?? null}
      />
      {strategyMarks && (
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          <span className="font-bold text-up">▲ 매수</span> · <span className="font-bold text-down">▼ 매도/스탑</span>
          {strategyMarks.open_stop && <> · ┄ 현재 추적 스탑 {formatPrice(strategyMarks.open_stop.stop_level, market)}</>}
          {" — "}전략 랩 SOTA({strategyMarks.strategy_key})의 백테스트 매매 지점 · 시뮬레이션 결과이며 투자 권유가 아닙니다
        </p>
      )}
      {(schools.length > 1 || hasSequence) && (
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          {schools.length > 1 && <>마커 색상: {schools.map((school) => schoolShort[school]).join(" · ")} — 학회별로 다른 잉크가 찍힙니다</>}
          {schools.length > 1 && hasSequence && " · "}
          {hasSequence && "같은 학회가 목표를 거듭 제시한 경우, 목표 1/3 → 2/3 → 3/3 순으로 번호가 붙습니다"}
        </p>
      )}
    </figure>
  );
}
