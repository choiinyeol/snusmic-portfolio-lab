import Link from 'next/link';
import type { ReportBoardRow } from '@/components/report-board/report-board-table';
import { ReportsTable } from '@/components/reports/ReportsTable';
import { compactTicker, stockDisplayName } from '@/components/trading/helpers';
import { MetricStrip } from '@/components/shell/MetricStrip';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/ui/Section';
import { formatDateKo, formatPercent } from '@/lib/format';
import type { ReportBoardViewModel } from '@/lib/view-models/report-board';

export function ReportBoardScreen({ model }: { model: ReportBoardViewModel }) {
  return (
    <div className="grid gap-5">
      <PageHeader
        actions={
          <Button asChild size="sm" variant="secondary">
            <Link href="/statistics">성과 통계</Link>
          </Button>
        }
        header={model.header}
        metrics={<MetricStrip metrics={model.metrics} />}
      />
      {model.warnings.length ? (
        <section className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-semibold">데이터 진단</div>
          <ul className="grid gap-1 text-xs leading-5">
            {model.warnings.map((warning) => (
              <li key={warning.id}>{warning.message}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <Section
        title="검토 큐"
        caption="후보를 먼저 열고, 웹에서 빠졌거나 전사 품질 확인이 필요한 리포트는 오른쪽 진단 큐에서 확인합니다."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="grid gap-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">오늘 볼 후보</h2>
                <p className="mt-1 text-xs text-slate-500">
                  정렬 기준 상위 후보입니다. 전체 표본은 아래 테이블에서 봅니다.
                </p>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {model.priorityRows.length.toLocaleString('ko-KR')}개
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {model.priorityRows.map((row) => (
                <PriorityCandidateCard key={row.symbol} row={row} />
              ))}
            </div>
          </div>

          <aside className="grid content-start gap-3 rounded-md border border-slate-200 bg-white p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">진단 우선순위</h2>
                <p className="mt-1 text-xs text-slate-500">표본 밖 리포트와 전사 재검토 항목입니다.</p>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {model.diagnostics.length.toLocaleString('ko-KR')}개
              </span>
            </div>
            {model.diagnostics.length ? (
              <div className="grid gap-2">
                {model.diagnostics.map((item) => (
                  <DiagnosticCard item={item} key={item.id} />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                추가 진단 항목이 없습니다.
              </div>
            )}
          </aside>
        </div>
      </Section>

      <Section
        title="리포트 테이블"
        caption="전체 리포트를 한 기준으로 두고, 현재 수익률·진행률·가격 경로를 같은 줄에서 비교합니다."
      >
        <ReportsTable
          marketRows={model.candidateRows}
          reports={model.reportTable.sourceRows}
          viewRows={model.reportTable.rows}
        />
      </Section>
    </div>
  );
}

function DiagnosticCard({ item }: { item: ReportBoardViewModel['diagnostics'][number] }) {
  const content = (
    <>
      <div className="font-medium text-slate-950">{stockDisplayName(item.symbol, item.company)}</div>
      <div className="mt-0.5 font-mono text-xs text-slate-500">
        {compactTicker(item.symbol)} · {item.date ? formatDateKo(item.date) : '-'}
      </div>
    </>
  );

  return (
    <div className="grid gap-2 rounded-md border border-slate-100 bg-slate-50/60 p-2.5 text-xs">
      <div className="flex items-start justify-between gap-3">
        {item.href ? (
          <Link className="min-w-0 hover:text-blue-600" href={item.href}>
            {content}
          </Link>
        ) : (
          <div className="min-w-0">{content}</div>
        )}
        <span className="shrink-0 whitespace-nowrap text-amber-700">{item.status}</span>
      </div>
      <div className="grid gap-1 leading-5 text-slate-600">
        <div>
          <span className="font-medium text-slate-500">원인 </span>
          <span className="font-mono">{item.reason}</span>
        </div>
        <div>
          <span className="font-medium text-slate-500">조치 </span>
          {item.action}
        </div>
      </div>
    </div>
  );
}
function PriorityCandidateCard({ row }: { row: ReportBoardRow }) {
  const href = `/reports/${encodeURIComponent(row.symbol)}/${encodeURIComponent(row.latestReportId)}`;
  const displayName = stockDisplayName(row.symbol, row.company);
  const ticker = compactTicker(row.symbol);
  return (
    <Link
      className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50"
      href={href}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-950">{displayName}</div>
        <div className="mt-0.5 font-mono text-xs text-slate-500">
          {displayName !== ticker ? `${ticker} · ` : ''}
          {formatDateKo(row.latestReportDate)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <SignalValue
          label="현재 수익률"
          tone={(row.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}
          value={formatPercent(row.currentReturn)}
        />
        <SignalValue label="목표 근접" tone="neutral" value={formatPercent(row.targetRemainingPct)} />
      </div>
      <p className="line-clamp-2 text-xs leading-5 text-slate-500">
        {row.rankBasis || '후보 점수 기준 상위 종목입니다.'}
      </p>
    </Link>
  );
}

function SignalValue({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }) {
  const toneClass = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-slate-950';
  return (
    <div className="min-w-0">
      <div className="truncate text-slate-500">{label}</div>
      <div className={`truncate font-mono font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
