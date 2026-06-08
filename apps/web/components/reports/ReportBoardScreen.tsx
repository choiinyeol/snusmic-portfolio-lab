import Link from 'next/link';
import { ReportsTable } from '@/components/reports/ReportsTable';
import { Button } from '@/components/ui/button';
import type { ReportBoardViewModel } from '@/lib/view-models/report-board';

export function ReportBoardScreen({ model }: { model: ReportBoardViewModel }) {
  const latestPublication = model.header.badges?.find((badge) => badge.label === '최신 발간')?.value;
  const priceAsOf = model.header.badges?.find((badge) => badge.label === '가격 기준')?.value;

  return (
    <div className="grid gap-4">
      <section className="grid gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Reports</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">리포트 원장</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              발간 리포트를 같은 가격 기준으로 놓고 현재 수익률, 목표 진행률, 상태를 한 표에서 바로 비교합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/">Board</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/statistics">Statistics</Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-slate-500">
          <span>{priceAsOf ? `price ${priceAsOf}` : 'price -'}</span>
          <span>{latestPublication ? `report ${latestPublication}` : 'report -'}</span>
          <span>후보 {model.candidateRows.length.toLocaleString('ko-KR')}건</span>
          <span>전체 {model.reportTable.rows.length.toLocaleString('ko-KR')}건</span>
        </div>
      </section>

      <ReportsTable rows={model.reportTable.rows} subtitle="현재 가격 기준 전체 리포트 원장" title="리포트 원장" />
    </div>
  );
}
