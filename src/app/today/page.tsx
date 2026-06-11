import { promises as fs } from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { dateLabel, getDisplayName, reportDataset, SCHOOL_LABELS } from "@/lib/report-model";
import { isBuy, schoolShort, signColor, tickerSlug } from "@/lib/verdict";
import { cn, formatPct, formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "오늘의 판결 신문 — 판결 아카이브",
  description: "매일 데이터에서 자동 조판되는 1면 — 전략 신호·시세표·부고·신착 리포트",
};

/* ── 신호 API 정적 파일 타입 (public/api/v1) ─────────────────────────────── */

type TriggerReport = { school: string; report_date: string };
type Position = {
  ticker: string;
  market: string;
  name: string;
  entry_date: string;
  entry_price: number | null;
  current_price: number | null;
  stop_level: number | null;
  unrealized_pct: number | null;
  days_held: number | null;
  entry_reason: string;
  trigger_reports: TriggerReport[];
};
type BuySignal = {
  ticker: string;
  market: string;
  name: string;
  signal_date: string;
  entry_basis_price: number | null;
  entry_reason: string;
};
type SellSignal = { ticker: string; market: string; name: string; reason: string; stop_level: number | null; dist_to_stop_pct: number | null };
type SignalsPayload = {
  as_of: string;
  headline_strategy: string;
  regime: { state: string; kospi_close: number | null; kospi_ma200: number | null };
  slots: { max_positions?: number; open?: number; available?: number };
  open_positions: Position[];
  buy_signals: BuySignal[];
  sell_signals: SellSignal[];
};
type Trade = {
  ticker: string;
  market: string;
  name: string;
  entry_date: string;
  exit_date: string;
  entry_price: number | null;
  exit_price: number | null;
  return_pct: number | null;
  days: number | null;
  exit_reason: string;
};

async function loadSignals(): Promise<SignalsPayload | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "api", "v1", "signals", "latest.json"), "utf-8");
    return JSON.parse(raw) as SignalsPayload;
  } catch {
    return null;
  }
}

async function loadTrades(strategyKey: string): Promise<{ trades: Trade[] } | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "api", "v1", "trades", `${strategyKey}.json`), "utf-8");
    return JSON.parse(raw) as { trades: Trade[] };
  } catch {
    return null;
  }
}

/* ── 모자이크 잉크 — 증거의 서가(verdict-wall)와 같은 색 관습 ───────────── */
const MOSAIC_CLASS: Record<string, string> = {
  Tenbagger: "wall-prism",
  Multibagger: "wall-gold",
  Double: "bg-[#8f0c22] dark:bg-[#ff4a63]",
  Winner: "bg-[#c42848] dark:bg-[#ef6479]",
  Positive: "bg-[#eaa3b0] dark:bg-[#a85f6d]",
  Drawdown: "bg-[#a9c2ec] dark:bg-[#5d7cb8]",
  Wrecked: "bg-[#1c46a8] dark:bg-[#5e86e8]",
  "No quote": "bg-[#d6cfc0] dark:bg-[#3e3e39]",
};

function BoxTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-y-2 border-foreground py-1 text-center font-display text-sm font-black tracking-[0.3em] [text-indent:0.3em]">
      {children}
    </h2>
  );
}

export default async function TodayPage() {
  const signals = await loadSignals();
  const headlineKey = signals?.headline_strategy ?? "";
  const tradesFile = headlineKey ? await loadTrades(headlineKey) : null;

  const asOf = signals?.as_of ?? reportDataset.as_of;
  const opens = signals?.open_positions ?? [];
  const buys = signals?.buy_signals ?? [];
  const sells = signals?.sell_signals ?? [];
  const regime = signals?.regime;

  // 1면 머리기사 — 보유 종목 중 가장 크게 움직인 자리
  const lead = opens.length
    ? [...opens].sort((a, b) => Math.abs(b.unrealized_pct ?? 0) - Math.abs(a.unrealized_pct ?? 0))[0]
    : null;
  const leadSchools = lead ? [...new Set(lead.trigger_reports.map((t) => t.school))] : [];
  const leadSlug = lead ? `${lead.market || "KR"}-${lead.ticker}`.toLowerCase() : null;

  // 부고 — 최근 45일 내 스탑 청산
  const cutoff = new Date(new Date(`${asOf}T00:00:00Z`).getTime() - 45 * 86_400_000).toISOString().slice(0, 10);
  const obituaries = (tradesFile?.trades ?? [])
    .filter((t) => t.exit_date >= cutoff)
    .sort((a, b) => b.exit_date.localeCompare(a.exit_date))
    .slice(0, 6);

  // 신착 리포트 — 발간일 최신순
  const modern = reportDataset.records.filter((r) => r.era === "modern" && r.report_date);
  const freshDesk = [...modern]
    .sort((a, b) => String(b.report_date).localeCompare(String(a.report_date)))
    .slice(0, 6);

  // 모자이크 띠 — 최근 발간 132건의 판결색
  const mosaic = [...modern]
    .sort((a, b) => String(b.report_date).localeCompare(String(a.report_date)))
    .slice(0, 132);

  const issueNo = reportDataset.records.length;
  const weather =
    regime?.state === "ON"
      ? { mark: "☀", text: "맑음 — KOSPI 200일선 위" }
      : { mark: "☂", text: "흐림 — KOSPI 200일선 아래" };

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-8">
      <div className="print:hidden">
        <SiteHeader eyebrow="Daily Verdict Front Page" />
      </div>

      {/* ── 제호(마스트헤드) ─────────────────────────────────────────────── */}
      <header className="mt-6 border-b-4 border-double border-foreground pb-3 text-center">
        <div className="flex items-baseline justify-between font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px]">
          <span>통권 {issueNo.toLocaleString("ko-KR")}호</span>
          <span>매 거래일 자동 조판</span>
          <span aria-label="오늘의 장세">
            {weather.mark} {weather.text}
          </span>
        </div>
        <h1 className="mt-2 font-display text-6xl font-black tracking-tight sm:text-8xl">판결일보</h1>
        <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.5em] text-muted-foreground [text-indent:0.5em]">
          The Verdict Daily
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-foreground/60 pt-2 font-mono text-[11px] font-semibold text-muted-foreground">
          <span>{dateLabel(asOf)} ({["일", "월", "화", "수", "목", "금", "토"][new Date(`${asOf}T00:00:00Z`).getUTCDay()]})</span>
          <span className="hidden sm:inline">학생 리서치 판결 아카이브 발행</span>
          <span>전략 {headlineKey || "—"}</span>
        </div>
      </header>

      {/* ── 본면: 머리기사(좌) + 시세표·부고·신착(우) ───────────────────── */}
      <div className="mt-6 grid gap-8 lg:grid-cols-12">
        {/* 머리기사 */}
        <article className="lg:col-span-8 lg:border-r lg:border-foreground/40 lg:pr-8">
          {lead ? (
            <>
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-stamp">1면 머리기사</p>
              <h2 className="mt-2 font-display text-3xl font-black leading-tight tracking-tight sm:text-5xl">
                {lead.name}, 보유 {lead.days_held ?? "—"}일 만에{" "}
                <span className={signColor(lead.unrealized_pct)}>{formatPct(lead.unrealized_pct)}</span>
              </h2>
              <p className="mt-3 border-l-2 border-foreground/50 pl-3 text-base font-medium leading-7 text-muted-foreground">
                {leadSchools.length > 1
                  ? `${leadSchools.map((s) => schoolShort[s as keyof typeof schoolShort] ?? s).join(" · ")} — ${leadSchools.length}개 학회가 먼저 짚었던 종목이 전략 랩 포트폴리오의 간판이 됐다.`
                  : `${leadSchools.map((s) => schoolShort[s as keyof typeof schoolShort] ?? s).join("")}의 매수 리포트 한 장이 만든 자리다.`}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
                {[
                  { label: "진입가", value: formatPrice(lead.entry_price, lead.market) },
                  { label: "현재가", value: formatPrice(lead.current_price, lead.market) },
                  { label: "추적 스탑", value: formatPrice(lead.stop_level, lead.market) },
                  { label: "진입일", value: dateLabel(lead.entry_date) },
                ].map((s) => (
                  <div key={s.label} className="bg-card px-3 py-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{s.label}</p>
                    <p className="mt-0.5 font-mono text-sm font-bold tnum">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-4 text-[15px] leading-8 [&>p:first-child]:first-letter:float-left [&>p:first-child]:first-letter:mr-2 [&>p:first-child]:first-letter:font-display [&>p:first-child]:first-letter:text-5xl [&>p:first-child]:first-letter:font-black [&>p:first-child]:first-letter:leading-none">
                <p>
                  {dateLabel(lead.entry_date)} {formatPrice(lead.entry_price, lead.market)}에 진입한 {lead.name}
                  {lead.market === "US" ? "" : ` (${lead.ticker})`}은 {dateLabel(asOf)} 현재{" "}
                  {formatPrice(lead.current_price, lead.market)} — 수익률 {formatPct(lead.unrealized_pct)}를 기록 중이다.
                  이 자리는 사람이 고른 것이 아니라, 학회 매수 리포트 발간을 신호로 익일 시가에 기계적으로 진입하는
                  백테스트 규칙이 만들었다.
                </p>
                <p>
                  청산 규칙도 기계적이다. 추적 스탑(샹들리에)은 현재 {formatPrice(lead.stop_level, lead.market)}에 걸려
                  있고, 종가가 그 아래로 내려오면 다음 거래일 시가에 미련 없이 판다. 목표가도, 뉴스도, 회의도 없다 —
                  규칙이 곧 판결이다.
                </p>
                {leadSchools.length > 0 && (
                  <p>
                    근거 서류는 {lead.trigger_reports
                      .slice(0, 4)
                      .map((t) => `${SCHOOL_LABELS[t.school as keyof typeof SCHOOL_LABELS] ?? t.school} (${dateLabel(t.report_date)})`)
                      .join(", ")}
                    의 매수 리포트{lead.trigger_reports.length > 4 ? ` 외 ${lead.trigger_reports.length - 4}건` : ""}.
                    {leadSlug && (
                      <>
                        {" "}전체 기록은{" "}
                        <Link href={`/stocks/${leadSlug}`} className="font-bold underline decoration-stamp decoration-2 underline-offset-2">
                          종목 판결 페이지
                        </Link>
                        에서 차트 위 매매 지점과 함께 볼 수 있다.
                      </>
                    )}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-muted-foreground">오늘은 보유 포지션이 없습니다 — 현금(파킹)이 1면입니다.</p>
          )}

          {/* 2단 기사 — 오늘의 매수 신호 */}
          <div className="mt-8 border-t-2 border-foreground/70 pt-4">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground">오늘의 매수 신호</p>
            {buys.length ? (
              <ul className="mt-3 space-y-3">
                {buys.map((b) => (
                  <li key={b.ticker}>
                    <h3 className="font-display text-xl font-black tracking-tight">
                      「{b.name}」 — 새 신호가 울렸다
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {dateLabel(b.signal_date)} 신호 · 기준가 {formatPrice(b.entry_basis_price, b.market)} · {b.entry_reason}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">오늘은 새 매수 신호가 없다. 신문은 침묵도 기록한다.</p>
            )}
          </div>
        </article>

        {/* 우측 칼럼 — 시세표 · 부고 · 신착 */}
        <aside className="space-y-7 lg:col-span-4">
          {/* 시세표 */}
          <section aria-label="오늘의 시세표">
            <BoxTitle>시세표</BoxTitle>
            <p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground">
              신규 매수 {buys.length} · 매도 임박 {sells.length} · 보유 {opens.length}
              {signals?.slots?.max_positions ? ` / ${signals.slots.max_positions}` : ""}
            </p>
            <table className="mt-2 w-full font-mono text-[11px]">
              <thead>
                <tr className="border-b border-foreground/60 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-1 font-semibold">종목</th>
                  <th className="py-1 text-right font-semibold">현재가</th>
                  <th className="py-1 text-right font-semibold">손익</th>
                  <th className="py-1 text-right font-semibold">스탑</th>
                </tr>
              </thead>
              <tbody>
                {[...opens]
                  .sort((a, b) => (b.unrealized_pct ?? 0) - (a.unrealized_pct ?? 0))
                  .map((p) => {
                    const slug = `${p.market || "KR"}-${p.ticker}`.toLowerCase();
                    return (
                      <tr key={p.ticker} className="border-b border-dotted border-border">
                        <td className="py-1.5 pr-1">
                          <Link href={`/stocks/${slug}`} className="font-bold hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-1.5 text-right tnum">{formatPrice(p.current_price, p.market)}</td>
                        <td className={cn("py-1.5 text-right font-bold tnum", signColor(p.unrealized_pct))}>
                          {formatPct(p.unrealized_pct)}
                        </td>
                        <td className="py-1.5 text-right tnum text-muted-foreground">{formatPrice(p.stop_level, p.market)}</td>
                      </tr>
                    );
                  })}
                {!opens.length && (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-muted-foreground">보유 없음 — 전량 파킹 중</td>
                  </tr>
                )}
              </tbody>
            </table>
            {sells.length > 0 && (
              <p className="mt-2 border border-warn/60 bg-[hsl(var(--finance-warning-bg))] px-2 py-1.5 font-mono text-[10px] font-bold text-warn">
                ⚠ 매도 임박: {sells.map((s) => `${s.name} (스탑까지 ${s.dist_to_stop_pct?.toFixed(1) ?? "—"}%)`).join(" · ")}
              </p>
            )}
          </section>

          {/* 부고 — 스탑 청산 */}
          <section aria-label="부고 — 최근 청산">
            <BoxTitle>부고</BoxTitle>
            <p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground">최근 45일 내 스탑 청산 포지션</p>
            {obituaries.length ? (
              <ul className="mt-2 space-y-2 border border-foreground/70 p-3">
                {obituaries.map((t) => (
                  <li key={`${t.ticker}-${t.exit_date}`} className="font-mono text-[11px] leading-5">
                    <span className="font-display font-black">† {t.name}</span>{" "}
                    <span className="text-muted-foreground">
                      {dateLabel(t.exit_date)} 영면 · 향년 {t.days ?? "—"}일 ·{" "}
                    </span>
                    <span className={cn("font-bold", signColor(t.return_pct))}>{formatPct(t.return_pct)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 border border-foreground/40 p-3 text-center font-mono text-[11px] text-muted-foreground">
                최근 45일 부고 없음 — 모두 무탈하다.
              </p>
            )}
          </section>

          {/* 신착 리포트 */}
          <section aria-label="신착 리포트">
            <BoxTitle>신착 리포트</BoxTitle>
            <ul className="mt-2 divide-y divide-dotted divide-border">
              {freshDesk.map((r) => {
                const slug = tickerSlug(r);
                return (
                  <li key={r.source_file} className="py-2 font-mono text-[11px] leading-5">
                    <span className="text-muted-foreground">{dateLabel(r.report_date)}</span>{" "}
                    <span className="font-bold text-stamp">{schoolShort[r.school]}</span>{" "}
                    {slug ? (
                      <Link href={`/stocks/${slug}`} className="font-bold hover:underline">
                        {getDisplayName(r)}
                      </Link>
                    ) : (
                      <span className="font-bold">{getDisplayName(r)}</span>
                    )}
                    {isBuy(r) && r.target_price !== null && (
                      <span className="text-muted-foreground"> — 목표 {formatPrice(r.target_price, r.market)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      {/* ── 하단 모자이크 띠 — 최근 판결 132건 ──────────────────────────── */}
      <section aria-label="최근 판결 모자이크" className="mt-8 border-t-2 border-foreground/70 pt-3">
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
            최근 판결 {mosaic.length}건 — 짙은 적색일수록 높이 올랐다
          </p>
          <Link href="/" className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] hover:underline print:hidden">
            전체 서가 보기 →
          </Link>
        </div>
        <div className="mt-2 flex flex-wrap gap-[3px]">
          {mosaic.map((r) => {
            const slug = tickerSlug(r);
            const cell = (
              <span
                className={cn("block h-3.5 w-3.5 rounded-[2px]", MOSAIC_CLASS[r.performance_bucket] ?? MOSAIC_CLASS["No quote"])}
                title={`${getDisplayName(r)} · ${dateLabel(r.report_date)} · ${formatPct(r.return_latest_pct)}`}
              />
            );
            return slug ? (
              <Link key={r.source_file} href={`/stocks/${slug}`} className="wall-cell">
                {cell}
              </Link>
            ) : (
              <span key={r.source_file}>{cell}</span>
            );
          })}
        </div>
      </section>

      {/* ── 판권면 ──────────────────────────────────────────────────────── */}
      <footer className="mt-8 border-t-4 border-double border-foreground pt-3 text-center">
        <p className="font-mono text-[10px] leading-5 text-muted-foreground">
          본 신문은 매 거래일 공개 데이터에서 자동 조판됩니다 · 모든 신호는 백테스트 시뮬레이션이며 투자 권유가 아닙니다 ·
          과거 성과는 미래 수익을 보장하지 않습니다
        </p>
        <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">
          The Verdict Daily — printed from data, {dateLabel(asOf)}
        </p>
      </footer>
    </main>
  );
}
