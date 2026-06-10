import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { StatStrip } from "@/components/report-ledger";
import { WealthChart } from "@/components/strategy/wealth-chart";
import backtest from "@/data/strategy-backtest.json";
import { signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

export const metadata: Metadata = { title: "모멘텀 전략 — 판결 아카이브" };

const ATR_MULT = backtest.params.atr_mult;

function fmt만(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억원`;
  return `${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
}

const RULES = [
  {
    title: "유니버스 — Buy 의견만",
    body: "4개 학회 리포트 중 rating_class == 'buy'인 종목만 후보로 삼습니다. Soft Buy·Hold·Sell은 제외. 리포트 발간일 이후부터 후보가 되므로 point-in-time이 보장됩니다 — 미래 정보를 쓰지 않습니다.",
  },
  {
    title: "진입 — 발간 후 신고가 돌파",
    body: "발간 10거래일 이후, 종가가 '발간 후 최고 종가'를 경신하면 다음 거래일 시가에 매수. 리포트의 주장(펀더멘털)과 시장의 동의(모멘텀)가 만나는 지점만 삽니다. 발간 후 180일 내 신호가 없으면 소멸. — '늦게 모멘텀을 보고 진입하더라도 크게 먹을 수 있다'는 가설을 검증합니다.",
  },
  {
    title: `청산 — 래칫형 ATR×${ATR_MULT} 트레일링 스탑`,
    body: `진입 후 최고 종가에서 ${ATR_MULT}×ATR(42) 라인을 따라 올립니다. 단, +30% 돌파 시 (${ATR_MULT + 1})×ATR로, +100% 돌파 시 (${ATR_MULT + 2})×ATR로 스탑 폭이 자동 확대됩니다. 큰 수익이 날수록 스탑을 더 느슨하게 두어 텐배거 후보를 일찍 잘라내지 않습니다.`,
  },
  {
    title: "선별 — 샤프비율 + 컨센서스 우선",
    body: "동일비중 5%, 최대 20종목. 슬롯 경합 시 ≥2개 학회가 동시에 Buy를 낸 종목을 우선 배정하고, 이후 90일 샤프비율 순으로 채웁니다. 거래비용은 편도 0.3% 가정.",
  },
  {
    title: "시장 국면 오버레이",
    body: "KOSPI 종가가 200일 이동평균 아래면 신규 진입을 멈춥니다 (보유 종목 청산 규칙은 항상 동작). 모멘텀의 약점인 대세 하락장 노출을 구조적으로 줄이는 장치로, 모든 ATR 배수에서 MDD를 일관되게 낮췄습니다.",
  },
];

type SensitivityRow = {
  atr_mult: number;
  regime_filter: boolean;
  total_return_pct: number;
  sharpe: number | null;
  mdd_pct: number;
  trades: number;
  win_rate_pct: number | null;
};

type WealthPoint = {
  month: number;
  date: string;
  contributed: number;
  strategy_value: number;
  benchmark_value: number;
};

export default function StrategyPage() {
  const m = backtest.metrics;
  const equity = backtest.equity as { date: string; nav: number }[];
  const ws = backtest.wealth_sim as {
    schedule_desc: string;
    final_contributed: number;
    final_strategy_value: number;
    final_benchmark_value: number;
    strategy_gain_on_contributed_pct: number | null;
    benchmark_gain_on_contributed_pct: number | null;
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
    single_club: { count: number; avg_return_pct: number | null; win_rate_pct: number | null; median_return_pct: number | null };
    multi_club: { count: number; avg_return_pct: number | null; win_rate_pct: number | null; median_return_pct: number | null };
    alpha_multi_vs_single: number | null;
    note: string;
  };

  // equity SVG
  const maxNav = Math.max(...equity.map((p) => p.nav));
  const minNav = Math.min(...equity.map((p) => p.nav));
  const W = 720;
  const H = 220;
  const x = (i: number) => 8 + (i / (equity.length - 1)) * (W - 16);
  const y = (nav: number) => 12 + ((maxNav - nav) / (maxNav - minNav || 1)) * (H - 36);
  const path = equity.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.nav).toFixed(1)}`).join(" ");

  return (
    <main className="mx-auto max-w-[1500px] space-y-9 px-4 py-6 sm:px-8">
      <SiteHeader eyebrow="Momentum Strategy Lab" />

      <header>
        <h1 className="mt-3 font-display text-4xl font-black leading-[1.15] tracking-tight sm:text-6xl">
          학회의 주장에, <span className="text-stamp">시장의 동의</span>가 붙는 순간만 산다.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
          수십 년간 가장 일관되게 검증된 전략 중 하나인 추세추종(모멘텀)을 이 아카이브에 결합했습니다. 리포트는 종목 선별(어떤 종목을 볼 것인가)을,
          신고가 돌파는 타이밍(언제 살 것인가)을, 래칫형 ATR 트레일링 스탑은 위험 관리(언제 팔 것인가)를 맡습니다. 수익이 클수록 스탑 폭이
          자동으로 넓어져 텐배거 후보를 일찍 자르지 않습니다. 아래 수치는 아카이브의 리포트 발간일과 캐시된 일별 시세만으로 계산한 백테스트입니다.
        </p>
      </header>

      <StatStrip
        items={[
          { label: `누적 수익률 (${m.start.slice(0, 4)}~)`, value: formatPct(m.total_return_pct, 1), tone: signColor(m.total_return_pct) },
          { label: "연환산 (CAGR)", value: formatPct(m.cagr_pct, 1), tone: signColor(m.cagr_pct) },
          { label: "샤프비율", value: String(m.sharpe ?? "—") },
          { label: "최대 낙폭 (MDD)", value: formatPct(m.mdd_pct, 1), tone: "text-down" },
          { label: "승률", value: `${m.win_rate_pct ?? "—"}%` },
          { label: "거래 / 신호", value: `${m.trades}회 / ${m.signals}건` },
        ]}
      />

      {/* ── 자산 곡선 (단순 자본 배율) ─────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="자산 곡선">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">자산 곡선 (초기자본 = 1.0)</h2>
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
          <text x={x(equity.length - 1)} y={y(equity[equity.length - 1].nav) - 8} textAnchor="end" fontSize="11" fontWeight="700" className={cn("font-mono", m.total_return_pct >= 0 ? "fill-up" : "fill-down")}>
            {equity[equity.length - 1].nav.toFixed(2)}
          </text>
        </svg>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-border pt-4">
          {(backtest.yearly as { year: number; return_pct: number }[]).map((row) => (
            <div key={row.year} className="rounded-md border border-border px-3 py-1.5 text-center">
              <p className="font-mono text-[10px] text-muted-foreground">{row.year}</p>
              <p className={cn("tnum font-mono text-sm font-bold", signColor(row.return_pct))}>{formatPct(row.return_pct, 1)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 월 적립 부의 시뮬레이션 ─────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="월 적립 부의 시뮬레이션">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-black tracking-tight">월 적립 부의 시뮬레이션</h2>
          <p className="font-mono text-[11px] text-muted-foreground">
            {ws.series[0]?.date} → {ws.series[ws.series.length - 1]?.date}
          </p>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{ws.schedule_desc}</p>

        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "총 납입금", value: fmt만(ws.final_contributed), tone: "" },
            { label: "전략 최종 자산", value: fmt만(ws.final_strategy_value), tone: signColor(ws.final_strategy_value - ws.final_contributed) },
            { label: "벤치마크 최종 자산", value: fmt만(ws.final_benchmark_value), tone: signColor(ws.final_benchmark_value - ws.final_contributed) },
            { label: "전략 수익률 (납입 대비)", value: formatPct(ws.strategy_gain_on_contributed_pct, 1), tone: signColor(ws.strategy_gain_on_contributed_pct) },
            { label: "벤치마크 수익률 (납입 대비)", value: formatPct(ws.benchmark_gain_on_contributed_pct, 1), tone: signColor(ws.benchmark_gain_on_contributed_pct) },
          ].map((item) => (
            <div key={item.label} className="bg-card px-4 py-3">
              <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{item.label}</dt>
              <dd className={cn("tnum mt-1.5 font-display text-xl font-black tracking-tight", item.tone)}>{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5">
          <WealthChart series={ws.series} />
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          점선 = 납입금 누계 · 적색 실선 = 전략 자산 · 회색 실선 = KOSPI 벤치마크.
          시뮬레이션 MDD: {formatPct(ws.strategy_mdd_pct, 1)}
        </p>
      </section>

      {/* ── 테일 캡처 통계 ────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="테일 캡처 통계">
        <h2 className="font-display text-2xl font-black tracking-tight">수익은 꼬리에서 — 테일 캡처 분석</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          주식 수익률은 극단적으로 오른쪽 꼬리가 두꺼운 분포입니다. 상위 10% 거래가 전체 수익의
          대부분을 만들어 냅니다. 래칫형 스탑은 이 꼬리를 포착하기 위한 핵심 장치입니다.
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
                  <th className="px-3 py-1.5 text-right font-semibold">커버 학회 수</th>
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

      {/* ── 컨센서스 분석 ─────────────────────────────────────── */}
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
                  { k: "거래 수", v: data.count !== null ? `${data.count}건` : "—" },
                  { k: "평균 수익률", v: formatPct(data.avg_return_pct, 1), tone: signColor(data.avg_return_pct) },
                  { k: "승률", v: data.win_rate_pct !== null ? `${data.win_rate_pct}%` : "—" },
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
        {consensus.alpha_multi_vs_single !== null && (
          <p className="mt-3 text-sm text-muted-foreground">
            멀티 커버 종목의 평균 수익률은 단독 커버 대비{" "}
            <span className={cn("font-bold", signColor(consensus.alpha_multi_vs_single))}>
              {formatPct(consensus.alpha_multi_vs_single, 1)}p
            </span>{" "}
            높습니다.
            {consensus.alpha_multi_vs_single > 0
              ? " 여러 학회의 시각이 겹칠수록 종목 선별력이 높아지는 증거로 해석할 수 있습니다."
              : " 현재 샘플에서는 컨센서스 우위가 관찰되지 않습니다."}
          </p>
        )}
      </section>

      {/* ── 전략 규칙 ────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-2" aria-label="전략 규칙">
        {RULES.map((rule, index) => (
          <article key={rule.title} className="rounded-lg border border-border bg-card p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-stamp">규칙 {index + 1}</p>
            <h3 className="mt-1 font-display text-xl font-black tracking-tight">{rule.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{rule.body}</p>
          </article>
        ))}
      </section>

      {/* ── 파라미터 민감도 ──────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="파라미터 민감도">
        <h2 className="font-display text-2xl font-black tracking-tight">파라미터 민감도 — 체리피킹 방지 장치</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          스탑 폭(ATR 배수)과 국면 필터의 모든 조합을 공개합니다. 헤드라인(ATR×{ATR_MULT} + 국면 필터 {backtest.params.regime_filter ? "ON" : "off"})은
          이 표에서 <strong>사후 선택</strong>된 것이므로 그만큼 할인해서 읽어야 합니다. 다만 &lsquo;스탑이 넓을수록 꼬리 포착에 유리하다&rsquo;는
          패턴 자체는 전 구간에서 일관됩니다.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">ATR 배수</th>
                <th className="px-3 py-2 text-left font-semibold">국면 필터</th>
                <th className="px-3 py-2 text-right font-semibold">누적 수익률</th>
                <th className="px-3 py-2 text-right font-semibold">샤프</th>
                <th className="px-3 py-2 text-right font-semibold">MDD</th>
                <th className="px-3 py-2 text-right font-semibold">거래</th>
                <th className="px-3 py-2 text-right font-semibold">승률</th>
              </tr>
            </thead>
            <tbody>
              {(backtest.sensitivity as SensitivityRow[]).map((row) => {
                const isHeadline = row.atr_mult === ATR_MULT && row.regime_filter === backtest.params.regime_filter;
                return (
                  <tr
                    key={`${row.atr_mult}-${row.regime_filter}`}
                    className={cn("border-b border-dashed border-border last:border-b-0", isHeadline && "bg-secondary font-bold")}
                  >
                    <td className="tnum px-3 py-2 font-mono text-xs">×{row.atr_mult}{isHeadline ? " ◀ 헤드라인" : ""}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.regime_filter ? "ON" : "off"}</td>
                    <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(row.total_return_pct))}>
                      {formatPct(row.total_return_pct, 1)}
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{row.sharpe ?? "—"}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-down">{formatPct(row.mdd_pct, 1)}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{row.trades}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{row.win_rate_pct ?? "—"}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 현재 보유 포지션 ─────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6" aria-label="현재 보유 포지션">
        <h2 className="font-display text-2xl font-black tracking-tight">전략이 지금 들고 있는 종목 ({m.open_positions})</h2>
        <p className="mt-1 text-sm text-muted-foreground">백테스트 마지막 날 기준 미청산 포지션 — 트레일링 스탑이 아직 이탈되지 않은 종목들입니다.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b-4 border-double border-border font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">티커</th>
                <th className="px-3 py-2 text-left font-semibold">진입일</th>
                <th className="px-3 py-2 text-right font-semibold">진입가</th>
                <th className="px-3 py-2 text-right font-semibold">현재가</th>
                <th className="px-3 py-2 text-right font-semibold">스탑 라인</th>
                <th className="px-3 py-2 text-right font-semibold">수익률</th>
                <th className="px-3 py-2 text-right font-semibold">커버</th>
              </tr>
            </thead>
            <tbody>
              {(backtest.open_positions as { ticker: string; entry_date: string; entry: number; last_close: number; stop: number; return_pct: number; n_clubs?: number }[])
                .sort((a, b) => b.return_pct - a.return_pct)
                .map((pos) => (
                  <tr key={pos.ticker} className="border-b border-dashed border-border last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs font-bold">{pos.ticker}</td>
                    <td className="tnum px-3 py-2 font-mono text-xs text-muted-foreground">{pos.entry_date}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.entry.toLocaleString()}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.last_close.toLocaleString()}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{Math.round(pos.stop).toLocaleString()}</td>
                    <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(pos.return_pct))}>{formatPct(pos.return_pct, 1)}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{pos.n_clubs ?? 1}개교</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 정직한 각주 ──────────────────────────────────────── */}
      <section className="rounded-lg border-2 border-foreground/70 bg-card p-6 shadow-[5px_5px_0_0_hsl(var(--foreground)/0.75)]" aria-label="전략의 한계">
        <h2 className="font-display text-2xl font-black tracking-tight">정직한 각주 — 이 전략이 무너지는 곳</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>
            · 모멘텀은 상방 베타를 증폭하지만 베타에서 자유롭지 않습니다. 백테스트 MDD {formatPct(m.mdd_pct, 1)}이 보여주듯 대세 하락장에서는
            롱온리 특성상 손실을 피할 수 없습니다.
          </li>
          <li>· 소수 종목(최대 20개) 집중 운용이라 논문(평균 600종목+)보다 변동성과 낙폭이 큽니다. 하이 리스크, 하이 리턴 프로파일입니다.</li>
          <li>· 가격 이력이 리포트 발간 시점부터만 있어 &lsquo;역사상 신고가(ATH)&rsquo;가 아닌 &lsquo;발간 후 신고가&rsquo;를 씁니다.</li>
          <li>· 생존 편향: 아카이브에 수집된 리포트 자체가 학회가 공개를 유지한 표본입니다. 상장폐지 종목 시세는 일부 누락될 수 있습니다.</li>
          <li>
            · 헤드라인 구성(ATR×{ATR_MULT} + 국면 필터 {backtest.params.regime_filter ? "ON" : "off"})은 위 민감도 표에서 사후 선택된 것입니다.
            컨센서스 우선 배정과 래칫 스탑도 표본 내 최적화입니다. 투자 권유가 아닙니다.
          </li>
          <li>
            · 부의 시뮬레이션은 전략 NAV 일별 수익률을 DCA 자산에 그대로 적용한 것입니다. 실제로는 일별 리밸런싱 비용, 슬리피지, 세금이 추가됩니다.
          </li>
        </ul>
      </section>
    </main>
  );
}
