import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CumulativeReturnChart } from '@/components/charts/CumulativeReturnChart';
import { StrategyExperimentTables } from '@/components/strategies/StrategyExperimentTables';
import { StrategySummary } from '@/components/strategies/StrategySummary';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getStrategyExperiment, getStrategyRuns } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';

type StrategyParams = Promise<{ runId: string }>;

export function generateStaticParams() {
  return getStrategyRuns().runs.map((run) => ({ runId: run.run_id }));
}

export default async function StrategyDetailPage({ params }: { params: StrategyParams }) {
  const { runId } = await params;
  const data = getStrategyRuns();
  const run = data.runs.find((item) => item.run_id === runId);
  if (!run) notFound();
  const experiment = getStrategyExperiment(run);
  const finalReturn = experiment.cumulativeReturnSeries.at(-1)?.value ?? run.metrics.money_weighted_return ?? null;

  return (
    <>
      <PageHero
        eyebrow="STRATEGY"
        title={run.label}
        subtitle="선택된 리포트 성과에서 재구성한 후보 실험입니다. 전체 브로커 원장 재현이 아닙니다."
        actions={
          <Link className="btn btn-sm btn-ghost" href="/strategies">
            ← 후보 목록
          </Link>
        }
        kpis={
          <div className="grid min-w-0 gap-3 min-[1400px]:grid-cols-2">
            <KpiTile
              label="실험 선택 종목"
              value={experiment.positions.length.toLocaleString('ko-KR')}
              delta={`${experiment.trades.length.toLocaleString('ko-KR')}개 이벤트`}
              tone="accent"
            />
            <KpiTile
              label="실험 누적 수익률"
              value={formatPercent(finalReturn)}
              tone={(finalReturn ?? 0) >= 0 ? 'good' : 'bad'}
            />
          </div>
        }
      />

      <StrategySummary run={run} />

      <Section eyebrow="Curve" title="재구성 누적 수익률 경로">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body p-3 md:p-4">
            <CumulativeReturnChart
              series={[
                { id: run.run_id, label: run.label, color: '#d7ff4f', points: experiment.cumulativeReturnSeries },
              ]}
            />
          </div>
        </article>
      </Section>

      <Section eyebrow="Derived events" title="후보 포트폴리오 · 재구성 이벤트">
        <StrategyExperimentTables runLabel={run.run_id} experiment={experiment} />
      </Section>

      <Section eyebrow="Params" title="파라미터">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body grid gap-3 p-5 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(run.params ?? {}).map(([key, value]) => (
              <div className="rounded-md border border-base-200 bg-base-100 px-3 py-2.5" key={key}>
                <dt className="text-xs font-mono uppercase tracking-[0.14em] text-base-content/55">{key}</dt>
                <dd className="mt-1 font-bold tabular-nums text-base-content">{formatParam(value)}</dd>
              </div>
            ))}
          </div>
        </article>
      </Section>
    </>
  );
}

function formatParam(value: unknown): string {
  if (typeof value === 'number')
    return Math.round(value * 100) / 100 === Math.round(value)
      ? Math.round(value).toLocaleString('ko-KR')
      : (Math.round(value * 100) / 100).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return String(value ?? '—');
}
