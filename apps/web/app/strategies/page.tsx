import Link from 'next/link';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getEquityDaily } from '@/lib/artifacts';
import { formatPercent, signedTextClass } from '@/lib/format';
import {
  BENCHMARK_IDS,
  compactStrategyLabel,
  getBenchmarkRows,
  getObjectivePassingRows,
  getSelectableStrategyRows,
  getStrategyLeaderboard,
  OBJECTIVE_MAX_DRAWDOWN,
  TARGET_BENCHMARK_ID,
  type StrategyLeaderboardRow,
} from '@/lib/product-model';

export default function StrategiesPage() {
  const leaderboard = getStrategyLeaderboard();
  const benchmarkRows = getBenchmarkRows(leaderboard);
  const selectableRows = getSelectableStrategyRows(leaderboard);
  const objectiveRows = getObjectivePassingRows(leaderboard);
  const targetBenchmark = benchmarkRows.find((row) => row.id === TARGET_BENCHMARK_ID);
  const bestSelectable = selectableRows[0];
  const chartSeries = buildStrategySeries([...benchmarkRows, ...selectableRows.slice(0, 8)]);

  return (
    <>
      <PageHero
        eyebrow="STRATEGIES"
        title="Strategies — 벤치마크와 고유 전략"
        subtitle="All-Weather, SMIC Follower v1/v2, KODEX200, QQQ, SPY, GLD, Weak Prophet은 비교 기준선입니다. 나머지는 사용자가 선택해 검토할 수 있는 원장형 고유 전략입니다."
        badges={[
          { label: '벤치마크', value: benchmarkRows.length },
          { label: '고유 전략', value: selectableRows.length },
          { label: '목표', value: `MDD ≤ ${formatPercent(OBJECTIVE_MAX_DRAWDOWN)}` },
          { label: '수익 기준', value: 'KOSPI 초과' },
          { label: '거래', value: '실시간 매매 아님' },
        ]}
        actions={
          <>
            <Link className="btn btn-sm btn-primary" href="/portfolio">
              전략 선택하기
            </Link>
            <a className="btn btn-sm btn-outline" href="#strategy-board">
              리더보드
            </a>
          </>
        }
        kpis={
          <div className="grid min-w-0 gap-3 min-[1400px]:grid-cols-2">
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
              label="최상위 고유 전략"
              value={bestSelectable?.label ?? '—'}
              delta={
                bestSelectable
                  ? `KOSPI 대비 ${formatPercent(bestSelectable.objectiveReturnExcess)} · MDD ${formatPercent(bestSelectable.maxDrawdown)}`
                  : '선택 가능 전략 없음'
              }
              tone={bestSelectable?.objectivePassed ? 'good' : 'neutral'}
            />
            <KpiTile label="벤치마크 정의" value="8개" delta="비교 기준선과 고유 전략을 분리" tone="neutral" />
          </div>
        }
      />

      <Section
        eyebrow="Benchmark Set"
        title="벤치마크 세트"
        caption="벤치마크는 성과 비교 기준입니다. Weak Prophet은 미래정보 상한선 성격이므로 투자 가능한 전략처럼 해석하지 않습니다."
      >
        <StrategyRiskTable rows={benchmarkRows} />
      </Section>

      <Section
        eyebrow="Objective Gate"
        title="고유 전략 — MDD 15% 이하 + KOSPI 초과"
        caption="개인 목표 조건을 먼저 검사합니다. 수익률이 높아도 MDD가 15%를 넘으면 통과로 표시하지 않습니다."
        id="strategy-board"
      >
        <StrategyRiskTable rows={selectableRows} />
      </Section>

      <Section eyebrow="Curve" title="벤치마크 세트와 고유 전략의 누적 수익률">
        <article className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body gap-3 p-3 md:p-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="snapshot-pill">벤치마크 {BENCHMARK_IDS.length}</span>
              <span className="snapshot-pill">고유 전략 {selectableRows.length}</span>
              <span className="snapshot-pill">목표: MDD 15% 이하 · KOSPI 초과</span>
            </div>
            <CumulativeReturnChart series={chartSeries} />
          </div>
        </article>
      </Section>
    </>
  );
}

function buildStrategySeries(rows: StrategyLeaderboardRow[]): ReturnSeries[] {
  const palette = ['#1b64da', '#16a368', '#7d6bff', '#f29423', '#ef4452', '#00a99a', '#94a3b8', '#111827'];
  const equity = getEquityDaily();
  return rows.map((row, index) => ({
    id: row.id,
    label: row.label,
    shortLabel: compactStrategyLabel(row.id, row.label),
    color: palette[index % palette.length],
    points: equity
      .filter((point) => point.persona === row.id && point.cumulativeReturn !== null)
      .map((point) => ({ time: point.date, value: point.cumulativeReturn ?? 0 })),
  }));
}

function StrategyRiskTable({ rows }: { rows: StrategyLeaderboardRow[] }) {
  return (
    <article className="board-table-wrap">
      <table className="board-table table table-sm table-density-compact w-full">
        <thead>
          <tr>
            <th>구분</th>
            <th>이름</th>
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
                  {row.kind === 'benchmark' ? '벤치마크' : '고유 전략'}
                </span>
              </td>
              <td className="min-w-[160px] max-w-[240px] truncate font-bold">
                <Link href={row.href} title={row.label}>
                  {row.label}
                </Link>
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

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}
