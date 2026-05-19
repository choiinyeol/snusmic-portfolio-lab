import Link from 'next/link';
import type { ReturnSeries } from '@/components/charts/CumulativeReturnChart';
import { PerformanceChartPanel } from '@/components/charts/PerformanceChartPanel';
import { QuantStrategySearchTable } from '@/components/trading/QuantStrategySearchTable';
import { StrategyRiskTable } from '@/components/trading/StrategyRiskTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiTile } from '@/components/ui/KpiTile';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import { getQuantStrategySearch, getStrategyCurves } from '@/lib/artifacts';
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
  const quantSearch = getQuantStrategySearch();
  const targetBenchmark = benchmarkRows.find((row) => row.id === TARGET_BENCHMARK_ID);
  const bestSelectable = selectableRows[0];
  const bestQuantCandidate = quantSearch.rows[0];
  const chartSeries = buildStrategySeries([...benchmarkRows, ...selectableRows.slice(0, 8)]);
  const comparisonLabelSummary = benchmarkRows
    .slice(0, 5)
    .map((row) => row.shortLabel)
    .join(', ');

  return (
    <>
      <PageHero
        eyebrow="전략 실험실"
        title="전략 비교"
        subtitle="벤치마크, 오라클, 선택 가능한 포트폴리오 전략을 분리해 성과·낙폭·규칙을 비교합니다."
        badges={[
          { label: '벤치마크', value: benchmarkRows.length },
          { label: '고유 전략', value: selectableRows.length },
          { label: '퀀트 탐색', value: `${quantSearch.candidateCount.toLocaleString('ko-KR')}개 후보` },
          { label: '목표', value: `MDD ≤ ${formatPercent(OBJECTIVE_MAX_DRAWDOWN)}` },
          { label: '수익 기준', value: 'KOSPI 초과' },
        ]}
        actions={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href="/portfolio">실제 포트폴리오 선택</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="#strategy-board">비교표 보기</a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href="#quant-search-board">퀀트 Top N</a>
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
            <KpiTile
              label="퀀트 탐색 목표"
              value={`${quantSearch.goalHitCount.toLocaleString('ko-KR')}개 통과`}
              delta={
                bestQuantCandidate
                  ? `Top1 Sortino ${bestQuantCandidate.annualizedSortinoLpm0?.toFixed(2) ?? '—'} · Sharpe ${
                      bestQuantCandidate.annualizedSharpe?.toFixed(2) ?? '—'
                    }`
                  : '탐색 후보 없음'
              }
              tone={quantSearch.goalHitCount ? 'good' : 'warn'}
            />
            <KpiTile
              label="벤치마크 정의"
              value={`${benchmarkRows.length}개`}
              delta="비교 기준선과 고유 전략을 분리"
              tone="neutral"
            />
          </div>
        }
      />

      <Section eyebrow="역할 구분" title="Strategies는 비교, Portfolio는 실제 원장">
        <div className="grid gap-3 lg:grid-cols-3">
          <RoleCard
            title="Portfolio"
            body="현재 보유, PnL, 체결, 운용 규칙을 실제 투자 가능한 strategy ledger만으로 보여줍니다."
            cta="포트폴리오 선택"
            href="/portfolio"
          />
          <RoleCard
            title="Strategies"
            body="벤치마크·오라클·후보 전략을 한 화면에서 비교합니다. 기준선은 살펴보는 대상이지 보유 포트폴리오가 아닙니다."
            cta="고유 전략 표"
            href="#strategy-board"
          />
          <RoleCard
            title="Benchmark"
            body={`${comparisonLabelSummary} 등 ${benchmarkRows.length}개 기준선은 비교 기준으로만 남깁니다.`}
            cta="벤치마크 표"
            href="#benchmark-board"
          />
        </div>
      </Section>

      <Section eyebrow="비교 기준" title="벤치마크 세트" id="benchmark-board">
        <StrategyRiskTable rows={benchmarkRows} title="벤치마크" csvFilename="snusmic-benchmarks.csv" />
      </Section>

      <Section eyebrow="목표 조건" title="고유 전략 — MDD 15% 이하 + KOSPI 초과" id="strategy-board">
        <StrategyRiskTable rows={selectableRows} title="고유 전략" csvFilename="snusmic-strategies.csv" />
      </Section>

      <Section eyebrow="팀 퀀트 탐색" title="Sharpe 2 또는 Sortino 2 이상 후보 Top N" id="quant-search-board">
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <strong>리서치 후보:</strong> {quantSearch.candidateCount.toLocaleString('ko-KR')}개 조합 중{' '}
          {quantSearch.goalHitCount.toLocaleString('ko-KR')}개가 Sharpe/Sortino 목표를 통과했습니다. 동일 후보군 반복
          탐색에 따른 과최적화 위험이 있어 실제 운용 전에는 별도 OOS 검증이 필요합니다. 제외:{' '}
          {quantSearch.excluded.join(', ') || '없음'}.
        </div>
        <QuantStrategySearchTable rows={quantSearch.rows} />
      </Section>

      <Section eyebrow="성과 경로" title="벤치마크 세트와 고유 전략의 누적 수익률">
        <PerformanceChartPanel
          benchmarkCount={BENCHMARK_IDS.length}
          series={chartSeries}
          strategyCount={selectableRows.length}
        />
      </Section>

      <Section eyebrow="운용 규칙" title="고유 전략 매수·매도 규칙">
        <div className="grid gap-3 lg:grid-cols-2">
          {selectableRows.slice(0, 6).map((row) => (
            <StrategyMethodCard key={row.id} row={row} />
          ))}
        </div>
      </Section>
    </>
  );
}

function RoleCard({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
      <Button asChild className="mt-4" size="sm" variant={title === 'Portfolio' ? 'default' : 'outline'}>
        <Link href={href}>{cta}</Link>
      </Button>
    </article>
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
