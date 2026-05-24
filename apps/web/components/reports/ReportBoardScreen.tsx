import Link from 'next/link';
import type { ReportBoardRow } from '@/components/report-board/report-board-table';
import { ReportsTable } from '@/components/reports/ReportsTable';
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
  return (
    <Link
      className="grid min-w-0 gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50"
      href={href}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-950">{row.company || row.symbol}</div>
        <div className="mt-0.5 font-mono text-xs text-slate-500">
          {row.symbol} · {formatDateKo(row.latestReportDate)}
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
