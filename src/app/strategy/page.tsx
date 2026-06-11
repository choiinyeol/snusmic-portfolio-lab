import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StatStrip } from "@/components/report-ledger";
import { StrategySelector } from "@/components/strategy/strategy-selector";
import {
  STRATEGY_LABEL_KO,
  STRATEGY_VERDICT,
  buildCuratedKeys,
} from "@/components/strategy/strategy-meta";
import backtest from "@/data/strategy-backtest.json";
import { signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

export const metadata: Metadata = {
  title: "전략 — 판결 아카이브",
  description:
    "학회 리포트 유니버스에서 전체 전략 변형을 IS/OOS로 검증. SOTA 전략의 임박 매매 신호와 전체 연구 기록.",
};

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
  highest_since_entry?: number | null;
  stop_level?: number | null;
  dist_to_stop_pct?: number | null;
  stop_hit?: boolean;
  extension?: number | null; // ATR% multiple from 50-MA (과열 게이지)
  trigger_schools?: string[];
  trigger_reports?: TriggerReport[];
};

type ImminentBuy = {
  ticker: string;
  market?: string;
  display_name?: string;
  n_schools: number;
  entry_basis_date?: string | null;
  entry_basis_price?: number | null;
  entry_pending?: boolean;
  trigger_schools?: string[];
  trigger_reports?: TriggerReport[];
};

type SignalsData = {
  as_of: string;
  headline_strategy: string;
  disclaimer: string;
  regime?: {
    applies: boolean;
    state: "ON" | "OFF";
    kospi_close: number;
    kospi_ma200: number;
    note: string;
  } | null;
  slots?: { max_positions: number; open: number; available: number };
  open_positions: SignalPosition[];
  approaching_stop: SignalPosition[];
  imminent_buys: ImminentBuy[];
  watching_count?: number;
  counts: {
    open: number;
    approaching_stop: number;
    imminent_buys: number;
    watching: number;
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
  kospi_dca_ratio?: number | null;
  kospi_dca_beats?: boolean | null;
};

type StrategyWealthSim = {
  final_strategy_value: number;
  strategy_gain_on_contributed_pct: number | null;
  strategy_mdd_pct: number;
  series: WealthPoint[];
};

type OpenPositionItem = {
  ticker: string;
  market?: string;
  display_name?: string;
  entry_date: string;
  entry: number;
  last_close: number;
  stop?: number;
  return_pct: number;
  source?: string;
  n_clubs?: number;
};

type MultiStrategyData = {
  strategies: StrategyRow[];
  headline_key: string;
  strategy_wealth_sims: Record<string, StrategyWealthSim>;
  equity_by_strategy: Record<string, { date: string; nav: number }[]>;
  yearly_by_strategy: Record<string, { year: number; return_pct: number }[]>;
  open_positions_by_strategy?: Record<string, OpenPositionItem[]>;
  trades_by_strategy?: Record<string, Trade[]>;
};

// ─── Verdict chip ─────────────────────────────────────────────────────────────

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
    sim_start: string;
    cost_per_side: number;
    position_weight: number;
    max_positions: number;
    chandelier_atr_mult: number;
    faber_ma_period: number;
    anti_overfit_note: string;
  };
  const signals = backtest.signals as unknown as SignalsData | undefined;
  const optunaNote = (backtest as Record<string, unknown>).optuna_chandelier as {
    adopted: boolean;
    best_params: { atr_period: number; atr_mult: number; max_positions: number };
    fold1_sharpe: number | null;
    fold2_sharpe: number | null;
    oos_sharpe: number | null;
    is_sharpe: number | null;
    n_trials: number;
    search_space: {
      atr_period: number[];
      atr_mult: number[] | { min: number; max: number; step: number };
      max_positions: number[];
    };
    methodology: string;
    adoption_criteria: string;
  } | undefined;
  const spoNote = (backtest as Record<string, unknown>).spo_predict_optimize as {
    paper: string;
    reference_impl: string;
    decision_problem: string;
    features: string[];
    mirrored_from_julia: string;
    adaptations: string;
    panel_months: number;
    first_rebalance: string | null;
    n_rebalances: number;
    n_train_months_final: number;
    V_spo: { is_sharpe: number | null; oos_sharpe: number | null; trades: number; mdd_pct: number | null; kospi_dca_ratio: number | null };
    V_ls: { is_sharpe: number | null; oos_sharpe: number | null; trades: number; mdd_pct: number | null; kospi_dca_ratio: number | null };
    spo_beats_ls: { is: boolean; oos: boolean };
    spo_vs_ls_verdict: string;
    promoted_to_selector: boolean;
    promotion_verdict: string;
    promotion_criteria: string;
    warmup_note: string;
  } | undefined;
  const multiStrategy = backtest.multi_strategy as unknown as MultiStrategyData;
  const universeStats = backtest.universe_stats as {
    kr_reports: number; us_reports: number; total_reports: number;
    kr_tickers: number; us_tickers: number;
  };

  const headlineTrades = (backtest.trades ?? []) as Trade[];
  const allTradesMap: Record<string, Trade[]> = {
    [params.headline_key]: headlineTrades,
  };

  // Curated selector keys: SOTA + adopted set + best-of-S (data-driven)
  const v12 = (backtest as Record<string, unknown>).v12_new_strategies as
    | { S_portfolio_opt?: { best_variant?: string } }
    | undefined;
  const bestSKey = v12?.S_portfolio_opt?.best_variant ?? null;
  const curatedKeys = buildCuratedKeys(multiStrategy.headline_key, bestSKey);
  const curatedSet = new Set(curatedKeys);

  const headlineLabel = STRATEGY_LABEL_KO[params.headline_key] ?? params.headline_key;
  const simStartDisplay = (params as { sim_start?: string }).sim_start ?? "2020-01-01";
  const strategyCount = multiStrategy.strategies.length;

  const regime = signals?.regime;
  const slots = signals?.slots;

  return (
    <main className="mx-auto max-w-[1500px] space-y-8 px-4 py-6 sm:px-8">
      <SiteHeader eyebrow="Strategy Lab" />

      {/* ══════════════════════════════════════════════════════════════
          ① 오늘의 신호 — SOTA 전략의 임박 매매
      ══════════════════════════════════════════════════════════════ */}
      {signals && (
        <section className="rounded-lg border-2 border-stamp bg-stamp/5 p-5" aria-label="오늘의 신호">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-black tracking-tight text-stamp">오늘의 신호</h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              기준일: {signals.as_of} · {headlineLabel}
            </p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            SOTA 전략({headlineLabel})이 지금 규칙대로 굴러간다면 일어날 매매 —
            리포트 뉴스 피드가 아니라 전략의 임박 주문서입니다.
          </p>

          {/* Regime banner */}
          {regime && (
            <div
              className={cn(
                "mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2",
                regime.applies && regime.state === "OFF"
                  ? "border-down/50 bg-down/10"
                  : "border-border bg-card",
              )}
            >
              <span className={cn(
                "rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-black",
                regime.state === "ON" ? "bg-up/15 text-up" : "bg-down/15 text-down",
              )}>
                레짐 {regime.state}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                KOSPI {regime.kospi_close.toLocaleString()} vs 200MA {regime.kospi_ma200.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">{regime.note}</span>
            </div>
          )}

          {/* Count badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "보유 중", count: signals.counts.open, tone: "bg-card border-border" },
              { label: "매도 임박 (스탑 3% 이내)", count: signals.counts.approaching_stop, tone: signals.counts.approaching_stop > 0 ? "bg-down/10 border-down/40" : "bg-card border-border" },
              { label: "매수 임박 (최근 5거래일)", count: signals.counts.imminent_buys, tone: signals.counts.imminent_buys > 0 ? "bg-up/10 border-up/40" : "bg-card border-border" },
              ...(slots ? [{ label: `슬롯 여유 (최대 ${slots.max_positions})`, count: slots.available, tone: slots.available === 0 ? "bg-down/10 border-down/40" : "bg-card border-border" }] : []),
            ].map((item) => (
              <div key={item.label} className={cn("rounded-lg border px-3 py-1.5", item.tone)}>
                <p className="font-mono text-[10px] text-muted-foreground">{item.label}</p>
                <p className="tnum font-display text-xl font-black">{item.count}</p>
              </div>
            ))}
          </div>

          {/* 매도 임박 — within 3% of trailing stop (incl. stop hit) */}
          {(signals.approaching_stop?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-down">
                매도 임박 — 트레일링 스탑 3% 이내
              </p>
              <div className="space-y-2">
                {signals.approaching_stop.map((pos, i) => {
                  const slug = pos.market && pos.ticker ? tickerSlug(pos.market, pos.ticker) : null;
                  return (
                    <div key={`${pos.ticker}-${i}`} className="rounded-md border border-down/40 bg-down/5 px-4 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        {slug ? (
                          <Link href={`/stocks/${slug}`} className="font-mono text-sm font-bold hover:underline">
                            {pos.display_name ?? pos.ticker}
                          </Link>
                        ) : (
                          <span className="font-mono text-sm font-bold">{pos.display_name ?? pos.ticker}</span>
                        )}
                        <span className="font-mono text-xs text-muted-foreground">({pos.ticker})</span>
                        {pos.stop_hit ? (
                          <span className="rounded-sm bg-down px-1.5 py-0.5 font-mono text-[10px] font-bold text-background">
                            스탑 터치 — 다음 시가 청산
                          </span>
                        ) : pos.dist_to_stop_pct != null && (
                          <span className="rounded-sm bg-down/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-down">
                            스탑까지 {pos.dist_to_stop_pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>진입가: <strong className="text-foreground">{pos.entry_price.toLocaleString()}</strong></span>
                        {pos.current_price != null && <span>현재가: <strong className={cn(pos.unrealized_pct != null && pos.unrealized_pct >= 0 ? "text-up" : "text-down")}>{pos.current_price.toLocaleString()}</strong></span>}
                        {pos.stop_level != null && <span>스탑: <strong className="text-down">{pos.stop_level.toLocaleString()}</strong></span>}
                        {pos.unrealized_pct != null && <span>미실현: <strong className={cn(pos.unrealized_pct >= 0 ? "text-up" : "text-down")}>{pos.unrealized_pct > 0 ? "+" : ""}{pos.unrealized_pct.toFixed(1)}%</strong></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 매수 임박 — reports in last 5 trading days, not yet entered */}
          {signals.imminent_buys.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-up">
                매수 임박 — 최근 5거래일 리포트, 익일 시가 진입 대기
                {slots && slots.available === 0 && (
                  <span className="ml-2 normal-case tracking-normal text-down">슬롯 가득 — 빈 슬롯이 생겨야 진입</span>
                )}
              </p>
              <div className="space-y-2">
                {signals.imminent_buys.map((sig, i) => {
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
                        <span className="rounded-sm bg-up/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-up">
                          {sig.n_schools}개교
                        </span>
                        {sig.entry_pending && (
                          <span className="rounded-sm border border-up/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-up">
                            진입 대기 중
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>진입 기준일: <strong className="text-foreground">{sig.entry_basis_date ?? "다음 거래일"}</strong></span>
                        <span>진입 기준가: <strong className="text-foreground">{sig.entry_basis_price != null ? sig.entry_basis_price.toLocaleString() : "익일 시가"}</strong></span>
                      </div>
                      {sig.trigger_reports && sig.trigger_reports.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {sig.trigger_reports.map((r, ri) => (
                            <span key={ri} className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px]">
                              [{r.school}] {r.report_date}{r.target_price ? ` 목표가 ${r.target_price.toLocaleString()}` : ""}
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

          {/* 보유 중 — open positions table */}
          {signals.open_positions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
                보유 중 — {signals.counts.open}종목 (현재가·스탑·과열계수)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">종목</th>
                      <th className="px-3 py-1.5 text-right">미실현</th>
                      <th className="px-3 py-1.5 text-right">현재가</th>
                      <th className="px-3 py-1.5 text-right">스탑</th>
                      <th className="px-3 py-1.5 text-right" title="ATR% Multiple from 50-MA. 8× 이상 과열 (Minervini circle)">과열계수</th>
                      <th className="px-3 py-1.5 text-right">보유일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...signals.open_positions].sort((a, b) => (b.unrealized_pct ?? -999) - (a.unrealized_pct ?? -999)).map((pos, i) => {
                      const slug = pos.market && pos.ticker ? tickerSlug(pos.market, pos.ticker) : null;
                      const ext = pos.extension;
                      const extColor = ext == null ? "text-muted-foreground" : ext >= 12 ? "text-down font-bold" : ext >= 8 ? "text-amber-500 font-bold" : "text-muted-foreground";
                      return (
                        <tr key={`${pos.ticker}-${i}`} className="border-b border-dashed border-border last:border-b-0">
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
                          <td className={cn("tnum px-3 py-1.5 text-right font-mono text-xs font-bold", pos.unrealized_pct != null ? (pos.unrealized_pct >= 0 ? "text-up" : "text-down") : "")}>
                            {pos.unrealized_pct != null ? `${pos.unrealized_pct > 0 ? "+" : ""}${pos.unrealized_pct.toFixed(1)}%` : "—"}
                          </td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs">
                            {pos.current_price != null ? pos.current_price.toLocaleString() : "—"}
                          </td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
                            {pos.stop_level != null ? pos.stop_level.toLocaleString() : "—"}
                          </td>
                          <td className={cn("tnum px-3 py-1.5 text-right font-mono text-xs", extColor)}>
                            {ext != null ? `${ext.toFixed(1)}×` : "—"}
                          </td>
                          <td className="tnum px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
                            {pos.days_elapsed}일
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                과열계수 = B/A (A=ATR14/가격, B=(가격−50SMA)/50SMA). 8× 황색, 12× 이상 적색 — Minervini 커뮤니티 관행, TradingView Fred6724.
                상세 보유 테이블은{" "}
                <a href="#strategy-selector" className="underline hover:text-foreground">전략 비교 → 보유 중 탭</a>에서 확인하세요.
              </p>
            </div>
          )}

          {/* Watching — demoted to a one-line count (report flow, not a strategy signal) */}
          {(signals.watching_count ?? 0) > 0 && (
            <p className="mt-4 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
              그 외 유효 리포트가 있는 미보유 종목 {signals.watching_count}개는 전략 신호가 아닌 리포트 흐름입니다 —{" "}
              <Link href="/" className="underline hover:text-foreground">아카이브에서 확인</Link>.
            </p>
          )}

          <p className="mt-3 text-[11px] italic text-muted-foreground">{signals.disclaimer}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ② 헤드라인 요약
      ══════════════════════════════════════════════════════════════ */}
      <header>
        <h1 className="mt-2 font-display text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl">
          전성기 수익을 어떻게 <span className="text-stamp">수확</span>할 것인가.
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          학회 리포트 발간 후 24개월 내 피크 수익률이 거의 전부 양(+)이라는 사실 —
          하지만 라운드트립을 타면 그 이익은 사라집니다.
          {strategyCount}개 전략 변형을 인샘플({simStartDisplay.slice(0, 7)}–2023-12)로 비교하고
          아웃오브샘플(2024–현재)로 검증, 그중 {curatedKeys.length}개를 채택했습니다.
          SOTA는 IS 샤프 최상위 전략인{" "}
          <strong className="text-foreground">{headlineLabel}</strong>입니다.
        </p>
        <p className="mt-1.5 text-sm italic text-muted-foreground">
          주의: 과거 데이터 기반 시뮬레이션. 미래 수익 보장 없음. 과최적화 방지를 위해 파라미터는 문헌 표준값 고정.
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          유니버스:{" "}
          <strong className="text-foreground">KR {universeStats.kr_tickers}개 + US {universeStats.us_tickers}개</strong>{" "}
          종목 (1회 이상 Buy 언급 — 단독·컨센서스 모두 진입) · 시뮬 기점 {simStartDisplay}
        </p>
      </header>

      <StatStrip
        items={[
          { label: "누적 수익률 (SOTA)", value: formatPct(m.total_return_pct, 1), tone: signColor(m.total_return_pct) },
          { label: "CAGR (전체)", value: formatPct(m.cagr_pct, 1), tone: signColor(m.cagr_pct) },
          { label: "인샘플 샤프", value: String(inSample.sharpe ?? "—") },
          { label: "아웃오브샘플 샤프", value: String(outOfSample.sharpe ?? "—"), tone: "text-up" },
          { label: "MDD", value: formatPct(m.mdd_pct, 1), tone: "text-down" },
          { label: "승률 / 거래", value: `${m.win_rate_pct ?? "—"}% / ${m.trades}건` },
        ]}
      />

      {/* ══════════════════════════════════════════════════════════════
          ③ 전략 비교 + 자산곡선·시뮬 (curated selector)
      ══════════════════════════════════════════════════════════════ */}
      <details open id="strategy-selector" className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer select-none list-none items-baseline justify-between gap-2 p-5 transition-colors hover:bg-secondary/20 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-display text-2xl font-black tracking-tight">전략 비교 &amp; 상세</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              채택 전략 {curatedKeys.length}개 · 자산곡선 · 월 적립 시뮬레이션 · 거래 로그
            </p>
          </div>
          <span className="font-mono text-sm text-muted-foreground transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="space-y-6 border-t border-border px-5 pb-5 pt-4">
          <p className="text-xs text-muted-foreground">
            모든 전략: 1회 이상 Buy 언급 시 즉시 진입, 동일비중 {Math.round((params.position_weight ?? 0.05) * 100)}%,
            편도 수수료 {(params.cost_per_side ?? 0.003) * 100}%. 동시 보유 한도로 신호 일부는 미체결.{" "}
            <span className="font-medium text-foreground">{params.anti_overfit_note}</span>
          </p>
          <StrategySelector
            multiStrategy={multiStrategy}
            wealthSimGlobal={ws}
            allTrades={allTradesMap}
            curatedKeys={curatedKeys}
          />
        </div>
      </details>

      {/* ══════════════════════════════════════════════════════════════
          ④ 전체 연구 기록 — every strategy ever tested, with verdicts
      ══════════════════════════════════════════════════════════════ */}
      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer select-none list-none items-baseline justify-between gap-2 p-5 transition-colors hover:bg-secondary/20 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-display text-2xl font-black tracking-tight">전체 연구 기록 — {strategyCount}개 전략 변형</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              시험한 모든 전략의 IS/OOS 성적과 채택·기각 사유 · CSV 다운로드
            </p>
          </div>
          <span className="font-mono text-sm text-muted-foreground transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="border-t border-border px-5 pb-5 pt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            <VerdictChip kind="SOTA" /> IS 샤프 최상위 자동 채택 ·{" "}
            <VerdictChip kind="채택" /> 셀렉터 채택 ·{" "}
            <VerdictChip kind="기각" /> 비용·성과 미달로 제외 ·{" "}
            <VerdictChip kind="연구용" /> 참고 가치만 — 칩에 마우스를 올리면 사유가 표시됩니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">전략</th>
                  <th className="px-3 py-2 text-left font-semibold">판정</th>
                  <th className="px-3 py-2 text-right font-semibold">IS 샤프</th>
                  <th className="px-3 py-2 text-right font-semibold">OOS 샤프</th>
                  <th className="px-3 py-2 text-right font-semibold">vs KOSPI DCA</th>
                  <th className="px-3 py-2 text-right font-semibold">MDD</th>
                  <th className="px-3 py-2 text-right font-semibold">거래수</th>
                  <th className="px-3 py-2 text-right font-semibold">CSV</th>
                </tr>
              </thead>
              <tbody>
                {multiStrategy.strategies.map((r) => {
                  const isSota = r.key === multiStrategy.headline_key;
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
          <p className="mt-2 text-xs text-muted-foreground">
            IS = In-Sample {simStartDisplay.slice(0, 7)} ~ 2023-12 · OOS = Out-of-Sample 2024-01 ~ 현재 ·
            vs KOSPI DCA = 동일 적립 스케줄 최종 자산 비율 (1.00x 초과 = KOSPI 적립식 우위).
          </p>
        </div>
      </details>

      {/* ══════════════════════════════════════════════════════════════
          ⑤ 방법론 / 전략 규칙 / 각주 — collapsible
      ══════════════════════════════════════════════════════════════ */}
      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer select-none list-none items-baseline justify-between gap-2 p-5 transition-colors hover:bg-secondary/20 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-display text-2xl font-black tracking-tight">방법론 &amp; 각주</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">전략 규칙 · 한계 · 면책사항</p>
          </div>
          <span className="font-mono text-sm text-muted-foreground transition-transform group-open:rotate-180">▼</span>
        </summary>
        <div className="space-y-5 border-t border-border px-5 pb-5 pt-4">

          {/* Strategy rules */}
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              {
                n: 1,
                title: "유니버스 — KR + US 전체 Buy 언급",
                body: `KR ${universeStats.kr_tickers}개 + US ${universeStats.us_tickers}개 종목. 리포트 풀 ${params.universe_start} 이후, 시뮬 기점 ${simStartDisplay}. 1회 이상 Buy 언급 즉시 진입 — 단독 커버·컨센서스 모두 포함. 동시 보유 한도로 신호 일부 미체결. US 종목은 달러 기준 가격 사용 (환율 미반영).`,
              },
              {
                n: 2,
                title: "진입 — 전략별 트리거 조건",
                body: "A/B/C/D/E: 발간 다음 거래일 시가 즉시 진입. F: 200MA 위 확인 후 진입. G: 발간일 종가 -20% 도달 시 진입. H: 미너비니 5-point 템플릿 통과 시. I: Supertrend(10,3) 상향전환 시. J: D NAV 오버레이. K: R:R 즉시. L: RSI(2)<10 AND close>200MA. M: 월초 직전 1mo 수익률 하위 20%. N: 리포트 당일 close≥52w고점×85%.",
              },
              {
                n: 3,
                title: "청산 — 전략별 규칙",
                body: "D/D+: ATR 트레일링 스탑 (Le Beau Chandelier). G: 목표가/+50%/12mo/ATR×3 선착. H: 주간 close<50MA. I: Supertrend 하향전환. J: 80/20 자동 디레버. K: half at +2.5R + ATR×3 트레일. L: RSI(2)>70 OR 10거래일. M: 1개월 보유 후 전량 매도. N: 월말 close<52w고점×70%.",
              },
              {
                n: 4,
                title: `포지션 — 동일비중 ${Math.round((params.position_weight ?? 0.05) * 100)}%`,
                body: `슬롯당 NAV의 ${Math.round((params.position_weight ?? 0.05) * 100)}%. 최대 ${params.max_positions ?? 20}종목 (K는 최대 10, D+ Optuna는 탐색 결과에 따름). 거래비용 편도 ${(params.cost_per_side ?? 0.003) * 100}%. J(레버리지): 차입비용 6%/년 일 단위 적립.`,
              },
              {
                n: 5,
                title: "L 민리버전 — Connors RSI-2 출처",
                body: "Connors & Alvarez (2009) 'Short-Term Trading Strategies That Work'. 유니버스: 최근 18개월 내 매수 리포트. RSI(2) < 10 AND close > 200MA 진입. RSI(2) > 70 OR 10거래일 청산. 단기 평균회귀 전략.",
              },
              {
                n: 6,
                title: "M 단기 리버설 — Factor Zoo 출처",
                body: "Jegadeesh (1990), Lehmann (1990) 단기 과매도 반전. 유니버스: 최근 18개월 리포트. 월초 리밸런싱: 직전 1개월 수익률 하위 20% 매수, 1개월 보유 후 전량 청산.",
              },
              {
                n: 7,
                title: "N 52주 고가 근접 — George & Hwang 2004 출처",
                body: "George & Hwang (2004) 'The 52-Week High and Momentum Investing'. 리포트 당일 close ≥ 52w high × 85% 진입. 월말 체크: close < 52w high × 70% 청산.",
              },
              {
                n: 8,
                title: "G 딥바이 / H 미너비니 / I 슈퍼트렌드 / K R:R",
                body: "G: Jegadeesh & Kim (2006). H: Minervini (2013). I: Supertrend(10,3) Seban. K: Van Tharp R-배수 프레임워크. 상세는 각 전략 결과 참조.",
              },
              {
                n: 9,
                title: "Q 깡토 추세추종 — 시장 필터 + RS 브레이크아웃",
                body: "시장 신호: KOSPI close > 200MA AND 50MA 상승 시 그린(2유닛) 아니면 레드(1유닛). 유닛 = 총자본/20, Max 2% Rule(단일 포지션 위험 ≤ 자본 2%). 진입: RS 퍼센타일 ≥ KOSPI RS AND close = 60일 신고가 AND 거래량 ≥ 20일 평균×1.5, 다음 시가 체결. 스탑: -8%(=1R). +3R에서 반매도, +1R에서 BE, +1.5R 이후 고점-8% 트레일. 비용 0.3%/side. 기대 승률 ~30% (추세형).",
              },
              {
                n: 10,
                title: "R Kelly 샹들리에 — D+ 위에 Kelly 포지션 사이징 오버레이",
                body: "D+ 샹들리에(Optuna) 진입/청산 규칙 그대로 + 포지션 크기만 Kelly로 대체. Kelly 공식: (p - (1-p)/(avg_win/avg_loss)) × 0.5 안전계수, 상한 25%, 하한 1%, 직전 40거래 기준 롤링 계산. 거래 이력 10건 미만이면 플랫 5%로 폴백. 플랫 5%와 비교하여 사이징 효과 단독 측정.",
              },
              {
                n: 11,
                title: "S 포트폴리오 최적화 — 월간 리밸런스 3종 배분형",
                body: "활성 유니버스(18개월 매수 리포트 윈도우) 종목을 매월 리밸런스. (a) S_hrp: HRP — 상관거리 단일연결 클러스터링, 준대각 재정렬, 역분산 재귀분할. (b) S_msharpe: max-Sharpe — LedoitWolf 공분산 축소(sklearn), 개별 비중 ≤15%. (c) S_mincvar: min-CVaR 95% — scipy linprog LP, 개별 비중 ≤15%. IS 샤프 최고 변형만 셀렉터에 포함. 턴오버 비용 적용. v15: scipy 의존성 누락 시 침묵 실패(평탄 NAV) 버그 수정 — 의존성 프리플라이트로 즉시 실패.",
              },
              {
                n: 12,
                title: "V. SPO 포트폴리오 — Smart 'Predict, then Optimize'",
                body: "Elmachtoub & Grigas (2022, Management Science) SPO+ 손실 구현 — 'SPO는 향후 과제' 항목을 결과로 대체. 선형모델 ĉ=Bx를 SPO+ 손실로 SGD 학습(V-a), 동일 파이프라인 LS 손실 대조군(V-b). 캡 심플렉스(Σw=1, w≤15%) LP는 닫힌형 그리디 오라클. 워크포워드 최소 24개월, 월말 신호 → 익월 첫 거래일 시가 체결, 비용 0.3%/side. 상세·정직한 판정은 아래 'SPO 방법론 공개' 참조. 장중(intraday) 전략과 유상증자(Secondary Public Offering) 이벤트 전략은 여전히 범위 밖(데이터 부재).",
              },
              {
                n: 13,
                title: "T / T-. 코어-KOSPI 샹들리에 — 유휴 현금 KOSPI 파킹",
                body: "D+ 샹들리에 규칙 완전 동일. 유휴 현금(비어있는 슬롯 금액)을 KOSPI 지수 익스포저(KODEX200 기준 ETF 가정)로 주차. T-(레짐 변형): KOSPI < 200MA 구간에서는 파킹 수익률 0%(현금 보유). 인덱스 ETF 전환 비용 0.05%/side 가정(실제 스프레드·세금 상이 가능). 베이스라인 = KOSPI DCA — 주식 픽이 KOSPI 알파를 더하면 ratio>1, 전환 비용이 알파를 삼키면 ratio≤1. 참조: Faber (2007) 레짐 필터.",
              },
              {
                n: 14,
                title: "U. 과열 스케일아웃 — ATR% Multiple from 50-MA",
                body: "T-와 완전 동일 + 과열 게이지: extension = B/A, A = ATR(14)/가격 (ATR%), B = (가격 − 50SMA)/50SMA. extension > 8× 시 보유 주수의 절반 매도 → KOSPI 파킹(1차). extension 이후 > 12× 시 남은 포지션의 절반 다시 매도(2차). 트리거는 포지션당 1회(오실레이션 재발동 없음; 재진입 시 초기화). 출처: Minervini 커뮤니티 관행, TradingView Fred6724.",
              },
            ].map((rule) => (
              <article key={rule.n} className="rounded-lg border border-border bg-secondary/20 p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-stamp">규칙 {rule.n}</p>
                <h4 className="mt-1 font-display text-base font-black tracking-tight">{rule.title}</h4>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{rule.body}</p>
              </article>
            ))}
          </div>

          {/* Optuna methodology disclosure */}
          {optunaNote && (
            <section className="rounded-lg border border-stamp/40 bg-stamp/5 p-5">
              <h3 className="font-display text-lg font-black tracking-tight">
                D+ Optuna 강건 최적화 — 방법론 전문 공개
                {optunaNote.adopted
                  ? <span className="ml-2 font-mono text-[11px] font-normal text-up">채택됨</span>
                  : <span className="ml-2 font-mono text-[11px] font-normal text-down">채택 불가 (OOS 미달)</span>
                }
              </h3>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">탐색 공간 (5차원 이하)</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>· ATR 기간: {optunaNote.search_space.atr_period?.join(" / ")}</li>
                    <li>
                      · ATR 배수:{" "}
                      {Array.isArray(optunaNote.search_space.atr_mult)
                        ? `[${optunaNote.search_space.atr_mult.join(", ")}]`
                        : `${optunaNote.search_space.atr_mult.min} ~ ${optunaNote.search_space.atr_mult.max} (step ${optunaNote.search_space.atr_mult.step})`}
                    </li>
                    <li>· 최대 포지션: {optunaNote.search_space.max_positions?.join(" / ")}</li>
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">최적 파라미터</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>· ATR 기간: {optunaNote.best_params?.atr_period}</li>
                    <li>· ATR 배수: {optunaNote.best_params?.atr_mult?.toFixed(3)}</li>
                    <li>· 최대 포지션: {optunaNote.best_params?.max_positions}</li>
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">IS 폴드 검증 ({optunaNote.n_trials} trials)</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>· 폴드1 (2020-21) 샤프: {optunaNote.fold1_sharpe?.toFixed(2) ?? "—"}</li>
                    <li>· 폴드2 (2022-23) 샤프: {optunaNote.fold2_sharpe?.toFixed(2) ?? "—"}</li>
                    <li>· 목적함수: min(f1,f2) − 0.1×|f1−f2|</li>
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">OOS 1회 평가 결과</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>· IS 샤프: {optunaNote.is_sharpe?.toFixed(2) ?? "—"}</li>
                    <li>· OOS 샤프: {optunaNote.oos_sharpe?.toFixed(2) ?? "—"}</li>
                    <li>· 채택 기준: {optunaNote.adoption_criteria}</li>
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-xs italic text-muted-foreground">{optunaNote.methodology}</p>
            </section>
          )}

          {/* SPO (Smart Predict-then-Optimize) methodology disclosure */}
          {spoNote && (
            <section className="rounded-lg border border-stamp/40 bg-stamp/5 p-5">
              <h3 className="font-display text-lg font-black tracking-tight">
                V. SPO 방법론 공개 — Smart &lsquo;Predict, then Optimize&rsquo;
                {spoNote.promoted_to_selector
                  ? <span className="ml-2 font-mono text-[11px] font-normal text-up">셀렉터 승격</span>
                  : <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">연구 기록 전용</span>
                }
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">
                논문: {spoNote.paper} · 참조 구현: {spoNote.reference_impl}
              </p>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">결과 — V-a SPO+ vs V-b LS</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>· IS 샤프: {spoNote.V_spo.is_sharpe ?? "—"} vs {spoNote.V_ls.is_sharpe ?? "—"}</li>
                    <li>· OOS 샤프: {spoNote.V_spo.oos_sharpe ?? "—"} vs {spoNote.V_ls.oos_sharpe ?? "—"}</li>
                    <li>· vs KOSPI DCA: {spoNote.V_spo.kospi_dca_ratio ?? "—"}x vs {spoNote.V_ls.kospi_dca_ratio ?? "—"}x</li>
                    <li>· SPO+ &gt; LS (논문 주장): IS {spoNote.spo_beats_ls.is ? "성립" : "불성립"} · OOS {spoNote.spo_beats_ls.oos ? "성립" : "불성립"}</li>
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground">워크포워드 설정</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>· 의사결정: {spoNote.decision_problem}</li>
                    <li>· 패널 {spoNote.panel_months}개월 · 리밸런스 {spoNote.n_rebalances}회 (첫 리밸런스 {spoNote.first_rebalance ?? "—"})</li>
                    <li>· 최종 학습 윈도우 {spoNote.n_train_months_final}개월 (확장, 최소 24)</li>
                    <li>· 피처 {spoNote.features.length}종: {spoNote.features.join(", ")}</li>
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                <strong className="text-foreground">Julia 레퍼런스에서 미러:</strong> {spoNote.mirrored_from_julia}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                <strong className="text-foreground">우리의 적응:</strong> {spoNote.adaptations}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">{spoNote.warmup_note}</p>
              <p className="mt-3 text-xs italic text-muted-foreground">
                판정: {spoNote.promotion_verdict} (승격 기준: {spoNote.promotion_criteria}) · {spoNote.spo_vs_ls_verdict}
              </p>
            </section>
          )}

          {/* Honest footnotes */}
          <section
            className="rounded-lg border-2 border-foreground/70 bg-card p-5 shadow-[4px_4px_0_0_hsl(var(--foreground)/0.7)]"
            aria-label="전략의 한계"
          >
            <h3 className="font-display text-xl font-black tracking-tight">정직한 각주 — 이 전략이 무너지는 곳</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>· <strong className="text-foreground">과최적화 주의.</strong> D 기본값 파라미터는 문헌 표준값(ATR×5, 200MA) 고정. D+ Optuna는 IS 2-폴드 교차검증으로 강건화했으나 표본 크기 제한으로 과최적화 위험이 남습니다.</li>
              <li>· <strong className="text-foreground">시뮬 기점 주의.</strong> 2020-01 이전 리포트 풀이 얇아 기점을 {simStartDisplay}로 설정. 실질 트레이딩은 신호 발생 시점부터이므로 첫 거래는 이후.</li>
              <li>· <strong className="text-foreground">내러티브 홀드(C) 주의.</strong> 무한 홀드 전략은 MDD 허용 범위가 넓습니다. 포지션 청산 규칙이 느슨합니다.</li>
              <li>· <strong className="text-foreground">딥바이(G) 솔직한 평가.</strong> 20% 하락이 저점이 아니라 시작인 경우가 많습니다. IS/OOS 모두 벤치마크 하회 — 채택 불가.</li>
              <li>· <strong className="text-foreground">민리버전(L) / 단기 리버설(M) 솔직한 평가.</strong> 두 전략 모두 이 유니버스에서 거래비용으로 작동하지 않습니다. Connors RSI-2는 미국 ETF·대형주 시장을 위해 설계된 전략으로 한국 소형·중형주 + 학회 리포트 필터 조합에서는 0.6% 왕복 비용 × 높은 회전율이 알파를 소진합니다. 구현 검증 후 기각 — 전체 연구 기록에만 유지.</li>
              <li>· <strong className="text-foreground">코어-새틀라이트 레버리지(J) 솔직한 평가.</strong> 차입비용(6%/년)과 폭락 타이밍 미스 리스크가 있습니다. D 보조 시뮬로만 참고하세요.</li>
              <li>· <strong className="text-foreground">US 종목 주의.</strong> 수익은 달러 기준. KRW/USD 환율 변동 미반영.</li>
              <li>· <strong className="text-foreground">컨센서스 표본 제한.</strong> US 컨센서스 종목 소수. 통계적 유의성 낮음.</li>
              <li>· 롱온리 전략. 대세 하락장 손실 불가피. SOTA MDD {formatPct(m.mdd_pct, 1)}.</li>
              <li>· <strong className="text-foreground">컨센서스 분석.</strong>{" "}
                SOTA 거래 기준: 단독 커버 {consensus.single_club.count}건 (평균 {formatPct(consensus.single_club.avg_return_pct, 1)}, 승률 {consensus.single_club.win_rate_pct ?? "—"}%) vs
                멀티 커버 {consensus.multi_club.count}건 (평균 {formatPct(consensus.multi_club.avg_return_pct, 1)}, 승률 {consensus.multi_club.win_rate_pct ?? "—"}%).
                {consensus.alpha_multi_vs_single != null && ` 멀티 커버 알파: ${formatPct(consensus.alpha_multi_vs_single, 1)}p.`}
              </li>
              <li>· 생존 편향: 공개를 유지한 리포트만 수집. 상장폐지 종목 시세 일부 누락 가능.</li>
              <li>· 올웨더는 25% GLD/NASDAQ/S&P500/KOSPI 분기 리밸런싱으로 단순화. 채권 미포함.</li>
              <li>· 투자 권유가 아닙니다. 과거 데이터 기반 시뮬레이션으로 미래 수익을 보장하지 않습니다.</li>
            </ul>
          </section>

          {/* Editorial: can price-only data hold tenbaggers? */}
          <section className="rounded-lg border border-stamp/40 bg-stamp/5 p-5">
            <h3 className="font-display text-lg font-black tracking-tight">가격-전용 데이터로 텐배거를 끝까지 들고 갈 수 있는가?</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              샹들리에 ATR×5 트레일은 “고점이 어디인지 모른다”는 사실을 설계로 인정하고,
              단지 <em>가격이 최고점에서 충분히 떨어질 때까지</em> 기다린다.
              이 접근은 10배·14배 구간을 가진 종목을 처음부터 끝까지 타는 것을 이론상 허용한다.
              실제로 백테스트에서 단일 최대 수익률 거래는 300~400%대로 나타났으며,
              샹들리에가 그런 종목들을 12개월 고정 보유나 목표가 절반익절보다 훨씬 오래 들고 있었다.
            </p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              그러나 <strong className="text-foreground">과열 구간에서 가격-전용 신호는 한계를 가진다.</strong>{" "}
              PLTR·TSLA·NVDA 유형처럼 extension(50SMA 대비 ATR% 배수)이 10×를 넘어 과열된 뒤 급락하는 패턴에서
              ATR 트레일은 이미 30~50% 되돌림을 감수한 뒤에야 청산한다.
              이에 U 전략(과열 스케일아웃: extension 8×·12× 부분 익절)을 설계해 T-와 비교했으나,
              이 유니버스에서는 과열 부분 익절이 남은 포지션의 상승을 놓치는 비용이 더 컸다 — U는 기각되었다
              (전체 연구 기록 참조).
              가격-전용 데이터만으로는 “지금이 고점인지 아닌지”를 알 수 없으므로,
              텐배거를 완전히 타려면 트레일링 스탑(ATR×5)이 과열 부분 익절보다 장기적으로 더 좋은 경우가 많다.
              결론: <em>샹들리에는 텐배거를 타는 데 가격-전용 데이터 중 가장 정직한 도구지만,
              과열 구간 이후의 되돌림 비용을 감수하는 것이 전략의 핵심 트레이드오프다.</em>
            </p>
          </section>
        </div>
      </details>
    </main>
  );
}
