import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiTile } from '@/components/ui/KpiTile';
import { Section } from '@/components/ui/Section';
import {
  getQuantStrategySearch,
  getQuantStrategySearchDetail,
  type QuantAllocationEvent,
  type QuantAllocationLeg,
} from '@/lib/artifacts';
import { formatDays, formatKrw, formatPercent } from '@/lib/format';

export function generateStaticParams() {
  return getQuantStrategySearch().details.map((row) => ({ strategy: row.strategyId }));
}

export default async function QuantStrategyDetailPage({ params }: { params: Promise<{ strategy: string }> }) {
  const { strategy } = await params;
  const detail = getQuantStrategySearchDetail(decodeURIComponent(strategy));
  if (!detail) notFound();

  const latestEvents = detail.allocationEvents.slice().reverse();
  const latestEvent = latestEvents[0];

  return (
    <div className="grid gap-5">
      <header className="grid gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">퀀트 메타전략</Badge>
          <Badge variant={detail.robustGoalHit ? 'success' : 'secondary'}>
            {detail.robustGoalHit ? '강건 통과' : detail.goalHit ? 'Sortino 통과' : '후보'}
          </Badge>
          <span className="font-mono text-xs text-slate-500">rank #{detail.rank}</span>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,.8fr)] xl:items-end">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-[-0.02em] text-slate-950 md:text-4xl">
              {detail.strategyId}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              이 화면은 Strategies의 숫자와 Portfolio의 원장을 연결한 퀀트 후보 상세입니다. 실제 개별 종목 체결이
              아니라, 기존 portfolio/benchmark persona를 언제 편입·제외했는지 보여주는 메타 포트폴리오 원장입니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/strategies#quant-search-board">← Top N으로 돌아가기</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/portfolio">포트폴리오 보기</Link>
              </Button>
            </div>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <KpiTile label="Sharpe" value={formatRatio(detail.annualizedSharpe)} delta={formatDays(detail.days)} />
            <KpiTile
              label="Sortino"
              value={formatRatio(detail.annualizedSortinoLpm0)}
              delta={`DS ${formatRatio(detail.annualizedSortinoDownsideStd)}`}
              tone="good"
            />
            <KpiTile label="CAGR" value={formatPercent(detail.cagr)} delta={formatPercent(detail.totalReturn)} />
            <KpiTile label="MDD" value={formatPercent(detail.maxDrawdown)} delta={detail.hitBasis} tone="warn" />
          </div>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,.9fr)_minmax(420px,1.1fr)]">
        <article className="rounded-md border border-slate-200 bg-white p-4">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            current allocation
          </div>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">현재 들고 있는 persona</h2>
            <span className="font-mono text-xs text-slate-500">{formatKrw(detail.latestEquityKrw)}</span>
          </div>
          <AllocationTable allocations={detail.currentAllocations} />
        </article>

        <article className="rounded-md border border-slate-200 bg-white p-4">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            latest rebalance
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">마지막 리밸런싱</h2>
          {latestEvent ? (
            <RebalanceCard event={latestEvent} />
          ) : (
            <p className="mt-3 text-sm text-slate-500">기록 없음</p>
          )}
        </article>
      </section>

      <Section eyebrow="매매 원장" title="최근 편입·제외 로그">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left">날짜</th>
                <th className="px-3 py-2 text-right">평가액</th>
                <th className="px-3 py-2 text-left">매수/편입</th>
                <th className="px-3 py-2 text-left">매도/제외</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {latestEvents.map((event) => (
                <tr key={`${detail.strategyId}-${event.date}-${event.equityKrw}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-500">{event.date}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                    {formatKrw(event.equityKrw)}
                  </td>
                  <td className="min-w-[220px] px-3 py-2">
                    <LegList legs={event.buys} side="buy" />
                  </td>
                  <td className="min-w-[220px] px-3 py-2">
                    <LegList legs={event.sells} side="sell" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section eyebrow="운용 규칙" title="이 후보가 사고파는 방식">
        <div className="grid gap-3 lg:grid-cols-3">
          <RuleCard title="매수/편입" items={detail.buyRules} />
          <RuleCard title="매도/제외" items={detail.sellRules} />
          <RuleCard title="리스크" items={detail.riskControls} />
        </div>
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-950">요약</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{detail.methodologySummary}</p>
          <p className="mt-2 break-words font-mono text-xs leading-5 text-slate-500">{detail.paramsSummary}</p>
        </div>
      </Section>
    </div>
  );
}

function AllocationTable({ allocations }: { allocations: QuantAllocationLeg[] }) {
  if (!allocations.length) return <p className="mt-3 text-sm text-slate-500">현재 편입 persona가 없습니다.</p>;
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-slate-100">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {allocations.map((allocation) => (
            <tr key={allocation.persona}>
              <td className="px-3 py-2">
                <PersonaLink persona={allocation.persona} />
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-slate-950">
                {formatPercent(allocation.weight)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RebalanceCard({ event }: { event: QuantAllocationEvent }) {
  return (
    <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-slate-950">{event.date}</span>
        <span className="font-mono text-xs text-slate-500">{formatKrw(event.equityKrw)}</span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <LegPanel title="편입/증액" legs={event.buys} side="buy" />
        <LegPanel title="제외/감액" legs={event.sells} side="sell" />
      </div>
    </div>
  );
}

function LegPanel({ title, legs, side }: { title: string; legs: QuantAllocationLeg[]; side: 'buy' | 'sell' }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <h3 className="text-xs font-semibold text-slate-500">{title}</h3>
      <div className="mt-2">
        <LegList legs={legs} side={side} />
      </div>
    </div>
  );
}

function LegList({ legs, side }: { legs: QuantAllocationLeg[]; side: 'buy' | 'sell' }) {
  if (!legs.length) return <span className="text-xs text-slate-400">—</span>;
  return (
    <ul className="grid gap-1.5">
      {legs.map((leg) => (
        <li className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" key={`${leg.persona}-${leg.weightDelta}`}>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${side === 'buy' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
          >
            {side === 'buy' ? '+' : ''}
            {formatPercent(leg.weightDelta)}
          </span>
          <PersonaLink persona={leg.persona} />
          <span className="font-mono text-[11px] text-slate-500">→ {formatPercent(leg.weightAfter)}</span>
        </li>
      ))}
    </ul>
  );
}

function PersonaLink({ persona }: { persona: string }) {
  return (
    <Link
      className="truncate text-sm font-semibold text-slate-800 underline-offset-4 hover:text-slate-950 hover:underline"
      href={
        persona.startsWith('benchmark_') ? '/strategies#benchmark-board' : `/portfolio/${encodeURIComponent(persona)}`
      }
      title={`${persona} 원장 보기`}
    >
      {persona}
    </Link>
  );
}

function RuleCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <ul className="mt-2 grid gap-1 text-sm leading-6 text-slate-500">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </article>
  );
}

function formatRatio(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
