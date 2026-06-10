import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StatStrip } from "@/components/report-ledger";
import { StrategySelector } from "@/components/strategy/strategy-selector";
import backtest from "@/data/strategy-backtest.json";
import { signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

export const metadata: Metadata = { title: "모멘텀 전략 — 판결 아카이브" };

function fmt만(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
}

// ─── Slug helper (mirrors verdict.ts tickerSlug) ──────────────────────────────
function tickerSlug(market: string, ticker: string): string {
  return `${market}-${ticker}`.toLowerCase();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodMetrics = {
  start?: string;
  end?: string;
  total_return_pct?: number | null;
  cagr_pct?: number | null;
  sharpe?: number | null;
  mdd_pct?: number | null;
};

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

type SignalPosition = {
  ticker: string;
  market?: string;
  display_name?: string;
  entry_date: string;
  entry_price: number;
  current_price?: number | null;
  unrealized_pct?: number | null;
  days_elapsed: number;
  exit_due: string;
  days_remaining: number;
  trigger_schools?: string[];
  trigger_reports?: TriggerReport[];
};

type NewSignal = {
  ticker: string;
  market?: string;
  display_name?: string;
  n_schools: number;
  entry_basis_date?: string | null;
  entry_basis_price?: number | null;
  trigger_schools?: string[];
  trigger_reports?: TriggerReport[];
};

type WatchingEntry = {
  ticker: string;
  market?: string;
  display_name?: string;
  covering_school: string;
  latest_report_date: string;
  target_price?: number | null;
  stated_upside_pct?: number | null;
  entry_basis_price?: number | null;
  note: string;
};

type SignalsData = {
  as_of: string;
  headline_strategy: string;
  disclaimer: string;
  open_positions: SignalPosition[];
  expiring_soon: SignalPosition[];
  new_buy_signals: NewSignal[];
  watching_single_club: WatchingEntry[];
  counts: {
    open: number;
    expiring_soon_30d: number;
    new_buy_signals: number;
    watching_single_club: number;
  };
};

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
  in_sample: PeriodMetrics;
  out_of_sample: PeriodMetrics;
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

type MultiStrategyData = {
  strategies: StrategyRow[];
  headline_key: string;
  strategy_wealth_sims: Record<string, StrategyWealthSim>;
  equity_by_strategy: Record<string, { date: string; nav: number }[]>;
  yearly_by_strategy: Record<string, { year: number; return_pct: number }[]>;
};

const STRATEGY_LABEL_KO: Record<string, string> = {
  A_12mo:               "A. 12개월 보유",
  B_36mo:               "B. 36개월 보유",
  C_narrative:          "C. 내러티브 홀드",
  D_chandelier:         "D. 샹들리에 래칫 ★",
  E_half_runner:        "E. 절반익절+러너",
  F_momentum_narrative: "F. 모멘텀 필터",
};

const BENCHMARK_KO: Record<string, string> = {
  KOSPI: "KOSPI", SP500: "S&P500", NASDAQ: "NASDAQ", AllWeather: "올웨더",
};

export default function StrategyPage() {
  const m = backtest.metrics as {
    start: string; end: string;
    total_return_pct: number; cagr_pct: number | null;
    sharpe: number | null; mdd_pct: number;
    trades: number; win_rate_pct: number | null;
    max_single_return_pct?: number | null;
  };
  const ws = backtest.wealth_sim as {
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
  const tail = backtest.tail_stats as {
    total_trades: number;
    top_decile_n: number;
    top_decile_pnl_share_pct: number;
    top_decile_avg_return_pct: number | null;
    multibagger_count: number;
    doubler_count: number;
    top_decile_avg_hold_days: number | null;
    top10_trades: { ticker: string; market?: string; display_name?: string; return_pct: number; days: number; n_clubs: number }[];
  };
  const consensus = backtest.consensus_stats as {
    single_club: { count: number; avg_return_pct: number | null; win_rate_pct: number | null };
    multi_club: { count: number; avg_return_pct: number | null; win_rate_pct: number | null };
    alpha_multi_vs_single: number | null;
    note: string;
  };
  const inSample = backtest.in_sample as PeriodMetrics;
  const outOfSample = backtest.out_of_sample as PeriodMetrics;
  const params = backtest.params as {
    headline_strategy: string;
    headline_key: string;
    is_period: string;
    oos_period: string;
    universe_start: string;
    cost_per_side: number;
    position_weight: number;
    max_positions: number;
    chandelier_atr_mult: number;
    faber_ma_period: number;
    anti_overfit_note: string;
  };
  const signals = backtest.signals as SignalsData | undefined;
  const multiStrategy = backtest.multi_strategy as unknown as MultiStrategyData;
  const universeStats = backtest.universe_stats as {
    kr_reports: number; us_reports: number; total_reports: number;
    kr_tickers: number; us_tickers: number;
  };

  // All trades per strategy (from JSON multi_strategy equity is already there;
  // trades per strategy come from the headline trades field for the headline,
  // other strategies' trades not exported into JSON individually — use headline trades here)
  // Strategy-specific trades are in the CSV files. For the selector we pass headline trades only.
  const headlineTrades = (backtest.trades ?? []) as Trade[];
  const allTradesMap: Record<string, Trade[]> = {
    [params.headline_key]: headlineTrades,
  };

  const oosBoundaryYear = 2024;

  // Headline equity chart (top section)
  const equity = backtest.equity as { date: string; nav: number }[];
  const maxNav = Math.max(...equity.map((p) => p.nav));
  const minNav = Math.min(...equity.map((p) => p.nav));
  const W = 720; const H = 220;
  const x = (i: number) => 8 + (i / (equity.length - 1)) * (W - 16);
  const y = (nav: number) => 12 + ((maxNav - nav) / ((maxNav - minNav || 1))) * (H - 36);
  const path = equity.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.nav).toFixed(1)}`).join(" ");

  return (
    <main className="mx-auto max-w-[1500px] space-y-9 px-4 py-6 sm:px-8">
      <SiteHeader eyebrow="Strategy Lab" />

      {/* ── 오늘의 신호 ────────────────────────────────────────────── */}
      {signals && (
        <section className="rounded-lg border-2 border-stamp bg-stamp/5 p-6" aria-label="오늘의 신호">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-2xl font-black tracking-tight text-stamp">
              오늘의 신호
            </h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              기준일: {signals.as_of} · 전략: {STRATEGY_LABEL_KO[signals.headline_strategy] ?? signals.headline_strategy}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground italic">{signals.disclaimer}</p>

          {/* Signal counts */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "보유 중", count: signals.counts.open, tone: "bg-card border-border" },
              { label: "30일 내 만기", count: signals.counts.expiring_soon_30d, tone: signals.counts.expiring_soon_30d > 0 ? "bg-down/10 border-down/40" : "bg-card border-border" },
              { label: "신규 매수 신호", count: signals.counts.new_buy_signals, tone: signals.counts.new_buy_signals > 0 ? "bg-up/10 border-up/40" : "bg-card border-border" },
              { label: "매수 대기 (1개교)", count: signals.counts.watching_single_club, tone: "bg-card border-border" },
            ].map((item) => (
              <div key={item.label} className={cn("rounded-lg border px-4 py-2", item.tone)}>
                <p className="font-mono text-[10px] text-muted-foreground">{item.label}</p>
                <p className="tnum font-display text-2xl font-black">{item.count}</p>
              </div>
            ))}
          </div>

          {/* New buy signals */}
          {signals.new_buy_signals.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-up">신규 매수 신호 — 컨센서스 형성, 진입 기준가 확인</p>
              <div className="space-y-2">
                {signals.new_buy_signals.map((sig, i) => {
                  const slug = sig.market && sig.ticker ? tickerSlug(sig.market, sig.ticker) : null;
                  return (
                    <div key={`${sig.ticker}-${i}`} className="rounded-md border border-up/40 bg-up/5 px-4 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        {slug ? (
                          <Link href={`/stocks/${slug}`} className="font-mono text-sm font-bold hover:underline">
                            {sig.display_name ?? sig.ticker}
                          </Link>
                        ) : (
                          <span className="font-mono text-sm font-bold">{sig.display_name ?? sig.ticker}</span>
                        )}
                        <span className="font-mono text-xs text-muted-foreground">({sig.ticker})</span>
                        <span className="rounded-sm bg-up/20 px-1.5 py-0.5 font-mono text-[10px] text-up font-bold">{sig.n_schools}개교 컨센서스</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>진입 기준일: <strong className="text-foreground">{sig.entry_basis_date ?? "—"}</strong></span>
                        <span>진입 기준가(시가): <strong className="text-foreground">{sig.entry_basis_price != null ? sig.entry_basis_price.toLocaleString() : "—"}</strong></span>
                      </div>
                      {sig.trigger_reports && sig.trigger_reports.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sig.trigger_reports.map((r, ri) => (
                            <span key={ri} className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                              [{r.school}] {r.report_date}
                              {r.target_price ? ` 목표가 ${r.target_price.toLocaleString()}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Open positions */}
          {signals.open_positions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                보유 중 ({signals.open_positions.length}종목)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">종목</th>
                      <th className="px-3 py-1.5 text-right">진입일</th>
                      <th className="px-3 py-1.5 text-right">진입가</th>
                      <th className="px-3 py-1.5 text-right">현재가</th>
                      <th className="px-3 py-1.5 text-right">미실현손익</th>
                      <th className="px-3 py-1.5 text-right">경과일</th>
                      <th className="px-3 py-1.5 text-right">매도 예정일</th>
                      <th className="px-3 py-1.5 text-right">잔여일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.open_positions.map((pos) => {
                      const slug = pos.market && pos.ticker ? tickerSlug(pos.market, pos.ticker) : null;
                      return (
                        <tr
                          key={pos.ticker}
                          className={cn(
                            "border-b border-dashed border-border last:border-b-0",
                            pos.days_remaining <= 30 && pos.days_remaining >= 0 && "bg-down/5"
                          )}
                        >
                          <td className="px-3 py-1.5">
                            {slug ? (
                              <Link href={`/stocks/${slug}`} className="hover:underline">
                                <p className="font-mono text-xs font-bold">{pos.display_name ?? pos.ticker}</p>
                              </Link>
                            ) : (
                              <p className="font-mono text-xs font-bold">{pos.display_name ?? pos.ticker}</p>
                            )}
                            <p className="font-mono text-[10px] text-muted-foreground">{pos.ticker}</p>
                          </td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">{pos.entry_date}</td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs">{pos.entry_price?.toLocaleString()}</td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs">{pos.current_price ? pos.current_price.toLocaleString() : "—"}</td>
                          <td className={cn("tnum px-3 py-1.5 text-right font-mono text-xs font-bold", signColor(pos.unrealized_pct))}>
                            {pos.unrealized_pct != null ? formatPct(pos.unrealized_pct, 1) : "—"}
                          </td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">{pos.days_elapsed}일</td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs">{pos.exit_due}</td>
                          <td className={cn("tnum px-3 py-1.5 text-right font-mono text-xs font-bold",
                            pos.days_remaining <= 30 ? "text-down" : "text-muted-foreground")}>
                            {pos.days_remaining}일
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Watching: single club */}
          {signals.watching_single_club.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
                매수 대기 — 1개교 단독 커버 ({signals.watching_single_club.length}종목, 클릭해서 펼치기)
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">종목</th>
                      <th className="px-3 py-1.5 text-left">커버 학회</th>
                      <th className="px-3 py-1.5 text-right">리포트일</th>
                      <th className="px-3 py-1.5 text-right">목표가</th>
                      <th className="px-3 py-1.5 text-right">현재 시가 기준</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.watching_single_club.map((w, i) => {
                      const slug = w.market && w.ticker ? tickerSlug(w.market, w.ticker) : null;
                      return (
                        <tr key={`${w.ticker}-${i}`} className="border-b border-dashed border-border last:border-b-0">
                          <td className="px-3 py-1.5">
                            {slug ? (
                              <Link href={`/stocks/${slug}`} className="hover:underline">
                                <p className="font-mono text-xs font-bold">{w.display_name ?? w.ticker}</p>
                              </Link>
                            ) : (
                              <p className="font-mono text-xs font-bold">{w.display_name ?? w.ticker}</p>
                            )}
                            <p className="font-mono text-[10px] text-muted-foreground">{w.ticker}</p>
                          </td>
                          <td className="px-3 py-1.5 font-mono text-xs">{w.covering_school}</td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">{w.latest_report_date}</td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs">
                            {w.target_price != null ? w.target_price.toLocaleString() : "—"}
                          </td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
                            {w.entry_basis_price != null ? w.entry_basis_price.toLocaleString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <header>
        <h1 className="mt-3 font-display text-4xl font-black leading-[1.15] tracking-tight sm:text-6xl">
          여러 학회가 동시에 <span className="text-stamp">Buy</span>를 외칠 때만 산다.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          6가지 전략을 인샘플(2019–2023)로 비교하고 아웃오브샘플(2024–현재)로 검증했습니다.
          헤드라인은 IS 샤프 최상위 전략인{" "}
          <strong className="text-foreground">D. 샹들리에 래칫 (ATR(42)×5)</strong>입니다 — 멀티배거를 살려두되 큰 낙폭을 차단합니다.
          내러티브가 맞으면 쭉 들고가는 C 전략은 36개월 보유(B)와 함께 최대 1,868% 단일 수익을 기록했습니다.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          유니버스:{" "}
          <strong className="text-foreground">KR {universeStats.kr_tickers}개 + US {universeStats.us_tickers}개</strong>{" "}
          종목 (≥2개 학회 Buy 컨센서스). US 종목 수익은 달러 기준, 환율 미환산.
        </p>
      </header>

      <StatStrip
        items={[
          { label: `누적 수익률 (헤드라인)`, value: formatPct(m.total_return_pct, 1), tone: signColor(m.total_return_pct) },
          { label: "CAGR (전체)", value: formatPct(m.cagr_pct, 1), tone: signColor(m.cagr_pct) },
          { label: "인샘플 샤프", value: String(inSample.sharpe ?? "—") },
          { label: "아웃오브샘플 샤프", value: String(outOfSample.sharpe ?? "—"), tone: "text-up" },
          { label: "MDD", value: formatPct(m.mdd_pct, 1), tone: "text-down" },
          { label: "승률 / 거래", value: `${m.win_rate_pct ?? "—"}% / ${m.trades}건` },
        ]}
      />

      {/* ── 멀티 전략 비교표 ──────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="멀티 전략 비교">
        <h2 className="font-display text-2xl font-black tracking-tight">전략 패밀리 비교 — IS/OOS · 최대 수익 · 텐배거</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          모든 전략: ≥2개 학회 컨센서스 즉시 진입, 동일비중 {Math.round((params.position_weight ?? 0.05) * 100)}%, 편도 수수료 {(params.cost_per_side ?? 0.003) * 100}%.{" "}
          <span className="text-foreground font-medium">{params.anti_overfit_note}</span>
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">전략</th>
                <th className="px-3 py-2 text-right font-semibold">IS CAGR</th>
                <th className="px-3 py-2 text-right font-semibold">IS 샤프</th>
                <th className="px-3 py-2 text-right font-semibold">IS MDD</th>
                <th className="px-3 py-2 text-right font-semibold">OOS CAGR</th>
                <th className="px-3 py-2 text-right font-semibold">OOS 샤프</th>
                <th className="px-3 py-2 text-right font-semibold">최대 1종목</th>
                <th className="px-3 py-2 text-right font-semibold">탑10% P&L</th>
                <th className="px-3 py-2 text-right font-semibold">거래수</th>
              </tr>
            </thead>
            <tbody>
              {multiStrategy.strategies.map((r) => {
                const isHL = r.key === multiStrategy.headline_key;
                const is = r.in_sample;
                const oos = r.out_of_sample;
                return (
                  <tr
                    key={r.key}
                    className={cn(
                      "border-b border-dashed border-border last:border-b-0",
                      isHL && "bg-secondary font-bold"
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {STRATEGY_LABEL_KO[r.key] ?? r.key}
                    </td>
                    <td className={cn("tnum px-3 py-2 text-right font-mono text-xs", signColor(is.cagr_pct))}>
                      {is.cagr_pct != null ? formatPct(is.cagr_pct, 1) : "—"}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{is.sharpe ?? "—"}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-down">
                      {is.mdd_pct != null ? formatPct(is.mdd_pct, 1) : "—"}
                    </td>
                    <td className={cn("tnum px-3 py-2 text-right font-mono text-xs", signColor(oos.cagr_pct))}>
                      {oos.cagr_pct != null ? formatPct(oos.cagr_pct, 1) : "—"}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{oos.sharpe ?? "—"}</td>
                    <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(r.max_single_return_pct))}>
                      {r.max_single_return_pct != null ? formatPct(r.max_single_return_pct, 0) : "—"}
                      {r.best_trade_name && r.max_single_return_pct != null && r.max_single_return_pct > 0 && (
                        <span className="ml-1 font-normal text-muted-foreground text-[10px]">({r.best_trade_name})</span>
                      )}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-up">
                      {r.top_decile_pnl_share_pct > 0 ? `${r.top_decile_pnl_share_pct}%` : "—"}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{r.trade_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          IS = In-Sample 2019-07 ~ 2023-12 · OOS = Out-of-Sample 2024-01 ~ 현재.
          헤드라인(★) = IS 샤프 최상위 자동 선정.
          B 전략 최대 1종목 +1,868%: 이수페타시스(007660) 36개월 보유.
        </p>
      </section>

      {/* ── 전략 선택 + 상세 (client component) ──────────────────── */}
      <section aria-label="전략별 상세 분석">
        <h2 className="mb-4 font-display text-2xl font-black tracking-tight">전략별 상세 — 탭으로 전환</h2>
        <p className="mb-5 max-w-3xl text-sm leading-6 text-muted-foreground">
          각 전략의 자산 곡선, 월 적립 시뮬레이션, 거래 로그를 탭으로 확인할 수 있습니다.
          종목 이름 클릭 → 해당 종목 페이지로 이동합니다.
        </p>
        <StrategySelector
          multiStrategy={multiStrategy}
          wealthSimGlobal={ws}
          allTrades={allTradesMap}
        />
      </section>

      {/* ── 전략 규칙 (헤드라인 D) ──────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-2" aria-label="헤드라인 전략 규칙">
        {[
          {
            n: 1,
            title: "유니버스 — KR + US 멀티클럽 컨센서스",
            body: `KR ${universeStats.kr_tickers}개 + US ${universeStats.us_tickers}개 종목. 2019-07-01 이후 ≥2개 학회 동시 Buy. 단독 학회 커버 제외. US 종목은 달러 기준 가격 사용 (환율 미반영).`,
          },
          {
            n: 2,
            title: "진입 — 발간 당일 (다음 거래일 시가)",
            body: "신고가 돌파 대기 없음. 발간 다음 거래일 시가 즉시 매수.",
          },
          {
            n: 3,
            title: `청산 — 샹들리에 래칫 ATR(42)×${params.chandelier_atr_mult ?? 5}`,
            body: `신고점 대비 ATR(42)×5 아래로 종가가 내려오면 다음 거래일 시가 청산. 파라미터: 문헌 표준값 고정 (Le Beau Chandelier Exit). 멀티배거를 살려두되 큰 낙폭을 차단합니다.`,
          },
          {
            n: 4,
            title: `포지션 — 동일비중 ${Math.round((params.position_weight ?? 0.05) * 100)}%, 최대 ${params.max_positions ?? 20}종목`,
            body: `슬롯당 NAV의 ${Math.round((params.position_weight ?? 0.05) * 100)}%. 최대 ${params.max_positions ?? 20}종목. 거래비용 편도 ${(params.cost_per_side ?? 0.003) * 100}%. 슬롯 경합 시 선착순.`,
          },
        ].map((rule) => (
          <article key={rule.n} className="rounded-lg border border-border bg-card p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-stamp">규칙 {rule.n}</p>
            <h3 className="mt-1 font-display text-xl font-black tracking-tight">{rule.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{rule.body}</p>
          </article>
        ))}
      </section>

      {/* ── 헤드라인 자산 곡선 ──────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="헤드라인 자산 곡선">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            자산 곡선 (초기자본 = 1.0) — 헤드라인 {STRATEGY_LABEL_KO[params.headline_key] ?? params.headline_key}
          </h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {m.start} → {m.end} · 주간 샘플
          </p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="전략 자산 곡선">
          <line x1="8" x2={W - 8} y1={y(1)} y2={y(1)} className="stroke-border" strokeDasharray="4 4" strokeWidth="1" />
          <text x={W - 10} y={y(1) - 5} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">1.0</text>
          <path d={path} fill="none" className={m.total_return_pct >= 0 ? "stroke-up" : "stroke-down"} strokeWidth="2" strokeLinejoin="round" />
          <text
            x={x(equity.length - 1)}
            y={y(equity[equity.length - 1].nav) - 8}
            textAnchor="end"
            fontSize="11"
            fontWeight="700"
            className={cn("font-mono", m.total_return_pct >= 0 ? "fill-up" : "fill-down")}
          >
            {equity[equity.length - 1].nav.toFixed(2)}
          </text>
          {(() => {
            const oosIdx = equity.findIndex((p) => parseInt(p.date.slice(0, 4)) >= oosBoundaryYear);
            if (oosIdx < 0) return null;
            const bx = x(oosIdx);
            return (
              <>
                <line x1={bx} x2={bx} y1={12} y2={H - 8} className="stroke-muted-foreground" strokeDasharray="3 3" strokeWidth="1" />
                <text x={bx + 4} y={22} fontSize="9" className="fill-muted-foreground font-mono">OOS →</text>
              </>
            );
          })()}
        </svg>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-border pt-4">
          {(backtest.yearly as { year: number; return_pct: number }[]).map((row) => (
            <div
              key={row.year}
              className={cn(
                "rounded-md border border-border px-3 py-1.5 text-center",
                row.year >= oosBoundaryYear && "border-stamp/50 bg-stamp/5"
              )}
            >
              <p className="font-mono text-[10px] text-muted-foreground">
                {row.year}{row.year >= oosBoundaryYear ? " OOS" : ""}
              </p>
              <p className={cn("tnum font-mono text-sm font-bold", signColor(row.return_pct))}>
                {formatPct(row.return_pct, 1)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 테일 캡처 통계 ────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="테일 캡처 통계">
        <h2 className="font-display text-2xl font-black tracking-tight">수익은 꼬리에서 — 테일 캡처 분석 (헤드라인)</h2>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "총 거래 수", value: String(tail.total_trades) },
            { label: "상위 10% 거래 수", value: String(tail.top_decile_n) },
            { label: "상위 10% P&L 기여", value: `${tail.top_decile_pnl_share_pct}%`, tone: "text-up" },
            { label: "상위 10% 평균 수익률", value: formatPct(tail.top_decile_avg_return_pct, 0), tone: "text-up" },
            { label: "2배 이상 거래", value: `${tail.doubler_count}건` },
            { label: "상위 10% 평균 보유일", value: tail.top_decile_avg_hold_days ? `${tail.top_decile_avg_hold_days}일` : "—" },
          ].map((item) => (
            <div key={item.label} className="bg-card px-4 py-3">
              <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</dt>
              <dd className={cn("tnum mt-1.5 font-display text-2xl font-black tracking-tight", item.tone ?? "")}>{item.value}</dd>
            </div>
          ))}
        </dl>
        {tail.top10_trades.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">상위 10개 거래 (헤드라인)</p>
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-semibold">종목</th>
                  <th className="px-3 py-1.5 text-right font-semibold">수익률</th>
                  <th className="px-3 py-1.5 text-right font-semibold">보유일</th>
                  <th className="px-3 py-1.5 text-right font-semibold">커버 학회</th>
                </tr>
              </thead>
              <tbody>
                {tail.top10_trades.map((t, i) => {
                  const slug = t.market && t.ticker ? tickerSlug(t.market, t.ticker) : null;
                  return (
                    <tr key={`${t.ticker}-${i}`} className="border-b border-dashed border-border last:border-b-0">
                      <td className="px-3 py-1.5">
                        {slug ? (
                          <Link href={`/stocks/${slug}`} className="hover:underline">
                            <p className="font-mono text-xs font-bold">{t.display_name ?? t.ticker}</p>
                          </Link>
                        ) : (
                          <p className="font-mono text-xs font-bold">{t.display_name ?? t.ticker}</p>
                        )}
                        <p className="font-mono text-[10px] text-muted-foreground">{t.ticker}</p>
                      </td>
                      <td className={cn("tnum px-3 py-1.5 text-right font-mono text-xs font-bold", signColor(t.return_pct))}>{formatPct(t.return_pct, 1)}</td>
                      <td className="tnum px-3 py-1.5 text-right font-mono text-xs">{t.days}일</td>
                      <td className="tnum px-3 py-1.5 text-right font-mono text-xs">{t.n_clubs}개</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── 컨센서스 분석 ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="컨센서스 분석">
        <h2 className="font-display text-2xl font-black tracking-tight">
          멀티클럽 컨센서스 — ≥2개 학회가 동시에 Buy를 내면?
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{consensus.note}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { label: "단독 커버 (1개 학회)", data: consensus.single_club },
            { label: "멀티 커버 (≥2개 학회)", data: consensus.multi_club },
          ].map(({ label, data }) => (
            <div key={label} className="rounded-lg border border-border bg-secondary/30 p-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
              <dl className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { k: "거래 수", v: `${data.count}건` },
                  { k: "평균 수익률", v: formatPct(data.avg_return_pct, 1), tone: signColor(data.avg_return_pct) },
                  { k: "승률", v: data.win_rate_pct != null ? `${data.win_rate_pct}%` : "—" },
                ].map(({ k, v, tone }) => (
                  <div key={k}>
                    <dt className="font-mono text-[9px] text-muted-foreground">{k}</dt>
                    <dd className={cn("tnum mt-0.5 font-mono text-base font-bold", tone ?? "")}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        {consensus.alpha_multi_vs_single != null && (
          <p className="mt-3 text-sm text-muted-foreground">
            멀티 커버 종목 평균 수익률이 단독 커버 대비{" "}
            <span className={cn("font-bold", signColor(consensus.alpha_multi_vs_single))}>
              {formatPct(consensus.alpha_multi_vs_single, 1)}p
            </span>{" "}
            {consensus.alpha_multi_vs_single > 0
              ? "높습니다."
              : "낮습니다. 현재 샘플에서는 컨센서스 우위가 관찰되지 않습니다."}
          </p>
        )}
      </section>

      {/* ── 현재 보유 포지션 ──────────────────────────────────────── */}
      {backtest.open_positions.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-6" aria-label="현재 보유 포지션">
          <h2 className="font-display text-2xl font-black tracking-tight">
            헤드라인 전략이 지금 들고 있는 종목 ({backtest.open_positions.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">백테스트 마지막 날 기준 미청산 포지션.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">종목</th>
                  <th className="px-3 py-2 text-left font-semibold">진입일</th>
                  <th className="px-3 py-2 text-right font-semibold">진입가</th>
                  <th className="px-3 py-2 text-right font-semibold">현재가</th>
                  <th className="px-3 py-2 text-right font-semibold">수익률</th>
                  <th className="px-3 py-2 text-right font-semibold">커버</th>
                </tr>
              </thead>
              <tbody>
                {(backtest.open_positions as { ticker: string; market?: string; display_name?: string; entry_date: string; entry: number; last_close: number; return_pct: number; n_clubs?: number }[])
                  .sort((a, b) => b.return_pct - a.return_pct)
                  .map((pos) => {
                    const slug = pos.market && pos.ticker ? tickerSlug(pos.market, pos.ticker) : null;
                    return (
                      <tr key={pos.ticker} className="border-b border-dashed border-border last:border-b-0">
                        <td className="px-3 py-2">
                          {slug ? (
                            <Link href={`/stocks/${slug}`} className="hover:underline">
                              <p className="font-mono text-xs font-bold">{pos.display_name ?? pos.ticker}</p>
                            </Link>
                          ) : (
                            <p className="font-mono text-xs font-bold">{pos.display_name ?? pos.ticker}</p>
                          )}
                          <p className="font-mono text-[10px] text-muted-foreground">{pos.ticker}</p>
                        </td>
                        <td className="tnum px-3 py-2 font-mono text-xs text-muted-foreground">{pos.entry_date}</td>
                        <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.entry.toLocaleString()}</td>
                        <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.last_close.toLocaleString()}</td>
                        <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(pos.return_pct))}>
                          {formatPct(pos.return_pct, 1)}
                        </td>
                        <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{pos.n_clubs ?? 1}개교</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 신고가 돌파 전략(legacy) 민감도 ─────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="신고가 돌파 전략 민감도">
        <h2 className="font-display text-2xl font-black tracking-tight">참고: 신고가 돌파 전략 파라미터 민감도 (KR 전용)</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          구 v3 헤드라인의 신고가 돌파 + ATR 래칫 그리드. 인샘플 샤프가 일관되게 낮아 컨센서스 즉시진입보다 떨어집니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">ATR 배수</th>
                <th className="px-3 py-2 text-left font-semibold">국면 필터</th>
                <th className="px-3 py-2 text-right font-semibold">IS 샤프</th>
                <th className="px-3 py-2 text-right font-semibold">OOS 샤프</th>
                <th className="px-3 py-2 text-right font-semibold">MDD</th>
                <th className="px-3 py-2 text-right font-semibold">거래수</th>
              </tr>
            </thead>
            <tbody>
              {(backtest.sensitivity as { atr_mult: number; regime_filter: boolean; total_return_pct: number; sharpe: number | null; mdd_pct: number; trades: number; is_sharpe: number | null; oos_sharpe: number | null }[]).map((row) => (
                <tr key={`${row.atr_mult}-${row.regime_filter}`} className="border-b border-dashed border-border last:border-b-0">
                  <td className="tnum px-3 py-2 font-mono text-xs">×{row.atr_mult}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.regime_filter ? "ON" : "off"}</td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs">{row.is_sharpe ?? "—"}</td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs">{row.oos_sharpe ?? "—"}</td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs text-down">{formatPct(row.mdd_pct, 1)}</td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs">{row.trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 정직한 각주 ──────────────────────────────────────────── */}
      <section
        className="rounded-lg border-2 border-foreground/70 bg-card p-6 shadow-[5px_5px_0_0_hsl(var(--foreground)/0.75)]"
        aria-label="전략의 한계"
      >
        <h2 className="font-display text-2xl font-black tracking-tight">정직한 각주 — 이 전략이 무너지는 곳</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>
            · <strong className="text-foreground">과최적화 주의.</strong> 헤드라인(D) 파라미터는 ATR×5, 200MA — 문헌 표준값으로 고정. 그리드 서치 없음. IS 샤프 최상위 자동 선정.
          </li>
          <li>
            · <strong className="text-foreground">내러티브 홀드(C) 주의.</strong> 무한 홀드 전략은 최대 수익이 크지만 포지션 청산 규칙이 느슨해 큰 MDD를 허용합니다. C의 최대 단일 손실(-0.84%)은 데이터 종료 시점 미청산 포지션이 없어서입니다.
          </li>
          <li>
            · <strong className="text-foreground">US 종목 주의.</strong> US 수익은 달러 기준. KRW/USD 환율 변동 미반영. 달러 강세 시 원화 환산 수익은 과소평가됩니다.
          </li>
          <li>
            · <strong className="text-foreground">컨센서스 종목 수 제한.</strong> 전체 기간 US 컨센서스 4개 종목. 표본이 작아 통계적 유의성이 낮습니다.
          </li>
          <li>
            · 롱온리 전략. 대세 하락장에서는 손실 불가피. 헤드라인 MDD {formatPct(m.mdd_pct, 1)}.
          </li>
          <li>
            · 생존 편향: 아카이브에 수집된 리포트는 학회가 공개를 유지한 표본. 상장폐지 종목 시세 일부 누락 가능.
          </li>
          <li>
            · 올웨더 포트폴리오는 25% GLD/NASDAQ/S&P500/KOSPI 분기 리밸런싱으로 단순화. 실제 올웨더(채권 포함)와 다릅니다.
          </li>
          <li>· 투자 권유가 아닙니다. 과거 데이터 기반 시뮬레이션으로 미래 수익을 보장하지 않습니다.</li>
        </ul>
      </section>
    </main>
  );
}
