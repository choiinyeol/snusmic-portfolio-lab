import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { StatStrip } from "@/components/report-ledger";
import backtest from "@/data/strategy-backtest.json";
import { signColor } from "@/lib/verdict";
import { cn, formatPct } from "@/lib/utils";

export const metadata: Metadata = { title: "모멘텀 전략 — 판결 아카이브" };

const RULES = [
  {
    title: "유니버스",
    body: "4개 학회 리포트가 커버한 국내 종목만. 리포트 발간일 이후부터 후보가 되므로 point-in-time이 보장됩니다 — 미래 정보를 쓰지 않습니다.",
  },
  {
    title: "진입 — 발간 후 신고가 돌파",
    body: "발간 10거래일 이후, 종가가 '발간 후 최고 종가'를 경신하면 다음 거래일 시가에 매수. 리포트의 주장(펀더멘털)과 시장의 동의(모멘텀)가 만나는 지점만 삽니다. 발간 후 180일 내 신호가 없으면 소멸.",
  },
  {
    title: "청산 — 42일 ATR 트레일링 스탑",
    body: "진입 후 최고 종가에서 3×ATR(42)을 뺀 라인을 따라 올리고, 종가가 이탈하면 다음 거래일 시가에 매도. 익절·손절을 따로 두지 않고 추세가 꺾이는 순간만 봅니다.",
  },
  {
    title: "선별 — 샤프비율 필터",
    body: "동일비중 5%, 최대 20종목. 같은 날 신호가 슬롯보다 많으면 90일 샤프비율이 높은 종목부터 편입합니다. 거래비용은 편도 0.3% 가정.",
  },
];

export default function StrategyPage() {
  const m = backtest.metrics;
  const equity = backtest.equity as { date: string; nav: number }[];
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
          신고가 돌파는 타이밍(언제 살 것인가)을, ATR 트레일링 스탑은 위험 관리(언제 팔 것인가)를 맡습니다. 아래 수치는 아카이브의 리포트
          발간일과 캐시된 일별 시세만으로 계산한 백테스트입니다.
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

      <section className="grid gap-6 lg:grid-cols-2" aria-label="전략 규칙">
        {RULES.map((rule, index) => (
          <article key={rule.title} className="rounded-lg border border-border bg-card p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-stamp">규칙 {index + 1}</p>
            <h3 className="mt-1 font-display text-xl font-black tracking-tight">{rule.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{rule.body}</p>
          </article>
        ))}
      </section>

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
              </tr>
            </thead>
            <tbody>
              {(backtest.open_positions as { ticker: string; entry_date: string; entry: number; last_close: number; stop: number; return_pct: number }[])
                .sort((a, b) => b.return_pct - a.return_pct)
                .map((pos) => (
                  <tr key={pos.ticker} className="border-b border-dashed border-border last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs font-bold">{pos.ticker}</td>
                    <td className="tnum px-3 py-2 font-mono text-xs text-muted-foreground">{pos.entry_date}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.entry.toLocaleString()}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs">{pos.last_close.toLocaleString()}</td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{Math.round(pos.stop).toLocaleString()}</td>
                    <td className={cn("tnum px-3 py-2 text-right font-mono text-xs font-bold", signColor(pos.return_pct))}>{formatPct(pos.return_pct, 1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border-2 border-foreground/70 bg-card p-6 shadow-[5px_5px_0_0_hsl(var(--foreground)/0.75)]" aria-label="전략의 한계">
        <h2 className="font-display text-2xl font-black tracking-tight">정직한 각주 — 이 전략이 무너지는 곳</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>
            · 모멘텀은 상방 베타를 증폭하지만 베타에서 자유롭지 않습니다. 백테스트 MDD {formatPct(m.mdd_pct, 1)}이 보여주듯 대세 하락장에서는
            롱온리 특성상 손실을 피할 수 없습니다. 실전에서는 시장 국면 필터(예: 지수 이동평균 하회 시 신규 진입 중단)나 하락장에서 버는 전략과의
            팩터 결합이 필요합니다.
          </li>
          <li>· 소수 종목(최대 20개) 집중 운용이라 논문(평균 600종목+)보다 변동성과 낙폭이 큽니다. 하이 리스크, 하이 리턴 프로파일입니다.</li>
          <li>· 가격 이력이 리포트 발간 시점부터만 있어 &lsquo;역사상 신고가(ATH)&rsquo;가 아닌 &lsquo;발간 후 신고가&rsquo;를 씁니다. 학회 커버 + 모멘텀 확인이라는 의도에는 부합하지만 원 논문과는 다른 정의입니다.</li>
          <li>· 생존 편향: 아카이브에 수집된 리포트 자체가 학회가 공개를 유지한 표본입니다. 상장폐지 종목 시세는 일부 누락될 수 있습니다.</li>
          <li>· 백테스트는 파라미터(ATR 배수, 슬롯 수)를 튜닝하지 않은 1차 결과이며, 투자 권유가 아닙니다.</li>
        </ul>
      </section>
    </main>
  );
}
