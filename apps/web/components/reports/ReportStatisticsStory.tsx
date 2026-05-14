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
            {summary.sample.eligibleReportCount.toLocaleString('ko-KR')}건의 가격 경로를 다시 계산했습니다. 목표가
            도달률만 보면 엄격해 보이지만, 0.8배 목표·진입 타이밍·목표 도달 후 흐름을 함께 보면 투자 규칙으로 바꿀 수
            있는 질문이 더 선명해집니다.
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
        kicker="01 · 목표가를 더 현실적으로 보기"
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
        kicker="02 · 읽고 바로 사야 했나"
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
        kicker="03 · 눌림목인가 확인 매수인가"
        title="하락을 기다릴수록 참여율은 낮아지고, 돌파를 기다릴수록 가짜 돌파가 생깁니다"
        body="발간 후 20거래일 안에 -3/-5/-10% 눌림목이 오면 매수하는 규칙과 +3/+5/+10% 상승 확인 후 매수하는 규칙을 비교했습니다."
      >
        <TriggerFrontier rows={triggerRows} />
      </StorySection>

      <StorySection
        kicker="04 · 목표가에 닿은 뒤"
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
        kicker="05 · 역사적 익절선"
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
        kicker="06 · 경로의 고통"
        title="맞은 리포트도 중간 손실을 견뎌야 했습니다"
        body="각 리포트의 발간 이후 최대 상승폭과 최대 하락폭을 동시에 놓으면, 성공 표본이 얼마나 불편한 경로를 거쳤는지 보입니다."
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
  const width = 720;
  const height = 260;
  const points = rows.map((row) => ({
    x: xScale(row.targetMultiple, 0.35, 1.25),
    y: 100 - xScale(row.rewardReliabilityScore ?? 0, -0.1, 0.45),
    row,
  }));
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x * (width / 100)} ${point.y * (height / 100)}`)
    .join(' ');
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
      <svg
        className="h-auto w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="목표 배수별 보상 신뢰 점수"
      >
        <path d="M 40 220 H 690" stroke="#e2e8f0" />
        <path d="M 40 30 V 220" stroke="#e2e8f0" />
        <path d={line} fill="none" stroke="#0f172a" strokeWidth="3" />
        {points.map((point) => (
          <g key={point.row.targetMultiple}>
            <circle cx={point.x * (width / 100)} cy={point.y * (height / 100)} fill="#0f172a" r="5" />
            <text x={point.x * (width / 100)} y="245" fill="#64748b" fontSize="11" textAnchor="middle">
              {point.row.targetMultiple.toFixed(1)}x
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 text-xs text-slate-500">점수 = 중앙 수익률 × 도달률 / (하위 25% 손실 + 5% 완충)</div>
    </div>
  );
}

function RiskScatter({ rows }: { rows: ReportStatisticsLabSummary['riskScatter'] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <svg className="h-auto w-full" viewBox="0 0 760 340" role="img" aria-label="최대 하락폭과 최대 상승폭 산점도">
        <path d="M 60 290 H 730" stroke="#e2e8f0" />
        <path d="M 60 30 V 290" stroke="#e2e8f0" />
        <text x="60" y="320" fill="#64748b" fontSize="12">
          최대 하락폭
        </text>
        <text x="10" y="35" fill="#64748b" fontSize="12">
          최대 상승폭
        </text>
        {rows.map((row) => {
          const x = 60 + xScale(row.maxAdverseExcursion ?? 0, -0.8, 0) * 6.7;
          const y = 290 - xScale(Math.min(row.maxFavorableExcursion ?? 0, 1.5), 0, 1.5) * 1.73;
          const fill = row.hit10 ? '#2563eb' : row.hit08 ? '#7c3aed' : row.hit06 ? '#0f766e' : '#cbd5e1';
          return (
            <circle cx={x} cy={y} fill={fill} key={row.reportId} opacity="0.72" r="4">
              <title>{`${row.company} (${row.symbol}) 상승 ${formatPercent(row.maxFavorableExcursion)} / 하락 ${formatPercent(row.maxAdverseExcursion)}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
        <span>파랑: 1.0x 도달</span>
        <span>보라: 0.8x 도달</span>
        <span>청록: 0.6x 도달</span>
        <span>회색: 미도달</span>
      </div>
    </div>
  );
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
