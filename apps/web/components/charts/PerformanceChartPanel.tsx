import { SeriesToggleChart } from '@/components/charts/SeriesToggleChart';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';

export function PerformanceChartPanel({
  series,
  benchmarkCount,
  accountCount,
  objectiveLabel = '목표: MDD 15% 이하 · KOSPI 초과',
}: {
  series: ReturnSeries[];
  benchmarkCount: number;
  accountCount: number;
  objectiveLabel?: string;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3 md:p-4">
      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">Portfolio vs Benchmarks</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">벤치마크 대비 누적 성과</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{objectiveLabel}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs lg:justify-end">
          <span className="snapshot-pill">벤치마크 {benchmarkCount.toLocaleString('ko-KR')}</span>
          <span className="snapshot-pill">계좌 원장 {accountCount.toLocaleString('ko-KR')}</span>
        </div>
      </div>
      <SeriesToggleChart series={series} />
    </article>
  );
}
