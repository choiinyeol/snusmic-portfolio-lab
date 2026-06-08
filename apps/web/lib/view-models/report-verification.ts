import 'server-only';

import {
  getPriceSeries,
  getReportBoardPageBundle,
  getReportVerificationPageBundle,
  hasPriceArtifact,
  type PricePoint,
  type ReportBoardCandidateRow,
  type ReportRow,
} from '@/lib/artifacts';
import { formatDateKo, formatDays, formatPercent } from '@/lib/format';
import type { PageHeaderModel, PageMetric, TableViewPreset } from '@/lib/view-models/shared';

type ReportLedgerTechnicalFields = {
  latestReportId: string;
  latestReportDate: string;
  reportAgeDays: number | null;
  reportCount: number;
  volumeLatest: number | null;
  candidateBucket: ReportBoardCandidateRow['bucket'] | null;
  candidateScore: number | null;
  rankBasis: string | null;
  return1m: number | null;
  return3m: number | null;
  ytdReturn: number | null;
  return1y: number | null;
  distanceFrom52wHigh: number | null;
  rsRank1m: number | null;
  above20ma: boolean | null;
  above50ma: boolean | null;
  above200ma: boolean | null;
  maStack: boolean | null;
  sparkline: number[];
  expiredByAge: boolean;
};

export type ReportLedgerRow = ReportRow &
  ReportLedgerTechnicalFields & {
    id: string;
    status: 'hit' | 'open' | 'expired' | 'excluded' | 'warning';
    statusLabel: string;
    href: string;
  };

export type ReportLedgerTableModel = {
  rows: ReportLedgerRow[];
  defaultView: string;
  views: TableViewPreset[];
};

export type ReportVerificationViewModel = {
  header: PageHeaderModel;
  asOf: string | null;
  metrics: PageMetric[];
  table: ReportLedgerTableModel;
};

export function getReportVerificationViewModel(): ReportVerificationViewModel {
  const verificationBundle = getReportVerificationPageBundle();
  const boardBundle = getReportBoardPageBundle();
  const rows = buildReportLedgerRows(
    verificationBundle.table.rows,
    boardBundle.table.rows,
    verificationBundle.as_of.price_date,
  );
  const latestPublicationDate = verificationBundle.as_of.report_date;
  const priceAsOf = verificationBundle.as_of.price_date;

  return {
    header: {
      eyebrow: 'Report Verification',
      title: '리포트 성과 검증',
      description: '발간일, 목표가, 가격 흐름을 같은 기준으로 놓고 리포트 신호의 사후 성과를 추적합니다.',
      badges: [
        { label: '최신 발간', value: formatDateKo(latestPublicationDate) },
        { label: '가격 기준', value: priceAsOf ? formatDateKo(priceAsOf) : null },
        { label: '리포트', value: `${rows.length.toLocaleString('ko-KR')}건` },
      ],
    },
    asOf: priceAsOf,
    metrics: buildMetrics(verificationBundle.metrics, rows),
    table: {
      rows,
      defaultView: 'all',
      views: buildViewPresets(verificationBundle.views, rows),
    },
  };
}

export function rankReportCandidates(rows: ReportLedgerRow[]): ReportLedgerRow[] {
  return rows
    .filter(isReportCandidate)
    .sort(
      (a, b) =>
        (b.candidateScore ?? Number.NEGATIVE_INFINITY) - (a.candidateScore ?? Number.NEGATIVE_INFINITY) ||
        (b.ytdReturn ?? Number.NEGATIVE_INFINITY) - (a.ytdReturn ?? Number.NEGATIVE_INFINITY) ||
        b.publicationDate.localeCompare(a.publicationDate),
    );
}

function buildMetrics(
  metrics: ReturnType<typeof getReportVerificationPageBundle>['metrics'],
  rows: ReportLedgerRow[],
): PageMetric[] {
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  const reportCount = Number(byId.get('reports')?.value ?? rows.length);
  const active = Number(byId.get('active')?.value ?? rows.filter((report) => isReportCandidate(report)).length);
  const hitRate =
    nullableNumber(byId.get('target_hit_rate')?.value) ??
    safeRatio(rows.filter((report) => report.targetHit).length, rows.length);
  const medianReturn =
    nullableNumber(byId.get('median_current_return')?.value) ?? median(rows.map((report) => report.currentReturn));
  const medianDays =
    nullableNumber(byId.get('median_days_to_target')?.value) ??
    median(rows.filter((report) => report.targetHit).map((report) => report.daysToTarget));
  const excluded = Number(byId.get('excluded')?.value ?? 0);

  return [
    {
      id: 'reports',
      label: '전체 리포트',
      value: `${reportCount.toLocaleString('ko-KR')}건`,
      helper: '성과 검증 가능 표본',
      tone: 'neutral',
    },
    {
      id: 'active',
      label: '검토 후보',
      value: `${active.toLocaleString('ko-KR')}개`,
      helper: '목표가 검증 진행 중',
      tone: active > 0 ? 'positive' : 'neutral',
    },
    {
      id: 'hit-rate',
      label: '목표 도달률',
      value: formatPercent(hitRate),
      helper: `${rows.filter((report) => report.targetHit).length.toLocaleString('ko-KR')}건 도달`,
      tone: 'positive',
    },
    {
      id: 'median-return',
      label: '중앙 수익률',
      value: formatPercent(medianReturn),
      helper: '현재 평가 구간',
      tone: (medianReturn ?? 0) >= 0 ? 'positive' : 'negative',
    },
    {
      id: 'excluded',
      label: '제외',
      value: `${excluded.toLocaleString('ko-KR')}건`,
      helper: '원천/가격/성과 조건 제외',
      tone: excluded > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'median-days',
      label: '중앙 도달일',
      value: formatDays(medianDays),
      helper: '목표 도달 리포트 기준',
      tone: 'neutral',
    },
  ];
}

function buildViewPresets(
  views: ReturnType<typeof getReportVerificationPageBundle>['views'],
  rows: ReportLedgerRow[],
): TableViewPreset[] {
  const bundleCounts = new Map(views.map((view) => [view.id, view.count ?? 0]));
  return [
    {
      id: 'candidate',
      label: '검토 후보',
      count: bundleCounts.get('candidate') ?? rows.filter((report) => isReportCandidate(report)).length,
      description: '아직 목표가에 닿지 않았고 만료되지 않은 후보',
    },
    {
      id: 'all',
      label: '전체',
      count: rows.length,
      description: '검증 가능한 전체 리포트 표본',
    },
    {
      id: 'target-hit',
      label: '목표 도달',
      count: bundleCounts.get('target-hit') ?? rows.filter((report) => report.targetHit).length,
      description: '발간 후 목표가를 한 번 이상 도달',
    },
    {
      id: 'open',
      label: '진행 중',
      count: rows.filter((report) => !report.targetHit && !report.expired).length,
      description: '목표 도달 전이고 아직 만료되지 않음',
    },
    {
      id: 'upside',
      label: '업사이드',
      count: rows.filter((report) => (report.targetUpsideAtPub ?? 0) > 0).length,
      description: '발간 시점 상승여력이 남아 있던 리포트',
    },
  ];
}

function buildReportLedgerRows(
  reports: ReportRow[],
  candidates: ReportBoardCandidateRow[],
  priceAsOf: string | null,
): ReportLedgerRow[] {
  const reportCountsBySymbol = new Map<string, number>();
  for (const report of reports) {
    reportCountsBySymbol.set(report.symbol, (reportCountsBySymbol.get(report.symbol) ?? 0) + 1);
  }

  const candidateByReportId = new Map(candidates.map((candidate) => [candidate.reportId, candidate]));
  const bestCandidateBySymbol = new Map<string, ReportBoardCandidateRow>();
  for (const candidate of candidates) {
    const previous = bestCandidateBySymbol.get(candidate.symbol);
    if (!previous || candidate.score > previous.score) bestCandidateBySymbol.set(candidate.symbol, candidate);
  }

  const technicalsBySymbol = new Map<string, ReturnType<typeof buildTechnicals>>();
  const rows = reports.map((report) => {
    let technicals = technicalsBySymbol.get(report.symbol);
    if (!technicals) {
      const prices = hasPriceArtifact(report.symbol) ? getPriceSeries(report.symbol) : [];
      technicals = buildTechnicals(prices);
      technicalsBySymbol.set(report.symbol, technicals);
    }

    const candidate = candidateByReportId.get(report.reportId) ?? bestCandidateBySymbol.get(report.symbol) ?? null;
    const reportAgeDays = diffDays(priceAsOf ?? report.lastCloseDate, report.publicationDate);
    return {
      ...report,
      id: report.reportId,
      latestReportId: report.reportId,
      latestReportDate: report.publicationDate,
      reportAgeDays,
      reportCount: reportCountsBySymbol.get(report.symbol) ?? 1,
      volumeLatest: technicals.volumeLatest,
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
      expiredByAge: reportAgeDays !== null && reportAgeDays > 365,
      status: report.targetHit ? 'hit' : report.expired ? 'expired' : 'open',
      statusLabel: report.targetHit ? '도달' : report.expired ? '만료' : '진행 중',
      href: `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`,
    } satisfies ReportLedgerRow;
  });

  const rankedReturns = rows
    .map((row) => row.return1m)
    .filter((value): value is number => value !== null && Number.isFinite(value))
    .sort((a, b) => a - b);

  return rows.map((row) => ({ ...row, rsRank1m: percentileRank(row.return1m, rankedReturns) }));
}

export function isReportCandidate(
  report: Pick<ReportLedgerRow, 'expired' | 'targetHit' | 'targetUpsideAtPub'>,
): boolean {
  return !report.targetHit && !report.expired && (report.targetUpsideAtPub ?? 0) > 0;
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

function diffDays(later: string | null, earlier: string): number | null {
  if (!later) return null;
  const laterTime = Date.parse(`${later}T00:00:00.000Z`);
  const earlierTime = Date.parse(`${earlier}T00:00:00.000Z`);
  if (!Number.isFinite(laterTime) || !Number.isFinite(earlierTime)) return null;
  return Math.floor((laterTime - earlierTime) / 86_400_000);
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

function nullableNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function safeRatio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function median(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (finite.length === 0) return null;
  finite.sort((a, b) => a - b);
  const mid = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[mid - 1] + finite[mid]) / 2 : finite[mid];
}
