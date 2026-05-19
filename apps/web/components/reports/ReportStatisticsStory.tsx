'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import type { ReportStatisticsLabSummary } from '@/lib/artifacts';
import { formatDays, formatPercent } from '@/lib/format';
import { formatMultiple, isNumber, mean, quantileFromSorted, trimmedMean, wilsonCI } from '@/lib/report-statistics';

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
  const sortedReturns = [...currentReturns].sort((a, b) => a - b);
  const meanReturn = mean(currentReturns);
  const medianReturn = quantileFromSorted(sortedReturns, 0.5);
  const deepLosers = currentReturns.filter((value) => value <= -0.2).length;
  const bigWinners = currentReturns.filter((value) => value >= 0.2).length;
  const returnQuantiles = {
    min: quantileFromSorted(sortedReturns, 0),
    p10: quantileFromSorted(sortedReturns, 0.1),
    p25: quantileFromSorted(sortedReturns, 0.25),
    median: medianReturn,
    p75: quantileFromSorted(sortedReturns, 0.75),
    p90: quantileFromSorted(sortedReturns, 0.9),
    max: quantileFromSorted(sortedReturns, 1),
  };
  const eligiblePathCount = currentReturns.length;
  const pathBuckets = buildPathBuckets(summary.riskScatter);
  const exampleMetaById = buildExampleMetaById(summary.topExamples);

  const trimmedMean10 = trimmedMean(currentReturns, 0.1);
  const uniqueSymbolCount = new Set(summary.riskScatter.map((row) => row.symbol).filter(Boolean)).size;
  const vintageCohorts = buildVintageCohorts(summary.riskScatter);

  return (
    <div className="grid gap-14">
      <section className="grid gap-6 border-b border-slate-200 pb-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
        <div className="max-w-3xl">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            리포트 성과
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em] text-slate-950 md:text-6xl">
            발간된 리포트는 실제로 어디까지 갔을까요
          </h1>
          <p className="mt-5 text-base leading-8 text-slate-600">
            발간된 분석 리포트 {summary.sample.eligibleReportCount.toLocaleString('ko-KR')}건이 이후 어떤 가격 경로를
            지나갔는지 한 페이지에 모았습니다. 목표가 도달률, 중간 손실, 도달 후 흐름까지 한 번에 보고 비교해 보세요.
          </p>
        </div>
        <DistributionSignature
          mean={meanReturn}
          median={medianReturn}
          trimmed={trimmedMean10}
          sampleSize={eligiblePathCount}
          uniqueSymbols={uniqueSymbolCount}
          deepLosers={deepLosers}
          bigWinners={bigWinners}
        />
      </section>

      <StorySection
        kicker="전체 분포"
        title="모든 리포트를 한 줄에 늘어놓으면"
        body="발간된 리포트 한 건이 점 하나입니다. 현재 수익률 순으로 늘어놓으면 어디가 평균이고 어디가 양극단인지 한눈에 보입니다."
      >
        <WholeSampleMap rows={summary.riskScatter} quantiles={returnQuantiles} />
        <InsightLine>
          전체 표본의 하위 10%는 <strong>{formatPercent(returnQuantiles.p10)}</strong> 이하, 상위 10%는{' '}
          <strong>{formatPercent(returnQuantiles.p90)}</strong> 이상입니다. 평균만 보면 한쪽 끝의 큰 수익·큰 손실이
          가려질 수 있어, 중앙값과 사분위를 함께 봅니다.
        </InsightLine>
        <VintageCohortTable cohorts={vintageCohorts} />
      </StorySection>

      <StorySection
        kicker="경로 유형"
        title="같은 수익률에도 다른 길이 있었습니다"
        body="목표가에 빠르게 닿은 리포트, 큰 손실을 거쳤다가 회복한 리포트, 끝내 손실로 끝난 리포트를 나눠봅니다. 같은 결과여도 도착한 방식이 달랐습니다."
      >
        <PathBucketPanel buckets={pathBuckets} exampleMetaById={exampleMetaById} total={eligiblePathCount} />
        <InsightLine>
          “큰 손실 후 적중” 그룹은 손절선을 너무 촘촘하게 잡으면 놓치는 표본입니다. “반납한 표본”은 목표가에 한 번
          닿았지만 이후 다시 빠졌던 케이스로, 익절 규칙을 따로 볼 필요가 있습니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="목표가 도달률"
        title="목표가의 60·80·100%까지 가본 비율"
        body="목표가에 완전히 닿지 않더라도 80%까지는 갔다면 의미 있는 결과입니다. 도달 기준을 바꾸어가며 도달률과 도달까지 걸린 시간을 봅니다."
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
          <strong>{formatPercent(selectedHit?.hitRate)}</strong>, 평균적으로 도달까지 걸린 시간은{' '}
          <strong>{formatDays(selectedHit?.medianDaysToHit)}</strong>입니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="진입 시점"
        title="발간 당일 vs 며칠 뒤"
        body="당일 매수가 어려운 개인투자자에게 1·3·5·10·20거래일 뒤 진입의 결과를 따로 계산했습니다."
      >
        <ControlStrip
          label="보유 기간"
          options={HORIZONS.map((value) => ({ value, label: `${value}D` }))}
          value={horizon}
          onChange={setHorizon}
        />
        <DelayHeatmap rows={delayRows} />
        <InsightLine>
          {horizon}거래일 보유 기준으로 당일 진입의 중앙 수익률은{' '}
          <strong>{formatPercent(delayRows.find((row) => row.delayDays === 0)?.medianReturn)}</strong>, 20일 기다린 뒤
          진입은 <strong>{formatPercent(delayRows.find((row) => row.delayDays === 20)?.medianReturn)}</strong>입니다.
          기다린다고 자동으로 유리해지진 않았습니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="진입 규칙"
        title="눌림목에서 살까, 돌파를 보고 살까"
        body="발간 후 20거래일 안에 일정 폭의 하락이 오면 매수하는 규칙과, 상승을 먼저 확인한 뒤 매수하는 규칙을 같은 표본에서 비교했습니다."
      >
        <TriggerFrontier rows={triggerRows} />
      </StorySection>

      <StorySection
        kicker="도달 후 흐름"
        title="목표가에 닿은 뒤 계속 들고 가면"
        body="목표가에 처음 닿은 날부터 5·20·60·120거래일을 더 보유했을 때의 분포입니다."
      >
        <PostTargetDrift rows={summary.postTargetDrift} />
        <InsightLine>
          도달 후 60거래일 중앙 수익률은{' '}
          <strong>
            {formatPercent(summary.postTargetDrift.find((row) => row.daysAfterTarget === 60)?.medianReturn)}
          </strong>
          , 하위 25%는{' '}
          <strong>{formatPercent(summary.postTargetDrift.find((row) => row.daysAfterTarget === 60)?.p25Return)}</strong>
          입니다. 더 들고 가면 더 벌 가능성도 있지만 폭이 커집니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="익절선"
        title="이 표본에서 안정적이었던 익절 배수"
        body="목표가의 일정 비율에 닿으면 익절하고, 그렇지 않으면 250거래일 후 청산한다고 했을 때의 결과입니다."
      >
        <TargetMultipleCurve rows={multipleRows} />
        <InsightLine>
          250거래일 기준 가장 안정적이었던 익절선은{' '}
          <strong>{bestMultiple ? `${bestMultiple.targetMultiple.toFixed(1)}x` : '—'}</strong> 부근입니다. 평균 수익이
          가장 높은 구간이 아니라, 도달률과 하방 위험까지 같이 본 결과입니다.
        </InsightLine>
      </StorySection>

      <StorySection
        kicker="경로의 굴곡"
        title="맞춘 리포트도 도착까지 굴곡이 있었습니다"
        body="발간 이후 최대 상승폭과 최대 하락폭을 같은 그림에 놓으면, 결과적으로 맞춘 리포트가 얼마나 굴곡을 거쳤는지 보입니다."
      >
        <RiskScatter rows={summary.riskScatter} />
      </StorySection>

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
  deepLosers,
  bigWinners,
}: {
  mean: number | null;
  median: number | null;
  trimmed: number | null;
  sampleSize: number;
  uniqueSymbols: number;
  deepLosers: number;
  bigWinners: number;
}) {
  const medianX = xScale(median ?? 0, -0.8, 1.2);
  const meanX = xScale(mean ?? 0, -0.8, 1.2);
  const trimmedX = xScale(trimmed ?? 0, -0.8, 1.2);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>손실 꼬리</span>
        <span>상승 꼬리</span>
      </div>
      <div className="relative mt-5 h-24 rounded-xl bg-gradient-to-r from-rose-100 via-slate-100 to-blue-100">
        <Marker x={medianX} label="중앙값" value={formatPercent(median)} tone="slate" />
        <Marker x={trimmedX} label="10% 절단 평균" value={formatPercent(trimmed)} tone="amber" />
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
      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        평균이 중앙값보다 크고 절단 평균이 더 작다면, 양극단의 큰 수익 몇 건이 평균을 끌어올리고 있다는 뜻입니다.
      </p>
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

type RiskScatterRow = ReportStatisticsLabSummary['riskScatter'][number];

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
        {rows.map((row) => {
          const ci = wilsonCI(row.hitCount ?? 0, row.sampleSize ?? 0);
          const point = (row.hitRate ?? ci.point) * 100;
          return (
            <div key={row.horizonDays}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-950">{row.horizonDays}D</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-slate-950">
                  {formatPercent(row.hitRate)}
                </span>
              </div>
              <div className="relative mt-2 h-28 rounded-md bg-slate-100">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-2 rounded bg-slate-300/70"
                  style={{
                    bottom: `${Math.max(0, ci.lo * 100)}%`,
                    height: `${Math.max(0, (ci.hi - ci.lo) * 100)}%`,
                  }}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-2 h-[2px] bg-slate-950"
                  style={{ bottom: `${Math.max(2, point)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {row.hitCount}/{row.sampleSize} · 추정 범위 {formatPercent(ci.lo)}–{formatPercent(ci.hi)}
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">중앙 {formatDays(row.medianDaysToHit)}</div>
            </div>
          );
        })}
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
  const [selectedMultiple, setSelectedMultiple] = useState<number | null>(rows[0]?.targetMultiple ?? null);
  const scores = rows.map((row) => row.rewardReliabilityScore ?? 0);
  const minScore = Math.min(-0.05, ...scores);
  const maxScore = Math.max(0.05, ...scores);
  const selected = rows.find((row) => row.targetMultiple === selectedMultiple) ?? rows[0] ?? null;
  const best =
    [...rows].sort(
      (a, b) =>
        (b.rewardReliabilityScore ?? Number.NEGATIVE_INFINITY) - (a.rewardReliabilityScore ?? Number.NEGATIVE_INFINITY),
    )[0] ?? null;

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
              selected={row.targetMultiple === selected?.targetMultiple}
              onSelect={() => setSelectedMultiple(row.targetMultiple)}
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
      <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start">
        <p>
          점수 = 중앙 수익률 × 도달률 / (하위 25% 손실 + 5% 완충). 점을 누르면 비교 기준이 고정됩니다.{' '}
          {best ? `현재 최고 후보는 ${best.targetMultiple.toFixed(1)}x입니다.` : ''}
        </p>
        {selected ? (
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="font-semibold text-slate-950">{selected.targetMultiple.toFixed(1)}x 선택</div>
            <div className="mt-2 grid gap-1 font-mono tabular-nums">
              <span>도달률 {formatPercent(selected.hitRate)}</span>
              <span>중앙 {formatPercent(selected.medianReturn)}</span>
              <span>하위 25% {formatPercent(selected.p25Return)}</span>
              {best ? (
                <span>
                  최고 후보 대비 점수{' '}
                  {formatNumber((selected.rewardReliabilityScore ?? 0) - (best.rewardReliabilityScore ?? 0))}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RiskScatter({ rows }: { rows: ReportStatisticsLabSummary['riskScatter'] }) {
  const [view, setView] = useState<'all' | 'hit10' | 'partial' | 'lossTail'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.reportId ?? null);
  const visibleRows = rows.filter((row) => {
    if (view === 'hit10') return row.hit10;
    if (view === 'partial') return row.hit08 && !row.hit10;
    if (view === 'lossTail') return (row.maxAdverseExcursion ?? 0) <= -0.5 || (row.currentReturn ?? 0) <= -0.3;
    return true;
  });
  const selected = rows.find((row) => row.reportId === selectedId) ?? visibleRows[0] ?? null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">전체 표본의 최대 상승폭·최대 하락폭</h3>
          <p className="mt-1 text-xs text-slate-500">
            오른쪽으로 갈수록 중간 손실이 작고, 위로 갈수록 발간 이후 상승 여지가 컸습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            ['all', '전체'],
            ['hit10', '1.0x'],
            ['partial', '0.8x만'],
            ['lossTail', '손실 꼬리'],
          ].map(([id, label]) => (
            <button
              className={[
                'h-7 rounded-md border px-2 text-[11px] font-semibold transition-colors',
                view === id
                  ? 'border-slate-950 bg-slate-950 text-white'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
              ].join(' ')}
              key={id}
              type="button"
              onClick={() => setView(id as typeof view)}
            >
              {label}
            </button>
          ))}
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-500">
            n={visibleRows.length.toLocaleString('ko-KR')}
          </span>
        </div>
      </div>
      <div className="relative h-80 rounded-xl border border-slate-100 bg-[linear-gradient(to_right,rgba(226,232,240,.7)_1px,transparent_1px),linear-gradient(to_bottom,rgba(226,232,240,.7)_1px,transparent_1px)] bg-[size:12.5%_25%] px-5 py-5">
        <div className="absolute bottom-8 left-5 text-[11px] text-slate-500">최대 하락폭</div>
        <div className="absolute left-5 top-3 text-[11px] text-slate-500">최대 상승폭</div>
        {visibleRows.map((row) => {
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
              selected={row.reportId === selected?.reportId}
              onSelect={() => setSelectedId(row.reportId)}
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
      {selected ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <div className="font-semibold text-slate-950">
              {selected.company} ({selected.symbol})
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {selected.publicationDate} 발간 · 목표 {targetHitLabel(selected)} · 현재{' '}
              {formatPercent(selected.currentReturn)}
            </p>
          </div>
          <div className="grid gap-2 text-xs md:justify-items-end">
            <div className="grid grid-cols-3 gap-3 font-mono tabular-nums text-slate-700">
              <span>최대상승 {formatPercent(selected.maxFavorableExcursion)}</span>
              <span>최대하락 {formatPercent(selected.maxAdverseExcursion)}</span>
              <span>포착률 {formatNumber(selected.upsideCaptureRatio)}x</span>
            </div>
            <Link
              className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50"
              href={`/reports/${encodeURIComponent(selected.symbol)}/${encodeURIComponent(selected.reportId)}`}
            >
              리포트 상세 보기
            </Link>
          </div>
        </div>
      ) : null}
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
  selected = false,
  onSelect,
}: {
  x: number;
  y: number;
  label: string;
  meta: string;
  tone: 'good' | 'bad' | 'neutral' | 'accent' | 'teal';
  rows: Array<[string, string]>;
  selected?: boolean;
  onSelect?: () => void;
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
      className="group absolute z-10 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center outline-none"
      style={{
        left: `calc(1.25rem + ${x} * (100% - 2.5rem) / 100)`,
        top: `calc(1.25rem + ${y} * (100% - 2.5rem) / 100)`,
      }}
      type="button"
      onClick={onSelect}
    >
      <span
        className={[
          'size-2.5 rounded-full ring-4 transition-transform group-hover:scale-150 group-focus-visible:scale-150',
          selected ? 'scale-150 ring-slate-950/20' : '',
          colorClass,
        ].join(' ')}
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

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
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
    if (isNumber(row.currentReturn)) bucket.returns.push(row.currentReturn);
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
    <section aria-label="데이터 노트" className="border-t border-slate-200 pt-6">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start">
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            데이터 노트
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            기준일 {snapshotDate} · 표본 {sampleSize.toLocaleString('ko-KR')}건 · 유효 티커{' '}
            {uniqueSymbols.toLocaleString('ko-KR')}개. 가격은 종가 기준이며 거래비용은 반영되지 않았습니다. 이 페이지는
            학습 자료로 제공되며 투자 권유가 아닙니다.
          </p>
        </div>
      </div>
    </section>
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
