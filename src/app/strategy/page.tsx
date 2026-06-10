import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StatStrip } from "@/components/report-ledger";
import { StrategySelector } from "@/components/strategy/strategy-selector";
import backtest from "@/data/strategy-backtest.json";
import { signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

export const metadata: Metadata = { title: "전략 — 판결 아카이브" };

function fmt만(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
}

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
  // legacy fixed-hold fields
  exit_due?: string;
  days_remaining?: number;
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
  approaching_stop: SignalPosition[];
  // legacy
  expiring_soon?: SignalPosition[];
  new_buy_signals: NewSignal[];
  watching_single_club: WatchingEntry[];
  counts: {
    open: number;
    approaching_stop: number;
    // legacy
    expiring_soon_30d?: number;
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

const STRATEGY_LABEL_KO: Record<string, string> = {
  A_12mo:               "A. 12개월 보유",
  B_36mo:               "B. 36개월 보유",
  C_narrative:          "C. 내러티브 홀드",
  D_chandelier:         "D. 샹들리에 래칫",
  "D+_chandelier_optuna": "D+. 샹들리에 (Optuna) ★",
  E_half_runner:        "E. 절반익절+러너",
  F_momentum_narrative: "F. 모멘텀 필터",
  G_dip_buy:            "G. 딥바이",
  H_minervini:          "H. 미너비니 템플릿",
  I_supertrend:         "I. 슈퍼트렌드",
  J_core_satellite:     "J. 코어-새틀라이트",
  K_rr_trend:           "K. R:R 2.5 추세추종",
  L_rsi2_reversion:     "L. 민리버전 (RSI-2) ⚠",
  M_short_reversal:     "M. 단기 리버설 ⚠",
  N_52w_high:           "N. 52주 고가 근접",
  O_mtt_alpha16:        "O. MTT (alpha16) ★",
  P_deepbuy_chandelier: "P. 딥바이 샹들리에 ★",
  Q_kangto_trend:       "Q. 깡토 추세추종 (추세형)",
  R_kelly_chandelier:   "R. Kelly 샹들리에 (오버레이)",
  S_hrp:                "S-a. HRP (배분형)",
  S_msharpe:            "S-b. max-Sharpe (배분형)",
  S_mincvar:            "S-c. min-CVaR (배분형)",
};

const BENCHMARK_KO: Record<string, string> = {
  KOSPI: "KOSPI", SP500: "S&P500", NASDAQ: "NASDAQ", AllWeather: "올웨더",
};

// ─── Watching list: server-side first 8, rest hidden behind <details> ─────────
const WATCHING_PREVIEW = 8;

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
  const signals = backtest.signals as SignalsData | undefined;
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
  const multiStrategy = backtest.multi_strategy as unknown as MultiStrategyData;
  const universeStats = backtest.universe_stats as {
    kr_reports: number; us_reports: number; total_reports: number;
    kr_tickers: number; us_tickers: number;
  };

  const headlineTrades = (backtest.trades ?? []) as Trade[];
  const allTradesMap: Record<string, Trade[]> = {
    [params.headline_key]: headlineTrades,
  };

  const oosBoundaryYear = 2024;
  const equity = backtest.equity as { date: string; nav: number }[];
  const maxNav = Math.max(...equity.map((p) => p.nav));
  const minNav = Math.min(...equity.map((p) => p.nav));
  const W = 720; const H = 220;
  const x = (i: number) => 8 + (i / (equity.length - 1)) * (W - 16);
  const y = (nav: number) => 12 + ((maxNav - nav) / ((maxNav - minNav || 1))) * (H - 36);
  const path = equity.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.nav).toFixed(1)}`).join(" ");

  const simStartDisplay = (params as { sim_start?: string }).sim_start ?? "2020-01-01";

  return (
    <main className="mx-auto max-w-[1500px] space-y-8 px-4 py-6 sm:px-8">
      <SiteHeader eyebrow="Strategy Lab" />

      {/* ══════════════════════════════════════════════════════════════
          ① 오늘의 신호 — compact
      ══════════════════════════════════════════════════════════════ */}
      {signals && (
        <section className="rounded-lg border-2 border-stamp bg-stamp/5 p-5" aria-label="오늘의 신호">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-black tracking-tight text-stamp">오늘의 신호</h2>
            <p className="font-mono text-[11px] text-muted-foreground">
              기준일: {signals.as_of} · {STRATEGY_LABEL_KO[signals.headline_strategy] ?? signals.headline_strategy}
            </p>
          </div>

          {/* Count badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "보유 중",           count: signals.counts.open,                  tone: "bg-card border-border" },
              { label: "매도 임박 (스탑 3% 이내)", count: signals.counts.approaching_stop ?? signals.counts.expiring_soon_30d ?? 0, tone: (signals.counts.approaching_stop ?? signals.counts.expiring_soon_30d ?? 0) > 0 ? "bg-down/10 border-down/40" : "bg-card border-border" },
              { label: "신규 매수 신호 (30일)",  count: signals.counts.new_buy_signals,   tone: signals.counts.new_buy_signals > 0 ? "bg-up/10 border-up/40" : "bg-card border-border" },
              { label: "대기 신호 (슬롯 한도)", count: signals.counts.watching_single_club,   tone: "bg-card border-border" },
            ].map((item) => (
              <div key={item.label} className={cn("rounded-lg border px-3 py-1.5", item.tone)}>
                <p className="font-mono text-[10px] text-muted-foreground">{item.label}</p>
                <p className="tnum font-display text-xl font-black">{item.count}</p>
              </div>
            ))}
          </div>

          {/* Approaching stop — 매도 임박 (chandelier) */}
          {(signals.approaching_stop?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-down">
                매도 임박 — 트레일링 스탑 3% 이내
              </p>
              <div className="space-y-2">
                {signals.approaching_stop!.map((pos, i) => {
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
                        {pos.dist_to_stop_pct != null && (
                          <span className="rounded-sm bg-down/20 px-1.5 py-0.5 font-mono text-[10px] text-down font-bold">
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

          {/* New buy signals — reports within last 30 days */}
          {signals.new_buy_signals.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-up">
                신규 매수 신호 — 최근 30일 리포트
              </p>
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
                        <span className="rounded-sm bg-up/20 px-1.5 py-0.5 font-mono text-[10px] text-up font-bold">
                          {sig.n_schools}개교
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                        <span>진입 기준일: <strong className="text-foreground">{sig.entry_basis_date ?? "—"}</strong></span>
                        <span>진입 기준가: <strong className="text-foreground">{sig.entry_basis_price != null ? sig.entry_basis_price.toLocaleString() : "—"}</strong></span>
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

          {/* Open positions link — chandelier detail in selector */}
          {signals.counts.open > 0 && (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              보유 중 <strong className="text-foreground">{signals.counts.open}종목</strong>의 상세 보유 테이블 (진입가·현재가·스탑 레벨)은{" "}
              <a href="#strategy-selector" className="underline hover:text-foreground">전략 비교 → 보유 중 탭</a>에서 확인하세요.
            </p>
          )}

          {/* Watching list — capped with 더 보기 */}
          {signals.watching_single_club.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground select-none">
                대기 신호 — 유효하지만 미체결 ({signals.watching_single_club.length}종목, 동시 보유 한도) — 클릭해서 펼치기
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[580px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">종목</th>
                      <th className="px-3 py-1.5 text-left">커버 학회</th>
                      <th className="px-3 py-1.5 text-right">리포트일</th>
                      <th className="px-3 py-1.5 text-right">목표가</th>
                      <th className="px-3 py-1.5 text-right">시가 기준</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.watching_single_club.slice(0, WATCHING_PREVIEW).map((w, i) => {
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
                {signals.watching_single_club.length > WATCHING_PREVIEW && (
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                    … 외 {signals.watching_single_club.length - WATCHING_PREVIEW}종목 더 (전체 목록은 CSV 다운로드)
                  </p>
                )}
              </div>
            </details>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground italic">{signals.disclaimer}</p>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════
          ② 헤드라인 요약 + 자산곡선
      ══════════════════════════════════════════════════════════════ */}
      <header>
        <h1 className="mt-2 font-display text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl">
          전성기 수익을 어떻게 <span className="text-stamp">수확</span>할 것인가.
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          학회 리포트 발간 후 24개월 내 피크 수익률이 거의 전부 양(+)이라는 사실 —
          하지만 라운드트립을 타면 그 이익은 사라집니다.
          14가지 전략 + D+ Optuna를 인샘플({simStartDisplay.slice(0, 7)}–2023-12)로 비교하고 아웃오브샘플(2024–현재)로 검증.
          헤드라인은 IS 샤프 최상위 전략인{" "}
          <strong className="text-foreground">
            {STRATEGY_LABEL_KO[params.headline_key] ?? params.headline_key}
          </strong>입니다.
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground italic">
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
          { label: `누적 수익률 (헤드라인)`, value: formatPct(m.total_return_pct, 1), tone: signColor(m.total_return_pct) },
          { label: "CAGR (전체)", value: formatPct(m.cagr_pct, 1), tone: signColor(m.cagr_pct) },
          { label: "인샘플 샤프", value: String(inSample.sharpe ?? "—") },
          { label: "아웃오브샘플 샤프", value: String(outOfSample.sharpe ?? "—"), tone: "text-up" },
          { label: "MDD", value: formatPct(m.mdd_pct, 1), tone: "text-down" },
          { label: "승률 / 거래", value: `${m.win_rate_pct ?? "—"}% / ${m.trades}건` },
        ]}
      />

      {/* Headline equity chart */}
      <section className="rounded-lg border border-border bg-card p-5" aria-label="헤드라인 자산 곡선">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            헤드라인 자산 곡선 — {STRATEGY_LABEL_KO[params.headline_key] ?? params.headline_key}
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
        <div className="mt-3 flex flex-wrap gap-2 border-t border-dashed border-border pt-3">
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

      {/* ══════════════════════════════════════════════════════════════
          ③ 전략 비교 + 자산곡선·시뮬 (selector tabs) — collapsible
      ══════════════════════════════════════════════════════════════ */}
      <details open id="strategy-selector" className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer select-none list-none items-baseline justify-between gap-2 p-5 hover:bg-secondary/20 transition-colors [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-display text-2xl font-black tracking-tight">전략 비교 &amp; 상세</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              IS/OOS 성과표 · 전략별 자산곡선 · 월 적립 시뮬레이션 · 거래 로그
            </p>
          </div>
          <span className="font-mono text-sm text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-6">

          {/* IS/OOS comparison table */}
          <div>
            <h3 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              IS/OOS 비교표 — 모든 전략
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              모든 전략: 1회 이상 Buy 언급 시 즉시 진입 (J는 D 오버레이), 동일비중 {Math.round((params.position_weight ?? 0.05) * 100)}%, 편도 수수료 {(params.cost_per_side ?? 0.003) * 100}%. 동시 보유 20종목 한도로 신호 일부는 미체결.{" "}
              <span className="text-foreground font-medium">{params.anti_overfit_note}</span>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold">전략</th>
                    <th className="px-3 py-2 text-right font-semibold">IS CAGR</th>
                    <th className="px-3 py-2 text-right font-semibold">IS 샤프</th>
                    <th className="px-3 py-2 text-right font-semibold">IS MDD</th>
                    <th className="px-3 py-2 text-right font-semibold">OOS CAGR</th>
                    <th className="px-3 py-2 text-right font-semibold">OOS 샤프</th>
                    <th className="px-3 py-2 text-right font-semibold">vs KOSPI DCA</th>
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
                        <td className="px-3 py-2 font-mono text-xs">{STRATEGY_LABEL_KO[r.key] ?? r.key}</td>
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
                        <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", r.kospi_dca_ratio != null ? (r.kospi_dca_beats ? "text-up" : "text-down") : "text-muted-foreground")}>
                          {r.kospi_dca_ratio != null ? `${r.kospi_dca_ratio.toFixed(2)}x` : "—"}
                        </td>
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
            <p className="mt-2 text-xs text-muted-foreground">
              IS = In-Sample {simStartDisplay.slice(0, 7)} ~ 2023-12 · OOS = Out-of-Sample 2024-01 ~ 현재.
              헤드라인(★) = IS 샤프 최상위 자동 선정.
            </p>
          </div>

          {/* Strategy selector: per-strategy equity, wealth sim, trade log */}
          <StrategySelector
            multiStrategy={multiStrategy}
            wealthSimGlobal={ws}
            allTrades={allTradesMap}
          />
        </div>
      </details>


      {/* ══════════════════════════════════════════════════════════════
          ⑤ 방법론 / 전략 규칙 / 각주 — collapsible
      ══════════════════════════════════════════════════════════════ */}
      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer select-none list-none items-baseline justify-between gap-2 p-5 hover:bg-secondary/20 transition-colors [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-display text-2xl font-black tracking-tight">방법론 &amp; 각주</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">전략 규칙 · 한계 · 면책사항</p>
          </div>
          <span className="font-mono text-sm text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-5">

          {/* Strategy rules */}
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              {
                n: 1,
                title: "유니버스 — KR + US 전체 Buy 언급",
                body: `KR ${universeStats.kr_tickers}개 + US ${universeStats.us_tickers}개 종목. 리포트 풀 ${params.universe_start} 이후, 시뮬 기점 ${simStartDisplay}. 1회 이상 Buy 언급 즉시 진입 — 단독 커버·컨센서스 모두 포함. 동시 보유 20종목 한도로 신호 일부 미체결. US 종목은 달러 기준 가격 사용 (환율 미반영).`,
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
                body: `슬롯당 NAV의 ${Math.round((params.position_weight ?? 0.05) * 100)}%. 최대 ${params.max_positions ?? 20}종목 (K는 최대 10, D+ Optuna는 최대 10). 거래비용 편도 ${(params.cost_per_side ?? 0.003) * 100}%. J(레버리지): 차입비용 6%/년 일 단위 적립.`,
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
                body: "활성 유니버스(18개월 매수 리포트 윈도우) 종목을 매월 리밸런스. (a) S_hrp: HRP — 상관거리 단일연결 클러스터링, 준대각 재정렬, 역분산 재귀분할. (b) S_msharpe: max-Sharpe — LedoitWolf 공분산 축소(sklearn), 개별 비중 ≤15%. (c) S_mincvar: min-CVaR 95% — scipy linprog LP, 개별 비중 ≤15%. IS 샤프 최고 변형만 헤드라인 셀렉터에 포함. 턴오버 비용 적용.",
              },
              {
                n: 12,
                title: "범위 밖 전략 — 장중(intraday) 및 SPO",
                body: "장중(intraday) 데이터 기반 전략은 일봉 데이터만 사용하는 현 파이프라인 범위 밖으로 도입하지 않음. SPO(Secondary Public Offering) 이벤트 기반 전략은 향후 작업으로 보류.",
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
                  ? <span className="ml-2 font-mono text-[11px] font-normal text-up">채택됨 ✓</span>
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
              <p className="mt-3 text-xs text-muted-foreground italic">{optunaNote.methodology}</p>
            </section>
          )}

          {/* Honest footnotes */}
          <section
            className="rounded-lg border-2 border-foreground/70 bg-card p-5 shadow-[4px_4px_0_0_hsl(var(--foreground)/0.7)]"
            aria-label="전략의 한계"
          >
            <h3 className="font-display text-xl font-black tracking-tight">정직한 각주 — 이 전략이 무너지는 곳</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>· <strong className="text-foreground">과최적화 주의.</strong> D 기본값 파라미터는 문헌 표준값(ATR×5, 200MA) 고정. D+ Optuna는 IS 2-폴드 교차검증으로 강건화했으나 표본 크기(460종목) 제한으로 과최적화 위험이 남습니다.</li>
              <li>· <strong className="text-foreground">시뮬 기점 주의.</strong> 2020-01 이전 리포트 풀이 얇아 기점을 2020-01-01로 설정. 실질 트레이딩은 신호 발생 시점부터이므로 첫 거래는 이후.</li>
              <li>· <strong className="text-foreground">내러티브 홀드(C) 주의.</strong> 무한 홀드 전략은 MDD 허용 범위가 넓습니다. 포지션 청산 규칙이 느슨합니다.</li>
              <li>· <strong className="text-foreground">딥바이(G) 솔직한 평가.</strong> 20% 하락이 저점이 아니라 시작인 경우가 많습니다. IS/OOS 모두 벤치마크 하회 — 채택 불가.</li>
              <li>· <strong className="text-foreground">민리버전(L) / 단기 리버설(M) 솔직한 평가.</strong> L IS sharpe −3.1, OOS −2.53. M IS sharpe −1.4, OOS −2.18. 두 전략 모두 이 유니버스에서 작동하지 않습니다. Connors RSI-2는 미국 ETF·대형주 시장을 위해 설계된 전략으로 한국 소형·중형주 + 학회 리포트 필터 조합에서는 과도한 거래비용과 틱 노이즈로 음(−) 성과. 전략 참고용으로만 유지.</li>
              <li>· <strong className="text-foreground">52주 고가 근접(N).</strong> IS sharpe 0.20, OOS sharpe 1.20. OOS 성과는 양호하나 IS 샤프가 낮아 헤드라인 선정 기준 미달. 참고용 전략으로 유지.</li>
              <li>· <strong className="text-foreground">코어-새틀라이트 레버리지(J) 솔직한 평가.</strong> 차입비용(6%/년)과 폭락 타이밍 미스 리스크가 있습니다. D 보조 시뮬로만 참고하세요.</li>
              <li>· <strong className="text-foreground">R:R 2.5(K) 주의.</strong> 빠른 사이클이 거래비용을 높입니다.</li>
              <li>· <strong className="text-foreground">US 종목 주의.</strong> 수익은 달러 기준. KRW/USD 환율 변동 미반영.</li>
              <li>· <strong className="text-foreground">컨센서스 표본 제한.</strong> US 컨센서스 종목 소수. 통계적 유의성 낮음.</li>
              <li>· 롱온리 전략. 대세 하락장 손실 불가피. 헤드라인 MDD {formatPct(m.mdd_pct, 1)}.</li>
              <li>· <strong className="text-foreground">컨센서스 분석.</strong>{" "}
                헤드라인 거래 기준: 단독 커버 {consensus.single_club.count}건 (평균 {formatPct(consensus.single_club.avg_return_pct, 1)}, 승률 {consensus.single_club.win_rate_pct ?? "—"}%) vs
                멀티 커버 {consensus.multi_club.count}건 (평균 {formatPct(consensus.multi_club.avg_return_pct, 1)}, 승률 {consensus.multi_club.win_rate_pct ?? "—"}%).
                {consensus.alpha_multi_vs_single != null && ` 멀티 커버 알파: ${formatPct(consensus.alpha_multi_vs_single, 1)}p.`}
              </li>
              <li>· 생존 편향: 공개를 유지한 리포트만 수집. 상장폐지 종목 시세 일부 누락 가능.</li>
              <li>· 올웨더는 25% GLD/NASDAQ/S&P500/KOSPI 분기 리밸런싱으로 단순화. 채권 미포함.</li>
              <li>· 투자 권유가 아닙니다. 과거 데이터 기반 시뮬레이션으로 미래 수익을 보장하지 않습니다.</li>
            </ul>
          </section>
        </div>
      </details>
    </main>
  );
}
