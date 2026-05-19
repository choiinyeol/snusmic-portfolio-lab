'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CandlestickSeries,
  createChart,
  LineSeries,
  type IChartApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { ReportStatisticsLabSummary } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import { formatMultiple, isNumber, mean, quantileFromSorted, trimmedMean, wilsonCI } from '@/lib/report-statistics';

export type PricePathBar = {
  day: number;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  closeKrw: number;
};

export type PricePathSeries = {
  reportId: string;
  symbol: string;
  company: string;
  currency: string;
  publicationDate: string;
  peakReturn: number;
  baseKrw: number;
  bars: PricePathBar[];
};

export type FeatureBucket = {
  group: 'alignment' | 'high52w';
  label: string;
  count: number;
  medianReturn: number | null;
  hitRate10: number;
  medianDaysToHit10: number | null;
  /** Two-sided Mann-Whitney U p-value vs the rest of the dimension's
   * qualifying universe. `null` when either side has too few samples. */
  pValue: number | null;
};

export type EarlyExitRule = {
  signalDay: number;
  threshold: number;
  label: string;
  triggered: number;
  triggeredDevastating: number;
  triggeredDeclining: number;
  triggeredTarget: number;
  notTriggered: number;
  totalDevastating: number;
  totalTarget: number;
  /** Of all devastating outcomes, how many would this rule have caught
   * early (and therefore prevented the catastrophic drawdown). */
  avoidedDevastating: number;
  avoidedDevastatingRate: number;
  /** Of all target hits, how many would this rule have wrongly exited
   * before the win materialized. The cost side of the rule. */
  lostTarget: number;
  lostTargetRate: number;
};

export function ReportStatisticsStory({
  summary,
  pricePaths,
  featureBuckets,
  earlyExitRules,
  windowDays,
}: {
  summary: ReportStatisticsLabSummary;
  pricePaths: { winners: PricePathSeries[]; losers: PricePathSeries[] };
  featureBuckets: FeatureBucket[];
  earlyExitRules: EarlyExitRule[];
  windowDays: number;
}) {
  const peakReturns = summary.riskScatter.map((row) => row.maxFavorableExcursion).filter(isNumber);
  const sortedReturns = [...peakReturns].sort((a, b) => a - b);
  const meanReturn = mean(peakReturns);
  const medianReturn = quantileFromSorted(sortedReturns, 0.5);
  const expiryReturns = summary.riskScatter.map((row) => row.expiryReturn ?? null).filter(isNumber);
  const sortedExpiry = [...expiryReturns].sort((a, b) => a - b);
  const expiryMedian = quantileFromSorted(sortedExpiry, 0.5);
  const expiryMean = mean(expiryReturns);
  const hitTargetCount = summary.riskScatter.filter((row) => row.hit10).length;
  const flatCount = peakReturns.filter((value) => value < 0.05).length;
  const returnQuantiles = {
    min: quantileFromSorted(sortedReturns, 0),
    p10: quantileFromSorted(sortedReturns, 0.1),
    p25: quantileFromSorted(sortedReturns, 0.25),
    median: medianReturn,
    p75: quantileFromSorted(sortedReturns, 0.75),
    p90: quantileFromSorted(sortedReturns, 0.9),
    max: quantileFromSorted(sortedReturns, 1),
  };
  const eligiblePathCount = peakReturns.length;
  const pathBuckets = buildPathBuckets(summary.riskScatter);
  const exampleMetaById = buildExampleMetaById(summary.topExamples);

  const trimmedMean10 = trimmedMean(peakReturns, 0.1);
  const uniqueSymbolCount = new Set(summary.riskScatter.map((row) => row.symbol).filter(Boolean)).size;
  const vintageCohorts = buildVintageCohorts(summary.riskScatter);
  const concentration = buildConcentration(summary.riskScatter);

  return (
    <div className="grid gap-10">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-xl font-semibold text-slate-950">리포트 통계</h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          기준일 {summary.sample.endDate} · 표본 {eligiblePathCount.toLocaleString('ko-KR')}건 · 유효 티커{' '}
          {uniqueSymbolCount.toLocaleString('ko-KR')}개 · 유효기간 {windowDays}거래일 (≈ 2년)
        </p>
      </header>

      <DistributionSignature
        mean={meanReturn}
        median={medianReturn}
        trimmed={trimmedMean10}
        sampleSize={eligiblePathCount}
        uniqueSymbols={uniqueSymbolCount}
        hitTargetCount={hitTargetCount}
        flatCount={flatCount}
        expiryMedian={expiryMedian}
        expiryMean={expiryMean}
        expirySample={expiryReturns.length}
      />

      <WholeSampleMap rows={summary.riskScatter} quantiles={returnQuantiles} />

      <WinnersLosersBoard rows={summary.riskScatter} />

      <PricePathOverlay
        title="가장 크게 간 종목 10건의 가격 경로"
        caption={`발간 당일을 0%로 두고 ${windowDays}거래일까지의 누적 수익률입니다. 종목을 선택하면 단일 OHLCV 차트로 전환됩니다.`}
        paths={pricePaths.winners}
        tone="good"
      />

      <PricePathOverlay
        title="발간 후 거의 못 오른 종목 10건의 가격 경로"
        caption={`발간 당일을 0%로 두고 ${windowDays}거래일까지의 누적 수익률입니다. 종목을 선택하면 단일 OHLCV 차트로 전환됩니다.`}
        paths={pricePaths.losers}
        tone="bad"
      />

      <ConcentrationInsight rows={concentration} />

      <EarlyExitRulesTable rules={earlyExitRules} />

      <FeatureBucketsTable buckets={featureBuckets} />

      <PathBucketPanel buckets={pathBuckets} exampleMetaById={exampleMetaById} total={eligiblePathCount} />

      <VintageCohortTable cohorts={vintageCohorts} />

      <DataNoteFooter
        sampleSize={eligiblePathCount}
        uniqueSymbols={uniqueSymbolCount}
        snapshotDate={summary.sample.endDate}
      />
    </div>
  );
}

function DistributionSignature({
  mean,
  median,
  trimmed,
  sampleSize,
  uniqueSymbols,
  hitTargetCount,
  flatCount,
  expiryMedian,
  expiryMean,
  expirySample,
}: {
  mean: number | null;
  median: number | null;
  trimmed: number | null;
  sampleSize: number;
  uniqueSymbols: number;
  hitTargetCount: number;
  flatCount: number;
  expiryMedian: number | null;
  expiryMean: number | null;
  expirySample: number;
}) {
  const compressDomain = Math.max(0.5, compressReturn(Math.max(1.5, mean ?? 0, median ?? 0, trimmed ?? 0)));
  const xLin = (value: number) => xScale(compressReturn(Math.max(0, value)), 0, compressDomain);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>발간 시점</span>
        <span>발간 후 고점</span>
      </div>
      <div className="relative mt-5 h-24 rounded-xl bg-gradient-to-r from-slate-100 via-emerald-50 to-emerald-200">
        <Marker x={xLin(median ?? 0)} label="중앙 고점" value={formatPercent(median)} tone="slate" />
        <Marker x={xLin(trimmed ?? 0)} label="10% 절단 평균" value={formatPercent(trimmed)} tone="amber" />
        <Marker x={xLin(mean ?? 0)} label="평균 고점" value={formatPercent(mean)} tone="blue" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="font-mono text-2xl font-semibold text-emerald-600">{hitTargetCount}</div>
          <div className="text-slate-500">1.0x 목표 도달</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-semibold text-slate-500">{flatCount}</div>
          <div className="text-slate-500">고점 +5% 미만</div>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">표본</dt>
          <dd className="font-mono font-semibold tabular-nums text-slate-950">
            {sampleSize.toLocaleString('ko-KR')}건
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">유효 티커</dt>
          <dd className="font-mono font-semibold tabular-nums text-slate-950">
            {uniqueSymbols.toLocaleString('ko-KR')}개
          </dd>
        </div>
      </dl>
      <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
        <span className="font-semibold text-slate-700">만료 종가 기준</span> (500거래일 경과 표본 {expirySample}건):
        중앙 <span className="font-mono font-semibold tabular-nums text-slate-950">{formatPercent(expiryMedian)}</span>{' '}
        · 평균 <span className="font-mono font-semibold tabular-nums text-slate-950">{formatPercent(expiryMean)}</span>.
        고점은 보유 중 한 번이라도 도달한 폭, 만료는 끝까지 들고 갔을 때의 종가 수익률입니다.
      </div>
    </div>
  );
}

function Marker({
  x,
  label,
  value,
  tone,
}: {
  x: number;
  label: string;
  value: string;
  tone: 'slate' | 'blue' | 'amber';
}) {
  const lineClass = tone === 'blue' ? 'bg-blue-600' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-950';
  return (
    <div className="absolute top-0 h-full" style={{ left: `${x}%` }}>
      <div className={`h-full w-px ${lineClass}`} />
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

/** Signed-log compression for the y-axis. Linear within ±50%, log10 beyond.
 * Lets one +1800% winner (HD현대일렉트릭) and many ±20% middle reports
 * share a single readable chart without the top getting clipped. */
function compressReturn(v: number, lin: number = 0.5): number {
  const sign = Math.sign(v);
  const abs = Math.abs(v);
  if (abs <= lin) return v;
  return sign * (lin + Math.log10(1 + (abs - lin)) * 2);
}

/** Pleasant tick set covering the observed range. Asymmetric because
 * downside is bounded near -100% while upside is unbounded. */
function pickYTicks(maxObserved: number): Array<{ value: number; label: string }> {
  const ticks: Array<{ value: number; label: string }> = [
    { value: -0.8, label: '-80%' },
    { value: -0.5, label: '-50%' },
    { value: -0.2, label: '-20%' },
    { value: 0, label: '0%' },
    { value: 0.2, label: '+20%' },
    { value: 0.5, label: '+50%' },
  ];
  if (maxObserved >= 1) ticks.push({ value: 1, label: '+100%' });
  if (maxObserved >= 2) ticks.push({ value: 2, label: '+200%' });
  if (maxObserved >= 5) ticks.push({ value: 5, label: '+500%' });
  if (maxObserved >= 10) ticks.push({ value: 10, label: '+1000%' });
  if (maxObserved >= 20) ticks.push({ value: 20, label: '+2000%' });
  return ticks;
}

function WholeSampleMap({
  rows,
  quantiles,
}: {
  rows: ReportStatisticsLabSummary['riskScatter'];
  quantiles: ReturnQuantiles;
}) {
  const sortedRows = rows
    .filter((row) => isNumber(row.maxFavorableExcursion))
    .sort((a, b) => (a.maxFavorableExcursion ?? 0) - (b.maxFavorableExcursion ?? 0));
  const maxReturn = sortedRows.length === 0 ? 1 : (sortedRows[sortedRows.length - 1].maxFavorableExcursion ?? 1);
  const yLo = 0;
  const yHi = compressReturn(Math.max(maxReturn, 1));
  const yTicks = pickYTicks(maxReturn).filter((tick) => tick.value >= 0);
  const topThreeIds = new Set(
    [...sortedRows]
      .slice(-3)
      .reverse()
      .map((row) => row.reportId),
  );

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">전체 리포트 발간 후 고점 지도</h3>
            <p className="mt-1 text-xs text-slate-500">
              점 하나가 리포트 한 건. 왼쪽부터 발간 후 고점이 낮은 순서. y축은 ±50% 안쪽 선형, 바깥 log 압축으로
              극단까지 같이 보입니다. 점을 누르면 리포트 상세로 이동합니다.
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
            n={sortedRows.length.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="relative h-[28rem] rounded-xl border border-slate-100 bg-white px-12 py-4">
          {yTicks.map((tick) => {
            const compressed = compressReturn(tick.value);
            const y = 100 - ((compressed - yLo) / (yHi - yLo)) * 100;
            const isZero = tick.value === 0;
            return (
              <div className="pointer-events-none" key={tick.value}>
                <div
                  className={
                    isZero
                      ? 'absolute left-12 right-12 h-px bg-slate-950/30'
                      : 'absolute left-12 right-12 h-px bg-slate-200/70'
                  }
                  style={{ top: `${y}%` }}
                />
                <span
                  className="absolute -translate-y-1/2 font-mono text-[10px] text-slate-500"
                  style={{ top: `${y}%`, left: '0.5rem' }}
                >
                  {tick.label}
                </span>
              </div>
            );
          })}
          {sortedRows.map((row, index) => {
            const value = row.maxFavorableExcursion ?? 0;
            const x = sortedRows.length <= 1 ? 50 : (index / (sortedRows.length - 1)) * 100;
            const compressed = compressReturn(value);
            const y = 100 - ((compressed - yLo) / (yHi - yLo)) * 100;
            const category = classifyOutcome(row);
            const tone = OUTCOME_CATEGORIES.find((meta) => meta.id === category)?.tone ?? 'neutral';
            const isTopWinner = topThreeIds.has(row.reportId);
            return (
              <DataPoint
                key={row.reportId}
                label={`${row.company} (${row.symbol})`}
                meta={`${row.publicationDate} · 순위 ${index + 1}/${sortedRows.length}`}
                tone={tone}
                x={x}
                y={y}
                href={`/reports/${encodeURIComponent(row.symbol)}/${encodeURIComponent(row.reportId)}`}
                rows={[
                  ['발간 후 고점', formatPercent(row.maxFavorableExcursion)],
                  ['만료 종가', formatPercent(row.expiryReturn ?? null)],
                  ['최대 하락폭', formatPercent(row.maxAdverseExcursion)],
                  ['목표 도달', targetHitLabel(row)],
                ]}
                annotation={isTopWinner ? `${row.company} ${formatPercent(row.maxFavorableExcursion)}` : undefined}
              />
            );
          })}
        </div>
      </div>

      <OutcomeBreakdownPanel rows={sortedRows} />

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-950">분위수로 본 표본</h3>
        <p className="mt-1 text-xs text-slate-500">
          평균은 위쪽 꼬리 몇 건이 크게 끌어올리지만, 중앙값은 표본 절반을 나누는 실제 위치입니다.
        </p>
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
    </div>
  );
}

type RiskScatterRow = ReportStatisticsLabSummary['riskScatter'][number];

function OutcomeBreakdownPanel({ rows }: { rows: RiskScatterRow[] }) {
  const counts = new Map<OutcomeCategory, number>();
  for (const row of rows) {
    const id = classifyOutcome(row);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const total = rows.length;
  const devastating = counts.get('devastating') ?? 0;
  const declining = counts.get('declining') ?? 0;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-950">결과 분류</h3>
        <p className="font-mono text-[11px] text-slate-500">
          치명적+손실 {devastating + declining}건 ({total ? formatPercent((devastating + declining) / total) : '—'})
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        매수해서 조금 오르거나 목표가에 못 닿은 건 큰 문제 아니지만, 발간 후 거의 못 오르고 만료까지 깊게 하락한 표본은
        별도로 봅니다.
      </p>
      <div className="mt-4 grid gap-2">
        {OUTCOME_CATEGORIES.map((category) => {
          const count = counts.get(category.id) ?? 0;
          const share = total ? count / total : 0;
          return (
            <div
              className="grid grid-cols-[1rem_minmax(0,16rem)_minmax(0,1fr)_5rem_3rem] items-center gap-3"
              key={category.id}
            >
              <span aria-hidden="true" className={`inline-block size-2.5 rounded-full ${category.swatchClass}`} />
              <div>
                <div className="text-sm font-semibold text-slate-950">{category.label}</div>
                <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{category.description}</div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${category.swatchClass}`} style={{ width: `${share * 100}%` }} />
              </div>
              <span className="text-right font-mono text-sm font-semibold tabular-nums text-slate-950">
                {count.toLocaleString('ko-KR')}건
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-slate-500">{formatPercent(share)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type OutcomeCategory = 'target' | 'partial' | 'upside' | 'flat' | 'declining' | 'devastating';

type OutcomeMeta = {
  id: OutcomeCategory;
  label: string;
  description: string;
  tone: 'good' | 'accent' | 'teal' | 'neutral' | 'warning' | 'bad';
  swatchClass: string;
};

const OUTCOME_CATEGORIES: OutcomeMeta[] = [
  {
    id: 'target',
    label: '1.0x 목표 도달',
    description: '발간 후 500거래일 안에 목표가에 한 번이라도 도달',
    tone: 'good',
    swatchClass: 'bg-blue-600',
  },
  {
    id: 'partial',
    label: '부분 도달 (0.6–0.8x)',
    description: '목표가의 60–80% 구간까지 도달',
    tone: 'accent',
    swatchClass: 'bg-violet-600',
  },
  {
    id: 'upside',
    label: '상승 기회 있었음',
    description: '목표 미도달이지만 발간 후 한 번이라도 +20% 이상 올랐던 표본',
    tone: 'teal',
    swatchClass: 'bg-teal-600',
  },
  {
    id: 'flat',
    label: '횡보',
    description: '발간 후 큰 등락 없이 ±10% 안쪽으로 끝난 표본',
    tone: 'neutral',
    swatchClass: 'bg-slate-400',
  },
  {
    id: 'declining',
    label: '손실 (-10% ~ -30%)',
    description: '만료 시점 종가가 -10% ~ -30% 사이',
    tone: 'warning',
    swatchClass: 'bg-amber-500',
  },
  {
    id: 'devastating',
    label: '계속 하락 · 치명적 손실',
    description: '발간 후 거의 못 오르고 만료 종가가 -30% 이하 — "사면 안 됐던" 표본',
    tone: 'bad',
    swatchClass: 'bg-rose-600',
  },
];

/** Classify a row into one of six buckets ordered from best to worst.
 * The split below the hit-target line is intentionally asymmetric:
 * upside misses with positive MFE are "OK", but unilateral losses get
 * two buckets (-10–30% and -30%+) because catastrophic losses are the
 * dominant risk on this page. */
function classifyOutcome(row: RiskScatterRow): OutcomeCategory {
  if (row.hit10) return 'target';
  if (row.hit08 || row.hit06) return 'partial';
  const peak = row.maxFavorableExcursion ?? 0;
  if (peak >= 0.2) return 'upside';
  const ref = row.expiryReturn ?? row.currentReturn ?? 0;
  if (ref <= -0.3) return 'devastating';
  if (ref <= -0.1) return 'declining';
  return 'flat';
}

type PathBucket = {
  id: string;
  label: string;
  question: string;
  count: number;
  share: number | null;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
  rule: string;
  examples: RiskScatterRow[];
};

function PathBucketPanel({
  buckets,
  exampleMetaById,
  total,
}: {
  buckets: PathBucket[];
  exampleMetaById: Map<string, ExampleMeta>;
  total: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">경로 진단 태그</h3>
          <p className="mt-1 text-xs text-slate-500">
            태그는 서로 겹칠 수 있습니다. 대표 사례는 추천 종목이 아니라 경로를 읽기 위한 예시입니다.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
          전체 {total.toLocaleString('ko-KR')}건
        </span>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {buckets.map((bucket) => (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4" key={bucket.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">{bucket.label}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{bucket.question}</p>
              </div>
              <div className="text-right">
                <div className={`font-mono text-xl font-semibold ${bucketToneClass(bucket.tone)}`}>
                  {bucket.count.toLocaleString('ko-KR')}
                </div>
                <div className="font-mono text-[11px] text-slate-500">{formatPercent(bucket.share, 1)}</div>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-white px-3 py-2 font-mono text-[11px] text-slate-500">{bucket.rule}</div>
            <div className="mt-3 grid gap-2">
              {bucket.examples.length ? (
                bucket.examples.map((row) => {
                  const meta = exampleMetaById.get(row.reportId);
                  return (
                    <Link
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg bg-white px-3 py-2 text-xs transition hover:bg-blue-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                      href={`/reports/${encodeURIComponent(row.symbol)}/${encodeURIComponent(row.reportId)}`}
                      key={`${bucket.id}-${row.reportId}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-slate-950">
                          {row.company} <span className="font-mono text-slate-500">{row.symbol}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                          {row.publicationDate} · {targetHitDetail(row, meta)} · 상세 보기
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-right font-mono tabular-nums">
                        <MetricMini
                          label="현재"
                          value={formatPercent(row.currentReturn)}
                          tone={(row.currentReturn ?? 0) >= 0 ? 'good' : 'bad'}
                        />
                        <MetricMini label="상승" value={formatPercent(row.maxFavorableExcursion)} tone="good" />
                        <MetricMini label="하락" value={formatPercent(row.maxAdverseExcursion)} tone="bad" />
                        <MetricMini label="목표대비" value={formatMultiple(row.upsideCaptureRatio)} tone="neutral" />
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-500">표본 부족</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricMini({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={tone === 'good' ? 'text-blue-600' : tone === 'bad' ? 'text-rose-600' : 'text-slate-700'}>
        {value}
      </div>
    </div>
  );
}

type ExampleMeta = {
  hit08Days: number | null;
  hit10Days: number | null;
};

function buildExampleMetaById(topExamples: ReportStatisticsLabSummary['topExamples']): Map<string, ExampleMeta> {
  const map = new Map<string, ExampleMeta>();
  Object.values(topExamples).forEach((examples) => {
    examples.forEach((example) => {
      const reportId = typeof example.reportId === 'string' ? example.reportId : null;
      if (!reportId) return;
      map.set(reportId, {
        hit08Days: readHitDays(example, '0.8'),
        hit10Days: readHitDays(example, '1'),
      });
    });
  });
  return map;
}

function readHitDays(example: Record<string, unknown>, key: '0.8' | '1'): number | null {
  const hit = example.hit;
  if (!hit || typeof hit !== 'object') return null;
  const target = (hit as Record<string, unknown>)[key];
  if (!target || typeof target !== 'object') return null;
  const days = (target as Record<string, unknown>).days;
  return typeof days === 'number' && Number.isFinite(days) ? days : null;
}

function targetHitDetail(row: RiskScatterRow, meta: ExampleMeta | undefined): string {
  if (row.hit10) return `1.0x 도달${formatHitDays(meta?.hit10Days)}`;
  if (row.hit08) return `0.8x 도달${formatHitDays(meta?.hit08Days)}`;
  if (row.hit06) return '0.6x 도달';
  return '목표 미도달';
}

function formatHitDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return '';
  if (days === 0) return ' · 발간일 고가 기준';
  return ` · ${days.toLocaleString('ko-KR')}거래일`;
}

function buildPathBuckets(rows: RiskScatterRow[]): PathBucket[] {
  const eligible = rows.filter((row) => isNumber(row.currentReturn));
  const bucket = (
    id: string,
    label: string,
    question: string,
    tone: PathBucket['tone'],
    rule: string,
    predicate: (row: RiskScatterRow) => boolean,
    sort: (a: RiskScatterRow, b: RiskScatterRow) => number,
  ): PathBucket => {
    const members = eligible.filter(predicate).sort(sort);
    return {
      id,
      label,
      question,
      count: members.length,
      share: eligible.length ? members.length / eligible.length : null,
      tone,
      rule,
      examples: members.slice(0, 3),
    };
  };

  return [
    bucket(
      'clean-winners',
      '빠른 적중에 가까운 승자',
      '0.8x 목표에 닿았고 현재도 의미 있게 오른 표본입니다. 기다림보다 실행 가능성을 보는 후보입니다.',
      'good',
      '0.8x 도달 · 현재 +20% 이상 · 중간 손실 -10% 이내',
      (row) => row.hit08 && (row.currentReturn ?? 0) >= 0.2 && (row.maxAdverseExcursion ?? 0) >= -0.1,
      (a, b) => (b.currentReturn ?? 0) - (a.currentReturn ?? 0),
    ),
    bucket(
      'painful-winners',
      '큰 손실 후 적중',
      '목표에 닿았지만 중간 손실이 컸던 표본입니다. 손절 규칙 검정에 중요합니다.',
      'warn',
      '0.8x 이상 도달 · 중간 손실 -20% 이하',
      (row) => row.hit08 && (row.maxAdverseExcursion ?? 0) <= -0.2,
      (a, b) => (a.maxAdverseExcursion ?? 0) - (b.maxAdverseExcursion ?? 0),
    ),
    bucket(
      'round-trips',
      '큰 초과상승 뒤 반납',
      '발간 후 한때 크게 올랐지만 현재 수익이 약하거나 음수인 표본입니다.',
      'neutral',
      '최대 상승 +50% 이상 · 현재 +10% 미만',
      (row) => (row.maxFavorableExcursion ?? 0) >= 0.5 && (row.currentReturn ?? 0) < 0.1,
      (a, b) => (b.maxFavorableExcursion ?? 0) - (a.maxFavorableExcursion ?? 0),
    ),
    bucket(
      'persistent-losers',
      '손실 꼬리',
      '평균 속에 숨기면 안 되는 실패 데이터입니다. 제외 조건과 시간 손절 후보입니다.',
      'bad',
      '현재 -20% 이하 · 최대 상승 +20% 미만',
      (row) => (row.currentReturn ?? 0) <= -0.2 && (row.maxFavorableExcursion ?? 0) < 0.2,
      (a, b) => (a.currentReturn ?? 0) - (b.currentReturn ?? 0),
    ),
  ];
}

function bucketToneClass(tone: PathBucket['tone']): string {
  if (tone === 'good') return 'text-blue-600';
  if (tone === 'bad') return 'text-rose-600';
  if (tone === 'warn') return 'text-amber-600';
  return 'text-slate-700';
}

function DataPoint({
  x,
  y,
  label,
  meta,
  tone,
  rows,
  href,
  annotation,
}: {
  x: number;
  y: number;
  label: string;
  meta: string;
  tone: 'good' | 'bad' | 'neutral' | 'accent' | 'teal' | 'warning';
  rows: Array<[string, string]>;
  href?: string;
  annotation?: string;
}) {
  const colorClass =
    tone === 'good'
      ? 'bg-blue-600 ring-blue-100'
      : tone === 'bad'
        ? 'bg-rose-600 ring-rose-100'
        : tone === 'warning'
          ? 'bg-amber-500 ring-amber-100'
          : tone === 'accent'
            ? 'bg-violet-600 ring-violet-100'
            : tone === 'teal'
              ? 'bg-teal-600 ring-teal-100'
              : 'bg-slate-400 ring-slate-100';

  const positionStyle = {
    left: `calc(1.25rem + ${x} * (100% - 2.5rem) / 100)`,
    top: `calc(1.25rem + ${y} * (100% - 2.5rem) / 100)`,
  };
  const ariaLabel = `${label} ${rows.map(([key, value]) => `${key} ${value}`).join(', ')}`;
  const dotClass = `size-2.5 rounded-full ring-4 transition-transform group-hover:scale-150 group-focus-visible:scale-150 ${colorClass}`;
  const tooltip = (
    <>
      {annotation ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-1 top-1/2 z-20 -translate-y-1/2 translate-x-full whitespace-nowrap rounded-sm bg-white/95 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 shadow-sm"
        >
          {annotation}
        </span>
      ) : null}
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
    </>
  );
  const wrapperClass =
    'group absolute z-10 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center outline-none';

  if (href) {
    return (
      <Link aria-label={ariaLabel} className={wrapperClass} href={href} style={positionStyle}>
        <span className={dotClass} />
        {tooltip}
      </Link>
    );
  }
  return (
    <span aria-label={ariaLabel} className={wrapperClass} style={positionStyle}>
      <span className={dotClass} />
      {tooltip}
    </span>
  );
}

function targetHitLabel(row: ReportStatisticsLabSummary['riskScatter'][number]): string {
  if (row.hit10) return '1.0x';
  if (row.hit08) return '0.8x';
  if (row.hit06) return '0.6x';
  return '미도달';
}

function xScale(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/** Trading-day index 0 maps to this UTC timestamp; subsequent days are
 * added in 86400-second increments. lightweight-charts requires actual
 * unix timestamps for its time axis, so we synthesize a "day → date"
 * mapping and relabel ticks back to `{N}D` in the formatter. */
const PRICE_PATH_BASE_TIME = 946684800; // 2000-01-01 UTC

function PricePathOverlay({
  title,
  caption,
  paths,
  tone,
}: {
  title: string;
  caption: string;
  paths: PricePathSeries[];
  tone: 'good' | 'bad';
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (paths.find((p) => p.reportId === selectedId) ?? null) : null;

  if (paths.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 text-xs text-slate-500">표시할 가격 경로가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{caption}</p>
        </div>
        {selected ? (
          <div className="flex items-center gap-2 text-xs">
            <button
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-600 transition-colors hover:bg-slate-50"
              onClick={() => setSelectedId(null)}
              type="button"
            >
              ← 전체 보기
            </button>
            <Link
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 transition-colors hover:bg-slate-50"
              href={`/reports/${encodeURIComponent(selected.symbol)}/${encodeURIComponent(selected.reportId)}`}
            >
              리포트 상세 ↗
            </Link>
          </div>
        ) : null}
      </header>
      {selected ? (
        <PricePathCandlestick path={selected} tone={tone} />
      ) : (
        <PricePathLineOverlay paths={paths} tone={tone} />
      )}
      {selected ? null : (
        <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {paths.map((path, i) => {
            const opacity = 0.4 + 0.55 * (1 - i / Math.max(1, paths.length - 1));
            const swatch =
              tone === 'good'
                ? `rgba(16, 185, 129, ${opacity.toFixed(2)})`
                : `rgba(244, 63, 94, ${opacity.toFixed(2)})`;
            return (
              <li key={path.reportId}>
                <button
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-50"
                  onClick={() => setSelectedId(path.reportId)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: swatch }}
                  />
                  <span className="truncate font-semibold text-slate-950">{path.company}</span>
                  <span className="ml-auto font-mono tabular-nums text-slate-700">
                    {formatPercent(path.peakReturn)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PricePathLineOverlay({ paths, tone }: { paths: PricePathSeries[]; tone: 'good' | 'bad' }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || paths.length === 0) return;
    const chart: IChartApi = createChart(node, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#475569', fontFamily: 'inherit' },
      grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
      rightPriceScale: { borderColor: '#e2e8f0', scaleMargins: { top: 0.05, bottom: 0.08 } },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: false,
        secondsVisible: false,
        tickMarkFormatter: (time: number) => {
          const day = Math.round((time - PRICE_PATH_BASE_TIME) / 86400);
          return `${day}D`;
        },
      },
      localization: {
        priceFormatter: (price: number) => `${(price * 100).toFixed(0)}%`,
        timeFormatter: (time: number) => {
          const day = Math.round((Number(time) - PRICE_PATH_BASE_TIME) / 86400);
          return `${day}거래일`;
        },
      },
      crosshair: { mode: 1 },
    });
    for (let i = 0; i < paths.length; i += 1) {
      const path = paths[i];
      const opacity = 0.4 + 0.55 * (1 - i / Math.max(1, paths.length - 1));
      const color =
        tone === 'good' ? `rgba(16, 185, 129, ${opacity.toFixed(2)})` : `rgba(244, 63, 94, ${opacity.toFixed(2)})`;
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      series.setData(
        path.bars.map((bar) => ({
          time: (PRICE_PATH_BASE_TIME + bar.day * 86400) as UTCTimestamp,
          value: bar.closeKrw / path.baseKrw - 1,
        })),
      );
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [paths, tone]);

  return (
    <div className="mt-4 h-[28rem] w-full overflow-hidden rounded-xl border border-slate-100" ref={containerRef} />
  );
}

function PricePathCandlestick({ path, tone }: { path: PricePathSeries; tone: 'good' | 'bad' }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const chart: IChartApi = createChart(node, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#475569', fontFamily: 'inherit' },
      grid: { vertLines: { color: '#e2e8f0' }, horzLines: { color: '#e2e8f0' } },
      rightPriceScale: { borderColor: '#e2e8f0', scaleMargins: { top: 0.05, bottom: 0.08 } },
      timeScale: { borderColor: '#e2e8f0', timeVisible: false, secondsVisible: false },
      crosshair: { mode: 1 },
    });
    const accent = tone === 'good' ? '#16a34a' : '#e11d48';
    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#059669',
      borderDownColor: '#dc2626',
      wickUpColor: '#059669',
      wickDownColor: '#dc2626',
    });
    series.setData(
      path.bars.map((bar) => ({
        time: bar.time as Time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    );
    const basePrice = path.bars[0]?.close ?? 0;
    if (basePrice > 0) {
      series.createPriceLine({
        price: basePrice,
        color: accent,
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '발간',
      });
    }
    const expiryBar = path.bars[path.bars.length - 1];
    if (expiryBar && expiryBar.close > 0) {
      series.createPriceLine({
        price: expiryBar.close,
        color: '#64748b',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '만료',
      });
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [path, tone]);

  return (
    <div className="mt-4 grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
        <div>
          <div className="text-sm font-semibold text-slate-950">
            {path.company} <span className="font-mono text-xs text-slate-500">({path.symbol})</span>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">
            발간 {path.publicationDate} · {path.bars.length}거래일 · {path.currency}
          </div>
        </div>
        <div
          className={`font-mono text-base font-semibold tabular-nums ${tone === 'good' ? 'text-emerald-600' : 'text-rose-600'}`}
        >
          고점 {formatPercent(path.peakReturn)}
        </div>
      </div>
      <div className="h-[28rem] w-full overflow-hidden rounded-xl border border-slate-100" ref={containerRef} />
    </div>
  );
}

type VintageCohort = {
  year: string;
  reports: number;
  hits: number;
  hitRate: number;
  ciLo: number;
  ciHi: number;
  medianReturn: number | null;
};

function buildVintageCohorts(rows: RiskScatterRow[]): VintageCohort[] {
  const byYear = new Map<string, { reports: number; hits: number; returns: number[] }>();
  for (const row of rows) {
    if (!row.publicationDate) continue;
    const year = row.publicationDate.slice(0, 4);
    const bucket = byYear.get(year) ?? { reports: 0, hits: 0, returns: [] };
    bucket.reports += 1;
    if (row.hit10) bucket.hits += 1;
    if (isNumber(row.maxFavorableExcursion)) bucket.returns.push(row.maxFavorableExcursion);
    byYear.set(year, bucket);
  }
  return Array.from(byYear.entries())
    .map(([year, bucket]) => {
      const ci = wilsonCI(bucket.hits, bucket.reports);
      const sorted = [...bucket.returns].sort((a, b) => a - b);
      return {
        year,
        reports: bucket.reports,
        hits: bucket.hits,
        hitRate: ci.point,
        ciLo: ci.lo,
        ciHi: ci.hi,
        medianReturn: quantileFromSorted(sorted, 0.5),
      };
    })
    .sort((a, b) => a.year.localeCompare(b.year));
}

function DataNoteFooter({
  sampleSize,
  uniqueSymbols,
  snapshotDate,
}: {
  sampleSize: number;
  uniqueSymbols: number;
  snapshotDate: string;
}) {
  return (
    <footer aria-label="데이터 노트" className="border-t border-slate-200 pt-5">
      <p className="font-mono text-[11px] text-slate-500">
        기준일 {snapshotDate} · 표본 {sampleSize.toLocaleString('ko-KR')}건 · 유효 티커{' '}
        {uniqueSymbols.toLocaleString('ko-KR')}개 · 종가 기준 · 거래비용 미반영
      </p>
    </footer>
  );
}

function VintageCohortTable({ cohorts }: { cohorts: VintageCohort[] }) {
  if (cohorts.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="발간 연도별">
      <header className="border-b border-slate-200 px-4 py-2">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          발간 연도별
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-950">시장 국면이 다른 해의 표본을 분리해서 봅니다</h3>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">발간연도</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">표본</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">목표 도달</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">도달률</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">추정 범위</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">중앙 수익률</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cohorts.map((cohort) => (
            <tr key={cohort.year}>
              <td className="px-3 py-2 font-mono text-xs text-slate-950">{cohort.year}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{cohort.reports}</td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">{cohort.hits}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-slate-950">
                {formatPercent(cohort.hitRate)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-slate-500">
                {formatPercent(cohort.ciLo)}–{formatPercent(cohort.ciHi)}
              </td>
              <td
                className={`px-3 py-2 text-right font-mono tabular-nums ${
                  (cohort.medianReturn ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatPercent(cohort.medianReturn)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function EarlyExitRulesTable({ rules }: { rules: EarlyExitRule[] }) {
  if (rules.length === 0) return null;
  const best = [...rules].sort((a, b) => {
    const aScore = a.avoidedDevastatingRate - a.lostTargetRate;
    const bScore = b.avoidedDevastatingRate - b.lostTargetRate;
    return bScore - aScore;
  })[0];
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="조기 손절 규칙">
      <header className="border-b border-slate-200 px-4 py-2">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          치명적 손실 회피 규칙
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-950">발간 후 며칠 안에 얼마나 빠지면 손절할까</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          치명적 손실 ({rules[0]?.totalDevastating ?? 0}건)을 사후 데이터로 보면, 대부분 발간 후 20거래일 이내에 이미 큰
          폭으로 빠지기 시작합니다. 각 손절 규칙이 치명적 손실을 얼마나 거르고, 1.0x 목표를 얼마나 헛 놓치는지를 같이
          봅니다.
        </p>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">규칙</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">발동</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">회피한 치명적</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">놓친 목표</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">차이</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rules.map((rule) => {
            const isBest = rule === best;
            const delta = rule.avoidedDevastatingRate - rule.lostTargetRate;
            return (
              <tr className={isBest ? 'bg-emerald-50/50' : undefined} key={`${rule.signalDay}-${rule.threshold}`}>
                <td className="px-3 py-2">
                  <div className="text-sm text-slate-950">{rule.label}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                    {rule.totalDevastating}건 중 {rule.avoidedDevastating}건 회피 · 목표 {rule.totalTarget}건 중{' '}
                    {rule.lostTarget}건 손절
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{rule.triggered}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-emerald-700">
                  {formatPercent(rule.avoidedDevastatingRate)}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-600">
                  {formatPercent(rule.lostTargetRate)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-mono tabular-nums ${
                    delta >= 0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {(delta >= 0 ? '+' : '') + formatPercent(delta)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] leading-5 text-slate-600">
        <span className="font-semibold text-slate-700">차이</span> = 회피한 치명적률 − 놓친 목표율. 값이 양수일수록
        규칙이 평균적으로 도움이 됩니다 (치명적을 거르는 효과 &gt; 목표 놓치는 손실). 가장 큰 양수가 강조됩니다.
      </footer>
    </section>
  );
}

function FeatureBucketsTable({ buckets }: { buckets: FeatureBucket[] }) {
  if (buckets.length === 0) return null;
  const groups: Array<{ id: FeatureBucket['group']; label: string }> = [
    { id: 'alignment', label: '추세 정배열' },
    { id: 'high52w', label: '52주 고가 근접도' },
  ];
  return (
    <section
      className="overflow-hidden rounded-md border border-slate-200 bg-white"
      aria-label="발간 시점 기술적 특성별"
    >
      <header className="border-b border-slate-200 px-4 py-2">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          발간 시점 기술적 특성별
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-950">정배열·신고가 근접·갭이 결과를 가른 폭</h3>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">특성</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">표본</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">중앙 수익률</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">1.0x 도달</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">도달 중앙 일수</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groups.flatMap((group) => {
            const groupBuckets = buckets.filter((bucket) => bucket.group === group.id);
            if (groupBuckets.length === 0) return [];
            return [
              <tr className="bg-slate-50/60" key={`group-${group.id}`}>
                <td
                  className="px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"
                  colSpan={5}
                >
                  {group.label}
                </td>
              </tr>,
              ...groupBuckets.map((bucket) => (
                <tr key={`${bucket.group}-${bucket.label}`}>
                  <td className="px-3 py-2 text-sm text-slate-950">{bucket.label}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{bucket.count}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono tabular-nums ${
                      (bucket.medianReturn ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatPercent(bucket.medianReturn)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-950">
                    {formatPercent(bucket.hitRate10)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-500">
                    {bucket.medianDaysToHit10 !== null ? `${bucket.medianDaysToHit10.toLocaleString('ko-KR')}일` : '—'}
                  </td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </section>
  );
}

type ConcentrationRow = {
  topN: number;
  share: number;
  totalGain: number;
};

/** Concentration of positive returns. Sum up every report's positive
 * current return, then show what share of that sum the top-N reports
 * contribute. Tells the retail-investor truth that a handful of names
 * carry most of the upside. */
function buildConcentration(rows: RiskScatterRow[]): ConcentrationRow[] {
  const positive = rows
    .map((row) => row.maxFavorableExcursion)
    .filter(isNumber)
    .filter((value): value is number => value > 0)
    .sort((a, b) => b - a);
  const totalGain = positive.reduce((sum, value) => sum + value, 0);
  const topShare = (n: number) => positive.slice(0, n).reduce((sum, value) => sum + value, 0);
  return [1, 3, 5, 10, 25].map((topN) => ({
    topN,
    share: totalGain > 0 ? topShare(topN) / totalGain : 0,
    totalGain,
  }));
}

function ConcentrationInsight({ rows }: { rows: ConcentrationRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-950">상위 N건이 누적 고점 수익의 몇 %를 만들었나</h3>
        <p className="mt-1 text-xs text-slate-500">
          모든 리포트의 발간 후 고점 수익률을 더한 값을 100%로 두고, 상위 몇 건이 그중 얼마를 차지하는지 봅니다.
        </p>
        <div className="mt-5 grid gap-4">
          {rows.map((row) => (
            <div className="grid grid-cols-[3rem_minmax(0,1fr)_5rem] items-center gap-3" key={row.topN}>
              <span className="font-mono text-xs font-semibold text-slate-500">상위 {row.topN}</span>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-950"
                  style={{ width: `${Math.max(2, row.share * 100)}%` }}
                />
              </div>
              <span className="text-right font-mono text-sm font-semibold tabular-nums text-slate-950">
                {formatPercent(row.share)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WinnersLosersBoard({ rows }: { rows: RiskScatterRow[] }) {
  const eligible = rows.filter((row) => isNumber(row.maxFavorableExcursion));
  const winners = [...eligible]
    .sort((a, b) => (b.maxFavorableExcursion ?? 0) - (a.maxFavorableExcursion ?? 0))
    .slice(0, 10);
  const losers = [...eligible]
    .sort((a, b) => (a.maxFavorableExcursion ?? 0) - (b.maxFavorableExcursion ?? 0))
    .slice(0, 10);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CaseList title="고점 기준 가장 크게 간 종목 10" tone="good" rows={winners} />
      <CaseList title="발간 후 거의 못 오른 종목 10" tone="bad" rows={losers} />
    </div>
  );
}

function CaseList({ title, tone, rows }: { title: string; tone: 'good' | 'bad'; rows: RiskScatterRow[] }) {
  const accent = tone === 'good' ? 'text-emerald-700' : 'text-rose-700';
  const valueColor = tone === 'good' ? 'text-emerald-600' : 'text-rose-600';
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-2">
        <div className={`font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${accent}`}>{title}</div>
        <p className="mt-0.5 font-mono text-[10px] text-slate-400">고점 / 만료 종가 (500거래일)</p>
      </header>
      <ol className="divide-y divide-slate-100">
        {rows.map((row, index) => (
          <li key={row.reportId}>
            <Link
              className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
              href={`/reports/${encodeURIComponent(row.symbol)}/${encodeURIComponent(row.reportId)}`}
            >
              <span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">{row.company}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-slate-500">
                  {row.symbol} · 발간 {row.publicationDate} · {targetHitLabel(row)}
                </div>
              </div>
              <div className="text-right">
                <div className={`font-mono text-base font-semibold tabular-nums ${valueColor}`}>
                  {formatPercent(row.maxFavorableExcursion)}
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                  만료 {formatPercent(row.expiryReturn ?? null)}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
