import { formatDays, formatNative, formatPercent } from '@/lib/format';
import type { PricePoint, ReportRow } from '@/lib/artifacts';

export type PathEvidence = {
  peak: PricePoint | null;
  trough: PricePoint | null;
  markers: Array<{ time: string; kind: 'publication' | 'target-hit' | 'peak' | 'trough'; label: string; value?: number | null }>;
};

export type ScenarioRow = {
  label: string;
  basis: string;
  point: PricePoint | null;
  currentReturn: number | null;
  targetReturn: number | null;
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
  const peak = observed.reduce<PricePoint | null>((best, point) => (!best || point.value > best.value ? point : best), null);
  const trough = observed.reduce<PricePoint | null>((best, point) => (!best || point.value < best.value ? point : best), null);
  const markers: PathEvidence['markers'] = [
    { time: report.publicationDate, kind: 'publication', label: '발간', value: reportEntryPrice(report) },
  ];
  if (report.targetHitDate) markers.push({ time: report.targetHitDate, kind: 'target-hit', label: '목표 도달', value: report.targetPriceNative });
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
      currentReturn: null,
      targetReturn: null,
    }));
  }
  const low = postPublication.reduce((best, point) => point.value < best.value ? point : best, postPublication[0]);
  const high = postPublication.reduce((best, point) => point.value > best.value ? point : best, postPublication[0]);
  const priceRange = Math.max(0, high.value - low.value);
  const price25 = low.value + priceRange * 0.25;
  const price75 = low.value + priceRange * 0.75;
  const q25 = nearestPricePoint(postPublication, price25);
  const q75 = nearestPricePoint(postPublication, price75);
  const current = postPublication.at(-1) ?? null;
  return [
    { label: '발간 후 저점', basis: formatAssetPrice(low.value, report), point: low },
    { label: '25% 가격 수준', basis: formatAssetPrice(price25, report), point: q25 },
    { label: '75% 가격 수준', basis: formatAssetPrice(price75, report), point: q75 },
    { label: '발간 후 고점', basis: formatAssetPrice(high.value, report), point: high },
    { label: '현재가', basis: current ? formatAssetPrice(current.value, report) : '—', point: current },
  ].map((row) => ({
    ...row,
    currentReturn: row.point && current ? current.value / row.point.value - 1 : null,
    targetReturn: row.point && report.targetPriceNative ? report.targetPriceNative / row.point.value - 1 : null,
  }));
}

export function oneYearBefore(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  const value = new Date(Date.UTC(year - 1, month - 1, day));
  return value.toISOString().slice(0, 10);
}

export function buildKoreanInvestmentMemo(report: ReportRow): KoreanInvestmentMemo {
  const targetSentence = isBearishReport(report)
    ? report.targetHit
      ? `매도/회피 의견의 하락 목표가는 ${formatDays(report.daysToTarget)} 만에 도달했습니다.`
      : '매도/회피 의견이지만 하락 목표가에는 아직 도달하지 않았습니다.'
    : (report.targetUpsideAtPub ?? 0) <= 0
      ? '첫 거래 가능 가격이 목표가를 이미 넘어선 비실행 케이스로, 목표가 달성 통계에서는 제외됩니다.'
      : report.targetHit
        ? `목표가는 ${formatDays(report.daysToTarget)} 만에 도달해, 리포트의 단기 가격 근거가 실거래 경로에서 확인되었습니다.`
        : `현재 시점에서 목표가에는 도달하지 않았으며, 목표까지 남은 상승률은 ${formatPercent(targetRemaining(report))}입니다.`;
  const riskTone = (report.troughReturn ?? 0) < -0.2
    ? '발간 이후 하방 변동성이 컸기 때문에 분할 진입과 손실 제한 기준의 사전 검토가 권장됩니다.'
    : '관측 저점 기준 하방 훼손은 제한적이지만, 목표가 미도달 상태에서는 시간 비용을 함께 점검할 필요가 있습니다.';

  return {
    summary: `${report.company} 리포트는 발간일 종가 ${formatAssetPrice(reportEntryPrice(report), report)} 대비 목표가 ${formatAssetPrice(report.targetPriceNative, report)}를 제시했습니다. ${targetSentence}`,
    bullets: [
      { label: '상승 여력', text: `발간 시점 목표 업사이드 ${formatPercent(report.targetUpsideAtPub)}, 관측 최고 수익률 ${formatPercent(report.peakReturn)}.` },
      { label: '리스크', text: `${riskTone} 관측 최저 수익률 ${formatPercent(report.troughReturn)}.` },
      { label: '현재 판단', text: `최근 종가 ${formatAssetPrice(report.lastCloseNative, report)} (${report.lastCloseDate ?? '날짜 없음'}), 현재 수익률 ${formatPercent(report.currentReturn)}.` },
    ],
  };
}

export function formatAssetPrice(value: number | null | undefined, report: ReportRow): string {
  return formatNative(value, report.currency);
}

export function reportEntryPrice(report: ReportRow): number | null {
  if (report.entryPriceNative !== null && report.entryPriceNative !== undefined && Number.isFinite(report.entryPriceNative)) {
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
  if (report.targetDirection === 'downside') return target / current - 1;
  return target / current - 1;
}

function nearestPricePoint(points: PricePoint[], value: number): PricePoint | null {
  return points.reduce<PricePoint | null>((best, point) => {
    if (!best) return point;
    return Math.abs(point.value - value) < Math.abs(best.value - value) ? point : best;
  }, null);
}

function isBearishReport(report: ReportRow): boolean {
  return report.targetDirection === 'downside';
}
