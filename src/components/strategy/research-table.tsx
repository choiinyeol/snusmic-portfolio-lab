"use client";

// ─── 전체 연구 기록 테이블 — 정렬 가능 (v18) ──────────────────────────────────
// IS/OOS 샤프, vs KOSPI DCA, vs 올웨더 DCA, MDD, 거래수로 정렬.
// L/M(비용 사망)은 백테스트에서 가지치기되어 행 자체가 없음 — 방법론 한 줄로만 기록.

import { useSortable, SortableTh, type SortColumn } from "@/components/sortable";
import { STRATEGY_LABEL_KO, STRATEGY_VERDICT } from "@/components/strategy/strategy-meta";
import { cn, formatPct } from "@/lib/utils";

export type ResearchRow = {
  key: string;
  label: string;
  metrics: { mdd_pct: number | null };
  in_sample: { sharpe?: number | null };
  out_of_sample: { sharpe?: number | null };
  trade_count: number;
  kospi_dca_ratio?: number | null;
  kospi_dca_beats?: boolean | null;
  aw_dca_ratio?: number | null;
  aw_dca_beats?: boolean | null;
};

const COLS: SortColumn<ResearchRow>[] = [
  { key: "label",      value: (r) => STRATEGY_LABEL_KO[r.key] ?? r.key },
  { key: "is_sharpe",  value: (r) => r.in_sample.sharpe ?? null,      firstDir: "desc" },
  { key: "oos_sharpe", value: (r) => r.out_of_sample.sharpe ?? null,  firstDir: "desc" },
  { key: "kospi_dca",  value: (r) => r.kospi_dca_ratio ?? null,       firstDir: "desc" },
  { key: "aw_dca",     value: (r) => r.aw_dca_ratio ?? null,          firstDir: "desc" },
  { key: "mdd",        value: (r) => r.metrics.mdd_pct ?? null,       firstDir: "desc" },
  { key: "trades",     value: (r) => r.trade_count,                   firstDir: "desc" },
];

function VerdictChip({ kind, reason }: { kind: "SOTA" | "채택" | "기각" | "연구용"; reason?: string }) {
  const styles: Record<string, string> = {
    SOTA: "bg-stamp text-background",
    채택: "border border-up/50 bg-up/10 text-up",
    기각: "border border-down/50 bg-down/10 text-down",
    연구용: "border border-border bg-secondary/40 text-muted-foreground",
  };
  return (
    <span
      className={cn("inline-block rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold cursor-help", styles[kind])}
      title={reason ?? (kind === "SOTA" ? "State of the art — IS 샤프 최상위 자동 채택" : kind === "채택" ? "셀렉터 채택 전략" : undefined)}
    >
      {kind}
    </span>
  );
}

export function ResearchTable({
  rows,
  headlineKey,
  curatedKeys,
}: {
  rows: ResearchRow[];
  headlineKey: string;
  curatedKeys: string[];
}) {
  const { sorted, specs, toggle } = useSortable(rows, COLS, []);
  const sort = { specs, toggle };
  const curatedSet = new Set(curatedKeys);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1020px] border-collapse text-sm">
        <thead>
          <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <SortableTh sortKey="label" sort={sort} className="py-2 text-left">전략</SortableTh>
            <th className="px-3 py-2 text-left font-semibold">판정</th>
            <SortableTh sortKey="is_sharpe"  sort={sort} align="right" className="py-2">IS 샤프</SortableTh>
            <SortableTh sortKey="oos_sharpe" sort={sort} align="right" className="py-2">OOS 샤프</SortableTh>
            <SortableTh sortKey="kospi_dca"  sort={sort} align="right" className="py-2">vs KOSPI DCA</SortableTh>
            <SortableTh sortKey="aw_dca"     sort={sort} align="right" className="py-2">vs 올웨더 DCA</SortableTh>
            <SortableTh sortKey="mdd"        sort={sort} align="right" className="py-2">MDD</SortableTh>
            <SortableTh sortKey="trades"     sort={sort} align="right" className="py-2">거래수</SortableTh>
            <th className="px-3 py-2 text-right font-semibold">CSV</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const isSota = r.key === headlineKey;
            const isCurated = curatedSet.has(r.key);
            const verdict = STRATEGY_VERDICT[r.key];
            const kind: "SOTA" | "채택" | "기각" | "연구용" = isSota ? "SOTA" : isCurated ? "채택" : (verdict?.chip ?? "연구용");
            return (
              <tr
                key={r.key}
                className={cn(
                  "border-b border-dashed border-border last:border-b-0",
                  isSota && "bg-secondary font-bold",
                )}
              >
                <td className="px-3 py-2">
                  <p className="font-mono text-xs">{STRATEGY_LABEL_KO[r.key] ?? r.key}</p>
                  {!isCurated && verdict && (
                    <p className="mt-0.5 max-w-[320px] text-[10px] font-normal leading-4 text-muted-foreground">{verdict.reason}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <VerdictChip kind={kind} reason={isSota ? undefined : verdict?.reason} />
                </td>
                <td className="tnum px-3 py-2 text-right font-mono text-xs">{r.in_sample.sharpe ?? "—"}</td>
                <td className="tnum px-3 py-2 text-right font-mono text-xs">{r.out_of_sample.sharpe ?? "—"}</td>
                <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", r.kospi_dca_ratio != null ? (r.kospi_dca_beats ? "text-up" : "text-down") : "text-muted-foreground")}>
                  {r.kospi_dca_ratio != null ? `${r.kospi_dca_ratio.toFixed(2)}x` : "—"}
                </td>
                <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", r.aw_dca_ratio != null ? (r.aw_dca_beats ? "text-up" : "text-down") : "text-muted-foreground")}>
                  {r.aw_dca_ratio != null ? `${r.aw_dca_ratio.toFixed(2)}x` : "—"}
                </td>
                <td className="tnum px-3 py-2 text-right font-mono text-xs text-down">
                  {r.metrics.mdd_pct != null ? formatPct(r.metrics.mdd_pct, 1) : "—"}
                </td>
                <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{r.trade_count}</td>
                <td className="px-3 py-2 text-right">
                  <a
                    href={`/strategy-trades-${r.key}.csv`}
                    download={`strategy-trades-${r.key}.csv`}
                    className="font-mono text-[10px] text-muted-foreground underline hover:text-foreground"
                  >
                    다운로드
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
