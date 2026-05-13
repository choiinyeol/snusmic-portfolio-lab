import { SeriesToggleChart } from '@/components/charts/SeriesToggleChart';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';

export function PerformanceChartPanel({
  series,
  benchmarkCount,
  strategyCount,
  objectiveLabel = '목표: MDD 15% 이하 · KOSPI 초과',
}: {
  series: ReturnSeries[];
  benchmarkCount: number;
  strategyCount: number;
  objectiveLabel?: string;
}) {
  return (
    <article className="lab-panel p-3 md:p-4">
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <span className="snapshot-pill">벤치마크 {benchmarkCount.toLocaleString('ko-KR')}</span>
        <span className="snapshot-pill">고유 전략 {strategyCount.toLocaleString('ko-KR')}</span>
        <span className="snapshot-pill">{objectiveLabel}</span>
      </div>
      <SeriesToggleChart series={series} />
    </article>
  );
}
