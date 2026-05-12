import Link from 'next/link';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { StrategySummary } from '@/components/strategies/StrategySummary';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getEquityDaily, getParameterImportance, getStrategyExperiment, getStrategyRuns } from '@/lib/artifacts';
import { formatPercent, signedTextClass } from '@/lib/format';
import {
  BENCHMARK_IDS,
  getBenchmarkRows,
  getObjectivePassingRows,
  getSelectableStrategyRows,
  getStrategyLeaderboard,
  OBJECTIVE_MAX_DRAWDOWN,
  TARGET_BENCHMARK_ID,
  type StrategyLeaderboardRow,
} from '@/lib/product-model';

export default function StrategiesPage() {
  const data = getStrategyRuns();
  const importance = getParameterImportance();
  const bestRun = data.runs.find((run) => run.run_id === data.best_run_id) ?? data.runs[0];
  const leaderboard = getStrategyLeaderboard();
  const benchmarkRows = getBenchmarkRows(leaderboard);
  const selectableRows = getSelectableStrategyRows(leaderboard);
  const objectiveRows = getObjectivePassingRows(leaderboard);
  const targetBenchmark = benchmarkRows.find((row) => row.id === TARGET_BENCHMARK_ID);
  const bestSelectable = selectableRows[0];
  const chartSeries = buildStrategySeries(leaderboard, data.runs.slice(0, 3));
  const disclaimer = normalizeStrategyDisclaimer(data.disclaimer);

  return (
    <>
      <PageHero
        eyebrow="STRATEGIES"
        title="Strategy Lab — 보고서 성과 기반 후보 실험"
        subtitle={disclaimer}
        badges={[
          { label: '후보', value: data.runs.length },
          { label: '벤치마크', value: benchmarkRows.length },
          { label: '선택 전략', value: selectableRows.length },
          { label: '스터디', value: data.study_name ?? '—' },
          { label: '범위', value: data.scope ?? bestRun?.scope ?? 'local' },
          { label: 'Trading', value: 'No live trading' },
        ]}
        actions={
          <>
            <Link className="btn btn-sm btn-primary" href={bestRun ? `/strategies/${bestRun.run_id}` : '/strategies'}>
              최고 후보
            </Link>
            <a className="btn btn-sm btn-outline" href="#strategy-board">
              리더보드
            </a>
          </>
        }
        kpis={
          <div className="grid min-w-0 gap-3 min-[1400px]:grid-cols-2">
            <KpiTile
              label="최고 후보"
              value={bestRun?.label ?? '—'}
              delta={bestRun ? `score ${formatPercent(bestRun.metrics.score)}` : '없음'}
              tone="good"
            />
            <KpiTile
              label="목표 게이트"
              value={objectiveRows.length ? `${objectiveRows.length}개 통과` : '통과 없음'}
              delta={`MDD ≤ ${formatPercent(OBJECTIVE_MAX_DRAWDOWN)} · KOSPI 초과`}
              tone={objectiveRows.length ? 'good' : 'warn'}
            />
            <KpiTile
              label="KOSPI/KODEX 200"
              value={formatPercent(targetBenchmark?.returnPct)}
              delta={`MDD ${formatPercent(targetBenchmark?.maxDrawdown)}`}
              tone="accent"
            />
            <KpiTile
              label="최상위 선택 전략"
              value={bestSelectable?.label ?? '—'}
              delta={
                bestSelectable
                  ? `KOSPI 대비 ${formatPercent(bestSelectable.objectiveReturnExcess)} · MDD ${formatPercent(bestSelectable.maxDrawdown)}`
                  : '선택 가능 전략 없음'
              }
              tone={bestSelectable?.objectivePassed ? 'good' : 'neutral'}
            />
          </div>
        }
      />

      <Section
        eyebrow="Leaderboard"
        title="목표 게이트 — MDD 15% 이하 + KOSPI 초과"
        caption="개인 목표 조건을 먼저 검사합니다. 수익률이 높아도 MDD가 15%를 넘으면 통과로 표시하지 않습니다."
      >
        <StrategyRiskTable rows={(objectiveRows.length ? objectiveRows : selectableRows).slice(0, 10)} />
      </Section>

      <Section
        eyebrow="Benchmark Set"
        title="벤치마크 세트"
        caption="All-Weather, SMIC Follower v1/v2, KODEX200, QQQ, SPY, GLD, Weak Prophet은 비교 기준선입니다. Weak Prophet은 미래정보 상한선 성격입니다."
      >
        <StrategyRiskTable rows={benchmarkRows} />
      </Section>

      <Section eyebrow="Curve" title="벤치마크 세트와 선택 가능 전략의 누적 수익률">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-3 p-3 md:p-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="snapshot-pill">벤치마크 {BENCHMARK_IDS.length}</span>
              <span className="snapshot-pill">선택 가능 전략 {selectableRows.length}</span>
              <span className="snapshot-pill">목표: MDD 15% 이하 · KOSPI 초과</span>
            </div>
            <CumulativeReturnChart series={chartSeries} />
          </div>
        </article>
      </Section>

      {importance.parameters?.length ? (
        <Section eyebrow="Sensitivity" title="파라미터 중요도">
          <article className="lab-panel p-4 md:p-5">
            <div className="grid gap-3">
              {importance.parameters.slice(0, 8).map((item) => (
                <div
                  className="grid gap-2 md:grid-cols-[minmax(120px,.35fr)_minmax(0,1fr)_auto] md:items-center"
                  key={item.parameter}
                >
                  <span className="font-mono text-sm text-base-content/65">{item.parameter}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-base-200">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(1, item.importance * 100)}%` }}
                    />
                  </div>
                  <strong className="tabular-nums">{formatPercent(item.importance)}</strong>
                </div>
              ))}
            </div>
          </article>
        </Section>
      ) : null}

      <Section eyebrow="Leaderboard" title="전략 후보" id="strategy-board">
        <div className="grid gap-4 lg:grid-cols-2">
          {data.runs.length ? (
            data.runs.map((run) => <StrategySummary key={run.run_id} run={run} href={`/strategies/${run.run_id}`} />)
          ) : (
            <div className="rounded-box border border-base-300 bg-base-100 p-5 text-sm text-base-content/65 shadow-sm">
              후보 실험 데이터가 없습니다. canonical data/web/strategy-runs.json 내보내기를 먼저 생성하세요.
            </div>
          )}
        </div>
      </Section>
    </>
  );
}

function normalizeStrategyDisclaimer(value?: string | null): string {
  if (!value) return '리포트 성과 테이블에서 파생한 후보 실험 스냅샷이며, 전체 브로커 원장 재현이 아닙니다.';
  if (/local-only|optuna|artifact/i.test(value)) {
    return '리포트 성과 테이블에서 파생한 후보 실험 스냅샷이며, 전체 브로커 원장 재현이 아닙니다.';
  }
  return value;
}

function buildStrategySeries(
  leaderboard: StrategyLeaderboardRow[],
  runs: ReturnType<typeof getStrategyRuns>['runs'],
): ReturnSeries[] {
  const palette = ['#1b64da', '#16a368', '#7d6bff', '#f29423', '#ef4452', '#00a99a', '#94a3b8', '#111827'];
  const personaRows = leaderboard.filter((row) => row.kind === 'benchmark' || row.kind === 'strategy').slice(0, 13);
  const equity = getEquityDaily();
  const series: ReturnSeries[] = personaRows.map((row, index) => ({
    id: row.id,
    label: row.kind === 'benchmark' ? `BM · ${row.label}` : `전략 · ${row.label}`,
    color: palette[index],
    points: equity
      .filter((point) => point.persona === row.id && point.cumulativeReturn !== null)
      .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
  }));
  return [
    ...series,
    ...runs.map((run, index) => ({
      id: run.run_id,
      label: `실험 · ${run.label}`,
      color: palette[(index + personaRows.length) % palette.length],
      points: getStrategyExperiment(run).cumulativeReturnSeries,
    })),
  ];
}

function StrategyRiskTable({ rows }: { rows: StrategyLeaderboardRow[] }) {
  return (
    <article className="board-table-wrap">
      <table className="board-table table table-sm table-density-compact w-full">
        <thead>
          <tr>
            <th>구분</th>
            <th>전략</th>
            <th className="text-right">수익률</th>
            <th className="text-right">Sharpe</th>
            <th className="text-right">Sortino</th>
            <th className="text-right">MDD</th>
            <th className="text-right">KOSPI 초과</th>
            <th className="text-right">목표</th>
            <th className="text-right">거래</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span
                  className={`badge badge-sm ${row.kind === 'benchmark' ? 'badge-ghost' : 'badge-primary badge-soft'}`}
                >
                  {kindLabel(row.kind)}
                </span>
              </td>
              <td className="min-w-[220px] max-w-[320px] truncate font-bold">
                <Link href={row.href}>{row.label}</Link>
              </td>
              <td className={`text-right font-mono font-black tabular-nums ${signedTextClass(row.returnPct)}`}>
                {formatPercent(row.returnPct)}
              </td>
              <td className="text-right font-mono tabular-nums">{formatNumber(row.sharpe)}</td>
              <td className="text-right font-mono tabular-nums">{formatNumber(row.sortino)}</td>
              <td className="text-right font-mono tabular-nums text-error">
                {formatPercent(row.maxDrawdown)}
                {(row.maxDrawdown ?? 0) > 0.25 ? (
                  <span className="ml-1 badge badge-warning badge-soft badge-xs">낙폭 점검</span>
                ) : null}
              </td>
              <td className={`text-right font-mono font-bold tabular-nums ${signedTextClass(row.benchmarkExcess)}`}>
                {formatPercent(row.benchmarkExcess)}
              </td>
              <td className="text-right">
                {row.kind === 'benchmark' ? (
                  <span className="badge badge-ghost badge-xs">기준선</span>
                ) : row.objectivePassed ? (
                  <span className="badge badge-success badge-soft badge-xs">통과</span>
                ) : (
                  <span className="badge badge-warning badge-soft badge-xs">미달</span>
                )}
              </td>
              <td className="text-right font-mono tabular-nums">{row.tradeCount?.toLocaleString('ko-KR') ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function kindLabel(kind: StrategyLeaderboardRow['kind']): string {
  if (kind === 'benchmark') return '벤치마크';
  if (kind === 'strategy') return '고유 전략';
  return '후보 실험';
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
