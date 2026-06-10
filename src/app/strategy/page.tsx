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
  G_dip_buy:            "G. 딥바이",
  H_minervini:          "H. 미너비니 템플릿",
  I_supertrend:         "I. 슈퍼트렌드",
  J_core_satellite:     "J. 코어-새틀라이트",
  K_rr_trend:           "K. R:R 2.5 추세추종",
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
    sim_start: string;
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
              { label: "30일 내 만기",       count: signals.counts.expiring_soon_30d,     tone: signals.counts.expiring_soon_30d > 0 ? "bg-down/10 border-down/40" : "bg-card border-border" },
              { label: "신규 매수 신호",     count: signals.counts.new_buy_signals,        tone: signals.counts.new_buy_signals > 0 ? "bg-up/10 border-up/40" : "bg-card border-border" },
              { label: "매수 대기 (1개교)", count: signals.counts.watching_single_club,   tone: "bg-card border-border" },
            ].map((item) => (
              <div key={item.label} className={cn("rounded-lg border px-3 py-1.5", item.tone)}>
                <p className="font-mono text-[10px] text-muted-foreground">{item.label}</p>
                <p className="tnum font-display text-xl font-black">{item.count}</p>
              </div>
            ))}
          </div>

          {/* New buy signals */}
          {signals.new_buy_signals.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-up">
                신규 매수 신호 — 컨센서스 형성
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
                          {sig.n_schools}개교 컨센서스
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

          {/* Open positions (compact table) */}
          {signals.open_positions.length > 0 && (
            <details className="mt-4" open>
              <summary className="cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground select-none">
                보유 중 ({signals.open_positions.length}종목) — 클릭해서 접기/펼치기
              </summary>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      <th className="px-3 py-1.5 text-left">종목</th>
                      <th className="px-3 py-1.5 text-right">진입일</th>
                      <th className="px-3 py-1.5 text-right">진입가</th>
                      <th className="px-3 py-1.5 text-right">현재가</th>
                      <th className="px-3 py-1.5 text-right">미실현</th>
                      <th className="px-3 py-1.5 text-right">경과일</th>
                      <th className="px-3 py-1.5 text-right">매도 예정</th>
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
            </details>
          )}

          {/* Watching list — capped with 더 보기 */}
          {signals.watching_single_club.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground select-none">
                매수 대기 — 1개교 단독 커버 ({signals.watching_single_club.length}종목) — 클릭해서 펼치기
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
          11가지 전략을 인샘플({simStartDisplay.slice(0, 7)}–2023-12)로 비교하고 아웃오브샘플(2024–현재)로 검증.
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
          종목 (≥2개 학회 Buy 컨센서스, G전략은 단독 OK) · 시뮬 기점 {simStartDisplay}
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
      <details open className="group rounded-lg border border-border bg-card">
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
              모든 전략: ≥2개 학회 컨센서스 즉시 진입 (G는 단독 OK, J는 D 오버레이), 동일비중 {Math.round((params.position_weight ?? 0.05) * 100)}%, 편도 수수료 {(params.cost_per_side ?? 0.003) * 100}%.{" "}
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
          ④ 분석 심화 — tail stats, consensus, open positions
             (collapsible secondary depth)
      ══════════════════════════════════════════════════════════════ */}
      <details className="group rounded-lg border border-border bg-card">
        <summary className="flex cursor-pointer select-none list-none items-baseline justify-between gap-2 p-5 hover:bg-secondary/20 transition-colors [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-display text-2xl font-black tracking-tight">분석 심화</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              테일 캡처 · 멀티클럽 컨센서스 · 현재 보유 포지션 · 신고가 돌파 레거시 민감도
            </p>
          </div>
          <span className="font-mono text-sm text-muted-foreground group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-6">

          {/* Tail stats */}
          <section aria-label="테일 캡처 통계">
            <h3 className="mb-3 font-display text-xl font-black tracking-tight">수익은 꼬리에서 — 테일 캡처 (헤드라인)</h3>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "총 거래 수", value: String(tail.total_trades) },
                { label: "상위 10% 거래", value: String(tail.top_decile_n) },
                { label: "상위 10% P&L", value: `${tail.top_decile_pnl_share_pct}%`, tone: "text-up" },
                { label: "상위 10% 평균 수익", value: formatPct(tail.top_decile_avg_return_pct, 0), tone: "text-up" },
                { label: "2배 이상 거래", value: `${tail.doubler_count}건` },
                { label: "상위 10% 평균 보유", value: tail.top_decile_avg_hold_days ? `${tail.top_decile_avg_hold_days}일` : "—" },
              ].map((item) => (
                <div key={item.label} className="bg-card px-4 py-3">
                  <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</dt>
                  <dd className={cn("tnum mt-1.5 font-display text-2xl font-black tracking-tight", item.tone ?? "")}>{item.value}</dd>
                </div>
              ))}
            </dl>
            {tail.top10_trades.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">상위 10개 거래</p>
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      <th className="px-3 py-1.5 text-left font-semibold">종목</th>
                      <th className="px-3 py-1.5 text-right font-semibold">수익률</th>
                      <th className="px-3 py-1.5 text-right font-semibold">보유일</th>
                      <th className="px-3 py-1.5 text-right font-semibold">커버</th>
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

          {/* Consensus stats */}
          <section aria-label="컨센서스 분석">
            <h3 className="mb-2 font-display text-xl font-black tracking-tight">
              멀티클럽 컨센서스 — ≥2개 학회가 동시에 Buy를 내면?
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">{consensus.note}</p>
            <div className="grid gap-4 sm:grid-cols-2">
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
                멀티 커버 평균 수익률이 단독 커버 대비{" "}
                <span className={cn("font-bold", signColor(consensus.alpha_multi_vs_single))}>
                  {formatPct(consensus.alpha_multi_vs_single, 1)}p
                </span>{" "}
                {consensus.alpha_multi_vs_single > 0 ? "높습니다." : "낮습니다."}
              </p>
            )}
          </section>

          {/* Open positions from headline */}
          {backtest.open_positions.length > 0 && (
            <section aria-label="현재 보유 포지션">
              <h3 className="mb-2 font-display text-xl font-black tracking-tight">
                헤드라인 전략 현재 보유 ({backtest.open_positions.length}종목)
              </h3>
              <p className="mb-3 text-sm text-muted-foreground">백테스트 마지막 날 기준 미청산 포지션.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
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

          {/* Legacy breakout sensitivity */}
          <section aria-label="신고가 돌파 전략 민감도">
            <h3 className="mb-2 font-display text-xl font-black tracking-tight">
              참고: 신고가 돌파 전략 파라미터 민감도 (KR 전용, v3 레거시)
            </h3>
            <p className="mb-3 text-sm text-muted-foreground">
              구 v3 헤드라인의 신고가 돌파 + ATR 래칫 그리드. 인샘플 샤프가 일관되게 낮습니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] border-collapse text-sm">
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
                title: "유니버스 — KR + US 컨센서스",
                body: `KR ${universeStats.kr_tickers}개 + US ${universeStats.us_tickers}개 종목. 리포트 풀 ${params.universe_start} 이후, 시뮬 기점 ${simStartDisplay}. ≥2개 학회 동시 Buy (G딥바이는 단독 OK — 딥 자체가 필터). US 종목은 달러 기준 가격 사용 (환율 미반영).`,
              },
              {
                n: 2,
                title: "진입 — 전략별 트리거 조건",
                body: "A/B/C/D/E: 발간 다음 거래일 시가 즉시 진입. F: 200MA 위 확인 후 진입. G: 발간일 종가 -20% 도달 시 진입. H: 미너비니 5-point 템플릿 통과 시. I: Supertrend(10,3) 상향전환 시. J: D NAV 오버레이. K: 컨센서스 발생 즉시.",
              },
              {
                n: 3,
                title: `청산 — 전략별 규칙`,
                body: `D 헤드라인: ATR(42)×5 트레일링 (Le Beau). G: 목표가/+50%/12mo/ATR×3 선착. H: 주간 close<50MA. I: Supertrend 하향전환. J: 80/20 자동 디레버. K: half at +2.5R + ATR×3 트레일.`,
              },
              {
                n: 4,
                title: `포지션 — 동일비중 ${Math.round((params.position_weight ?? 0.05) * 100)}%`,
                body: `슬롯당 NAV의 ${Math.round((params.position_weight ?? 0.05) * 100)}%. 최대 ${params.max_positions ?? 20}종목 (K는 최대 10). 거래비용 편도 ${(params.cost_per_side ?? 0.003) * 100}%. J(레버리지): 차입비용 6%/년 일 단위 적립.`,
              },
              {
                n: 5,
                title: "G 딥바이 — 파라미터 출처",
                body: "딥 임계값 20%: Jegadeesh & Kim (2006) 애널리스트 반응 후 가격 조정 연구. 창 6개월, ATR×3 스탑, +50% 익절, 12개월 최대 보유. 단독 커버 허용 — 딥 진입 자체가 질적 필터 역할.",
              },
              {
                n: 6,
                title: "H 미너비니 — 파라미터 출처",
                body: "Minervini (2013) 'Trade Like a Stock Market Wizard'. 5-point template: close>50MA>150MA>200MA, 200MA 상승(vs 1달 전), 52w 고점 70% 이상, 6개월 RS vs KOSPI 양(+). 청산: 주간 close<50MA.",
              },
              {
                n: 7,
                title: "I 슈퍼트렌드 — 파라미터 출처",
                body: "Supertrend 표준 파라미터 (10, 3): ATR 기간 10일, 밴드 배수 3.0. Olivier Seban 대중화. 발간 시 불리시이거나 3개월 내 첫 상향 전환 시 진입. 하향 전환 다음 거래일 청산.",
              },
              {
                n: 8,
                title: "K R:R 2.5 — 파라미터 출처",
                body: "Van Tharp 'Trade Your Way to Financial Freedom' R-배수 프레임워크. 1R = ATR(20)×1. 반절 +2.5R 익절 (고성과 트레이더 통계적 최적 구간). 나머지 Chandelier ATR×3 트레일. 최대 10종목 집중도 관리.",
              },
            ].map((rule) => (
              <article key={rule.n} className="rounded-lg border border-border bg-secondary/20 p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-stamp">규칙 {rule.n}</p>
                <h4 className="mt-1 font-display text-base font-black tracking-tight">{rule.title}</h4>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{rule.body}</p>
              </article>
            ))}
          </div>

          {/* Honest footnotes */}
          <section
            className="rounded-lg border-2 border-foreground/70 bg-card p-5 shadow-[4px_4px_0_0_hsl(var(--foreground)/0.7)]"
            aria-label="전략의 한계"
          >
            <h3 className="font-display text-xl font-black tracking-tight">정직한 각주 — 이 전략이 무너지는 곳</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
              <li>· <strong className="text-foreground">과최적화 주의.</strong> 헤드라인(D) 파라미터는 ATR×5, 200MA — 문헌 표준값 고정. 그리드 서치 없음.</li>
              <li>· <strong className="text-foreground">시뮬 기점 주의.</strong> 2020-01 이전 리포트 풀이 얇아 기점을 2020-01-01로 설정. 실질 트레이딩은 신호 발생 시점부터이므로 첫 거래는 이후.</li>
              <li>· <strong className="text-foreground">내러티브 홀드(C) 주의.</strong> 무한 홀드 전략은 MDD 허용 범위가 넓습니다. 포지션 청산 규칙이 느슨합니다.</li>
              <li>· <strong className="text-foreground">딥바이(G) 솔직한 평가.</strong> IS CAGR −2.2%, OOS CAGR −31.5%. 20% 하락이 저점이 아니라 시작인 경우가 많습니다. 단독 커버 허용이 과도한 노출을 만들었습니다. IS/OOS 모두 벤치마크 하회 — 채택 불가.</li>
              <li>· <strong className="text-foreground">미너비니(H) / 슈퍼트렌드(I).</strong> IS Sharpe가 D보다 낮고 진입 필터가 신호를 크게 줄입니다. 추세 필터 전략은 급등 초입을 놓치는 비용이 존재합니다.</li>
              <li>· <strong className="text-foreground">코어-새틀라이트 레버리지(J) 솔직한 평가.</strong> IS Sharpe 0.83, OOS Sharpe 1.04로 D(0.97/0.98)와 경쟁적이지만, 차입비용(6%/년)과 폭락 타이밍 미스 리스크가 있습니다. 레버리지 전개 구간에서 추가 낙폭이 발생하면 NAV가 D보다 더 많이 빠집니다. 단독 사용 권장 불가, D의 보조 시뮬로만 참고하세요.</li>
              <li>· <strong className="text-foreground">R:R 2.5(K) 주의.</strong> IS/OOS Sharpe 0.52/0.50으로 안정적이나 D보다 낮습니다. 빠른 사이클이 거래비용을 높입니다.</li>
              <li>· <strong className="text-foreground">US 종목 주의.</strong> 수익은 달러 기준. KRW/USD 환율 변동 미반영.</li>
              <li>· <strong className="text-foreground">컨센서스 표본 제한.</strong> US 컨센서스 종목 4개. 통계적 유의성 낮음.</li>
              <li>· 롱온리 전략. 대세 하락장 손실 불가피. 헤드라인 MDD {formatPct(m.mdd_pct, 1)}.</li>
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
