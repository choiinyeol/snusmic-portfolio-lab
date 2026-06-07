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
      {model.diagnostics.length ? (
        <Section title="진단 우선순위" caption="웹에서 빠졌거나 전사 품질 확인이 필요한 리포트만 압축했습니다.">
          <div className="mt-3 overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">상태</th>
                  <th className="px-3 py-2 font-medium">리포트</th>
                  <th className="px-3 py-2 font-medium">원인</th>
                  <th className="px-3 py-2 font-medium">조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {model.diagnostics.map((item) => {
                  const content = (
                    <>
                      <div className="font-medium text-slate-950">{stockDisplayName(item.symbol, item.company)}</div>
                      <div className="font-mono text-slate-500">
                        {compactTicker(item.symbol)} · {item.date ? formatDateKo(item.date) : '-'}
                      </div>
                    </>
                  );
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-amber-700">{item.status}</td>
                      <td className="px-3 py-2">
                        {item.href ? (
                          <Link className="block hover:text-blue-600" href={item.href}>
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-600">{item.reason}</td>
                      <td className="px-3 py-2 leading-5 text-slate-600">{item.action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section
        title="오늘 볼 후보"
        caption="지금 먼저 볼 종목만 압축해서 보여줍니다. 전체 표본은 아래 테이블에서 정렬과 컬럼 모드로 확인합니다."
      >
        <div className="mt-3 grid gap-3 xl:grid-cols-5">
          {model.priorityRows.map((row) => (
            <PriorityCandidateCard key={row.symbol} row={row} />
          ))}
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
