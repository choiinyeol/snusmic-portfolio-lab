import Link from 'next/link';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { StrategySummary } from '@/components/strategies/StrategySummary';
import { KpiTile } from '@/components/ui/KpiTile';
import { Section } from '@/components/ui/Section';
import { Panel } from '@/components/ui/Terminal';
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
      <section className="hero rounded-box border border-base-300 bg-base-100 shadow-sm">
        <div className="hero-content grid w-full max-w-none gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(340px,.75fr)] md:p-8">
          <div className="grid content-center gap-4">
            <span className="badge badge-primary badge-soft w-fit tracking-[0.16em]">STRATEGY VALIDATION</span>
            <h1 className="display-1">전략은 수익률보다 신뢰도를 먼저 봅니다.</h1>
            <p className="max-w-3xl text-lg leading-8 text-base-content/70">
              {disclaimer} 파라미터는 0.01 단위로 실험하고, 화면에는 핵심 지표만 두 자리까지 요약합니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link className="btn btn-primary" href={bestRun ? `/strategies/${bestRun.run_id}` : '/strategies'}>최고 후보 검토</Link>
              <a className="btn btn-outline" href="#strategy-board">리더보드 보기</a>
            </div>
          </div>
          <div className="alert alert-soft border-base-300 bg-base-200/70">
            <div>
              <h3 className="font-bold">해석 원칙</h3>
              <p className="text-sm leading-6">백테스트는 투자 추천이 아니라 리서치 규칙의 사후 검증입니다. 최종 수익률, MDD, 파라미터 민감도를 함께 봅니다.</p>
              <p className="mt-2 text-sm font-semibold text-base-content/70">{riskNote}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-4">
        <KpiTile label="전략 후보" value={data.runs.length.toLocaleString('ko-KR')} tone="accent" />
        <KpiTile label="최고 후보" value={bestRun?.label ?? '—'} delta={bestRun ? `score ${formatPercent(bestRun.metrics.score)}` : '내보낸 전략 없음'} tone="good" />
        <KpiTile label="스터디" value={data.study_name ?? '—'} />
        <KpiTile label="범위" value={data.scope ?? bestRun?.scope ?? 'local'} />
      </section>

      <Section eyebrow="Curve" title="전략별 누적 수익률 비교" caption="기준 전략의 실제 일별 자본 대비 수익률과 상위 실험 후보의 이벤트 기반 실험 경로를 함께 비교합니다.">
        <Panel>
          <CumulativeReturnChart series={chartSeries} />
        </Panel>
      </Section>

      {importance.parameters?.length ? (
        <Section eyebrow="Sensitivity" title="파라미터 중요도" caption="성과를 많이 움직인 파라미터를 먼저 보되, 과최적화 가능성을 함께 고려합니다.">
          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-3 p-5">
              {importance.parameters.slice(0, 8).map((item) => (
                <div className="grid gap-2 md:grid-cols-[minmax(120px,.35fr)_minmax(0,1fr)_auto] md:items-center" key={item.parameter}>
                  <span className="font-mono text-sm text-base-content/65">{item.parameter}</span>
                  <progress className="progress progress-primary" value={Math.max(0.01, item.importance)} max={1} />
                  <strong>{formatPercent(item.importance)}</strong>
                </div>
              ))}
            </div>
          </article>
        </Section>
      ) : null}

      <Section eyebrow="Leaderboard" title="전략 후보 목록" caption="각 후보의 성과와 경고를 상세 화면에서 검토합니다." id="strategy-board">
        <div className="grid gap-4">
          {data.runs.length ? data.runs.map((run) => (
            <StrategySummary key={run.run_id} run={run} href={`/strategies/${run.run_id}`} />
          )) : (
            <Panel>
              <p>전략 아티팩트가 없습니다. 로컬 탐색/내보내기 스크립트를 실행한 뒤 JSON을 public artifacts에 복사하세요.</p>
            </Panel>
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
