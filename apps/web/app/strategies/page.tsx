import Link from 'next/link';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { SeriesToggleChart } from '@/components/charts/SeriesToggleChart';
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
            <SeriesToggleChart series={chartSeries} />
          </div>
        </article>
      </Section>

      <Section
        eyebrow="Method"
        title="고유 전략 매수·매도 규칙"
        caption="MTT 전략은 수익률 숫자만 보는 대상이 아니라, 어떤 조건에서 현금을 보유하고 어떤 조건에서 매수·매도하는지 함께 읽어야 합니다."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {selectableRows.slice(0, 6).map((row) => (
            <StrategyMethodCard key={row.id} row={row} />
          ))}
        </div>
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
    shortLabel: row.shortLabel || compactStrategyLabel(row.id, row.label),
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
                  {row.kind === 'strategy' ? '고유 전략' : row.kind === 'oracle' ? '오라클' : '벤치마크'}
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
                ) : row.kind === 'oracle' ? (
                  <span className="badge badge-warning badge-soft badge-xs">상한선</span>
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

function StrategyMethodCard({ row }: { row: StrategyLeaderboardRow }) {
  return (
    <article className="lab-panel p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="lab-panel__eyebrow">{row.shortLabel}</div>
          <h3 className="truncate text-lg font-black tracking-[-0.035em]" title={row.label}>
            {row.label}
          </h3>
        </div>
        <span
          className={`badge badge-sm ${row.objectivePassed ? 'badge-success badge-soft' : 'badge-warning badge-soft'}`}
        >
          {row.objectivePassed ? '목표 통과' : '목표 미달'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-base-content/65">{row.methodologySummary}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <RuleList title="매수" items={row.buyRules} />
        <RuleList title="매도" items={row.sellRules} />
        <RuleList title="리스크" items={row.riskControls} />
      </div>
    </article>
  );
}

function RuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-3">
      <h4 className="text-xs font-black uppercase tracking-[0.14em] text-base-content/45">{title}</h4>
      <ul className="mt-2 grid gap-1 text-sm leading-5 text-base-content/65">
        {items.length ? items.map((item) => <li key={item}>• {item}</li>) : <li>—</li>}
      </ul>
    </div>
  );
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}
