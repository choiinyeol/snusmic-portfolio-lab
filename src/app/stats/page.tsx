import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TierStrip } from "@/components/stats/tier-strips";
import { CandidatesTable } from "@/components/stats/candidates-table";
import { FACTOR_SHORT_LABELS, type LiftBin, type StatsData } from "@/components/stats/stats-types";
import statsJson from "@/data/stats.json";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "통계 — 판결 아카이브",
  description:
    "배거의 관상 — 텐배거·멀티배거·더블이 된 학회 리포트들의 발간 시점 공통 요인을 통계로 검시하고, 지금 그 요인을 충족한 최신 리포트를 스크리닝합니다.",
};

const data = statsJson as unknown as StatsData;

const TIER_KO: Record<string, string> = {
  Tenbagger: "텐배거",
  Multibagger: "멀티배거",
  Double: "더블",
  Winner: "순항",
  Positive: "상승",
};

function liftTone(lift: number | null) {
  if (lift === null) return "text-muted-foreground";
  if (lift >= 1.05) return "text-up";
  if (lift <= 0.95) return "text-down";
  return "text-foreground/70";
}

function fmtRange(bin: LiftBin, unit: string) {
  if (bin.lo === null || bin.hi === null) return bin.label;
  const u = unit === "배" ? "배" : unit;
  return `${bin.lo} ~ ${bin.hi}${u}`;
}

/** 리프트 셀 — 배율 + 조건부 확률 + 구간 n */
function LiftCell({ bin, unit }: { bin: LiftBin | null; unit: string }) {
  if (!bin) return <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground/50">—</td>;
  return (
    <td className="px-3 py-2 text-right" title={`${bin.label} · 구간 ${fmtRange(bin, unit)} · ${bin.success}/${bin.n}건이 더블 이상`}>
      <span className={cn("tnum font-mono text-sm font-bold", liftTone(bin.lift))}>
        {bin.lift === null ? "—" : `${bin.lift.toFixed(2)}×`}
      </span>
      <span className="tnum ml-1.5 font-mono text-[10px] text-muted-foreground">
        {bin.p_pct === null ? "" : `${bin.p_pct}% · n=${bin.n}`}
      </span>
    </td>
  );
}

export default function StatsPage() {
  const { universe, features, tier_order, tier_stats, lift, top_factors, logit, candidates, consensus } = data;
  const tierCounts = tier_order.map((t) => ({ tier: t, n: universe.n_by_tier[t] ?? 0 }));
  const orderedFeatures = [...features].sort((a, b) => Number(b.is_top) - Number(a.is_top) || (b.lift_spread ?? 0) - (a.lift_spread ?? 0));
  const maxCoef = logit ? Math.max(...logit.coefs.map((c) => Math.abs(c.coef ?? 0)), 0.001) : 1;
  const screened = candidates.filter((c) => c.score >= 3);

  return (
    <main className="mx-auto max-w-[1500px] space-y-10 px-4 py-6 sm:px-8">
      <SiteHeader eyebrow="Statistics" />

      {/* ── 머리글 ── */}
      <header>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-stamp">발간 시점 공통 요인 검시</p>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl">배거의 관상</h1>
        <p className="mt-2 font-display text-lg font-bold text-foreground/80">텐배거는 태어날 때부터 텐배거였나.</p>
        <p className="mt-4 max-w-3xl text-base leading-7 text-foreground/75">
          2019년 7월 이후의 매수 리포트 <strong className="tnum font-bold">{universe.n_reports.toLocaleString()}건</strong>을 발간 후 24개월 내
          최고가 기준으로 등급을 매기고, <strong className="font-bold">발간되던 그 날</strong>의 시세·리포트 요인만으로
          (look-ahead 없이) 등급별 관상을 비교했습니다. 전체의 <strong className="tnum font-bold">{universe.base_rate_pct}%</strong>가
          더블(+100%) 이상이 됐습니다 — 이 베이스레이트 대비 각 요인이 확률을 얼마나 끌어올렸는지가 아래 리프트입니다.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {tierCounts.map(({ tier, n }) => (
            <div key={tier} className={cn("rounded-lg border px-3 py-1.5", tier === "Tenbagger" || tier === "Multibagger" ? "border-stamp/50 bg-stamp/5" : "border-border bg-card")}>
              <p className="font-mono text-[10px] text-muted-foreground">{TIER_KO[tier] ?? tier}</p>
              <p className="tnum font-display text-xl font-black">{n}</p>
            </div>
          ))}
        </div>
      </header>

      {/* ── ① 등급별 발간 시점 분포 ── */}
      <section aria-label="등급별 발간 시점 분포">
        <h2 className="border-b-2 border-foreground/60 pb-1.5 font-display text-2xl font-black tracking-tight">① 등급별 발간 시점 분포</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          각 피처를 등급(피크 기준)별로 늘어놓은 분포입니다. 막대는 IQR(25–75%), 가는 선은 p10–p90, 세로 눈금이 중앙값.
          학회 수 옆 숫자는 해당 등급에서 그 피처를 계산할 수 있었던 표본 수 — 가격 창고가 종목의 첫 리포트 직전부터 시작하기 때문에
          과거 이력 피처는 재커버 종목에서만 계산됩니다.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orderedFeatures.map((f) => (
            <TierStrip key={f.key} label={f.label} unit={f.unit} desc={f.desc} stats={tier_stats[f.key]} tierOrder={tier_order} />
          ))}
        </div>
      </section>

      {/* ── ② 3분위 리프트 ── */}
      <section aria-label="3분위 리프트">
        <h2 className="border-b-2 border-foreground/60 pb-1.5 font-display text-2xl font-black tracking-tight">② 어떤 요인이 더블 이상을 골라냈나 — 3분위 리프트</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          피처값 하위·중위·상위 ⅓ 구간별로 <em>P(더블 이상 | 구간) ÷ 베이스레이트({universe.base_rate_pct}%)</em>를 계산했습니다.
          1.00×보다 크면 그 구간에서 배거 확률이 높았다는 뜻. <span className="font-semibold text-stamp">붉은 행</span>이 단조 리프트가 확인된 상위 판별 요인입니다.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-foreground/60 bg-secondary/40 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">피처 (발간 시점)</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">n</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">하위 ⅓</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">중위 ⅓</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">상위 ⅓</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">단조</th>
              </tr>
            </thead>
            <tbody>
              {orderedFeatures.map((f) => {
                const bins = lift[f.key]?.bins ?? [];
                const cells: (LiftBin | null)[] = bins.length === 3 ? bins : bins.length === 2 ? [bins[0], null, bins[1]] : [null, null, null];
                return (
                  <tr key={f.key} className={cn("border-b border-dashed border-border/80", f.is_top && "bg-stamp/5")}>
                    <td className="px-3 py-2">
                      <span className={cn("font-semibold", f.is_top && "text-stamp")}>{f.label}</span>
                      {f.is_top && <span className="ml-1.5 rounded-sm bg-stamp px-1 py-px font-mono text-[9px] font-bold text-background">판별 요인</span>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{f.desc}</p>
                    </td>
                    <td className="tnum px-3 py-2 text-right font-mono text-xs text-muted-foreground">{f.n}</td>
                    <LiftCell bin={cells[0]} unit={f.unit} />
                    <LiftCell bin={cells[1]} unit={f.unit} />
                    <LiftCell bin={cells[2]} unit={f.unit} />
                    <td className="px-3 py-2 text-right font-mono text-xs">{f.monotone ? <span className="font-bold text-stamp">단조</span> : <span className="text-muted-foreground/60">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg border-2 border-stamp bg-stamp/5 p-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-stamp">읽는 법 — 배거의 관상 요약</p>
          <ul className="mt-2 space-y-1 text-sm leading-6 text-foreground/85">
            {top_factors.map((f) => {
              const bins = lift[f.key]?.bins ?? [];
              const worst = bins[0];
              const best = bins[bins.length - 1];
              return (
                <li key={f.key}>
                  <strong className="font-bold">{f.label}</strong>
                  {f.direction > 0 ? "이(가) 높을수록" : "이(가) 낮을수록"} 더블 이상 확률이 올라갔습니다 —{" "}
                  <span className="tnum font-mono text-xs">
                    {f.direction > 0 ? `${worst?.lift?.toFixed(2)}× → ${best?.lift?.toFixed(2)}×` : `${best?.lift?.toFixed(2)}× → ${worst?.lift?.toFixed(2)}×`}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            특히 눈에 띄는 것: <strong className="font-semibold text-foreground/80">조용한(저변동성) 종목은 배거가 잘 되지 않았다</strong>는 점.
            다만 변동성은 양날의 검 — 같은 성질이 급락 확률도 키웁니다. 이 표는 &lsquo;수익률 상방&rsquo;만 본 단면입니다.
          </p>
        </div>
      </section>

      {/* ── ③ 로지스틱 회귀 (참고) ── */}
      {logit && (
        <section aria-label="로지스틱 회귀">
          <h2 className="border-b-2 border-foreground/60 pb-1.5 font-display text-2xl font-black tracking-tight">③ 요인을 한꺼번에 넣으면 — 로지스틱 회귀 (참고용)</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            결측 없는 표본 <strong className="tnum">{logit.n}건</strong>에 L2 로지스틱 회귀를 한 번 돌렸습니다 (피처 표준화, 1SD당 로그오즈).
            in-sample AUC <strong className="tnum">{logit.auc_in_sample}</strong> — 동전 던지기(0.5)보다는 낫지만 예언서는 아닙니다.
            모멘텀 계열 피처(1/3/6/12개월·상대강도)는 서로 강하게 상관되어 <strong>개별 계수의 부호는 불안정</strong>합니다. 상관이지 인과가 아니며, 표본 외 검증도 없습니다.
          </p>
          <div className="mt-4 max-w-2xl space-y-1.5">
            {logit.coefs.map((c) => {
              const v = c.coef ?? 0;
              return (
                <div key={c.key} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 truncate font-mono text-[11px] text-muted-foreground" title={c.label}>{c.label}</span>
                  <div className="relative h-3.5 flex-1 rounded-sm bg-secondary/50">
                    <div
                      className={cn("absolute top-0 h-full rounded-sm", v >= 0 ? "left-1/2 bg-up/60" : "right-1/2 bg-down/60")}
                      style={{ width: `${(Math.abs(v) / maxCoef) * 48}%` }}
                    />
                    <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
                  </div>
                  <span className={cn("tnum w-14 shrink-0 text-right font-mono text-xs font-semibold", v >= 0 ? "text-up" : "text-down")}>
                    {v > 0 ? "+" : ""}{v.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── ④ 지금 그 관상을 한 종목들 ── */}
      <section aria-label="현재 후보 스크리닝">
        <h2 className="border-b-2 border-foreground/60 pb-1.5 font-display text-2xl font-black tracking-tight">④ 지금 그 관상을 한 종목들</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          발간 <strong className="font-semibold">180일 이내</strong>이면서 아직 피크 기준 더블이 안 된 리포트 <strong className="tnum">{candidates.length}건</strong>을,
          위의 판별 요인 {top_factors.length}개로 <strong className="font-semibold">현재 시점</strong> 데이터에서 채점했습니다.
          요인 충족 기준은 과거 표본의 &lsquo;유리한 ⅓&rsquo; 경계값. <strong className="tnum font-semibold text-stamp">{screened.length}건</strong>이 3개 이상을 충족합니다.
          주의 — 과거 통계는 발간 시점 기준이고 이 채점은 오늘 기준이라 시점이 다르며, 이것은 추천이 아니라 스크리닝입니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {top_factors.map((f, i) => (
            <span key={f.key} className="rounded-md border border-border bg-card px-2.5 py-1 font-mono text-[11px]">
              <span className="font-bold text-stamp">{i + 1}. {FACTOR_SHORT_LABELS[f.key] ?? f.key}</span>{" "}
              <span className="text-muted-foreground">
                {f.label} {f.cond === ">=" ? "≥" : "≤"} {f.threshold}{f.unit === "배" ? "배" : f.unit}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-4">
          <CandidatesTable candidates={candidates} factors={top_factors} />
        </div>
      </section>

      {/* ── ⑤ 학회 합의 — 둘이 보면 다른가 (v25) ── */}
      {consensus && consensus.groups.length > 0 && (
        <section aria-label="학회 합의">
          <h2 className="border-b-2 border-foreground/60 pb-1.5 font-display text-2xl font-black tracking-tight">⑤ 학회 합의 — 둘이 보면 다른가</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            발간일 직전 <strong className="font-semibold">{consensus.window_days}일</strong> 안에 같은 종목을 커버한
            학회 수(본인 포함)별로 결과를 비교했습니다. 베이스레이트 {consensus.base_rate_pct}% 대비
            합의 커버가 배거 확률을 끌어올렸는지 — 리포트 {consensus.n_reports.toLocaleString()}건 기준.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {consensus.groups.map((g) => (
              <div key={g.label} className={cn("rounded-lg border p-4", (g.lift ?? 0) > 1.1 ? "border-stamp/50 bg-stamp/5" : "border-border bg-card")}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{g.label} · n={g.n}</p>
                <p className="tnum mt-1 font-display text-3xl font-black">
                  {g.success_pct != null ? `${g.success_pct}%` : "—"}
                  <span className={cn("ml-2 align-middle font-mono text-sm font-bold", (g.lift ?? 0) > 1 ? "text-up" : "text-muted-foreground")}>
                    {g.lift != null ? `${g.lift.toFixed(2)}×` : ""}
                  </span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  더블 이상 비율 · 피크 중앙값 {g.median_peak_pct != null ? `+${g.median_peak_pct}%` : "—"} ·
                  현재 중앙값 {g.median_latest_pct != null ? `${g.median_latest_pct > 0 ? "+" : ""}${g.median_latest_pct}%` : "—"}
                </p>
              </div>
            ))}
          </div>
          {consensus.episodes.length > 0 && (
            <details className="group mt-4 rounded-lg border border-border bg-card">
              <summary className="cursor-pointer select-none list-none p-4 font-display text-sm font-bold [&::-webkit-details-marker]:hidden">
                최근 합의 에피소드 {consensus.episodes.length}건 보기
                <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">(2개+ 학회가 90일 내 같은 종목)</span>
              </summary>
              <div className="overflow-x-auto border-t border-border p-4">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-foreground/60 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5 text-left">발간일</th>
                      <th className="px-2 py-1.5 text-left">종목</th>
                      <th className="px-2 py-1.5 text-left">학회</th>
                      <th className="px-2 py-1.5 text-right">합의 수</th>
                      <th className="px-2 py-1.5 text-right">피크</th>
                      <th className="px-2 py-1.5 text-right">현재</th>
                      <th className="px-2 py-1.5 text-left">등급</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consensus.episodes.map((e) => (
                      <tr key={`${e.report_date}-${e.ticker}-${e.school}`} className="border-b border-dashed border-border/80 last:border-b-0">
                        <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">{e.report_date}</td>
                        <td className="px-2 py-1.5">
                          <Link href={`/stocks/${e.slug}`} className="font-medium hover:underline">{e.name}</Link>
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[10px] uppercase text-muted-foreground">{e.school}</td>
                        <td className="tnum px-2 py-1.5 text-right font-mono text-xs font-bold">{e.n_schools}</td>
                        <td className={cn("tnum px-2 py-1.5 text-right font-mono text-xs", (e.peak_pct ?? 0) >= 100 ? "text-stamp font-bold" : (e.peak_pct ?? 0) > 0 ? "text-up" : "text-down")}>
                          {e.peak_pct != null ? `${e.peak_pct > 0 ? "+" : ""}${e.peak_pct}%` : "—"}
                        </td>
                        <td className={cn("tnum px-2 py-1.5 text-right font-mono text-xs", (e.latest_pct ?? 0) > 0 ? "text-up" : "text-down")}>
                          {e.latest_pct != null ? `${e.latest_pct > 0 ? "+" : ""}${e.latest_pct}%` : "—"}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{TIER_KO[e.tier] ?? e.tier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <p className="mt-2 font-mono text-[10px] leading-4 text-muted-foreground">{consensus.note}</p>
        </section>
      )}

      {/* ── 정직 고지 ── */}
      <section aria-label="정직 고지" className="rounded-lg border border-border bg-secondary/30 p-5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">정직 고지 — 이 통계가 말하지 않는 것</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-foreground/75">
          <li>
            <strong className="font-semibold">표본 크기.</strong> 텐배거는 {universe.n_by_tier["Tenbagger"] ?? 0}건, 멀티배거는 {universe.n_by_tier["Multibagger"] ?? 0}건뿐입니다.
            리프트는 더블 이상({TIER_KO.Double}·{TIER_KO.Multibagger}·{TIER_KO.Tenbagger} 합산)을 묶어 계산했지만, 구간당 표본이 100여 건이라 ±5%p 수준의 오차가 있습니다.
          </li>
          <li>
            <strong className="font-semibold">생존편향.</strong> 표본은 학회가 &lsquo;쓰기로 결정한&rsquo; 종목뿐입니다. 같은 관상을 하고도 리포트가 안 나온 종목들의 운명은 모릅니다.
          </li>
          <li>
            <strong className="font-semibold">상관이지 인과가 아닙니다.</strong> 리프트도 회귀계수도 in-sample 요약 통계이며, 표본 외 예측력 검증을 하지 않았습니다.
          </li>
          <li>
            <strong className="font-semibold">피처 결측.</strong> {universe.coverage_caveat} 따라서 시세 피처 표본은 재커버 종목 쪽으로 기울어 있습니다.
          </li>
          <li>
            <strong className="font-semibold">성공의 정의.</strong> &lsquo;더블 이상&rsquo;은 발간 후 24개월 내 <em>최고가</em> 기준입니다. 그 수익이 지금까지 남아 있다는 뜻이 아닙니다.
          </li>
          <li>
            <strong className="font-semibold">스크리닝의 시점 차이.</strong> 과거 요인은 발간 시점, 후보 채점은 현재 시점({data.as_of} 기준 시세) — 같은 잣대가 아닙니다.
            투자 판단의 근거가 아니라 기록 보관소의 통계 놀음으로 읽어 주세요.
          </li>
        </ol>
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">
          생성 {data.generated_at} · 기준일 {data.as_of} · {universe.criteria}
        </p>
      </section>
    </main>
  );
}
