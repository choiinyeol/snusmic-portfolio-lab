import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/ui/Money';
import { formatDateKo, formatPercent } from '@/lib/format';
import { getActionQueueViewModel, type ActionQueueAction, type ActionQueueRow } from '@/lib/view-models/action-queue';

export default function OverviewPage() {
  const view = getActionQueueViewModel();
  const rows = view.rows;
  const lead = rows[0] ?? null;
  const buyRows = rows.filter((row) => row.action === 'Buy');
  const sellRows = rows.filter((row) => row.action === 'Sell');
  const watchRows = rows.filter((row) => row.action === 'Watch');

  return (
    <div className="grid gap-4 text-zinc-950">
      <section className="rounded-[28px] border border-zinc-200 bg-[#fbfaf7] p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-[22px] border border-zinc-200 bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-zinc-200 bg-[#f4efe6] px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                    Action Queue desk
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-mono text-[11px] text-zinc-500">
                    no broker order
                  </span>
                </div>
                <h1 className="mt-5 max-w-4xl text-[42px] font-semibold leading-[0.95] tracking-[-0.055em] text-zinc-950 sm:text-[60px]">
                  오늘 할 일은<br className="hidden sm:block" /> 큐에서만 봅니다.
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-zinc-600">
                  리포트, 보유, 실제 거래 기록이 겹친 종목만 올립니다. 가격은 현재가·괴리율·구간을 확인하는 보조 데이터이고, 단독으로 후보를 만들지 않습니다.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/reports">
                    Report Pool <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/portfolio">Portfolio</Link>
                </Button>
              </div>
            </div>

            <div className="mt-8 grid gap-2 sm:grid-cols-4">
              <DeskStat label="Queue rows" value={view.summary.rowCount.toLocaleString('ko-KR')} />
              <DeskStat label="Buy / Sell" value={`${view.summary.buyCount} / ${view.summary.sellCount}`} tone="blue" />
              <DeskStat label="Watch" value={view.summary.watchCount.toLocaleString('ko-KR')} />
              <DeskStat label="Avg confidence" value={view.summary.averageConfidence === null ? '-' : `${Math.round(view.summary.averageConfidence)}%`} tone="amber" />
            </div>
          </div>

          <aside className="grid gap-3 rounded-[22px] border border-zinc-200 bg-zinc-950 p-5 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">source contract</div>
            <ContractLine label="후보 생성" value="trades · holdings · reports" />
            <ContractLine label="가격 역할" value="현재가 · 목표가 괴리 · 구간 검증" />
            <ContractLine label="계좌" value={view.summary.accountLabel} />
            <ContractLine label="금지" value="price-only 후보 · broker order" />
          </aside>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="grid gap-4">
          <ActionColumn title="Buy" rows={buyRows.slice(0, 6)} />
          <ActionColumn title="Sell" rows={sellRows.slice(0, 4)} />
          <ActionColumn title="Watch" rows={watchRows.slice(0, 4)} />
        </div>

        <div className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">primary ticket</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">첫 번째 판단 카드</h2>
            </div>
            {lead ? <Badge variant={actionVariant(lead.action)}>{lead.action}</Badge> : null}
          </div>
          {lead ? <Ticket row={lead} /> : <EmptyQueue />}
        </div>
      </section>

      <section className="rounded-[28px] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">queue ledger</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">전체 Action Queue</h2>
            <p className="mt-1 text-xs text-zinc-500">모든 행은 Ticker, Action, Planned Price, Current Price, Strategy Reason, Report Evidence, Portfolio Impact, Confidence를 카드 안에 표시합니다.</p>
          </div>
          <Badge variant="outline" className="bg-[#fbfaf7] font-mono">
            {rows.length.toLocaleString('ko-KR')} / {view.summary.rowCount.toLocaleString('ko-KR')} visible
          </Badge>
        </div>
        <div className="mt-4 grid gap-2">
          {rows.length ? rows.map((row) => <LedgerCard key={row.ticker} row={row} />) : <EmptyQueue />}
        </div>
      </section>
    </div>
  );
}

function DeskStat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'blue' | 'amber' }) {
  const toneClass = tone === 'blue' ? 'text-blue-700' : tone === 'amber' ? 'text-amber-700' : 'text-zinc-950';
  return (
    <div className="rounded-2xl border border-zinc-200 bg-[#fbfaf7] p-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-400">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function ContractLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-zinc-100">{value}</div>
    </div>
  );
}

function ActionColumn({ title, rows }: { title: ActionQueueAction; rows: ActionQueueRow[] }) {
  return (
    <section className="rounded-[24px] border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between px-1">
        <Badge variant={actionVariant(title)}>{title}</Badge>
        <span className="font-mono text-xs text-zinc-400">{rows.length.toLocaleString('ko-KR')} shown</span>
      </div>
      <div className="grid gap-2">
        {rows.length ? rows.map((row) => <QueueChip key={`${title}-${row.ticker}`} row={row} />) : <div className="rounded-2xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-400">후보 없음</div>}
      </div>
    </section>
  );
}

function QueueChip({ row }: { row: ActionQueueRow }) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-[#fbfaf7] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-zinc-950">{row.ticker}</div>
          <div className="mt-0.5 truncate text-xs text-zinc-500">{row.company}</div>
        </div>
        <div className="font-mono text-sm font-semibold text-zinc-950">{row.confidence}%</div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
        <span>{row.entryExitZone}</span>
        <span>{formatPercent(row.targetGapPct, 1)}</span>
      </div>
    </article>
  );
}

function Ticket({ row }: { row: ActionQueueRow }) {
  return (
    <div className="pt-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div>
          <div className="font-mono text-4xl font-semibold tracking-tight text-zinc-950">{row.ticker}</div>
          <div className="mt-1 text-sm text-zinc-500">{row.company}</div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <TicketField label="Planned Price">
              <Money native={row.plannedPrice} krw={row.plannedPriceKrw} currency={row.currency} bold />
            </TicketField>
            <TicketField label="Current Price">
              <Money native={row.currentPrice} krw={row.currentPriceKrw} currency={row.currency} bold />
            </TicketField>
            <TicketField label="Strategy Reason">{row.strategyReason}</TicketField>
            <TicketField label="Report Evidence">
              {row.reportHref ? <Link href={row.reportHref} className="font-medium text-zinc-950 underline-offset-2 hover:underline">{row.reportEvidence}</Link> : row.reportEvidence}
            </TicketField>
            <TicketField label="Portfolio Impact">{row.portfolioImpact}</TicketField>
            <TicketField label="Validation">{[...row.validationTags, row.entryExitZone].join(' · ')}</TicketField>
          </div>
        </div>
        <div className="rounded-[22px] border border-zinc-200 bg-[#fbfaf7] p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-400">Confidence</div>
          <div className="mt-3 font-mono text-5xl font-semibold tabular-nums text-zinc-950">{row.confidence}%</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full rounded-full bg-zinc-950" style={{ width: `${row.confidence}%` }} />
          </div>
          <div className="mt-4 text-xs leading-5 text-zinc-500">{row.confidenceReasons.join(' · ') || '근거 제한'}</div>
          <div className="mt-4 font-mono text-xs text-zinc-400">px {formatDateKo(row.latestPriceDate)}</div>
        </div>
      </div>
    </div>
  );
}

function TicketField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-[#fbfaf7] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</div>
      <div className="mt-2 text-sm leading-5 text-zinc-700">{children}</div>
    </div>
  );
}

function LedgerCard({ row }: { row: ActionQueueRow }) {
  return (
    <article className="grid gap-2 rounded-2xl border border-zinc-200 bg-[#fbfaf7] p-3 text-xs md:grid-cols-[150px_96px_150px_150px_minmax(180px,1fr)_minmax(200px,1fr)_minmax(160px,0.8fr)_110px]">
      <LedgerField label="Ticker">
        <div className="font-mono text-sm font-semibold text-zinc-950">{row.ticker}</div>
        <div className="mt-0.5 truncate text-zinc-500">{row.company}</div>
      </LedgerField>
      <LedgerField label="Action">
        <Badge variant={actionVariant(row.action)}>{row.action}</Badge>
        <div className="mt-1 text-[11px] text-zinc-500">{row.entryExitZone}</div>
      </LedgerField>
      <LedgerField label="Planned Price" align="right">
        <Money native={row.plannedPrice} krw={row.plannedPriceKrw} currency={row.currency} />
      </LedgerField>
      <LedgerField label="Current Price" align="right">
        <Money native={row.currentPrice} krw={row.currentPriceKrw} currency={row.currency} />
        <div className="mt-1 text-[11px] text-zinc-500">gap {formatPercent(row.targetGapPct, 1)}</div>
      </LedgerField>
      <LedgerField label="Strategy Reason">{row.strategyReason}</LedgerField>
      <LedgerField label="Report Evidence">
        {row.reportHref ? <Link href={row.reportHref} className="font-medium text-zinc-950 underline-offset-2 hover:underline">{row.reportEvidence}</Link> : row.reportEvidence}
      </LedgerField>
      <LedgerField label="Portfolio Impact">{row.portfolioImpact}</LedgerField>
      <LedgerField label="Confidence" align="right">
        <div className="font-mono text-sm font-semibold text-zinc-950">{row.confidence}%</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full rounded-full bg-zinc-950" style={{ width: `${row.confidence}%` }} />
        </div>
      </LedgerField>
    </article>
  );
}

function LedgerField({ label, children, align = 'left' }: { label: string; children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{label}</div>
      <div className="leading-5 text-zinc-700">{children}</div>
    </div>
  );
}

function EmptyQueue() {
  return <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">Action Queue를 만들 수 있는 trades, holdings, reports 근거가 없습니다.</div>;
}

function actionVariant(action: ActionQueueAction): 'success' | 'destructive' | 'secondary' {
  if (action === 'Buy') return 'success';
  if (action === 'Sell') return 'destructive';
  return 'secondary';
}
