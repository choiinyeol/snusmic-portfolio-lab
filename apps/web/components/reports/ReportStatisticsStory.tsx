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
import { formatDateKo, formatPercent } from '@/lib/format';
import {
  buildPeakReturnDistribution,
  formatMultiple,
  isNumber,
  mean,
  quantileFromSorted,
  trimmedMean,
  wilsonCI,
} from '@/lib/report-statistics';
import type { PricePathSeries } from '@/lib/view-models/report-statistics';

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

export type ConfirmationSignal = {
  id:
    | 'risk_no_5pct_60d'
    | 'risk_deep_drop_20d'
    | 'risk_first_5_negative'
    | 'pass_first_5pct_5d'
    | 'pass_first_5pct_21_60'
    | 'pass_dip_recover';
  kind: 'risk' | 'pass';
  label: string;
  description: string;
  cohortSize: number;
  cohortShare: number;
  successRate: number;
  devastatingRate: number;
  targetRate: number;
  baselineSuccess: number;
  baselineDevastating: number;
  baselineTarget: number;
};

export function ReportStatisticsStory({
  summary,
  pricePaths,
  featureBuckets,
  confirmationSignals,
  windowDays,
}: {
  summary: ReportStatisticsLabSummary;
  pricePaths: { winners: PricePathSeries[]; losers: PricePathSeries[] };
  featureBuckets: FeatureBucket[];
  confirmationSignals: ConfirmationSignal[];
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
  const _pathBuckets = buildPathBuckets(summary.riskScatter);
  const _exampleMetaById = buildExampleMetaById(summary.topExamples);

  const trimmedMean10 = trimmedMean(peakReturns, 0.1);
  const uniqueSymbolCount = new Set(summary.riskScatter.map((row) => row.symbol).filter(Boolean)).size;
  const _vintageCohorts = buildVintageCohorts(summary.riskScatter);
  const concentration = buildConcentration(summary.riskScatter);
  const top10Concentration = concentration.find((row) => row.topN === 10)?.share ?? null;

  return (
    <div className="grid gap-5">
      <StatisticsHeader
        endDate={summary.sample.endDate}
        sampleSize={eligiblePathCount}
        uniqueSymbols={uniqueSymbolCount}
        windowDays={windowDays}
      />

      <ExecutiveSummary
        expiryMedian={expiryMedian}
        flatCount={flatCount}
        hitTargetCount={hitTargetCount}
        medianReturn={medianReturn}
        sampleSize={eligiblePathCount}
        signals={confirmationSignals}
        top10Concentration={top10Concentration}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
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

        <ConcentrationInsight rows={concentration} />
      </div>

      <WholeSampleMap rows={summary.riskScatter} quantiles={returnQuantiles} />

      <WinnersLosersBoard rows={summary.riskScatter} />

      <PricePathOverlay
        title="고점 수익 상위 10 가격 경로"
        caption={`발간일을 0%로 정규화한 ${windowDays}거래일 경로입니다. 종목을 선택하면 단일 OHLCV 차트로 전환됩니다.`}
        paths={pricePaths.winners}
        tone="good"
      />

      <PricePathOverlay
        title="고점 수익 하위 10 가격 경로"
        caption={`발간일을 0%로 정규화한 ${windowDays}거래일 경로입니다. 상승 기회가 거의 없었던 리포트를 빠르게 확인합니다.`}
        paths={pricePaths.losers}
        tone="bad"
      />

      <FeatureBucketsTable buckets={featureBuckets} />

      <DataNoteFooter
        sampleSize={eligiblePathCount}
        uniqueSymbols={uniqueSymbolCount}
        snapshotDate={summary.sample.endDate}
      />
    </div>
  );
}

function StatisticsHeader({
  endDate,
  sampleSize,
  uniqueSymbols,
  windowDays,
}: {
  endDate: string;
  sampleSize: number;
  uniqueSymbols: number;
  windowDays: number;
}) {
  return (
    <header className="rounded-md border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <div className="font-mono text-[11px] font-semibold uppercase text-slate-500">Performance statistics</div>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">리포트 성과 통계</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            발간 리포트가 실제 가격 경로에서 어느 정도 기회와 손실을 만들었는지, 목표 도달·고점·만료 종가를 같은
            기준으로 비교합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 md:max-w-md md:justify-end">
          <span className="snapshot-pill">기준일 {formatDateKo(endDate)}</span>
          <span className="snapshot-pill">표본 {sampleSize.toLocaleString('ko-KR')}건</span>
          <span className="snapshot-pill">티커 {uniqueSymbols.toLocaleString('ko-KR')}개</span>
          <span className="snapshot-pill">{windowDays}거래일</span>
        </div>
      </div>
    </header>
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
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">수익 분포의 중심</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            평균보다 중앙값과 절단 평균을 먼저 봅니다. 몇 개의 대형 성공 사례가 전체 평균을 크게 당깁니다.
          </p>
        </div>
        <span className="font-mono text-[11px] text-slate-500">peak return</span>
      </div>
      <div className="relative mt-4 h-20 rounded-md border border-slate-200 bg-slate-50">
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

function ExecutiveSummary({
  sampleSize,
  hitTargetCount,
  medianReturn,
  flatCount,
  expiryMedian,
  signals,
  top10Concentration,
}: {
  sampleSize: number;
  hitTargetCount: number;
  medianReturn: number | null;
  flatCount: number;
  expiryMedian: number | null;
  signals: ConfirmationSignal[];
  top10Concentration: number | null;
}) {
  const targetRate = sampleSize ? hitTargetCount / sampleSize : null;
  const flatShare = sampleSize ? flatCount / sampleSize : null;
  const riskSignal = signals
    .filter((signal) => signal.kind === 'risk')
    .sort((a, b) => b.devastatingRate - a.devastatingRate)[0];
  const passSignal = signals
    .filter((signal) => signal.kind === 'pass')
    .sort((a, b) => b.successRate - a.successRate)[0];
  return (
    <section
      className={`grid gap-4 rounded-md border border-slate-200 bg-white p-4 ${
        signals.length > 0 ? 'xl:grid-cols-[minmax(0,1fr)_24rem]' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">핵심 판독</div>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          목표가를 맞힌 리포트는 많지 않지만, 큰 수익 기회는 소수 종목에 강하게 집중됩니다.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          이 화면은 “어떤 리포트가 좋았나”보다 “어떤 가격 경로를 먼저 의심해야 하나”를 보게 만드는 통계 보드입니다.
        </p>
        <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-5 md:grid-cols-3">
          <div>
            <div className="font-semibold text-slate-700">1. 표본과 목표가</div>
            <p className="mt-1 text-slate-600">
              {sampleSize.toLocaleString('ko-KR')}건 중 {hitTargetCount.toLocaleString('ko-KR')}건
              {`(${formatPercent(targetRate)})`}만 1.0x 목표가를 찍었습니다.
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-700">2. 중앙값과 무반응</div>
            <p className="mt-1 text-slate-600">
              중앙 고점은 {formatPercent(medianReturn)}, +5% 미만은 {flatCount.toLocaleString('ko-KR')}건
              {`(${formatPercent(flatShare)})`}입니다.
            </p>
          </div>
          <div>
            <div className="font-semibold text-slate-700">3. 집중도와 만료</div>
            <p className="mt-1 text-slate-600">
              상위 10건 집중도 {formatPercent(top10Concentration)}, 만료 중앙 {formatPercent(expiryMedian)}를 보고 평균
              착시를 걸러냅니다.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <SummaryMetric
            label="목표가 도달률"
            value={formatPercent(targetRate)}
            caption={`${hitTargetCount.toLocaleString('ko-KR')}건`}
            tone="good"
          />
          <SummaryMetric label="중앙 고점 수익" value={formatPercent(medianReturn)} tone="good" />
          <SummaryMetric
            label="고점 +5% 미만"
            value={formatPercent(flatShare)}
            caption={`${flatCount.toLocaleString('ko-KR')}건`}
            tone="warn"
          />
          <SummaryMetric
            label="만료 중앙 수익"
            value={formatPercent(expiryMedian)}
            tone={(expiryMedian ?? 0) >= 0 ? 'good' : 'bad'}
          />
          <SummaryMetric label="상위 10 집중도" value={formatPercent(top10Concentration)} tone="warn" />
        </div>
      </div>
      {signals.length > 0 ? (
        <div className="grid content-start gap-2 rounded-md bg-slate-50 p-3">
          <InsightLine
            label="강한 확인 신호"
            value={passSignal?.label ?? '표본 없음'}
            caption={passSignal ? `성공률 ${formatPercent(passSignal.successRate)}` : undefined}
          />
          <InsightLine
            label="주의 신호"
            value={riskSignal?.label ?? '표본 없음'}
            caption={riskSignal ? `큰 손실 ${formatPercent(riskSignal.devastatingRate)}` : undefined}
          />
        </div>
      ) : null}
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption?: string;
  tone: 'good' | 'warn' | 'bad';
}) {
  const color = tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-red-600' : 'text-amber-600';
  return (
    <div className="grid min-w-0 gap-1 rounded-md border border-slate-200 bg-white p-3">
      <div className="truncate text-xs text-slate-500">{label}</div>
      <div className={`truncate font-mono text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {caption ? <div className="truncate text-xs text-slate-500">{caption}</div> : null}
    </div>
  );
}

function InsightLine({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-950">{value}</div>
      {caption ? <div className="mt-1 text-xs text-slate-500">{caption}</div> : null}
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
      <div className="rounded-md border border-slate-200 bg-white p-4" id="sample-map">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">전체 표본 고점 지도</h3>
            <p className="mt-1 text-xs text-slate-500">
              점 하나가 리포트 한 건입니다. 왼쪽부터 고점 수익률이 낮은 순서로 정렬했고, 점을 누르면 리포트 상세로
              이동합니다.
            </p>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
            n={sortedRows.length.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-600">
          <span className="font-semibold text-slate-700">읽는 법</span>: 0% 부근에 몰린 점은 기회가 거의 없던 리포트,
          위쪽으로 튀는 점은 큰 상승 경로가 있었던 리포트입니다. 극단값 때문에 y축은 압축했습니다.
        </div>
        <div className="relative h-[22rem] rounded-md border border-slate-100 bg-white px-12 py-4">
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
            const category = classifyScatterTone(row);
            const tone = SCATTER_TONE_CATEGORIES.find((meta) => meta.id === category)?.tone ?? 'neutral';
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

      <div className="rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-950">분위수 요약</h3>
        <p className="mt-1 text-xs text-slate-500">
          평균은 오른쪽 꼬리 몇 건이 끌어올릴 수 있습니다. 중앙값과 P75/P90을 같이 봐야 일반적인 기회를 놓치지 않습니다.
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
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3" key={label as string}>
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
  const total = rows.length;
  const distribution = buildPeakReturnDistribution(rows);
  const [selectedBinId, setSelectedBinId] = useState<string | null>(distribution.defaultBinId);
  const selectedBin = distribution.bins.find((bin) => bin.id === selectedBinId) ?? distribution.bins[0];
  const selectedRows = selectedBin?.rows ?? [];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-950">고점 수익률 구간 분포</h3>
        <p className="font-mono text-[11px] text-slate-500">n={total.toLocaleString('ko-KR')}</p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        성공/실패 판정보다 발간 후 한 번이라도 도달한 고점 수익률을 구간으로 봅니다. 평균이 중앙값보다 높고 P90이 멀리
        벌어질수록 우측 꼬리가 긴 분포입니다.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2 md:max-w-xl">
        <DistributionMetric label="평균 고점" value={formatPercent(distribution.mean)} />
        <DistributionMetric label="중앙 고점" value={formatPercent(distribution.median)} />
        <DistributionMetric label="P90 고점" value={formatPercent(distribution.p90)} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-1.5">
          {distribution.bins.map((bin) => {
            const selected = selectedBin?.id === bin.id;
            return (
              <button
                aria-pressed={selected}
                className={`grid grid-cols-[5.25rem_minmax(0,1fr)_4.5rem_4rem] items-center gap-3 rounded-md px-2 py-2 text-left transition ${
                  selected ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                key={bin.id}
                onClick={() => setSelectedBinId(bin.id)}
                type="button"
              >
                <span
                  className={`font-mono text-[11px] font-semibold tabular-nums ${selected ? 'text-white' : bin.textClass}`}
                >
                  {bin.label}
                </span>
                <span className={`h-2 overflow-hidden rounded-full ${selected ? 'bg-white/20' : 'bg-slate-200'}`}>
                  <span
                    className={`block h-full rounded-full ${selected ? 'bg-white' : bin.barClass}`}
                    style={{ width: `${Math.max(2, bin.share * 100)}%` }}
                  />
                </span>
                <span className="text-right font-mono text-xs font-semibold tabular-nums">
                  {bin.count.toLocaleString('ko-KR')}건
                </span>
                <span
                  className={`text-right font-mono text-[11px] tabular-nums ${selected ? 'text-white/70' : 'text-slate-500'}`}
                >
                  {formatPercent(bin.share)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-950">{selectedBin?.label ?? '구간'} 종목</h4>
            <span className="font-mono text-[11px] text-slate-500">
              {selectedRows.length.toLocaleString('ko-KR')}건
            </span>
          </div>
          <div className="mt-3 max-h-80 overflow-y-auto pr-1">
            {selectedRows.length ? (
              <div className="grid gap-1.5">
                {selectedRows.map((row) => (
                  <Link
                    className="grid grid-cols-[minmax(0,1fr)_4.5rem] gap-3 rounded-md bg-white px-3 py-2 text-xs transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
                    href={`/reports/${encodeURIComponent(row.symbol)}/${encodeURIComponent(row.reportId)}`}
                    key={row.reportId}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-950">{statisticsReportName(row)}</span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">
                        {row.publicationDate}
                      </span>
                    </span>
                    <span
                      className={`text-right font-mono text-xs font-semibold tabular-nums ${signedTextClass(row.maxFavorableExcursion ?? 0)}`}
                    >
                      {formatPercent(row.maxFavorableExcursion ?? null)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-white px-3 py-6 text-center text-xs text-slate-500">
                해당 구간의 표본이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DistributionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function statisticsReportName(row: RiskScatterRow): string {
  const symbol = stripMarketSuffix(row.symbol);
  if (row.symbol.endsWith('.KS') || row.symbol.endsWith('.KQ')) return row.company || symbol;
  if (!row.symbol.includes('.')) return symbol;

  const hasReadableLocalName = Array.from(row.company).some((char) => char.charCodeAt(0) > 127);
  return hasReadableLocalName ? row.company : symbol;
}

function stripMarketSuffix(symbol: string): string {
  return symbol.replace(/\.(KS|KQ|KONEX|T|HK|SS|SZ|AS|PA|SW)$/i, '');
}

function signedTextClass(value: number): string {
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-rose-600';
  return 'text-slate-500';
}

type ScatterToneCategory = 'target' | 'partial' | 'upside' | 'flat' | 'declining' | 'devastating';

type ScatterToneMeta = {
  id: ScatterToneCategory;
  tone: 'good' | 'accent' | 'teal' | 'neutral' | 'warning' | 'bad';
};

const SCATTER_TONE_CATEGORIES: ScatterToneMeta[] = [
  {
    id: 'target',
    tone: 'good',
  },
  {
    id: 'partial',
    tone: 'accent',
  },
  {
    id: 'upside',
    tone: 'teal',
  },
  {
    id: 'flat',
    tone: 'neutral',
  },
  {
    id: 'declining',
    tone: 'warning',
  },
  {
    id: 'devastating',
    tone: 'bad',
  },
];

/** Classify a row into one of six buckets ordered from best to worst.
 * The split below the hit-target line is intentionally asymmetric:
 * upside misses with positive MFE are "OK", but unilateral losses get
 * two buckets (-10–30% and -30%+) because catastrophic losses are the
 * dominant risk on this page. */
function classifyScatterTone(row: RiskScatterRow): ScatterToneCategory {
  if (row.hit10) return 'target';
  if (row.hit08 || row.hit06) return 'partial';
  const peak = row.maxFavorableExcursion ?? 0;
  if (peak >= 0.3) return 'upside';
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

function _PathBucketPanel({
  buckets,
  exampleMetaById,
  total,
}: {
  buckets: PathBucket[];
  exampleMetaById: Map<string, ExampleMeta>;
  total: number;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
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
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4" key={bucket.id}>
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
            <div className="mt-3 rounded-md bg-white px-3 py-2 font-mono text-[11px] text-slate-500">{bucket.rule}</div>
            <div className="mt-3 grid gap-2">
              {bucket.examples.length ? (
                bucket.examples.map((row) => {
                  const meta = exampleMetaById.get(row.reportId);
                  return (
                    <Link
                      className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md bg-white px-3 py-2 text-xs transition hover:bg-blue-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
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
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 text-xs text-slate-500">표시할 가격 경로가 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
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
    <div className="mt-4 h-[24rem] w-full overflow-hidden rounded-md border border-slate-100" ref={containerRef} />
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
      <div className="h-[24rem] w-full overflow-hidden rounded-md border border-slate-100" ref={containerRef} />
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

function _VintageCohortTable({ cohorts }: { cohorts: VintageCohort[] }) {
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

function _ConfirmationSignalsTable({ signals }: { signals: ConfirmationSignal[] }) {
  if (signals.length === 0) return null;
  const baselineSuccess = signals[0].baselineSuccess;
  const baselineDevastating = signals[0].baselineDevastating;
  const baselineTarget = signals[0].baselineTarget;
  const groups: Array<{ kind: ConfirmationSignal['kind']; label: string; tone: 'risk' | 'pass' }> = [
    { kind: 'risk', label: '위험 신호 (이 코호트에 들면 결과가 평균보다 나쁘다)', tone: 'risk' },
    { kind: 'pass', label: '확인 신호 (이 코호트에 들면 결과가 평균보다 좋다)', tone: 'pass' },
  ];
  return (
    <section
      aria-label="발간 후 가격 동작 코호트별 결과"
      className="overflow-hidden rounded-md border border-slate-200 bg-white"
    >
      <header className="border-b border-slate-200 px-4 py-2">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          발간 후 가격 동작 신호
        </div>
        <h3 className="mt-1 text-sm font-semibold text-slate-950">어떤 신호가 어떤 결과로 이어졌나</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          손절 규칙은 누구나 만들 수 있고 그것만으론 무책임합니다. 대신 발간 직후 며칠간의 가격 동작이 이후 결과에
          어떻게 연결되는지를 코호트로 봅니다. 각 신호는 베이스라인(전체 평균 성공{' '}
          <span className="font-mono">{formatPercent(baselineSuccess)}</span> · 치명적{' '}
          <span className="font-mono">{formatPercent(baselineDevastating)}</span> · 목표{' '}
          <span className="font-mono">{formatPercent(baselineTarget)}</span>) 대비 어떻게 다른지를 표시합니다.
        </p>
      </header>
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">신호</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">코호트</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">성공률</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">치명적률</th>
            <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">목표 도달</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groups.flatMap((group) => {
            const groupSignals = signals.filter((signal) => signal.kind === group.kind);
            if (groupSignals.length === 0) return [];
            return [
              <tr className="bg-slate-50/60" key={`group-${group.kind}`}>
                <td
                  className={`px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    group.tone === 'risk' ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                  colSpan={5}
                >
                  {group.label}
                </td>
              </tr>,
              ...groupSignals.map((signal) => {
                const successDelta = signal.successRate - signal.baselineSuccess;
                const devDelta = signal.devastatingRate - signal.baselineDevastating;
                const targetDelta = signal.targetRate - signal.baselineTarget;
                return (
                  <tr key={signal.id}>
                    <td className="px-3 py-2">
                      <div className="text-sm text-slate-950">{signal.label}</div>
                      <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{signal.description}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {signal.cohortSize}건
                      <span className="ml-1 text-[10px] text-slate-400">({formatPercent(signal.cohortShare)})</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatPercent(signal.successRate)}
                      <span className={`ml-1 text-[10px] ${successDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ({successDelta >= 0 ? '+' : ''}
                        {formatPercent(successDelta)})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatPercent(signal.devastatingRate)}
                      <span className={`ml-1 text-[10px] ${devDelta <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ({devDelta >= 0 ? '+' : ''}
                        {formatPercent(devDelta)})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatPercent(signal.targetRate)}
                      <span className={`ml-1 text-[10px] ${targetDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ({targetDelta >= 0 ? '+' : ''}
                        {formatPercent(targetDelta)})
                      </span>
                    </td>
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
      </table>
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
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-950">상승 기회 집중도</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        모든 리포트의 발간 후 고점 수익률을 더한 값을 100%로 두고, 상위 몇 건이 그중 얼마를 차지하는지 봅니다.
      </p>
      <div className="mt-5 grid gap-4">
        {rows.map((row) => (
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_5rem] items-center gap-3" key={row.topN}>
            <span className="font-mono text-xs font-semibold text-slate-500">Top {row.topN}</span>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-950" style={{ width: `${Math.max(2, row.share * 100)}%` }} />
            </div>
            <span className="text-right font-mono text-sm font-semibold tabular-nums text-slate-950">
              {formatPercent(row.share)}
            </span>
          </div>
        ))}
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
      <CaseList title="고점 수익 상위 10" tone="good" rows={winners} />
      <CaseList title="고점 수익 하위 10" tone="bad" rows={losers} />
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
        <p className="mt-0.5 font-mono text-[10px] text-slate-400">고점 / 만료 종가</p>
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
