import Link from 'next/link';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { StrategySummary } from '@/components/strategies/StrategySummary';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getEquityDaily, getParameterImportance, getPersonaLabel, getStrategyExperiment, getStrategyRuns } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';

export default function StrategiesPage() {
  const data = getStrategyRuns();
  const importance = getParameterImportance();
  const bestRun = data.runs.find((run) => run.run_id === data.best_run_id) ?? data.runs[0];
  const chartSeries = buildStrategySeries(data.runs.slice(0, 3));
  const riskNote = bestRun ? strategyRiskNote(bestRun.metrics.max_drawdown ?? bestRun.metrics.maxDrawdown) : '내보낸 전략이 없습니다.';
  const disclaimer = normalizeStrategyDisclaimer(data.disclaimer);

  return (
    <>
      <PageHero
        eyebrow="STRATEGIES"
        title="전략 백테스트"
        subtitle={disclaimer}
        badges={[
          { label: '후보', value: data.runs.length },
          { label: '스터디', value: data.study_name ?? '—' },
          { label: '범위', value: data.scope ?? bestRun?.scope ?? 'local' },
        ]}
        actions={
          <>
            <Link className="btn btn-sm btn-primary" href={bestRun ? `/strategies/${bestRun.run_id}` : '/strategies'}>최고 후보</Link>
            <a className="btn btn-sm btn-outline" href="#strategy-board">리더보드</a>
          </>
        }
        kpis={
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <KpiTile label="최고 후보" value={bestRun?.label ?? '—'} delta={bestRun ? `score ${formatPercent(bestRun.metrics.score)}` : '없음'} tone="good" />
            <KpiTile label="최고 후보 MDD" value={formatPercent(typeof bestRun?.metrics.max_drawdown === 'number' ? bestRun.metrics.max_drawdown : null)} delta={riskNote} tone={(typeof bestRun?.metrics.max_drawdown === 'number' && bestRun.metrics.max_drawdown < -0.25) ? 'warn' : 'neutral'} />
          </div>
        }
      />

      <Section eyebrow="Curve" title="전략별 누적 수익률 비교">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body p-3 md:p-4">
            <CumulativeReturnChart series={chartSeries} />
          </div>
        </article>
      </Section>

      {importance.parameters?.length ? (
        <Section eyebrow="Sensitivity" title="파라미터 중요도">
          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-3 p-5">
              {importance.parameters.slice(0, 8).map((item) => (
                <div className="grid gap-2 md:grid-cols-[minmax(120px,.35fr)_minmax(0,1fr)_auto] md:items-center" key={item.parameter}>
                  <span className="font-mono text-sm text-base-content/65">{item.parameter}</span>
                  <progress className="progress progress-primary" value={Math.max(0.01, item.importance)} max={1} />
                  <strong className="tabular-nums">{formatPercent(item.importance)}</strong>
                </div>
              ))}
            </div>
          </article>
        </Section>
      ) : null}

      <Section eyebrow="Leaderboard" title="전략 후보" id="strategy-board">
        <div className="grid gap-4 lg:grid-cols-2">
          {data.runs.length ? data.runs.map((run) => (
            <StrategySummary key={run.run_id} run={run} href={`/strategies/${run.run_id}`} />
          )) : (
            <div className="rounded-box border border-base-300 bg-base-100 p-5 text-sm text-base-content/65 shadow-sm">
              전략 아티팩트가 없습니다. 로컬 탐색/내보내기 스크립트를 실행한 뒤 JSON을 public artifacts에 복사하세요.
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

function normalizeStrategyDisclaimer(value?: string | null): string {
  if (!value) return '전략 탐색 결과는 사전에 계산된 정적 스냅샷입니다.';
  if (/local-only|optuna|artifact/i.test(value)) {
    return '전략 탐색 결과는 사전에 계산된 정적 스냅샷입니다.';
  }
  return value;
}

function strategyRiskNote(value: unknown): string {
  const drawdown = typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (drawdown === null) return 'MDD 데이터가 없어 상세 후보에서 리스크를 별도로 확인해야 합니다.';
  if (drawdown < -0.25) return `최고 후보도 MDD ${formatPercent(drawdown)}로 낙폭 점검이 필요합니다.`;
  return `최고 후보 MDD ${formatPercent(drawdown)} 수준으로 낙폭이 비교적 제한적입니다.`;
}

function buildStrategySeries(runs: ReturnType<typeof getStrategyRuns>['runs']): ReturnSeries[] {
  const palette = ['#1b64da', '#16a368', '#7d6bff', '#f29423', '#ef4452', '#00a99a'];
  const baselinePersonas = ['smic_follower', 'smic_follower_v2', 'all_weather'];
  const equity = getEquityDaily();
  const series: ReturnSeries[] = baselinePersonas.map((persona, index) => ({
    id: persona,
    label: getPersonaLabel(persona),
    color: palette[index],
    points: equity
      .filter((point) => point.persona === persona && point.cumulativeReturn !== null)
      .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
  }));
  return [
    ...series,
    ...runs.map((run, index) => ({
      id: run.run_id,
      label: run.label,
      color: palette[(index + baselinePersonas.length) % palette.length],
      points: getStrategyExperiment(run).cumulativeReturnSeries,
    })),
  ];
}
