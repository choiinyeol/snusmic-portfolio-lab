"use client";

// ─── 전체 연구 기록 테이블 — 정렬 가능 (v20) ──────────────────────────────────
// IS/OOS 샤프, vs KOSPI DCA, vs 올웨더 DCA, MDD, 거래수로 정렬.
// 판정(SOTA/채택/연구용/기각)과 사유는 백테스트 JSON의 verdict/verdict_reason —
// 셀렉터 칩과 같은 단일 소스라 다시 어긋날 수 없다. 하드코딩 금지.
// L/M(비용 사망)은 백테스트에서 가지치기되어 행 자체가 없음 — 방법론 한 줄로만 기록.

import { useSortable, SortableTh, type SortColumn } from "@/components/sortable";
import { STRATEGY_LABEL_KO } from "@/components/strategy/strategy-meta";
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
  // v20: 백테스트가 실행 시점 수치로 생성한 판정
  verdict?: string | null;
  verdict_reason?: string | null;
};

const VERDICT_ORDER: Record<string, number> = { SOTA: 0, 채택: 1, 연구용: 2, 기각: 3 };

const COLS: SortColumn<ResearchRow>[] = [
  { key: "label",      value: (r) => STRATEGY_LABEL_KO[r.key] ?? r.key },
  { key: "verdict",    value: (r) => VERDICT_ORDER[r.verdict ?? ""] ?? 9 },
  { key: "is_sharpe",  value: (r) => r.in_sample.sharpe ?? null,      firstDir: "desc" },
  { key: "oos_sharpe", value: (r) => r.out_of_sample.sharpe ?? null,  firstDir: "desc" },
  { key: "kospi_dca",  value: (r) => r.kospi_dca_ratio ?? null,       firstDir: "desc" },
  { key: "aw_dca",     value: (r) => r.aw_dca_ratio ?? null,          firstDir: "desc" },
  { key: "mdd",        value: (r) => r.metrics.mdd_pct ?? null,       firstDir: "desc" },
  { key: "trades",     value: (r) => r.trade_count,                   firstDir: "desc" },
];

function VerdictChip({ kind, reason }: { kind: string; reason?: string | null }) {
  const styles: Record<string, string> = {
    SOTA: "bg-stamp text-background",
    채택: "border border-up/50 bg-up/10 text-up",
    기각: "border border-down/50 bg-down/10 text-down",
    연구용: "border border-border bg-secondary/40 text-muted-foreground",
  };
  return (
    <span
      className={cn("inline-block rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold cursor-help", styles[kind] ?? styles["연구용"])}
      title={reason ?? undefined}
    >
      {kind}
    </span>
  );
}

export function ResearchTable({
  rows,
  headlineKey,
}: {
  rows: ResearchRow[];
  headlineKey: string;
}) {
  const { sorted, specs, toggle } = useSortable(rows, COLS, []);
  const sort = { specs, toggle };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1020px] border-collapse text-sm">
        <thead>
          <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <SortableTh sortKey="label" sort={sort} className="py-2 text-left">전략</SortableTh>
            <SortableTh sortKey="verdict" sort={sort} className="py-2 text-left">판정</SortableTh>
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
            const kind = r.verdict ?? "연구용";
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
                  {r.verdict_reason && (
                    <p className="mt-0.5 max-w-[360px] text-[10px] font-normal leading-4 text-muted-foreground">{r.verdict_reason}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <VerdictChip kind={kind} reason={r.verdict_reason} />
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
