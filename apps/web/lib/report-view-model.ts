import { formatDays, formatNative, formatPercent } from '@/lib/format';
import type { PricePoint, ReportRow } from '@/lib/artifacts';

export type PathEvidence = {
  peak: PricePoint | null;
  trough: PricePoint | null;
  markers: Array<{
    time: string;
    kind: 'publication' | 'target-hit' | 'peak' | 'trough';
    label: string;
    value?: number | null;
  }>;
};

export type ScenarioRow = {
  label: string;
  basis: string;
  point: PricePoint | null;
  bandPosition: number | null;
  currentReturn: number | null;
  targetReturn: number | null;
};

export type TrendSnapshot = {
  verdict: string;
  detail: string;
  tone: 'good' | 'warn' | 'bad' | 'accent';
  metrics: Array<{ label: string; value: string; tone?: 'good' | 'warn' | 'bad' | 'accent' }>;
  movingAverages: Array<{ label: string; value: number | null; distance: number | null }>;
};

export type TargetStatus = {
  label: string;
  detail: string;
  tone: 'good' | 'warn' | 'bad' | 'accent';
};

export type KoreanInvestmentMemo = {
  summary: string;
  bullets: Array<{ label: string; text: string }>;
};

export function targetMoveLabel(report: ReportRow): string {
  return report.targetDirection === 'downside' ? '하락 여지' : '업사이드';
}

export function targetMovePhrase(report: ReportRow): string {
  return report.targetDirection === 'downside' ? '하락 목표' : '상승 목표';
}

export function buildPathEvidence(prices: PricePoint[], report: ReportRow): PathEvidence {
  const postPublication = prices.filter((point) => point.time >= report.publicationDate);
  const observed = postPublication.length ? postPublication : prices;
  const peak = observed.reduce<PricePoint | null>(
    (best, point) => (!best || point.value > best.value ? point : best),
    null,
  );
  const trough = observed.reduce<PricePoint | null>(
    (best, point) => (!best || point.value < best.value ? point : best),
    null,
  );
  const markers: PathEvidence['markers'] = [
    { time: report.publicationDate, kind: 'publication', label: '발간', value: reportEntryPrice(report) },
  ];
  if (report.targetHitDate)
    markers.push({
      time: report.targetHitDate,
      kind: 'target-hit',
      label: '목표 도달',
      value: report.targetPriceNative,
    });
  if (peak) markers.push({ time: peak.time, kind: 'peak', label: '관측 고점', value: peak.value });
  if (trough) markers.push({ time: trough.time, kind: 'trough', label: '관측 저점', value: trough.value });
  return { peak, trough, markers };
}

export function buildScenarioRows(prices: PricePoint[], report: ReportRow): ScenarioRow[] {
  const postPublication = prices.filter((point) => point.time >= report.publicationDate);
  if (!postPublication.length) {
    return ['발간 후 저점', '25% 가격 수준', '75% 가격 수준', '발간 후 고점', '현재가'].map((label) => ({
      label,
      basis: '—',
      point: null,
      bandPosition: null,
      currentReturn: null,
      targetReturn: null,
    }));
  }
  const low = postPublication.reduce((best, point) => (point.value < best.value ? point : best), postPublication[0]);
  const high = postPublication.reduce((best, point) => (point.value > best.value ? point : best), postPublication[0]);
  const priceRange = Math.max(0, high.value - low.value);
  const price25 = low.value + priceRange * 0.25;
  const price75 = low.value + priceRange * 0.75;
  const q25 = nearestPricePoint(postPublication, price25);
  const q75 = nearestPricePoint(postPublication, price75);
  const current = postPublication.at(-1) ?? null;
  return [
    { label: '발간 후 저점', basis: formatAssetPrice(low.value, report), point: low, bandPosition: 0 },
    {
      label: '25% 가격 수준',
      basis: formatAssetPrice(price25, report),
      point: q25,
      bandPosition: bandPosition(q25?.value, low.value, high.value),
    },
    {
      label: '75% 가격 수준',
      basis: formatAssetPrice(price75, report),
      point: q75,
      bandPosition: bandPosition(q75?.value, low.value, high.value),
    },
    { label: '발간 후 고점', basis: formatAssetPrice(high.value, report), point: high, bandPosition: 1 },
    {
      label: '현재가',
      basis: current ? formatAssetPrice(current.value, report) : '—',
      point: current,
      bandPosition: bandPosition(current?.value, low.value, high.value),
    },
  ].map((row) => ({
    ...row,
    currentReturn: row.point && current ? current.value / row.point.value - 1 : null,
    targetReturn: row.point && report.targetPriceNative ? report.targetPriceNative / row.point.value - 1 : null,
  }));
}

export function buildTrendSnapshot(prices: PricePoint[], report: ReportRow): TrendSnapshot {
  const closes = prices.map((point) => point.close ?? point.value).filter(isFiniteNumber);
  const current = report.lastCloseNative ?? closes.at(-1) ?? null;
  const maWindows = [20, 60, 120, 200];
  const movingAverages = maWindows.map((window) => {
    const value = average(closes.slice(-window));
    return { label: `MA${window}`, value, distance: current && value ? current / value - 1 : null };
  });
  const ma20 = movingAverages[0]?.value ?? null;
  const ma60 = movingAverages[1]?.value ?? null;
  const ma200 = movingAverages[3]?.value ?? null;
  const momentum3m = trailingReturn(closes, 63);
  const momentum6m = trailingReturn(closes, 126);
  const momentum12m = trailingReturn(closes, 252);
  const high52w = closes.length ? Math.max(...closes.slice(-252)) : null;
  const distanceFromHigh = current && high52w ? current / high52w - 1 : null;
  const drawdown = maxDrawdown(closes.slice(-252));
  const atrProxy = averageTrueRangeProxy(prices.slice(-20));
  const aboveLongTrend = !!current && !!ma200 && current >= ma200;
  const shortTrendUp = !!ma20 && !!ma60 && ma20 >= ma60;
  const momentumPositive = (momentum3m ?? 0) > 0 && (momentum6m ?? 0) > 0;
  const reportAligned = report.targetDirection === 'downside' ? !shortTrendUp : shortTrendUp || momentumPositive;
  const verdict =
    aboveLongTrend && shortTrendUp && momentumPositive
      ? '상승 추세 우위'
      : shortTrendUp || momentumPositive
        ? '상승 전환 관찰'
        : aboveLongTrend
          ? '장기선 상단 횡보'
          : '추세 확인 필요';
  const tone: TrendSnapshot['tone'] =
    aboveLongTrend && shortTrendUp ? 'good' : shortTrendUp || momentumPositive ? 'accent' : 'warn';
  const detail = reportAligned
    ? '리포트 방향과 가격 추세가 대체로 같은 쪽을 가리킵니다.'
    : '리포트 목표와 추세 신호가 엇갈리므로 진입 타이밍 점검이 필요합니다.';
  return {
    verdict,
    detail,
    tone,
    movingAverages,
    metrics: [
      { label: '3M 모멘텀', value: formatPercent(momentum3m), tone: toneForSigned(momentum3m) },
      { label: '6M 모멘텀', value: formatPercent(momentum6m), tone: toneForSigned(momentum6m) },
      { label: '12M 모멘텀', value: formatPercent(momentum12m), tone: toneForSigned(momentum12m) },
      { label: '52주 고점 대비', value: formatPercent(distanceFromHigh), tone: toneForSigned(distanceFromHigh) },
      { label: '52주 최대 낙폭', value: formatPercent(drawdown), tone: 'bad' },
      { label: '20D ATR proxy', value: formatPercent(atrProxy), tone: 'warn' },
    ],
  };
}

export function buildKoreanInvestmentMemo(report: ReportRow): KoreanInvestmentMemo {
  const targetSentence =
    report.targetDirection === 'downside'
      ? report.targetHit
        ? `매도/회피 의견의 하락 목표가는 ${formatDays(report.daysToTarget)} 만에 도달했습니다.`
        : '매도/회피 의견이지만 하락 목표가에는 아직 도달하지 않았습니다.'
      : (report.targetUpsideAtPub ?? 0) <= 0
        ? '첫 거래 가능 가격이 목표가를 이미 넘어선 비실행 케이스로, 목표가 달성 통계에서는 제외됩니다.'
        : report.targetHit
          ? `목표가는 ${formatDays(report.daysToTarget)} 만에 도달해, 리포트의 단기 가격 근거가 실거래 경로에서 확인되었습니다.`
          : `현재 시점에서 목표가에는 도달하지 않았으며, 목표까지 남은 상승률은 ${formatPercent(targetRemaining(report))}입니다.`;
  const riskTone =
    (report.troughReturn ?? 0) < -0.2
      ? '발간 이후 하방 변동성이 컸기 때문에 분할 진입과 손실 제한 기준의 사전 검토가 권장됩니다.'
      : '관측 저점 기준 하방 훼손은 제한적이지만, 목표가 미도달 상태에서는 시간 비용을 함께 점검할 필요가 있습니다.';

  return {
    summary: `${report.company} 리포트는 발간일 종가 ${formatAssetPrice(reportEntryPrice(report), report)} 대비 목표가 ${formatAssetPrice(report.targetPriceNative, report)}를 제시했습니다. ${targetSentence}`,
    bullets: [
      {
        label: targetMovePhrase(report),
        text: `발간 시점 목표 변화율 ${formatPercent(report.targetUpsideAtPub)}, 관측 최고 수익률 ${formatPercent(report.peakReturn)}.`,
      },
      { label: '리스크', text: `${riskTone} 관측 최저 수익률 ${formatPercent(report.troughReturn)}.` },
      {
        label: '현재 판단',
        text: `최근 종가 ${formatAssetPrice(report.lastCloseNative, report)} (${report.lastCloseDate ?? '날짜 없음'}), 현재 수익률 ${formatPercent(report.currentReturn)}.`,
      },
    ],
  };
}

export function formatAssetPrice(value: number | null | undefined, report: ReportRow): string {
  return formatNative(value, report.currency);
}

export function reportEntryPrice(report: ReportRow): number | null {
  if (
    report.entryPriceNative !== null &&
    report.entryPriceNative !== undefined &&
    Number.isFinite(report.entryPriceNative)
  ) {
    return report.entryPriceNative;
  }
  return null;
}

export function targetStatus(report: ReportRow): TargetStatus {
  if (report.targetDirection === 'downside') {
    return report.targetHit
      ? { label: '매도 적중', detail: `${report.targetHitDate} · ${formatDays(report.daysToTarget)}`, tone: 'good' }
      : { label: '매도 의견 진행', detail: '하락 목표가 미도달', tone: 'warn' };
  }
  if ((report.targetUpsideAtPub ?? 0) <= 0) {
    return { label: '비실행', detail: '첫 거래 가능 가격이 목표가 이상', tone: 'warn' };
  }
  return report.targetHit
    ? { label: '목표 도달', detail: `${report.targetHitDate} · ${formatDays(report.daysToTarget)}`, tone: 'good' }
    : { label: '진행 중', detail: `목표까지 ${formatPercent(targetRemaining(report))}`, tone: 'accent' };
}

export function targetRemaining(report: ReportRow): number | null {
  const target = report.targetPriceNative;
  const current = report.lastCloseNative;
  if (!target || !current || current <= 0) return null;
  return target / current - 1;
}

function nearestPricePoint(points: PricePoint[], value: number): PricePoint | null {
  return points.reduce<PricePoint | null>((best, point) => {
    if (!best) return point;
    return Math.abs(point.value - value) < Math.abs(best.value - value) ? point : best;
  }, null);
}

function bandPosition(value: number | null | undefined, low: number, high: number): number | null {
  if (!isFiniteNumber(value)) return null;
  if (high <= low) return 0.5;
  return Math.max(0, Math.min(1, (value - low) / (high - low)));
}

function average(values: number[]): number | null {
  const finite = values.filter(isFiniteNumber);
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function trailingReturn(values: number[], sessions: number): number | null {
  if (values.length < 2) return null;
  const end = values.at(-1);
  const start = values.at(-(sessions + 1)) ?? values[0];
  if (!isFiniteNumber(start) || !isFiniteNumber(end) || start <= 0) return null;
  return end / start - 1;
}

function maxDrawdown(values: number[]): number | null {
  if (!values.length) return null;
  let peak = values[0];
  let worst = 0;
  for (const value of values) {
    if (value > peak) peak = value;
    if (peak > 0) worst = Math.min(worst, value / peak - 1);
  }
  return worst;
}

function averageTrueRangeProxy(points: PricePoint[]): number | null {
  const ranges = points
    .map((point) => {
      const close = point.close ?? point.value;
      const high = point.high ?? close;
      const low = point.low ?? close;
      return close > 0 ? (high - low) / close : null;
    })
    .filter(isFiniteNumber);
  return average(ranges);
}

function toneForSigned(value: number | null): 'good' | 'warn' | 'bad' | 'accent' {
  if (value === null) return 'warn';
  if (value > 0.02) return 'good';
  if (value < -0.02) return 'bad';
  return 'warn';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
