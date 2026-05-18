import Link from 'next/link';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { PerformanceChartPanel } from '@/components/charts/PerformanceChartPanel';
import { StrategyRiskTable } from '@/components/trading/StrategyRiskTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getStrategyCurves } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
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
        eyebrow="전략 실험실"
        title="전략 비교"
        subtitle="벤치마크, 오라클, 선택 가능한 포트폴리오 전략을 분리해 성과·낙폭·규칙을 비교합니다."
        badges={[
          { label: '벤치마크', value: benchmarkRows.length },
          { label: '고유 전략', value: selectableRows.length },
          { label: '목표', value: `MDD ≤ ${formatPercent(OBJECTIVE_MAX_DRAWDOWN)}` },
          { label: '수익 기준', value: 'KOSPI 초과' },
        ]}
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href="/portfolio">포트폴리오로 이동</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="#strategy-board">전략 리더보드</a>
            </Button>
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
        eyebrow="비교 기준"
        title="벤치마크 세트"
        caption="벤치마크는 성과 비교 기준입니다. Weak Prophet은 미래정보 상한선 성격이므로 투자 가능한 전략처럼 해석하지 않습니다."
      >
        <StrategyRiskTable rows={benchmarkRows} />
      </Section>

      <Section
        eyebrow="목표 조건"
        title="고유 전략 — MDD 15% 이하 + KOSPI 초과"
        caption="개인 목표 조건을 먼저 검사합니다. 수익률이 높아도 MDD가 15%를 넘으면 통과로 표시하지 않습니다."
        id="strategy-board"
      >
        <StrategyRiskTable rows={selectableRows} />
      </Section>

      <Section eyebrow="성과 경로" title="벤치마크 세트와 고유 전략의 누적 수익률">
        <PerformanceChartPanel
          benchmarkCount={BENCHMARK_IDS.length}
          series={chartSeries}
          strategyCount={selectableRows.length}
        />
      </Section>

      <Section
        eyebrow="운용 규칙"
        title="고유 전략 매수·매도 규칙"
        caption="리포트 추세 전략은 수익률 숫자만 보는 대상이 아니라, 어떤 조건에서 현금을 보유하고 어떤 조건에서 매수·매도하는지 함께 읽어야 합니다."
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
  const equity = getStrategyCurves();
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
        <Badge variant={row.objectivePassed ? 'success' : 'warning'}>
          {row.objectivePassed ? '목표 통과' : '목표 미달'}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{row.methodologySummary}</p>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <h4 className="text-xs font-black uppercase tracking-[0.14em] text-slate-950/45">{title}</h4>
      <ul className="mt-2 grid gap-1 text-sm leading-5 text-slate-500">
        {items.length ? items.map((item) => <li key={item}>• {item}</li>) : <li>—</li>}
      </ul>
    </div>
  );
}
