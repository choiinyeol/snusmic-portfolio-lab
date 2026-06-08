import Link from 'next/link';
import { ReportsTable } from '@/components/reports/ReportsTable';
import { Button } from '@/components/ui/button';
import { MetricStrip } from '@/components/ui/MetricStrip';
import { PageHeader } from '@/components/ui/PageHeader';
import { Section } from '@/components/ui/Section';
import type { ReportBoardViewModel } from '@/lib/view-models/report-board';

export function ReportBoardScreen({ model }: { model: ReportBoardViewModel }) {
  return (
    <div className="grid gap-5">
      <PageHeader
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/statistics">성과 통계</Link>
          </Button>
        }
        header={model.header}
        metrics={<MetricStrip metrics={model.metrics} />}
      />

      <Section
        title="리포트 테이블"
        caption="공개 리포트를 한 기준으로 비교합니다. 먼저 볼 후보는 같은 표 안에서 정렬과 필터로 좁힙니다."
        actions={
          <div className="font-mono text-xs text-slate-400">
            후보 {model.priorityRows.length.toLocaleString('ko-KR')}건 · 전체{' '}
            {model.reportTable.rows.length.toLocaleString('ko-KR')}건
          </div>
        }
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
