"use client";

import { useState } from "react";
import Link from "next/link";
import { WealthChart } from "@/components/strategy/wealth-chart";
import { signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WealthPoint = {
  month: number;
  date: string;
  contributed: number;
  strategy_value: number;
  KOSPI_value?: number;
  SP500_value?: number;
  NASDAQ_value?: number;
  AllWeather_value?: number;
};

type EquityPoint = { date: string; nav: number };
type YearlyReturn = { year: number; return_pct: number };

type StrategyRow = {
  key: string;
  label: string;
  metrics: {
    total_return_pct: number;
    cagr_pct: number | null;
    sharpe: number | null;
    mdd_pct: number;
    trades: number;
    win_rate_pct: number | null;
    avg_hold_days: number | null;
    max_single_return_pct: number | null;
    best_trade_ticker: string | null;
  };
  in_sample: { cagr_pct?: number | null; sharpe?: number | null; mdd_pct?: number | null };
  out_of_sample: { cagr_pct?: number | null; sharpe?: number | null; mdd_pct?: number | null };
  max_single_return_pct: number | null;
  best_trade_name: string | null;
  best_trade_ticker: string | null;
  top_decile_pnl_share_pct: number;
  trade_count: number;
};

type StrategyWealthSim = {
  final_strategy_value: number;
  strategy_gain_on_contributed_pct: number | null;
  strategy_mdd_pct: number;
  series: WealthPoint[];
};

type TriggerReport = {
  school: string;
  report_date: string;
  source_file?: string;
  target_price?: number | null;
  stated_upside_pct?: number | null;
};

type Trade = {
  ticker: string;
  market?: string;
  display_name?: string;
  source?: string;
  entry_date: string;
  exit_date: string;
  entry: number;
  exit: number;
  return_pct: number;
  days: number;
  n_clubs?: number;
  exit_reason?: string;
  trigger_schools?: string[];
  trigger_reports?: TriggerReport[];
  trigger_target_prices?: number[];
};

type MultiStrategyData = {
  strategies: StrategyRow[];
  headline_key: string;
  strategy_wealth_sims: Record<string, StrategyWealthSim>;
  equity_by_strategy: Record<string, EquityPoint[]>;
  yearly_by_strategy: Record<string, YearlyReturn[]>;
};

type WealthSimGlobal = {
  fx_assumption: string;
  schedule_desc: string;
  final_contributed: number;
  final_strategy_value: number;
  final_benchmark_values: Record<string, number>;
  strategy_gain_on_contributed_pct: number | null;
  benchmark_gain_on_contributed_pct: Record<string, number | null>;
  strategy_mdd_pct: number;
  series: WealthPoint[];
};

// ─── Labels ───────────────────────────────────────────────────────────────────

const STRATEGY_LABEL_KO: Record<string, string> = {
  A_12mo:              "A. 12개월 보유",
  B_36mo:              "B. 36개월 보유",
  C_narrative:         "C. 내러티브 홀드",
  D_chandelier:        "D. 샹들리에 래칫 ★",
  E_half_runner:       "E. 절반익절+러너",
  F_momentum_narrative:"F. 모멘텀 필터",
};

const STRATEGY_DESC_KO: Record<string, string> = {
  A_12mo:              "진입 후 12개월 고정 보유. 단순·강건한 기준선.",
  B_36mo:              "진입 후 36개월 보유. 장기 복리 극대화.",
  C_narrative:         "내러티브가 살아있으면 무한 보유. 월말 체크: close < 200MA AND < 진입가 → 청산 (Faber 2007).",
  D_chandelier:        "ATR(42)×5 트레일링 스탑. 신고점에서 래칫 상승. 멀티배거를 살려두되 큰 낙폭은 차단.",
  E_half_runner:       "목표가 도달 시 절반 익절 + 나머지 C 규칙으로 트레일.",
  F_momentum_narrative:"200MA 위에서만 진입 + C 청산 규칙.",
};

const BENCHMARK_KO: Record<string, string> = {
  KOSPI: "KOSPI", SP500: "S&P500", NASDAQ: "NASDAQ", AllWeather: "올웨더",
};

// ─── Slug helper ──────────────────────────────────────────────────────────────

function tickerSlugFromTrade(trade: Trade): string | null {
  if (!trade.ticker) return null;
  const market = trade.market ?? "KR";
  return `${market}-${trade.ticker}`.toLowerCase();
}

// ─── Mini equity curve ─────────────────────────────────────────────────────

function MiniEquity({ equity, color }: { equity: EquityPoint[]; color: string }) {
  if (!equity.length) return null;
  const W = 200; const H = 48;
  const maxNav = Math.max(...equity.map((p) => p.nav));
  const minNav = Math.min(...equity.map((p) => p.nav));
  const x = (i: number) => (i / (equity.length - 1)) * W;
  const y = (nav: number) => H - 4 - ((nav - minNav) / ((maxNav - minNav) || 1)) * (H - 8);
  const d = equity.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.nav).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full opacity-70" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function StrategySelector({
  multiStrategy,
  wealthSimGlobal,
  allTrades,
}: {
  multiStrategy: MultiStrategyData;
  wealthSimGlobal: WealthSimGlobal;
  allTrades: Record<string, Trade[]>;
}) {
  const [selectedKey, setSelectedKey] = useState<string>(multiStrategy.headline_key);

  const selected = multiStrategy.strategies.find((s) => s.key === selectedKey)!;
  const wealthSim = multiStrategy.strategy_wealth_sims[selectedKey];
  const equity = multiStrategy.equity_by_strategy[selectedKey] ?? [];
  const yearly = multiStrategy.yearly_by_strategy[selectedKey] ?? [];
  const trades = (allTrades[selectedKey] ?? []).filter(
    (t) => !t.exit_reason?.endsWith("미청산")
  );
  const tradesSorted = [...trades].sort((a, b) => b.exit_date.localeCompare(a.exit_date));

  const isHeadline = selectedKey === multiStrategy.headline_key;
  const oosBoundaryYear = 2024;

  // Equity chart dims
  const W = 720; const H = 200;
  const maxNav = Math.max(...equity.map((p) => p.nav));
  const minNav = Math.min(...equity.map((p) => p.nav));
  const ex = (i: number) => 8 + (i / (equity.length - 1)) * (W - 16);
  const ey = (nav: number) => 12 + ((maxNav - nav) / ((maxNav - minNav) || 1)) * (H - 36);
  const epath = equity.map((p, i) => `${i ? "L" : "M"}${ex(i).toFixed(1)},${ey(p.nav).toFixed(1)}`).join(" ");

  const m = selected.metrics;
  const is = selected.in_sample;
  const oos = selected.out_of_sample;

  return (
    <div className="space-y-8">
      {/* ── Strategy tabs ──────────────────────────────────────────── */}
      <div>
        <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          전략 선택 — 탭 클릭으로 전환
        </p>
        <div className="flex flex-wrap gap-2">
          {multiStrategy.strategies.map((s) => {
            const isHL = s.key === multiStrategy.headline_key;
            const isActive = s.key === selectedKey;
            return (
              <button
                key={s.key}
                onClick={() => setSelectedKey(s.key)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left transition-all",
                  isActive
                    ? "border-stamp bg-stamp/10 shadow-sm"
                    : "border-border bg-card hover:border-stamp/40 hover:bg-stamp/5",
                )}
                aria-pressed={isActive}
              >
                <p className="font-mono text-[11px] font-bold leading-tight">
                  {STRATEGY_LABEL_KO[s.key] ?? s.key}
                  {isHL && !isActive && (
                    <span className="ml-1 font-mono text-[9px] text-stamp">[헤드라인]</span>
                  )}
                </p>
                <p className={cn("tnum mt-0.5 font-mono text-xs font-bold", signColor(s.in_sample.cagr_pct))}>
                  IS CAGR {s.in_sample.cagr_pct != null ? formatPct(s.in_sample.cagr_pct, 1) : "—"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected strategy hero ──────────────────────────────────── */}
      <div className={cn(
        "rounded-lg border-2 p-5",
        isHeadline ? "border-stamp bg-stamp/5" : "border-border bg-card"
      )}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-stamp">
              {isHeadline ? "헤드라인 전략 ★" : "전략 상세"}
            </p>
            <h3 className="mt-0.5 font-display text-2xl font-black tracking-tight">
              {STRATEGY_LABEL_KO[selectedKey] ?? selectedKey}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              {STRATEGY_DESC_KO[selectedKey] ?? ""}
            </p>
          </div>
          <a
            href={`/strategy-trades-${selectedKey}.csv`}
            download={`strategy-trades-${selectedKey}.csv`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 font-mono text-xs font-semibold hover:bg-secondary/70 transition-colors"
          >
            ↓ CSV ({selected.trade_count}건)
          </a>
        </div>

        {/* Stats strip */}
        <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "IS CAGR",   value: is.cagr_pct  != null ? formatPct(is.cagr_pct,  1) : "—", tone: signColor(is.cagr_pct) },
            { label: "IS 샤프",   value: String(is.sharpe  ?? "—"), tone: "" },
            { label: "IS MDD",    value: is.mdd_pct   != null ? formatPct(is.mdd_pct,   1) : "—", tone: "text-down" },
            { label: "OOS CAGR",  value: oos.cagr_pct != null ? formatPct(oos.cagr_pct, 1) : "—", tone: signColor(oos.cagr_pct) },
            { label: "OOS 샤프",  value: String(oos.sharpe ?? "—"), tone: "" },
            { label: "최대 1종목", value: m.max_single_return_pct != null ? formatPct(m.max_single_return_pct, 0) : "—", tone: signColor(m.max_single_return_pct) },
            { label: "승률",      value: m.win_rate_pct != null ? `${m.win_rate_pct}%` : "—", tone: "" },
          ].map((item) => (
            <div key={item.label} className="bg-card px-3 py-2.5">
              <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</dt>
              <dd className={cn("tnum mt-1 font-display text-lg font-black tracking-tight", item.tone)}>{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* Best trade badge */}
        {selected.best_trade_name && selected.max_single_return_pct != null && selected.max_single_return_pct > 0 && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            최대 단일 수익:{" "}
            <strong className={cn("font-bold", signColor(selected.max_single_return_pct))}>
              {selected.best_trade_name} {formatPct(selected.max_single_return_pct, 0)}
            </strong>
          </p>
        )}
      </div>

      {/* ── Equity curve ─────────────────────────────────────────────── */}
      {equity.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              자산 곡선 — {STRATEGY_LABEL_KO[selectedKey] ?? selectedKey}
            </p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
            <line x1="8" x2={W - 8} y1={ey(1)} y2={ey(1)} className="stroke-border" strokeDasharray="4 4" strokeWidth="1" />
            <path
              d={epath}
              fill="none"
              className={m.total_return_pct >= 0 ? "stroke-up" : "stroke-down"}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {(() => {
              const oosIdx = equity.findIndex((p) => parseInt(p.date.slice(0, 4)) >= oosBoundaryYear);
              if (oosIdx < 0) return null;
              const bx = ex(oosIdx);
              return (
                <>
                  <line x1={bx} x2={bx} y1={12} y2={H - 8} className="stroke-muted-foreground" strokeDasharray="3 3" strokeWidth="1" />
                  <text x={bx + 4} y={20} fontSize="9" className="fill-muted-foreground font-mono">OOS →</text>
                </>
              );
            })()}
            <text
              x={ex(equity.length - 1)}
              y={ey(equity[equity.length - 1]?.nav ?? 1) - 6}
              textAnchor="end"
              fontSize="11"
              fontWeight="700"
              className={cn("font-mono", m.total_return_pct >= 0 ? "fill-up" : "fill-down")}
            >
              {equity[equity.length - 1]?.nav.toFixed(2)}
            </text>
          </svg>
          {/* Yearly returns */}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-dashed border-border pt-3">
            {yearly.map((row) => (
              <div
                key={row.year}
                className={cn(
                  "rounded-md border border-border px-2.5 py-1 text-center",
                  row.year >= oosBoundaryYear && "border-stamp/50 bg-stamp/5"
                )}
              >
                <p className="font-mono text-[9px] text-muted-foreground">
                  {row.year}{row.year >= oosBoundaryYear ? " OOS" : ""}
                </p>
                <p className={cn("tnum font-mono text-xs font-bold", signColor(row.return_pct))}>
                  {formatPct(row.return_pct, 1)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Wealth simulation (selected strategy) ─────────────────── */}
      {wealthSim && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-xl font-black tracking-tight">
              월 적립 시뮬레이션 — {STRATEGY_LABEL_KO[selectedKey] ?? selectedKey}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">{wealthSimGlobal.schedule_desc}</p>
          <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "총 납입금",     value: fmt만(wealthSimGlobal.final_contributed), tone: "" },
              { label: "전략 최종 자산", value: fmt만(wealthSim.final_strategy_value), tone: signColor(wealthSim.final_strategy_value - wealthSimGlobal.final_contributed) },
              ...Object.entries(wealthSimGlobal.final_benchmark_values).map(([k, v]) => ({
                label: `${BENCHMARK_KO[k] ?? k} 벤치마크`,
                value: fmt만(v),
                tone: signColor(v - wealthSimGlobal.final_contributed),
              })),
            ].map((item) => (
              <div key={item.label} className="bg-card px-3 py-2.5">
                <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</dt>
                <dd className={cn("tnum mt-1 font-display text-lg font-black tracking-tight", item.tone)}>{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="rounded-lg border border-stamp/60 bg-stamp/5 px-3 py-1.5">
              <p className="font-mono text-[9px] text-muted-foreground">전략 (납입 대비)</p>
              <p className={cn("tnum font-display text-xl font-black", signColor(wealthSim.strategy_gain_on_contributed_pct))}>
                {formatPct(wealthSim.strategy_gain_on_contributed_pct, 1)}
              </p>
            </div>
            {Object.entries(wealthSimGlobal.benchmark_gain_on_contributed_pct).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-secondary/20 px-3 py-1.5">
                <p className="font-mono text-[9px] text-muted-foreground">{BENCHMARK_KO[k] ?? k}</p>
                <p className={cn("tnum font-display text-xl font-black", signColor(v))}>{formatPct(v, 1)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <WealthChart series={wealthSim.series} />
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            {wealthSimGlobal.fx_assumption}
          </p>
        </section>
      )}

      {/* ── Trade log ────────────────────────────────────────────────── */}
      {tradesSorted.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-xl font-black tracking-tight">
              거래 로그 — {STRATEGY_LABEL_KO[selectedKey] ?? selectedKey} ({tradesSorted.length}건)
            </h3>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">종목</th>
                  <th className="px-3 py-2 text-right font-semibold">매수일</th>
                  <th className="px-3 py-2 text-right font-semibold">매수가</th>
                  <th className="px-3 py-2 text-right font-semibold">매도일</th>
                  <th className="px-3 py-2 text-right font-semibold">매도가</th>
                  <th className="px-3 py-2 text-right font-semibold">수익률</th>
                  <th className="px-3 py-2 text-right font-semibold">보유일</th>
                  <th className="px-3 py-2 text-right font-semibold">매도사유</th>
                </tr>
              </thead>
              <tbody>
                {tradesSorted.map((t, i) => {
                  const slug = tickerSlugFromTrade(t);
                  return (
                    <tr key={`${t.ticker}-${t.entry_date}-${i}`} className="border-b border-dashed border-border last:border-b-0">
                      <td className="px-3 py-2">
                        {slug ? (
                          <Link href={`/stocks/${slug}`} className="hover:underline">
                            <p className="font-mono text-xs font-bold">{t.display_name ?? t.ticker}</p>
                          </Link>
                        ) : (
                          <p className="font-mono text-xs font-bold">{t.display_name ?? t.ticker}</p>
                        )}
                        <p className="font-mono text-[10px] text-muted-foreground">{t.ticker} {t.market !== "KR" ? `· ${t.market}` : ""}</p>
                      </td>
                      <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{t.entry_date}</td>
                      <td className="tnum px-3 py-2 text-right font-mono text-xs">{typeof t.entry === "number" ? t.entry.toLocaleString() : t.entry}</td>
                      <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{t.exit_date}</td>
                      <td className="tnum px-3 py-2 text-right font-mono text-xs">{typeof t.exit === "number" ? t.exit.toLocaleString() : t.exit}</td>
                      <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(t.return_pct))}>
                        {formatPct(t.return_pct, 1)}
                      </td>
                      <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{t.days}일</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{t.exit_reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function fmt만(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
}
