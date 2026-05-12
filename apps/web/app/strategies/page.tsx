import Link from 'next/link';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { StrategySummary } from '@/components/strategies/StrategySummary';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import {
  getEquityDaily,
  getParameterImportance,
  getPersonaLabel,
  getStrategyExperiment,
  getStrategyRuns,
} from '@/lib/artifacts';
import { formatPercent, signedTextClass } from '@/lib/format';
import { getStrategyLeaderboard, type StrategyLeaderboardRow } from '@/lib/product-model';

export default function StrategiesPage() {
  const data = getStrategyRuns();
  const importance = getParameterImportance();
  const bestRun = data.runs.find((run) => run.run_id === data.best_run_id) ?? data.runs[0];
  const chartSeries = buildStrategySeries(data.runs.slice(0, 3));
  const leaderboard = getStrategyLeaderboard();
  const riskNote = bestRun
    ? strategyRiskNote(bestRun.metrics.max_drawdown ?? bestRun.metrics.maxDrawdown)
    : '내보낸 전략이 없습니다.';
  const disclaimer = normalizeStrategyDisclaimer(data.disclaimer);

  return (
    <>
      <PageHero
        eyebrow="STRATEGIES"
        title="Strategy Lab — 보고서 성과 기반 후보 실험"
        subtitle={disclaimer}
        badges={[
          { label: '후보', value: data.runs.length },
          { label: '스터디', value: data.study_name ?? '—' },
          { label: '범위', value: data.scope ?? bestRun?.scope ?? 'local' },
          { label: '선발', value: bestRun?.sampler ?? '—' },
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
              label="최고 후보 MDD"
              value={formatPercent(
                typeof bestRun?.metrics.max_drawdown === 'number' ? bestRun.metrics.max_drawdown : null,
              )}
              delta={riskNote}
              tone={
                typeof bestRun?.metrics.max_drawdown === 'number' && bestRun.metrics.max_drawdown > 0.25
                  ? 'warn'
                  : 'neutral'
              }
            />
            <KpiTile
              label="Full return"
              value={formatPercent(
                typeof bestRun?.metrics.full_money_weighted_return === 'number'
                  ? bestRun.metrics.full_money_weighted_return
                  : typeof bestRun?.metrics.money_weighted_return === 'number'
                    ? bestRun.metrics.money_weighted_return
                    : null,
              )}
              delta="전 구간 재평가"
              tone="accent"
            />
            <KpiTile
              label="Holdout return"
              value={formatPercent(
                typeof bestRun?.metrics.holdout_money_weighted_return === 'number'
                  ? bestRun.metrics.holdout_money_weighted_return
                  : null,
              )}
              delta="훈련 밖 검증"
            />
          </div>
        }
      />

      <Section
        eyebrow="Leaderboard"
        title="전략·벤치마크 우열"
        caption="수익률, Sharpe, Sortino, MDD, 최강 기준선 대비 초과수익을 같은 표에서 비교합니다."
      >
        <StrategyRiskTable rows={leaderboard.slice(0, 10)} />
      </Section>

      <Section eyebrow="Curve" title="Train 선발 후보의 가격 경로 기반 재구성 수익률">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body p-3 md:p-4">
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

function strategyRiskNote(value: unknown): string {
  const drawdown = typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (drawdown === null) return 'MDD 데이터가 없어 상세 후보에서 리스크를 별도로 확인해야 합니다.';
  if (drawdown > 0.25) return `최고 후보도 MDD ${formatPercent(drawdown)}로 낙폭 점검이 필요합니다.`;
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
            <th className="text-right">초과수익</th>
            <th className="text-right">거래</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span
                  className={`badge badge-sm ${row.kind === 'candidate' ? 'badge-primary badge-soft' : 'badge-ghost'}`}
                >
                  {row.kind === 'candidate' ? '후보' : '기준선'}
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
              <td className="text-right font-mono tabular-nums">{row.tradeCount?.toLocaleString('ko-KR') ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}
