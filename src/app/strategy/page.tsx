import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { StatStrip } from "@/components/report-ledger";
import { WealthChart } from "@/components/strategy/wealth-chart";
import backtest from "@/data/strategy-backtest.json";
import { signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

export const metadata: Metadata = { title: "모멘텀 전략 — 판결 아카이브" };

function fmt만(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
}

const STRATEGY_LABEL_KO: Record<string, string> = {
  A_immediate_12mo:  "A. 즉시진입 12개월 보유",
  B_immediate_18mo:  "B. 즉시진입 18개월 보유",
  C_ew_monthly:      "C. 동일비중 월 리밸런싱",
  D_consensus_12mo:  "D. 멀티클럽 컨센서스 12mo ★",
  E_breakout_atr4:   "E. 신고가 돌파+ATR 래칫 (v3)",
};

const BENCHMARK_KO: Record<string, string> = {
  KOSPI:      "KOSPI",
  SP500:      "S&P500",
  NASDAQ:     "NASDAQ",
  AllWeather: "올웨더",
};

type PeriodMetrics = {
  start?: string;
  end?: string;
  total_return_pct?: number | null;
  cagr_pct?: number | null;
  sharpe?: number | null;
  mdd_pct?: number | null;
};

type ResearchFamily = {
  label: string;
  metrics: {
    total_return_pct: number;
    cagr_pct: number | null;
    sharpe: number | null;
    mdd_pct: number;
    trades: number;
    win_rate_pct: number | null;
  };
  in_sample: PeriodMetrics;
  out_of_sample: PeriodMetrics;
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

export default function StrategyPage() {
  const m = backtest.metrics;
  const equity = backtest.equity as { date: string; nav: number }[];
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
    top10_trades: { ticker: string; return_pct: number; days: number; n_clubs: number }[];
  };
  const consensus = backtest.consensus_stats as {
    single_club: { count: number; avg_return_pct: number | null; win_rate_pct: number | null };
    multi_club: { count: number; avg_return_pct: number | null; win_rate_pct: number | null };
    alpha_multi_vs_single: number | null;
    note: string;
  };
  const research = backtest.research_families as ResearchFamily[];
  const inSample = backtest.in_sample as PeriodMetrics;
  const outOfSample = backtest.out_of_sample as PeriodMetrics;
  const params = backtest.params as {
    headline_strategy: string;
    is_period: string;
    oos_period: string;
    universe_start: string;
    cost_per_side: number;
    position_weight: number;
    max_positions: number;
  };

  // Equity chart
  const maxNav = Math.max(...equity.map((p) => p.nav));
  const minNav = Math.min(...equity.map((p) => p.nav));
  const W = 720;
  const H = 220;
  const x = (i: number) => 8 + (i / (equity.length - 1)) * (W - 16);
  const y = (nav: number) => 12 + ((maxNav - nav) / (maxNav - minNav || 1)) * (H - 36);
  const path = equity.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.nav).toFixed(1)}`).join(" ");

  // Year annotations: mark IS/OOS boundary
  const oosBoundaryYear = 2024;

  return (
    <main className="mx-auto max-w-[1500px] space-y-9 px-4 py-6 sm:px-8">
      <SiteHeader eyebrow="Strategy Lab" />

      <header>
        <h1 className="mt-3 font-display text-4xl font-black leading-[1.15] tracking-tight sm:text-6xl">
          여러 학회가 동시에 <span className="text-stamp">Buy</span>를 외칠 때만 산다.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          5가지 전략 패밀리를 인샘플(2019–2023)로 튜닝하고 아웃오브샘플(2024–현재)로 검증했습니다.
          가장 단순하면서도 강건한 규칙이 이겼습니다:
          <strong className="text-foreground"> ≥2개 학회가 동시에 Buy를 낸 종목을 발간 당일 매수 → 12개월 보유, 동일비중.</strong>{" "}
          신고가 돌파 필터는 오히려 알파를 갉아먹고 있었습니다.
        </p>
      </header>

      <StatStrip
        items={[
          { label: `누적 수익률 (전체)`, value: formatPct(m.total_return_pct, 1), tone: signColor(m.total_return_pct) },
          { label: "연환산 (CAGR 전체)", value: formatPct(m.cagr_pct, 1), tone: signColor(m.cagr_pct) },
          { label: "인샘플 샤프", value: String(inSample.sharpe ?? "—") },
          { label: "아웃오브샘플 샤프", value: String(outOfSample.sharpe ?? "—"), tone: "text-up" },
          { label: "최대 낙폭 (MDD)", value: formatPct(m.mdd_pct, 1), tone: "text-down" },
          { label: "승률 / 거래", value: `${m.win_rate_pct ?? "—"}% / ${m.trades}건` },
        ]}
      />

      {/* ── 전략 선정 근거: 인샘플/아웃오브샘플 연구 ─────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="전략 연구 결과">
        <h2 className="font-display text-2xl font-black tracking-tight">전략 패밀리 연구 — 어떻게 선정했나</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          유니버스: 2019-07-01 이후 발간된 buy 리포트 (KR 종목). 인샘플 구간 <strong className="text-foreground">{params.is_period}</strong>으로
          파라미터를 정하고, 아웃오브샘플 <strong className="text-foreground">{params.oos_period}</strong>에서 재확인했습니다.
          헤드라인은 인샘플 샤프비율 기준 최상위 전략입니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">전략</th>
                <th className="px-3 py-2 text-right font-semibold">IS CAGR</th>
                <th className="px-3 py-2 text-right font-semibold">IS 샤프</th>
                <th className="px-3 py-2 text-right font-semibold">IS MDD</th>
                <th className="px-3 py-2 text-right font-semibold">OOS CAGR</th>
                <th className="px-3 py-2 text-right font-semibold">OOS 샤프</th>
                <th className="px-3 py-2 text-right font-semibold">OOS MDD</th>
              </tr>
            </thead>
            <tbody>
              {research.map((r) => {
                const isHeadline = r.label === params.headline_strategy;
                const is = r.in_sample;
                const oos = r.out_of_sample;
                return (
                  <tr
                    key={r.label}
                    className={cn(
                      "border-b border-dashed border-border last:border-b-0",
                      isHeadline && "bg-secondary font-bold"
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {STRATEGY_LABEL_KO[r.label] ?? r.label}
                    </td>
                    <td className={cn("tnum px-3 py-2 text-right font-mono text-xs", signColor(is.cagr_pct))}>
                      {is.cagr_pct != null ? formatPct(is.cagr_pct, 1) : "—"}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">
                      {is.sharpe ?? "—"}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-down">
                      {is.mdd_pct != null ? formatPct(is.mdd_pct, 1) : "—"}
                    </td>
                    <td className={cn("tnum px-3 py-2 text-right font-mono text-xs", signColor(oos.cagr_pct))}>
                      {oos.cagr_pct != null ? formatPct(oos.cagr_pct, 1) : "—"}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">
                      {oos.sharpe ?? "—"}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-down">
                      {oos.mdd_pct != null ? formatPct(oos.mdd_pct, 1) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          * IS = In-Sample (2019-07 ~ 2023-12) | OOS = Out-of-Sample (2024-01 ~ 현재).
          헤드라인(★)은 인샘플 샤프비율 기준 자동 선정됩니다.
          아웃오브샘플에서도 D가 선두를 유지해 결과가 우연이 아님을 시사합니다.
        </p>
      </section>

      {/* ── 헤드라인 전략 규칙 ──────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-2" aria-label="헤드라인 전략 규칙">
        {[
          {
            n: 1,
            title: "유니버스 — 멀티클럽 Buy 컨센서스만",
            body: `2019-07-01 이후 발간된 리포트 중, ≥2개 학회가 동시에 rating_class == 'buy'인 종목만 대상입니다. 단독 학회 커버는 제외. 리포트 발간 이후 가격만 사용하므로 point-in-time이 보장됩니다.`,
          },
          {
            n: 2,
            title: "진입 — 발간 당일 (다음 거래일 시가)",
            body: "신고가 돌파를 기다리지 않습니다. 발간 다음 거래일 시가에 바로 매수합니다. 백테스트 결과 진입 지연(돌파 대기)이 오히려 알파를 削減했습니다.",
          },
          {
            n: 3,
            title: "청산 — 12개월 보유 후 시가 청산",
            body: "진입 후 12개월이 지난 첫 거래일 시가에 청산합니다. 단순 고정 기간 전략이지만 인샘플·아웃오브샘플 모두에서 ATR 트레일링 스탑보다 우월했습니다.",
          },
          {
            n: 4,
            title: `포지션 — 동일비중 ${Math.round((params.position_weight ?? 0.05) * 100)}%, 최대 ${params.max_positions ?? 20}종목`,
            body: `슬롯당 NAV의 ${Math.round((params.position_weight ?? 0.05) * 100)}%를 배분합니다. 최대 ${params.max_positions ?? 20}종목 동시 보유. 슬롯 경합 시 선착순 (진입일 기준). 거래비용 편도 ${(params.cost_per_side ?? 0.003) * 100}%.`,
          },
        ].map((rule) => (
          <article key={rule.n} className="rounded-lg border border-border bg-card p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-stamp">규칙 {rule.n}</p>
            <h3 className="mt-1 font-display text-xl font-black tracking-tight">{rule.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{rule.body}</p>
          </article>
        ))}
      </section>

      {/* ── 자산 곡선 ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="자산 곡선">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            자산 곡선 (초기자본 = 1.0) — 헤드라인 전략
          </h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {m.start} → {m.end} · 주간 샘플
          </p>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="전략 자산 곡선">
          <line x1="8" x2={W - 8} y1={y(1)} y2={y(1)} className="stroke-border" strokeDasharray="4 4" strokeWidth="1" />
          <text x={W - 10} y={y(1) - 5} textAnchor="end" fontSize="10" className="fill-muted-foreground font-mono">
            1.0
          </text>
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
          {/* IS/OOS boundary annotation */}
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

      {/* ── 월 적립 부의 시뮬레이션 (4 벤치마크) ───────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="월 적립 부의 시뮬레이션">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-black tracking-tight">월 적립 부의 시뮬레이션</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {ws.series[0]?.date} → {ws.series[ws.series.length - 1]?.date}
          </p>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{ws.schedule_desc}</p>
        <p className="mt-1 text-xs text-muted-foreground">{ws.fx_assumption}</p>

        {/* Final wealth table */}
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "총 납입금", value: fmt만(ws.final_contributed), tone: "" },
            { label: "전략 최종 자산", value: fmt만(ws.final_strategy_value), tone: signColor(ws.final_strategy_value - ws.final_contributed) },
            ...Object.entries(ws.final_benchmark_values).map(([k, v]) => ({
              label: `${BENCHMARK_KO[k] ?? k} 벤치마크`,
              value: fmt만(v),
              tone: signColor(v - ws.final_contributed),
            })),
          ].map((item) => (
            <div key={item.label} className="bg-card px-4 py-3">
              <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</dt>
              <dd className={cn("tnum mt-1.5 font-display text-xl font-black tracking-tight", item.tone)}>{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* Gain rates table */}
        <div className="mt-3 flex flex-wrap gap-3">
          <div className="rounded-lg border border-stamp/60 bg-stamp/5 px-4 py-2">
            <p className="font-mono text-[10px] text-muted-foreground">전략 수익률 (납입 대비)</p>
            <p className={cn("tnum font-display text-2xl font-black", signColor(ws.strategy_gain_on_contributed_pct))}>
              {formatPct(ws.strategy_gain_on_contributed_pct, 1)}
            </p>
          </div>
          {Object.entries(ws.benchmark_gain_on_contributed_pct).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-secondary/20 px-4 py-2">
              <p className="font-mono text-[10px] text-muted-foreground">{BENCHMARK_KO[k] ?? k} (납입 대비)</p>
              <p className={cn("tnum font-display text-2xl font-black", signColor(v))}>{formatPct(v, 1)}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <WealthChart series={ws.series} />
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          점선 = 납입금 누계 · 적색 실선 = 전략 자산 · 회색 = KOSPI · 청색 = S&P500 · 녹색 = NASDAQ · 황색 = 올웨더.
          시뮬레이션 MDD: {formatPct(ws.strategy_mdd_pct, 1)}
        </p>
      </section>

      {/* ── 테일 캡처 통계 ────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="테일 캡처 통계">
        <h2 className="font-display text-2xl font-black tracking-tight">수익은 꼬리에서 — 테일 캡처 분석</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          컨센서스 포트폴리오에서도 상위 10% 거래가 전체 수익의 대부분을 만들어 냅니다.
        </p>
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
            <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">상위 10개 거래</p>
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-semibold">티커</th>
                  <th className="px-3 py-1.5 text-right font-semibold">수익률</th>
                  <th className="px-3 py-1.5 text-right font-semibold">보유일</th>
                  <th className="px-3 py-1.5 text-right font-semibold">커버 학회</th>
                </tr>
              </thead>
              <tbody>
                {tail.top10_trades.map((t, i) => (
                  <tr key={`${t.ticker}-${i}`} className="border-b border-dashed border-border last:border-b-0">
                    <td className="px-3 py-1.5 font-mono text-xs font-bold">{t.ticker}</td>
                    <td className={cn("tnum px-3 py-1.5 text-right font-mono text-xs font-bold", signColor(t.return_pct))}>{formatPct(t.return_pct, 1)}</td>
                    <td className="tnum px-3 py-1.5 text-right font-mono text-xs">{t.days}일</td>
                    <td className="tnum px-3 py-1.5 text-right font-mono text-xs">{t.n_clubs}개</td>
                  </tr>
                ))}
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
            멀티 커버 종목의 평균 수익률은 단독 커버 대비{" "}
            <span className={cn("font-bold", signColor(consensus.alpha_multi_vs_single))}>
              {formatPct(consensus.alpha_multi_vs_single, 1)}p
            </span>{" "}
            {consensus.alpha_multi_vs_single > 0
              ? "높습니다. 여러 학회의 시각이 겹칠수록 종목 선별력이 높아지는 증거로 해석할 수 있습니다."
              : "낮습니다. 현재 샘플에서는 컨센서스 우위가 관찰되지 않습니다."}
          </p>
        )}
      </section>

      {/* ── 신고가 돌파 전략(E) 민감도 ─────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="신고가 돌파 전략 민감도">
        <h2 className="font-display text-2xl font-black tracking-tight">참고: 신고가 돌파 전략(E) 파라미터 민감도</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          v3 헤드라인이었던 신고가 돌파 + ATR 래칫 전략의 전체 그리드. 인샘플 샤프가 일관되게 낮고,
          아웃오브샘플에서는 일부 조합이 양호하나 컨센서스 즉시진입(IS 샤프 0.58)보다 떨어집니다.
          돌파 필터가 알파를 소모한다는 결론을 뒷받침합니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">ATR 배수</th>
                <th className="px-3 py-2 text-left font-semibold">국면 필터</th>
                <th className="px-3 py-2 text-right font-semibold">전체 수익률</th>
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
                  <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(row.total_return_pct))}>
                    {formatPct(row.total_return_pct, 1)}
                  </td>
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

      {/* ── 현재 보유 포지션 ─────────────────────────────────────── */}
      {backtest.open_positions.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-6" aria-label="현재 보유 포지션">
          <h2 className="font-display text-2xl font-black tracking-tight">
            전략이 지금 들고 있는 종목 ({backtest.open_positions.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">백테스트 마지막 날 기준 미청산 포지션 — 12개월 보유 기간이 아직 남은 종목들입니다.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-3 py-2 text-left font-semibold">티커</th>
                  <th className="px-3 py-2 text-left font-semibold">진입일</th>
                  <th className="px-3 py-2 text-right font-semibold">진입가</th>
                  <th className="px-3 py-2 text-right font-semibold">현재가</th>
                  <th className="px-3 py-2 text-right font-semibold">수익률</th>
                  <th className="px-3 py-2 text-right font-semibold">커버</th>
                </tr>
              </thead>
              <tbody>
                {(backtest.open_positions as { ticker: string; entry_date: string; entry: number; last_close: number; return_pct: number; n_clubs?: number }[])
                  .sort((a, b) => b.return_pct - a.return_pct)
                  .map((pos) => (
                    <tr key={pos.ticker} className="border-b border-dashed border-border last:border-b-0">
                      <td className="px-3 py-2 font-mono text-xs font-bold">{pos.ticker}</td>
                      <td className="tnum px-3 py-2 font-mono text-xs text-muted-foreground">{pos.entry_date}</td>
                      <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.entry.toLocaleString()}</td>
                      <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.last_close.toLocaleString()}</td>
                      <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(pos.return_pct))}>
                        {formatPct(pos.return_pct, 1)}
                      </td>
                      <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{pos.n_clubs ?? 1}개교</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── 정직한 각주 ──────────────────────────────────────────── */}
      <section
        className="rounded-lg border-2 border-foreground/70 bg-card p-6 shadow-[5px_5px_0_0_hsl(var(--foreground)/0.75)]"
        aria-label="전략의 한계"
      >
        <h2 className="font-display text-2xl font-black tracking-tight">정직한 각주 — 이 전략이 무너지는 곳</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>
            · <strong className="text-foreground">과최적화 주의.</strong> 헤드라인 전략(D)은 인샘플 기간 중 가장 높은 샤프비율을 보인 규칙입니다.
            아웃오브샘플 검증에서도 우위가 유지됐으나, 이는 아직 짧은 OOS 기간(약 2.5년)입니다. 결과를 과신하지 마십시오.
          </li>
          <li>
            · <strong className="text-foreground">컨센서스 종목 수가 적습니다.</strong> 전체 기간 {m.trades}건 거래. 표본이 작아 통계적 유의성이 낮을 수 있습니다.
          </li>
          <li>
            · 롱온리 전략이라 대세 하락장에서는 손실을 피할 수 없습니다. MDD {formatPct(m.mdd_pct, 1)}.
          </li>
          <li>
            · 생존 편향: 아카이브에 수집된 리포트는 학회가 공개를 유지한 표본입니다. 상장폐지 종목 시세 일부 누락 가능.
          </li>
          <li>
            · 부의 시뮬레이션의 미국 지수(NASDAQ, S&P500, GLD)는 달러 기준 포인트 수익률을 원화 환산 없이 적용했습니다.
            실제 KRW/USD 환율 변동은 미반영입니다.
          </li>
          <li>
            · 올웨더 포트폴리오는 25% GLD/NASDAQ/S&P500/KOSPI 분기 리밸런싱으로 단순화했습니다. 실제 올웨더 전략(채권 포함)과 다릅니다.
          </li>
          <li>· 투자 권유가 아닙니다. 이 백테스트는 과거 데이터에 기반하며 미래 수익을 보장하지 않습니다.</li>
        </ul>
      </section>
    </main>
  );
}
