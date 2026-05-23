import 'server-only';

import {
  getPriceSeries,
  getReportVerificationPageBundle,
  getReviewQueuePageBundle,
  hasPriceArtifact,
  type PricePoint,
  type ReportRow,
  type ReviewCandidateRow,
} from '@/lib/artifacts';
import type { ReviewBoardRow } from '@/components/review/review-table';
import { formatDateKo, formatPercent } from '@/lib/format';
import type { PageHeaderModel, PageMetric } from '@/lib/view-models/shared';

export type ReviewQueueViewModel = {
  header: PageHeaderModel;
  metrics: PageMetric[];
  priorityRows: ReviewBoardRow[];
  rows: ReviewBoardRow[];
};

export function getReviewQueueViewModel(): ReviewQueueViewModel {
  const reportBundle = getReportVerificationPageBundle();
  const queueBundle = getReviewQueuePageBundle();
  const reports = reportBundle.table.rows;
  const candidates = queueBundle.table.rows;
  const rows = buildReviewRows(reports, candidates);
  const latestPublicationDate = rows
    .map((row) => row.latestReportDate)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0];
  const positiveCurrentReturnCount = rows.filter((row) => (row.currentReturn ?? -Infinity) >= 0).length;
  const positiveCurrentReturnShare = rows.length ? positiveCurrentReturnCount / rows.length : null;
  const aboveAllMaCount = rows.filter((row) => row.maStack).length;
  const priorityRows = rows.slice(0, 5);

  return {
    header: {
      eyebrow: 'Review Queue',
      title: '검토 대기열',
      description: '오늘 먼저 볼 후보를 점수, 가격 위치, 리포트 맥락으로 정렬합니다.',
      badges: [
        { label: '최신 발간', value: formatDateKo(latestPublicationDate) },
        { label: '가격 기준', value: queueBundle.as_of.price_date ? formatDateKo(queueBundle.as_of.price_date) : null },
        { label: '리포트', value: `${reports.length.toLocaleString('ko-KR')}건` },
      ],
    },
    metrics: [
      {
        id: 'candidates',
        label: '후보 종목',
        value: `${rows.length.toLocaleString('ko-KR')}개`,
        helper: 'page bundle 기준',
        tone: 'neutral',
      },
      {
        id: 'positive',
        label: '현재 플러스',
        value: `${positiveCurrentReturnCount.toLocaleString('ko-KR')}개`,
        helper: formatPercent(positiveCurrentReturnShare, 1),
        tone: positiveCurrentReturnCount > 0 ? 'positive' : 'neutral',
      },
      {
        id: 'ma-stack',
        label: '정배열',
        value: `${aboveAllMaCount.toLocaleString('ko-KR')}개`,
        helper: '20/50/200 SMA 기준',
        tone: aboveAllMaCount > 0 ? 'positive' : 'neutral',
      },
      {
        id: 'priority',
        label: '오늘 우선순위',
        value: `${priorityRows.length.toLocaleString('ko-KR')}개`,
        helper: '상단 카드 표시',
        tone: 'accent',
      },
    ],
    priorityRows,
    rows,
  };
}

function buildReviewRows(reports: ReportRow[], candidates: ReviewCandidateRow[]): ReviewBoardRow[] {
  const reportsBySymbol = new Map<string, ReportRow[]>();
  for (const report of reports) {
    const list = reportsBySymbol.get(report.symbol) ?? [];
    list.push(report);
    reportsBySymbol.set(report.symbol, list);
  }

  const candidateByReportId = new Map(candidates.map((candidate) => [candidate.reportId, candidate]));
  const candidateBySymbol = new Map<string, ReviewCandidateRow>();
  for (const candidate of candidates) {
    const previous = candidateBySymbol.get(candidate.symbol);
    if (!previous || candidate.score > previous.score) candidateBySymbol.set(candidate.symbol, candidate);
  }

  const rows = Array.from(reportsBySymbol.entries()).map(([symbol, symbolReports]) => {
    const sortedReports = [...symbolReports].sort((a, b) => b.publicationDate.localeCompare(a.publicationDate));
    const latest = sortedReports[0];
    if (!latest) throw new Error(`Missing latest report for review symbol: ${symbol}`);
    const candidate = candidateByReportId.get(latest.reportId) ?? candidateBySymbol.get(symbol) ?? null;
    const prices = hasPriceArtifact(symbol) ? getPriceSeries(symbol) : [];
    const technicals = buildTechnicals(prices);
    return {
      symbol,
      company: latest.company,
      exchange: latest.exchange,
      currency: latest.currency,
      latestReportId: latest.reportId,
      latestReportDate: latest.publicationDate,
      reportAgeDays: null,
      reportCount: sortedReports.length,
      lastCloseNative: latest.lastCloseNative ?? technicals.lastPrice,
      lastCloseKrw: latest.lastCloseKrw,
      lastCloseDate: latest.lastCloseDate ?? technicals.lastCloseDate,
      volumeLatest: technicals.volumeLatest,
      entryPriceNative: latest.entryPriceNative,
      entryPriceKrw: latest.entryPriceKrw,
      targetPriceNative: latest.targetPriceNative,
      targetPriceKrw: latest.targetPriceKrw,
      targetUpsideAtPub: latest.targetUpsideAtPub,
      targetGapPct: latest.targetGapPct,
      targetRemainingPct: latest.targetRemainingPct,
      targetProgressPct: latest.targetProgressPct,
      currentReturn: latest.currentReturn,
      peakReturn: latest.peakReturn,
      troughReturn: latest.troughReturn,
      targetHit: latest.targetHit,
      targetHitDate: latest.targetHitDate,
      daysToTarget: latest.daysToTarget,
      expired: latest.expired,
      expiredByAge: false,
      caveatFlags: latest.caveatFlags,
      candidateBucket: candidate?.bucket ?? null,
      candidateScore: candidate?.score ?? null,
      rankBasis: candidate?.rankBasis ?? null,
      return1m: technicals.return1m,
      return3m: technicals.return3m,
      ytdReturn: technicals.ytdReturn,
      return1y: technicals.return1y,
      distanceFrom52wHigh: technicals.distanceFrom52wHigh,
      rsRank1m: null,
      above20ma: technicals.above20ma,
      above50ma: technicals.above50ma,
      above200ma: technicals.above200ma,
      maStack: technicals.maStack,
      sparkline: technicals.sparkline,
    } satisfies ReviewBoardRow;
  });

  const rankedReturns = rows
    .map((row) => row.return1m)
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);

  return rows
    .map((row) => ({ ...row, rsRank1m: percentileRank(row.return1m, rankedReturns) }))
    .sort(
      (a, b) =>
        (b.candidateScore ?? -Infinity) - (a.candidateScore ?? -Infinity) ||
        (b.ytdReturn ?? -Infinity) - (a.ytdReturn ?? -Infinity) ||
        b.latestReportDate.localeCompare(a.latestReportDate),
    );
}

function buildTechnicals(prices: PricePoint[]) {
  const latest = prices.at(-1);
  const lastPrice = latest?.value ?? null;
  const oneYearPrices = prices.slice(Math.max(0, prices.length - 252));
  const ytdStart = latest ? firstPointOnOrAfter(prices, `${latest.time.slice(0, 4)}-01-01`) : undefined;
  const oneMonthStart = latest ? firstPointOnOrAfter(prices, subtractDays(latest.time, 30)) : undefined;
  const threeMonthStart = latest ? firstPointOnOrAfter(prices, subtractDays(latest.time, 90)) : undefined;
  const oneYearStart = latest ? firstPointOnOrAfter(prices, subtractDays(latest.time, 365)) : undefined;
  const high52w = maxPrice(oneYearPrices);
  const sma20 = simpleMovingAverage(prices, 20);
  const sma50 = simpleMovingAverage(prices, 50);
  const sma200 = simpleMovingAverage(prices, 200);

  return {
    lastPrice,
    lastCloseDate: latest?.time ?? null,
    volumeLatest: latest?.volume ?? null,
    return1m: pctChange(lastPrice, oneMonthStart?.value),
    return3m: pctChange(lastPrice, threeMonthStart?.value),
    ytdReturn: pctChange(lastPrice, ytdStart?.value),
    return1y: pctChange(lastPrice, oneYearStart?.value),
    distanceFrom52wHigh: pctChange(lastPrice, high52w),
    above20ma: compareToAverage(lastPrice, sma20),
    above50ma: compareToAverage(lastPrice, sma50),
    above200ma: compareToAverage(lastPrice, sma200),
    maStack: movingAverageStack(lastPrice, sma20, sma50, sma200),
    sparkline: oneYearPrices.map((point) => point.value),
  };
}

function firstPointOnOrAfter(points: PricePoint[], date: string): PricePoint | undefined {
  return points.find((point) => point.time >= date) ?? points.at(0);
}

function subtractDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function simpleMovingAverage(points: PricePoint[], count: number): number | null {
  const values = points.slice(Math.max(0, points.length - count)).map((point) => point.value);
  if (values.length < count) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxPrice(points: PricePoint[]): number | null {
  if (!points.length) return null;
  return Math.max(...points.map((point) => point.high ?? point.value));
}

function pctChange(current: number | null | undefined, base: number | null | undefined): number | null {
  if (
    current === null ||
    current === undefined ||
    base === null ||
    base === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(base) ||
    base === 0
  ) {
    return null;
  }
  return current / base - 1;
}

function compareToAverage(current: number | null, average: number | null): boolean | null {
  if (current === null || average === null) return null;
  return current >= average;
}

function movingAverageStack(
  current: number | null,
  sma20: number | null,
  sma50: number | null,
  sma200: number | null,
): boolean | null {
  if (current === null || sma20 === null || sma50 === null || sma200 === null) return null;
  return current >= sma20 && sma20 >= sma50 && sma50 >= sma200;
}

function percentileRank(value: number | null, sortedValues: number[]): number | null {
  if (value === null || !Number.isFinite(value) || !sortedValues.length) return null;
  const lessOrEqual = sortedValues.filter((candidate) => candidate <= value).length;
  return (lessOrEqual / sortedValues.length) * 100;
}
