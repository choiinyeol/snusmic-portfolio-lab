"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { WealthChart } from "@/components/strategy/wealth-chart";
import { useSortable, SortableTh, type SortColumn } from "@/components/sortable";
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

type OpenPosition = {
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
  extension?: number | null;  // ATR% multiple from 50-MA (과열 게이지)
};

type MultiStrategyData = {
  strategies: StrategyRow[];
  headline_key: string;
  strategy_wealth_sims: Record<string, StrategyWealthSim>;
  equity_by_strategy: Record<string, EquityPoint[]>;
  yearly_by_strategy: Record<string, YearlyReturn[]>;
  open_positions_by_strategy?: Record<string, OpenPosition[]>;
  trades_by_strategy?: Record<string, Trade[]>;
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
  A_12mo:                 "A. 12개월 보유",
  B_36mo:                 "B. 36개월 보유",
  C_narrative:            "C. 내러티브 홀드",
  D_chandelier:           "D. 샹들리에 래칫",
  "D+_chandelier_optuna": "D+. 샹들리에 (Optuna) ★",
  E_half_runner:          "E. 절반익절+러너",
  F_momentum_narrative:   "F. 모멘텀 필터",
  G_dip_buy:              "G. 딥바이",
  H_minervini:            "H. 미너비니 템플릿",
  I_supertrend:           "I. 슈퍼트렌드",
  J_core_satellite:       "J. 코어-새틀라이트",
  K_rr_trend:             "K. R:R 2.5",
  L_rsi2_reversion:       "L. 민리버전 (RSI-2) ⚠",
  M_short_reversal:       "M. 단기 리버설 ⚠",
  N_52w_high:             "N. 52주 고가 근접",
  O_mtt_alpha16:          "O. MTT (alpha16) ★",
  P_deepbuy_chandelier:   "P. 딥바이 샹들리에 ★",
  Q_kangto_trend:         "Q. 깡토 추세추종",
  R_kelly_chandelier:     "R. Kelly 샹들리에",
  S_hrp:                  "S-a. HRP (배분형)",
  S_msharpe:              "S-b. max-Sharpe (배분형)",
  S_mincvar:              "S-c. min-CVaR (배분형)",
  T_kospi_core_chandelier:"T. 코어-KOSPI 샹들리에",
  "T-_kospi_core_regime": "T-. 코어-KOSPI 레짐 ★",
  U_chandelier_scaleout:  "U. 과열 스케일아웃 ★",
};

const STRATEGY_DESC_KO: Record<string, string> = {
  A_12mo:                 "진입 후 12개월 고정 보유. 단순·강건한 기준선.",
  B_36mo:                 "진입 후 36개월 보유. 장기 복리 극대화.",
  C_narrative:            "내러티브가 살아있으면 무한 보유. 월말 체크: close < 200MA AND < 진입가 → 청산 (Faber 2007).",
  D_chandelier:           "ATR(42)×5 트레일링 스탑. 신고점에서 래칫 상승. 멀티배거를 살려두되 큰 낙폭은 차단. 문헌 표준값 고정.",
  "D+_chandelier_optuna": "Optuna IS 2-폴드 강건 최적화. ATR 기간·배수·최대포지션 탐색. OOS 채택 기준 통과 시 헤드라인.",
  E_half_runner:          "목표가 도달 시 절반 익절 + 나머지 C 규칙으로 트레일.",
  F_momentum_narrative:   "200MA 위에서만 진입 + C 청산 규칙.",
  G_dip_buy:              "발간일 종가 대비 ≥20% 하락 후 매수 (6개월 내). 목표가/+50%/12mo/ATR×3 스탑 중 선착 청산.",
  H_minervini:            "트렌드 템플릿: close>50MA>150MA>200MA, 52w고점 70% 이상, RS양(+). 주간 close<50MA 청산. (Minervini 2013)",
  I_supertrend:           "Supertrend(10, 3) 불리시 시 진입. 베어리시 전환 시 청산.",
  J_core_satellite:       "D 오버레이. 80% 코어·20% 현금. KOSPI -15% 시 120% 레버리지. 차입비용 6%/년.",
  K_rr_trend:             "Stop=1×ATR(20). 반절 +2.5R 익절, 나머지 Chandelier ATR×3. 최대 10종목.",
  L_rsi2_reversion:       "⚠ 셀렉터 제외. RSI(2) < 10 AND close > 200MA 진입. RSI(2) > 70 OR 10거래일 청산. Connors & Alvarez (2009). 판정: 0.3%/side 비용 × 단기 회전율로 비용 사망 — 구현 검증 후 제외.",
  M_short_reversal:       "⚠ 셀렉터 제외. 월초: 직전 1개월 수익률 하위 20% 매수, 1개월 보유. 단기 리버설 팩터. 판정: 월별 전체 교체 비용(0.6% × 12회/년)으로 비용 사망 — 구현 검증 후 제외.",
  N_52w_high:             "리포트 당일 close ≥ 52w high × 85% 진입. 월말 close < 52w high × 70% 청산. George & Hwang (2004).",
  O_mtt_alpha16:          "v11 룩어헤드 수정. alpha16 MTT 이식. RS 퍼센타일(3m×0.5/6m×0.3/12m×0.2) + Minervini 5-조건 필터. 진입 RS≥79, -8%/BE/6%트레일/+3.5R/RS<82/115일 청산. 시그널 종가→익일 시가 체결. [alpha16 KRX 파라미터, OUR 데이터 미튜닝]",
  P_deepbuy_chandelier:   "딥바이 진입(≥20% 하락, 6개월 내) + 추가 10% 하락 시 스케일인(1회) + ATR 트레일링 스탑 청산(타겟 캡 없음). 딥바이 좋은 진입을 샹들리에로 멀티배거 포착.",
  Q_kangto_trend:         "시장신호등(KOSPI 200MA+50MA상승→2유닛). 진입: RS퍼센타일≥KOSPI RS AND 60d고가돌파 AND 거래량≥20d평균×1.5. 스탑 -8%(1R), BE +1R, 트레일 고점-8% +1.5R, 절반익절 +3R.",
  R_kelly_chandelier:     "D+ 샹들리에 규칙 + Kelly 포지션 사이징. Rolling 40거래 win/payoff 기준 fractional Kelly (cap 25%, safety 0.5, floor 1%).",
  S_hrp:                  "HRP 배분형. 상관거리 단일연결 클러스터링 → 준대각 재정렬 → 역분산 재귀분할. 월간 리밸런스.",
  S_msharpe:              "max-Sharpe 배분형. LedoitWolf 공분산 수축, 개별 비중 ≤15%. 월간 리밸런스.",
  S_mincvar:              "min-CVaR 95% 배분형. scipy linprog LP, 개별 비중 ≤15%. 월간 리밸런스.",
  T_kospi_core_chandelier:"D+ 샹들리에 규칙 + 유휴 현금을 KOSPI 익스포저(KODEX200)로 주차. 베이스라인 = KOSPI DCA.",
  "T-_kospi_core_regime": "T와 동일 + KOSPI < 200MA 구간에서는 파킹 수익률 0%(현금 보유). Faber (2007) 레짐 필터.",
  U_chandelier_scaleout:  "T-와 동일 + 과열 스케일아웃. extension(=ATR14% Multiple from 50SMA) > 8× → 절반 익절, > 12× → 나머지 절반 익절. Minervini circle / Fred6724.",
};

// Strategy grouping for tab sections
const STRATEGY_GROUPS: { label: string; keys: string[] }[] = [
  { label: "보유형",    keys: ["A_12mo", "B_36mo", "C_narrative", "E_half_runner"] },
  { label: "추세형",    keys: ["D_chandelier", "D+_chandelier_optuna", "F_momentum_narrative", "H_minervini", "I_supertrend", "K_rr_trend", "N_52w_high", "O_mtt_alpha16", "Q_kangto_trend"] },
  { label: "딥바이형",  keys: ["G_dip_buy", "P_deepbuy_chandelier"] },
  { label: "회귀형 ⚠", keys: ["L_rsi2_reversion", "M_short_reversal"] },
  { label: "오버레이",  keys: ["J_core_satellite", "R_kelly_chandelier"] },
  { label: "KOSPI파킹", keys: ["T_kospi_core_chandelier", "T-_kospi_core_regime", "U_chandelier_scaleout"] },
  { label: "배분형",    keys: ["S_hrp", "S_msharpe", "S_mincvar"] },
];

const BENCHMARK_KO: Record<string, string> = {
  KOSPI: "KOSPI", SP500: "S&P500", NASDAQ: "NASDAQ", AllWeather: "올웨더",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tickerSlugFromTrade(trade: Trade): string | null {
  if (!trade.ticker) return null;
  const market = trade.market ?? "KR";
  return `${market}-${trade.ticker}`.toLowerCase();
}

function fmt만(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
}

// ─── Mini equity curve ────────────────────────────────────────────────────────

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

// ─── Trade columns definition ─────────────────────────────────────────────────

const TRADE_COLS: SortColumn<Trade>[] = [
  { key: "display_name", value: (t) => t.display_name ?? t.ticker },
  { key: "entry_date",   value: (t) => t.entry_date,   groupValue: (t) => t.entry_date?.slice(0, 7) ?? null },
  { key: "entry",        value: (t) => t.entry,        firstDir: "desc" },
  { key: "exit_date",    value: (t) => t.exit_date,    groupValue: (t) => t.exit_date?.slice(0, 7) ?? null },
  { key: "exit",         value: (t) => t.exit,         firstDir: "desc" },
  { key: "return_pct",   value: (t) => t.return_pct,   firstDir: "desc", groupValue: (t) => Math.floor(t.return_pct / 25) },
  { key: "days",         value: (t) => t.days,         firstDir: "desc", groupValue: (t) => Math.floor(t.days / 30) },
  { key: "exit_reason",  value: (t) => t.exit_reason ?? "" },
];

const PAGE_SIZE = 20;

// ─── Open positions table ─────────────────────────────────────────────────────

function OpenPositionsTable({ positions, stratKey }: { positions: OpenPosition[]; stratKey: string }) {
  if (!positions.length) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 font-display text-xl font-black tracking-tight">
        보유 중 — {STRATEGY_LABEL_KO[stratKey] ?? stratKey} ({positions.length}종목)
      </h3>
      <p className="mb-2 text-xs text-muted-foreground">
        백테스트 마지막 날 기준 미청산 포지션. 동시 보유 20종목 한도로 신호 일부는 미체결.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <th className="px-3 py-2 text-left">종목</th>
              <th className="px-3 py-2 text-right">진입일</th>
              <th className="px-3 py-2 text-right">진입가</th>
              <th className="px-3 py-2 text-right">현재가</th>
              <th className="px-3 py-2 text-right">평가손익</th>
              <th className="px-3 py-2 text-right">스탑</th>
              <th className="px-3 py-2 text-right" title="ATR% Multiple from 50-MA — 8× 이상이면 과열 구간 (Minervini circle)">과열계수</th>
              <th className="px-3 py-2 text-right">커버</th>
            </tr>
          </thead>
          <tbody>
            {[...positions].sort((a, b) => b.return_pct - a.return_pct).map((pos) => {
              const market = pos.market ?? "KR";
              const slug = pos.ticker ? `${market}-${pos.ticker}`.toLowerCase() : null;
              const ext = pos.extension;
              const extColor = ext == null ? "" : ext >= 12 ? "text-down font-bold" : ext >= 8 ? "text-amber-500 font-bold" : ext >= 4 ? "text-foreground" : "text-muted-foreground";
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
                    <p className="font-mono text-[10px] text-muted-foreground">{pos.ticker}{market !== "KR" ? ` · ${market}` : ""}</p>
                  </td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{pos.entry_date}</td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.entry.toLocaleString()}</td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.last_close.toLocaleString()}</td>
                  <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(pos.return_pct))}>
                    {formatPct(pos.return_pct, 1)}
                  </td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {pos.stop && pos.stop > 0 ? pos.stop.toLocaleString() : "—"}
                  </td>
                  <td className={cn("tnum px-3 py-2 text-right font-mono text-xs", extColor)}>
                    {ext != null ? `${ext.toFixed(1)}×` : "—"}
                  </td>
                  <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {pos.n_clubs ?? 1}개교
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        과열계수 = ATR% Multiple from 50-MA (B/A, A=ATR14/가격, B=(가격−50SMA)/50SMA). 8× 이상 황색, 12× 이상 적색 경보 — Minervini 커뮤니티 관행.
      </p>
    </section>
  );
}

// ─── Ticker history panel ─────────────────────────────────────────────────────

type Candle = { time: string; open: number; high: number; low: number; close: number };

/** Fetch /prices/{slug}.json and return sorted candles (module-level cache) */
const _candleCache = new Map<string, Promise<Candle[] | null>>();
function fetchCandles(slug: string): Promise<Candle[] | null> {
  const hit = _candleCache.get(slug);
  if (hit) return hit;
  const p = fetch(`/prices/${slug}.json`)
    .then(async (r) => {
      if (!r.ok) return null;
      const j = await r.json() as { candles?: Candle[] };
      const valid = (j.candles ?? []).filter(
        (c) => typeof c?.time === "string" && typeof c.close === "number" && isFinite(c.close),
      );
      valid.sort((a, b) => a.time.localeCompare(b.time));
      return valid.length >= 2 ? valid : null;
    })
    .catch(() => null);
  _candleCache.set(slug, p);
  return p;
}

function TickerHistoryPanel({
  ticker,
  market,
  displayName,
  trades,
  onClose,
}: {
  ticker: string;
  market: string;
  displayName: string;
  trades: Trade[];
  onClose: () => void;
}) {
  const slug = `${market}-${ticker}`.toLowerCase();
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    fetchCandles(slug).then(setCandles);
  }, [slug]);

  // Sort trades oldest first for timeline display
  const sortedTrades = [...trades].sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  // Mini price chart with trade markers
  const W = 600; const H = 120;
  const chartEl = (() => {
    if (!candles || !candles.length) return null;
    // Clip candles to range covering all trades
    const firstEntry = sortedTrades[0]?.entry_date;
    const lastExit = sortedTrades[sortedTrades.length - 1]?.exit_date;
    if (!firstEntry || !lastExit) return null;
    // Show 60 days before first entry to 30 days after last exit
    const startClip = new Date(firstEntry);
    startClip.setDate(startClip.getDate() - 60);
    const endClip = new Date(lastExit);
    endClip.setDate(endClip.getDate() + 30);
    const startStr = startClip.toISOString().slice(0, 10);
    const endStr = endClip.toISOString().slice(0, 10);
    const visible = candles.filter((c) => c.time >= startStr && c.time <= endStr);
    if (visible.length < 2) return null;

    const prices = visible.map((c) => c.close);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const px = (i: number) => (i / (visible.length - 1)) * W;
    const py = (p: number) => H - 4 - ((p - minP) / ((maxP - minP) || 1)) * (H - 12);
    const linePath = visible.map((c, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(c.close).toFixed(1)}`).join(" ");

    // Marker helpers: find index of candle closest to a date string
    const nearestIdx = (dateStr: string) => {
      let best = 0;
      let bestDiff = Infinity;
      visible.forEach((c, i) => {
        const diff = Math.abs(new Date(c.time).getTime() - new Date(dateStr).getTime());
        if (diff < bestDiff) { bestDiff = diff; best = i; }
      });
      return best;
    };

    return (
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label={`${displayName} 가격 차트`}>
        <path d={linePath} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground" strokeLinejoin="round" />
        {sortedTrades.map((t, ti) => {
          const ei = nearestIdx(t.entry_date);
          const xi = nearestIdx(t.exit_date);
          const ex_ = px(ei); const ey_ = py(visible[ei]?.close ?? minP);
          const xx = px(xi);  const xy  = py(visible[xi]?.close ?? minP);
          return (
            <g key={ti}>
              {/* Entry: red triangle up (▲ KR convention: buy=red) */}
              <polygon
                points={`${ex_},${ey_ - 8} ${ex_ - 5},${ey_} ${ex_ + 5},${ey_}`}
                className="fill-[hsl(var(--up))]"
                opacity="0.9"
              />
              {/* Exit: blue triangle down (▼ KR convention: sell=blue) */}
              <polygon
                points={`${xx},${xy + 8} ${xx - 5},${xy} ${xx + 5},${xy}`}
                className="fill-[hsl(var(--down))]"
                opacity="0.9"
              />
            </g>
          );
        })}
      </svg>
    );
  })();

  const avgReturn = sortedTrades.reduce((s, t) => s + t.return_pct, 0) / (sortedTrades.length || 1);

  return (
    <div className="rounded-lg border-2 border-stamp bg-card p-5 shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-stamp">
            종목별 매매 이력
          </p>
          <h4 className="mt-0.5 font-display text-xl font-black tracking-tight">
            {displayName}
            <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">{ticker}</span>
          </h4>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            총 {sortedTrades.length}회 거래 · 평균 수익률{" "}
            <span className={cn("font-bold", signColor(avgReturn))}>
              {formatPct(avgReturn, 1)}
            </span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground hover:border-stamp/40 hover:text-foreground transition-colors"
          aria-label="닫기"
        >
          ✕ 닫기
        </button>
      </div>

      {/* Price chart with trade markers */}
      <div className="mt-4">
        {candles === null ? (
          <p className="font-mono text-xs text-muted-foreground">차트 로딩 중…</p>
        ) : chartEl ? (
          <>
            <p className="mb-1 font-mono text-[9px] text-muted-foreground">
              ▲ 매수(빨강)  ▼ 매도(파랑) — 진입 전후 60일 구간
            </p>
            {chartEl}
          </>
        ) : (
          <p className="font-mono text-xs text-muted-foreground">가격 데이터 없음</p>
        )}
      </div>

      {/* Trade timeline list */}
      <div className="mt-4 space-y-2">
        {sortedTrades.map((t, i) => (
          <div
            key={`${t.entry_date}-${i}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-dashed border-border px-3 py-2"
          >
            <span className="font-mono text-[10px] text-muted-foreground w-5 shrink-0">#{i + 1}</span>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="font-mono text-[9px] px-1 rounded bg-[hsl(var(--up)/0.15)] text-[hsl(var(--up))] font-bold">매수</span>
              <span className="text-muted-foreground">{t.entry_date}</span>
              <span className="font-bold">{typeof t.entry === "number" ? t.entry.toLocaleString() : t.entry}원</span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="font-mono text-[9px] px-1 rounded bg-[hsl(var(--down)/0.15)] text-[hsl(var(--down))] font-bold">매도</span>
              <span className="text-muted-foreground">{t.exit_date}</span>
              <span className="font-bold">{typeof t.exit === "number" ? t.exit.toLocaleString() : t.exit}원</span>
            </div>
            <span className={cn("tnum font-mono text-xs font-bold ml-auto", signColor(t.return_pct))}>
              {formatPct(t.return_pct, 1)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{t.days}일</span>
            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">{t.exit_reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Trade log with sort + pagination ────────────────────────────────────────

function TradeLog({ trades, stratKey }: { trades: Trade[]; stratKey: string }) {
  const [page, setPage] = useState(0);
  // openHistoryTicker: the ticker whose history panel is currently open (cap 1)
  const [openHistoryTicker, setOpenHistoryTicker] = useState<string | null>(null);
  const { sorted, specs, toggle } = useSortable(trades, TRADE_COLS, [{ key: "exit_date", dir: "desc" }]);
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const sort = { specs, toggle };

  // Reset page and history panel when strategy changes
  const [lastKey, setLastKey] = useState(stratKey);
  if (lastKey !== stratKey) { setLastKey(stratKey); setPage(0); setOpenHistoryTicker(null); }

  if (!trades.length) return null;

  // Group all trades by ticker for the history panel
  const tradesByTicker: Record<string, Trade[]> = {};
  for (const t of trades) {
    if (!tradesByTicker[t.ticker]) tradesByTicker[t.ticker] = [];
    tradesByTicker[t.ticker].push(t);
  }

  // Find the open-panel ticker's info
  const openTicker = openHistoryTicker;
  const openTrades = openTicker ? (tradesByTicker[openTicker] ?? []) : [];
  const openDisplayName = openTrades[0]?.display_name ?? openTicker ?? "";
  const openMarket = openTrades[0]?.market ?? "KR";

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="font-display text-xl font-black tracking-tight">
          거래 로그 — {STRATEGY_LABEL_KO[stratKey] ?? stratKey} ({trades.length}건)
        </h3>
        <p className="font-mono text-[10px] text-muted-foreground">
          Shift+클릭: 다중 정렬 · ▸ 이력: 종목별 매매 이력 패널
        </p>
      </div>

      {/* Ticker history panel (capped to 1 open at a time) */}
      {openTicker && openTrades.length > 0 && (
        <div className="mt-4">
          <TickerHistoryPanel
            ticker={openTicker}
            market={openMarket}
            displayName={openDisplayName}
            trades={openTrades}
            onClose={() => setOpenHistoryTicker(null)}
          />
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <SortableTh sortKey="display_name" sort={sort} className="px-3 py-2 text-left">종목</SortableTh>
              <SortableTh sortKey="entry_date"   sort={sort} align="right" className="px-3 py-2">매수일</SortableTh>
              <SortableTh sortKey="entry"        sort={sort} align="right" className="px-3 py-2">매수가</SortableTh>
              <SortableTh sortKey="exit_date"    sort={sort} align="right" className="px-3 py-2">매도일</SortableTh>
              <SortableTh sortKey="exit"         sort={sort} align="right" className="px-3 py-2">매도가</SortableTh>
              <SortableTh sortKey="return_pct"   sort={sort} align="right" className="px-3 py-2">수익률</SortableTh>
              <SortableTh sortKey="days"         sort={sort} align="right" className="px-3 py-2">보유일</SortableTh>
              <SortableTh sortKey="exit_reason"  sort={sort} className="px-3 py-2">매도사유</SortableTh>
              <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">이력</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t, i) => {
              const slug = tickerSlugFromTrade(t);
              const isOpen = openHistoryTicker === t.ticker;
              const tickerTradeCount = tradesByTicker[t.ticker]?.length ?? 1;
              return (
                <tr key={`${t.ticker}-${t.entry_date}-${i}`} className={cn(
                  "border-b border-dashed border-border last:border-b-0",
                  isOpen && "bg-stamp/5"
                )}>
                  <td className="px-3 py-2">
                    {slug ? (
                      <Link href={`/stocks/${slug}`} className="hover:underline">
                        <p className="font-mono text-xs font-bold">{t.display_name ?? t.ticker}</p>
                      </Link>
                    ) : (
                      <p className="font-mono text-xs font-bold">{t.display_name ?? t.ticker}</p>
                    )}
                    <p className="font-mono text-[10px] text-muted-foreground">{t.ticker}{t.market !== "KR" ? ` · ${t.market}` : ""}</p>
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
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setOpenHistoryTicker(isOpen ? null : t.ticker)}
                      className={cn(
                        "rounded px-2 py-0.5 font-mono text-[10px] font-bold transition-colors border",
                        isOpen
                          ? "border-stamp bg-stamp/10 text-stamp"
                          : "border-border bg-card text-muted-foreground hover:border-stamp/40 hover:text-foreground"
                      )}
                      title={`${t.display_name ?? t.ticker} 매매이력 (${tickerTradeCount}회)`}
                    >
                      {isOpen ? "▾" : "▸"} {tickerTradeCount > 1 ? `${tickerTradeCount}회` : "이력"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-border pt-3">
          <span className="font-mono text-[10px] text-muted-foreground mr-1">페이지:</span>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={cn(
                "tnum h-6 min-w-[24px] rounded px-1.5 font-mono text-[11px] font-bold transition-colors",
                i === page
                  ? "bg-stamp text-background"
                  : "border border-border bg-card text-muted-foreground hover:border-stamp/40 hover:text-foreground"
              )}
            >
              {i + 1}
            </button>
          ))}
          <span className="ml-1 font-mono text-[10px] text-muted-foreground">
            ({page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} / {sorted.length})
          </span>
        </div>
      )}
    </section>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

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
  // Prefer trades_by_strategy (v8) over legacy allTrades prop
  const tradesRaw = multiStrategy.trades_by_strategy?.[selectedKey] ?? allTrades[selectedKey] ?? [];
  const trades = tradesRaw.filter((t) => !t.exit_reason?.endsWith("미청산"));
  const openPositions: OpenPosition[] = multiStrategy.open_positions_by_strategy?.[selectedKey] ?? [];

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
    <div className="space-y-6">
      {/* ── Strategy tabs (grouped) ─────────────────────────────────── */}
      <div>
        <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          전략 선택 — 탭 클릭으로 전환
        </p>
        {STRATEGY_GROUPS.map((group) => {
          const groupStrats = multiStrategy.strategies.filter((s) => group.keys.includes(s.key));
          if (!groupStrats.length) return null;
          return (
            <div key={group.label} className="mb-3">
              <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {groupStrats.map((s) => {
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
          );
        })}
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
            CSV 다운로드 ({selected.trade_count}건)
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

      {/* ── Wealth simulation ─────────────────────────────────────────── */}
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

      {/* ── Open positions (current holdings for this strategy) ────── */}
      <OpenPositionsTable positions={openPositions} stratKey={selectedKey} />

      {/* ── Trade log (sortable + paginated) ─────────────────────────── */}
      <TradeLog trades={trades} stratKey={selectedKey} />
    </div>
  );
}
