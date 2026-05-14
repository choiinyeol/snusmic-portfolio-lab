'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import type { ReportStatisticsLabSummary } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';

const HORIZONS = [30, 60, 120, 250] as const;
const THRESHOLDS = [0.6, 0.8, 1.0] as const;

export function ReportStatisticsStory({ summary }: { summary: ReportStatisticsLabSummary }) {
  const [threshold, setThreshold] = useState(0.8);
  const [horizon, setHorizon] = useState(120);
  const thresholdRows = summary.fractionalHitRates.filter((row) => row.threshold === threshold);
  const selectedHit = thresholdRows.find((row) => row.horizonDays === horizon) ?? thresholdRows.at(-1);
  const delayRows = summary.delayedEntry.filter((row) => row.horizonDays === horizon);
  const triggerRows = summary.entryTriggers.filter((row) => row.horizonDays === horizon);
  const multipleRows = summary.optimalTargetMultiples.filter((row) => row.horizonDays === 250);
  const bestMultiple = [...multipleRows].sort(
    (a, b) =>
      (b.rewardReliabilityScore ?? Number.NEGATIVE_INFINITY) - (a.rewardReliabilityScore ?? Number.NEGATIVE_INFINITY),
  )[0];
  const currentReturns = summary.riskScatter.map((row) => row.currentReturn).filter(isNumber);
  const meanReturn = mean(currentReturns);
  const medianReturn = quantile(currentReturns, 0.5);
  const deepLosers = currentReturns.filter((value) => value <= -0.2).length;
  const bigWinners = currentReturns.filter((value) => value >= 0.2).length;
  const returnQuantiles = {
    min: quantile(currentReturns, 0),
    p10: quantile(currentReturns, 0.1),
    p25: quantile(currentReturns, 0.25),
    median: medianReturn,
    p75: quantile(currentReturns, 0.75),
    p90: quantile(currentReturns, 0.9),
    max: quantile(currentReturns, 1),
  };

  return (
    <div className="grid gap-14">
      <section className="grid gap-6 border-b border-slate-200 pb-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
        <div className="max-w-3xl">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            리포트 통계 실험실
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] text-slate-950 md:text-6xl">
            평균보다 먼저 볼 것은 분포입니다
          </h1>
          <p className="mt-5 text-base leading-8 text-slate-600">
            {summary.sample.eligibleReportCount.toLocaleString('ko-KR')}건의 가격 경로를 다시 계산했습니다. 주식
            수익률은 꼬리가 두꺼워 평균과 표준편차만으로 보기 어렵습니다. 그래서 이 페이지는 정규분포를 가정하지 않고
            전체 표본의 순위, 분위수, 꼬리, 경로를 먼저 보여줍니다.
          </p>
        </div>
        <DistributionSignature
          mean={meanReturn}
          median={medianReturn}
          deepLosers={deepLosers}
          bigWinners={bigWinners}
        />
      </section>

      <StorySection
        kicker="01 · 전체 표본 지도"
        title="정규분포 대신 모든 리포트를 한 줄로 펼쳐 봅니다"
        body="표본이 fat-tail이면 평균은 대표값이 아니라 꼬리의 흔적일 수 있습니다. 먼저 가격 경로가 연결된 리포트를 현재 수익률 순서대로 놓고, 분위수와 극단값이 어디에 있는지 봅니다."
      >
        <WholeSampleMap rows={summary.riskScatter} quantiles={returnQuantiles} />
        <InsightLine>
          하위 10%는 <strong>{formatPercent(returnQuantiles.p10)}</strong> 이하, 상위 10%는{' '}
          <strong>{formatPercent(returnQuantiles.p90)}</strong> 이상입니다. 이 정도 꼬리에서는 “평균 수익률”보다
          “중앙값·사분위·극단 손실을 통과하는 규칙”을 먼저 봐야 합니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="02 · 목표가를 더 현실적으로 보기"
        title="목표가 100%가 아니라 80%에 닿았는지도 봅니다"
        body="분석가 목표가는 단일 정답이 아니라 파라미터입니다. 원래 목표가의 60%, 80%, 100%에 해당하는 가격을 각각 계산하면 ‘완전 적중’보다 더 실용적인 성과 경로가 보입니다."
      >
        <ControlStrip
          label="목표 기준"
          options={THRESHOLDS.map((value) => ({ value, label: `${value.toFixed(1)}x` }))}
          value={threshold}
          onChange={setThreshold}
        />
        <FractionalHitFigure rows={thresholdRows} />
        <InsightLine>
          {horizon}거래일 안에 {threshold.toFixed(1)}x 목표에 닿은 비율은{' '}
          <strong>{formatPercent(selectedHit?.hitRate)}</strong>입니다. 중앙 도달 시간은{' '}
          <strong>{formatDays(selectedHit?.medianDaysToHit)}</strong>입니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="03 · 읽고 바로 사야 했나"
        title="발간 후 며칠 기다리면 결과가 달라졌나"
        body="리포트를 당일에 읽지 못한 개인투자자가 더 현실적입니다. 1·3·5·10·20거래일 뒤 진입했을 때의 중앙 수익률과 0.8x 목표 도달률을 같은 방식으로 다시 계산했습니다."
      >
        <ControlStrip
          label="보유 기간"
          options={HORIZONS.map((value) => ({ value, label: `${value}D` }))}
          value={horizon}
          onChange={setHorizon}
        />
        <DelayHeatmap rows={delayRows} />
        <InsightLine>
          이 표본에서는 기다린다고 자동으로 유리해지지 않았습니다. {horizon}거래일 기준 당일 진입의 중앙 수익률은{' '}
          <strong>{formatPercent(delayRows.find((row) => row.delayDays === 0)?.medianReturn)}</strong>, 20일 지연 진입은{' '}
          <strong>{formatPercent(delayRows.find((row) => row.delayDays === 20)?.medianReturn)}</strong>입니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="04 · 눌림목인가 확인 매수인가"
        title="하락을 기다릴수록 참여율은 낮아지고, 돌파를 기다릴수록 가짜 돌파가 생깁니다"
        body="발간 후 20거래일 안에 -3/-5/-10% 눌림목이 오면 매수하는 규칙과 +3/+5/+10% 상승 확인 후 매수하는 규칙을 비교했습니다."
      >
        <TriggerFrontier rows={triggerRows} />
      </StorySection>

      <StorySection
        kicker="05 · 목표가에 닿은 뒤"
        title="목표가는 끝이 아니라 분기점이었습니다"
        body="목표가에 처음 닿은 날을 0일로 놓고, 이후 5·20·60·120거래일을 더 보유했을 때의 중앙값과 사분위 범위를 계산했습니다."
      >
        <PostTargetDrift rows={summary.postTargetDrift} />
        <InsightLine>
          목표 도달 후 60거래일 중앙 수익률은{' '}
          <strong>
            {formatPercent(summary.postTargetDrift.find((row) => row.daysAfterTarget === 60)?.medianReturn)}
          </strong>
          이지만, 하위 25%는{' '}
          <strong>{formatPercent(summary.postTargetDrift.find((row) => row.daysAfterTarget === 60)?.p25Return)}</strong>
          입니다. 계속 보유는 가능성을 키우는 동시에 분산도 키웠습니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="06 · 역사적 익절선"
        title="이 표본에서 안정적이었던 익절선은 낮은 목표 배수 쪽이었습니다"
        body="목표가의 일부에 도달하면 익절하고, 아니면 250거래일 후 청산한다고 가정했습니다. 최고 평균이 아니라 중앙 수익률·도달률·하방 위험을 함께 본 보상/신뢰 점수를 봅니다."
      >
        <TargetMultipleCurve rows={multipleRows} />
        <InsightLine>
          250거래일 기준 보상/신뢰 점수가 가장 높은 구간은{' '}
          <strong>{bestMultiple ? `${bestMultiple.targetMultiple.toFixed(1)}x` : '—'}</strong>입니다. 이는 “정답”이
          아니라 현재 표본에서 실용적 익절선 후보로 볼 파라미터입니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="07 · 경로의 고통"
        title="맞은 리포트도 중간 손실을 견뎌야 했습니다"
        body="각 리포트의 발간 이후 최대 상승폭과 최대 하락폭을 전체 표본으로 동시에 놓으면, 성공 표본이 얼마나 불편한 경로를 거쳤는지 보입니다."
      >
        <RiskScatter rows={summary.riskScatter} />
      </StorySection>

      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
        <div className="text-sm font-semibold">해석 원칙</div>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-300">
          이 페이지는 예측 모델이 아니라 과거 표본의 규칙 실험입니다. 같은 종목의 중복 리포트, 유동성, 장중 발간 시점,
          상장폐지·거래정지 누락, 시장 국면 차이는 결과를 바꿀 수 있습니다. 따라서 결론은 “이대로 사라”가 아니라 “이
          파라미터를 전략 후보로 검정하라”입니다.
        </p>
      </section>
    </div>
  );
}

function DistributionSignature({
  mean,
  median,
  deepLosers,
  bigWinners,
}: {
  mean: number | null;
  median: number | null;
  deepLosers: number;
  bigWinners: number;
}) {
  const medianX = xScale(median ?? 0, -0.8, 1.2);
  const meanX = xScale(mean ?? 0, -0.8, 1.2);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>손실 꼬리</span>
        <span>상승 꼬리</span>
      </div>
      <div className="relative mt-5 h-24 rounded-xl bg-gradient-to-r from-rose-100 via-slate-100 to-blue-100">
        <Marker x={medianX} label="중앙값" value={formatPercent(median)} tone="slate" />
        <Marker x={meanX} label="평균" value={formatPercent(mean)} tone="blue" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="font-mono text-2xl font-semibold text-rose-600">{deepLosers}</div>
          <div className="text-slate-500">-20% 이하</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-semibold text-blue-600">{bigWinners}</div>
          <div className="text-slate-500">+20% 이상</div>
        </div>
      </div>
    </div>
  );
}

function Marker({ x, label, value, tone }: { x: number; label: string; value: string; tone: 'slate' | 'blue' }) {
  return (
    <div className="absolute top-0 h-full" style={{ left: `${x}%` }}>
      <div className={`h-full w-px ${tone === 'blue' ? 'bg-blue-600' : 'bg-slate-950'}`} />
      <div className="absolute top-2 w-28 -translate-x-1/2 rounded-md bg-white/90 px-2 py-1 text-center shadow-sm">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="font-mono text-xs font-semibold text-slate-950">{value}</div>
      </div>
    </div>
  );
}

type ReturnQuantiles = {
  min: number | null;
  p10: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  p90: number | null;
  max: number | null;
};

function WholeSampleMap({
  rows,
  quantiles,
}: {
  rows: ReportStatisticsLabSummary['riskScatter'];
  quantiles: ReturnQuantiles;
}) {
  const sortedRows = rows
    .filter((row) => isNumber(row.currentReturn))
    .sort((a, b) => (a.currentReturn ?? 0) - (b.currentReturn ?? 0));
  const tails = [
    { label: '-50% 이하', count: sortedRows.filter((row) => (row.currentReturn ?? 0) <= -0.5).length, tone: 'bad' },
    { label: '-20% 이하', count: sortedRows.filter((row) => (row.currentReturn ?? 0) <= -0.2).length, tone: 'bad' },
    { label: '+20% 이상', count: sortedRows.filter((row) => (row.currentReturn ?? 0) >= 0.2).length, tone: 'good' },
    { label: '+100% 이상', count: sortedRows.filter((row) => (row.currentReturn ?? 0) >= 1).length, tone: 'good' },
  ] as const;

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">전체 현재 수익률 지도</h3>
            <p className="mt-1 text-xs text-slate-500">
              각 점은 리포트 1건입니다. 왼쪽부터 현재 수익률이 낮은 순서입니다.
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
            n={sortedRows.length.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="relative h-80 rounded-xl border border-slate-100 bg-[linear-gradient(to_right,rgba(226,232,240,.7)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,.7)_1px,transparent_1px)] bg-[size:12.5%_25%] px-4 py-5">
          <div className="absolute left-4 right-4 top-[53.33%] h-px bg-slate-950/25" />
          <div className="absolute left-4 top-[51%] rounded bg-white/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            0%
          </div>
          {sortedRows.map((row, index) => {
            const value = row.currentReturn ?? 0;
            const x = sortedRows.length <= 1 ? 50 : (index / (sortedRows.length - 1)) * 100;
            const y = 100 - xScale(Math.max(-0.8, Math.min(1.5, value)), -0.8, 1.5);
            const tone = value <= -0.2 ? 'bad' : value >= 0.2 ? 'good' : 'neutral';
            return (
              <DataPoint
                key={row.reportId}
                label={`${row.company} (${row.symbol})`}
                meta={`${row.publicationDate} · 순위 ${index + 1}/${sortedRows.length}`}
                tone={tone}
                x={x}
                y={y}
                rows={[
                  ['현재 수익률', formatPercent(row.currentReturn)],
                  ['최대 상승폭', formatPercent(row.maxFavorableExcursion)],
                  ['최대 하락폭', formatPercent(row.maxAdverseExcursion)],
                  ['목표 도달', targetHitLabel(row)],
                ]}
              />
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-950">분위수로 본 표본</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-7">
            {[
              ['최저', quantiles.min],
              ['P10', quantiles.p10],
              ['P25', quantiles.p25],
              ['중앙', quantiles.median],
              ['P75', quantiles.p75],
              ['P90', quantiles.p90],
              ['최고', quantiles.max],
            ].map(([label, value]) => (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3" key={label as string}>
                <div className="font-mono text-[11px] uppercase text-slate-500">{label}</div>
                <div className="mt-2 font-mono text-sm font-semibold tabular-nums text-slate-950">
                  {formatPercent(value as number | null)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-950">꼬리 개수</h3>
          <div className="mt-4 grid gap-2">
            {tails.map((tail) => (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2" key={tail.label}>
                <span className="text-xs text-slate-500">{tail.label}</span>
                <span
                  className={`font-mono text-sm font-semibold ${tail.tone === 'good' ? 'text-blue-600' : 'text-rose-600'}`}
                >
                  {tail.count.toLocaleString('ko-KR')}건
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StorySection({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10">
      <div className="lg:sticky lg:top-8 lg:self-start">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{kicker}</div>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 md:text-3xl">{title}</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">{body}</p>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function ControlStrip<T extends number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {options.map((option) => (
        <button
          className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${option.value === value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FractionalHitFigure({ rows }: { rows: ReportStatisticsLabSummary['fractionalHitRates'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-4">
        {rows.map((row) => (
          <div key={row.horizonDays}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-slate-950">{row.horizonDays}D</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-950">
                {formatPercent(row.hitRate)}
              </span>
            </div>
            <div className="mt-2 h-28 rounded-md bg-slate-100 p-2">
              <div className="mt-auto flex h-full items-end">
                <div
                  className="w-full rounded-t bg-slate-950"
                  style={{ height: `${Math.max(2, (row.hitRate ?? 0) * 100)}%` }}
                />
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {row.hitCount}/{row.sampleSize} · 중앙 {formatDays(row.medianDaysToHit)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DelayHeatmap({ rows }: { rows: ReportStatisticsLabSummary['delayedEntry'] }) {
  const maxAbs = Math.max(0.05, ...rows.map((row) => Math.abs(row.medianReturn ?? 0)));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-2 md:grid-cols-6">
        {rows.map((row) => {
          const value = row.medianReturn ?? 0;
          const intensity = Math.min(1, Math.abs(value) / maxAbs);
          return (
            <div className="rounded-xl border border-slate-100 p-3" key={row.delayDays}>
              <div className="text-xs text-slate-500">{row.delayDays}일 뒤</div>
              <div
                className={`mt-3 rounded-lg p-3 ${value >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}
                style={{ opacity: 0.45 + intensity * 0.55 }}
              >
                <div className="font-mono text-lg font-semibold tabular-nums">{formatPercent(value)}</div>
                <div className="mt-1 text-[11px]">0.8x {formatPercent(row.hitRate08)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TriggerFrontier({ rows }: { rows: ReportStatisticsLabSummary['entryTriggers'] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(['dip', 'rally'] as const).map((type) => (
        <div className="rounded-2xl border border-slate-200 bg-white p-5" key={type}>
          <h3 className="text-sm font-semibold text-slate-950">{type === 'dip' ? '눌림목 진입' : '상승 확인 진입'}</h3>
          <div className="mt-4 grid gap-3">
            {rows
              .filter((row) => row.type === type)
              .map((row) => (
                <div key={row.triggerPct}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{formatPercent(row.triggerPct, 0)} 조건</span>
                    <span className="font-mono text-slate-950">중앙 {formatPercent(row.medianReturn)}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-[1fr_4rem] items-center gap-3">
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-950"
                        style={{ width: `${(row.entryRate ?? 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-right font-mono text-xs text-slate-500">
                      참여 {formatPercent(row.entryRate, 0)}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    0.8x {formatPercent(row.hitRate08)} · 최대하락 중앙 {formatPercent(row.medianDrawdown)}
                    {type === 'rally' ? ` · 가짜 돌파 ${formatPercent(row.falseBreakoutRate)}` : ''}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PostTargetDrift({ rows }: { rows: ReportStatisticsLabSummary['postTargetDrift'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-4">
        {rows.map((row) => (
          <div key={row.daysAfterTarget}>
            <div className="text-sm font-semibold text-slate-950">+{row.daysAfterTarget}D</div>
            <div className="relative mt-4 h-28 rounded-lg bg-slate-50">
              <RangeBar low={row.p25Return} high={row.p75Return} median={row.medianReturn} min={-0.3} max={0.3} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              양수 {formatPercent(row.sharePositive)} · n={row.sampleSize}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetMultipleCurve({ rows }: { rows: ReportStatisticsLabSummary['optimalTargetMultiples'] }) {
  const scores = rows.map((row) => row.rewardReliabilityScore ?? 0);
  const minScore = Math.min(-0.05, ...scores);
  const maxScore = Math.max(0.05, ...scores);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">목표 배수별 보상/신뢰 지도</h3>
          <p className="mt-1 text-xs text-slate-500">
            점에 마우스를 올리면 도달률, 중앙 수익률, 하위 25% 손실을 같이 봅니다.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">250거래일 청산 가정</span>
      </div>
      <div className="relative h-72 rounded-xl border border-slate-100 bg-[linear-gradient(to_right,rgba(226,232,240,.7)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,.7)_1px,transparent_1px)] bg-[size:12.5%_25%] px-5 py-5">
        <div className="absolute bottom-10 left-5 right-5 h-px bg-slate-950/20" />
        {rows.map((row) => {
          const x = xScale(row.targetMultiple, 0.35, 1.25);
          const y = 100 - xScale(row.rewardReliabilityScore ?? 0, minScore, maxScore);
          const positive = (row.rewardReliabilityScore ?? 0) >= 0;
          return (
            <DataPoint
              key={row.targetMultiple}
              label={`${row.targetMultiple.toFixed(1)}x 목표`}
              meta={`표본 ${row.sampleSize.toLocaleString('ko-KR')}건`}
              tone={positive ? 'good' : 'bad'}
              x={x}
              y={y}
              rows={[
                ['보상/신뢰 점수', formatNumber(row.rewardReliabilityScore)],
                ['도달률', formatPercent(row.hitRate)],
                ['중앙 수익률', formatPercent(row.medianReturn)],
                ['하위 25%', formatPercent(row.p25Return)],
              ]}
            />
          );
        })}
        <div className="absolute bottom-3 left-5 right-5 flex justify-between font-mono text-[10px] text-slate-400">
          <span>0.4x</span>
          <span>0.6x</span>
          <span>0.8x</span>
          <span>1.0x</span>
          <span>1.2x</span>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-500">점수 = 중앙 수익률 × 도달률 / (하위 25% 손실 + 5% 완충)</div>
    </div>
  );
}

function RiskScatter({ rows }: { rows: ReportStatisticsLabSummary['riskScatter'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">전체 표본의 최대 상승폭·최대 하락폭</h3>
          <p className="mt-1 text-xs text-slate-500">
            오른쪽으로 갈수록 중간 손실이 작고, 위로 갈수록 발간 이후 상승 여지가 컸습니다.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
          n={rows.length.toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="relative h-80 rounded-xl border border-slate-100 bg-[linear-gradient(to_right,rgba(226,232,240,.7)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,.7)_1px,transparent_1px)] bg-[size:12.5%_25%] px-5 py-5">
        <div className="absolute bottom-8 left-5 text-[11px] text-slate-500">최대 하락폭</div>
        <div className="absolute left-5 top-3 text-[11px] text-slate-500">최대 상승폭</div>
        {rows.map((row) => {
          const adverse = Math.max(-0.8, Math.min(0, row.maxAdverseExcursion ?? 0));
          const favorable = Math.max(0, Math.min(1.5, row.maxFavorableExcursion ?? 0));
          const x = xScale(adverse, -0.8, 0);
          const y = 100 - xScale(favorable, 0, 1.5);
          const tone = row.hit10 ? 'good' : row.hit08 ? 'accent' : row.hit06 ? 'teal' : 'neutral';
          return (
            <DataPoint
              key={row.reportId}
              label={`${row.company} (${row.symbol})`}
              meta={row.publicationDate}
              tone={tone}
              x={x}
              y={y}
              rows={[
                ['최대 상승폭', formatPercent(row.maxFavorableExcursion)],
                ['최대 하락폭', formatPercent(row.maxAdverseExcursion)],
                ['현재 수익률', formatPercent(row.currentReturn)],
                ['목표 도달', targetHitLabel(row)],
              ]}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>파랑: 1.0x 도달</span>
        <span>보라: 0.8x 도달</span>
        <span>청록: 0.6x 도달</span>
        <span>회색: 미도달</span>
      </div>
    </div>
  );
}

function DataPoint({
  x,
  y,
  label,
  meta,
  tone,
  rows,
}: {
  x: number;
  y: number;
  label: string;
  meta: string;
  tone: 'good' | 'bad' | 'neutral' | 'accent' | 'teal';
  rows: Array<[string, string]>;
}) {
  const colorClass =
    tone === 'good'
      ? 'bg-blue-600 ring-blue-100'
      : tone === 'bad'
        ? 'bg-rose-600 ring-rose-100'
        : tone === 'accent'
          ? 'bg-violet-600 ring-violet-100'
          : tone === 'teal'
            ? 'bg-teal-600 ring-teal-100'
            : 'bg-slate-400 ring-slate-100';

  return (
    <button
      aria-label={`${label} ${rows.map(([key, value]) => `${key} ${value}`).join(', ')}`}
      className="group absolute z-10 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center outline-none"
      style={{
        left: `calc(1.25rem + ${x} * (100% - 2.5rem) / 100)`,
        top: `calc(1.25rem + ${y} * (100% - 2.5rem) / 100)`,
      }}
      type="button"
    >
      <span
        className={`size-2.5 rounded-full ring-4 transition-transform group-hover:scale-150 group-focus-visible:scale-150 ${colorClass}`}
      />
      <span className="pointer-events-none absolute bottom-6 left-1/2 z-30 hidden w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs shadow-xl group-hover:block group-focus-visible:block">
        <span className="block font-semibold text-slate-950">{label}</span>
        <span className="mt-0.5 block font-mono text-[11px] text-slate-500">{meta}</span>
        <span className="mt-2 grid gap-1">
          {rows.map(([key, value]) => (
            <span className="flex items-center justify-between gap-3" key={key}>
              <span className="text-slate-500">{key}</span>
              <span className="font-mono font-semibold tabular-nums text-slate-950">{value}</span>
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

function targetHitLabel(row: ReportStatisticsLabSummary['riskScatter'][number]): string {
  if (row.hit10) return '1.0x';
  if (row.hit08) return '0.8x';
  if (row.hit06) return '0.6x';
  return '미도달';
}

function RangeBar({
  low,
  high,
  median,
  min,
  max,
}: {
  low: number | null;
  high: number | null;
  median: number | null;
  min: number;
  max: number;
}) {
  const left = xScale(low ?? 0, min, max);
  const right = xScale(high ?? 0, min, max);
  const mid = xScale(median ?? 0, min, max);
  return (
    <>
      <div className="absolute top-1/2 h-px w-full bg-slate-200" />
      <div
        className="absolute top-1/2 h-6 -translate-y-1/2 rounded-full bg-blue-100"
        style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }}
      />
      <div className="absolute top-1/2 h-10 w-0.5 -translate-y-1/2 bg-slate-950" style={{ left: `${mid}%` }} />
      <div className="absolute bottom-2 left-0 w-full text-center font-mono text-xs font-semibold text-slate-950">
        {formatPercent(median)}
      </div>
    </>
  );
}

function InsightLine({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700">{children}</p>;
}

function xScale(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(values: number[], q: number): number | null {
  const sorted = values.filter(isNumber).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}
