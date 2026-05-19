import 'server-only';
import type { HoldingRow, Insight, ReportRow, TradeRow } from '@/lib/artifacts';
import { getInsights } from '@/lib/artifacts';
import type { DashboardViewModel } from '@/lib/dashboard-view-model';
import { formatDateKo, formatKrw, formatPercent } from '@/lib/format';

export type DecisionTone = 'review' | 'watch' | 'ok' | 'risk' | 'data';

export type DecisionItem = {
  id: string;
  title: string;
  label: string;
  reason: string;
  metric: string;
  href: string;
  tone: DecisionTone;
};

export type DecisionBrief = {
  state: Array<{ label: string; value: string; caption: string; tone?: DecisionTone }>;
  decisions: DecisionItem[];
  quality: Array<{ label: string; value: string; caption: string; tone?: DecisionTone }>;
  changes: Array<{ title: string; caption: string; href: string }>;
};

export function buildDecisionBrief(view: DashboardViewModel): DecisionBrief {
  const { overview, dataQuality, benchmarkToBeat, selectedStrategy, latestReportsBySymbol, recentBuys } = view;
  const holdings = overview.portfolio.holdings;
  const reports = overview.recentReports;
  const candidates = overview.researchCandidates.map((candidate) => candidate.report);
  const insights = getInsights();
  const benchmarkExcess = selectedStrategy?.benchmarkExcess ?? null;
  const dataExcluded = dataQuality.reportExclusions.excluded_reports ?? 0;

  return {
    state: [
      {
        label: '평가액',
        value: formatKrw(overview.portfolio.finalEquityKrw),
        caption: `${overview.portfolio.label} · ${overview.snapshotDate || '기준일 없음'}`,
      },
      {
        label: 'RP이자 비중',
        value: formatPercent(overview.portfolio.cashWeight),
        caption: holdings.length ? `${holdings.length}개 보유` : '현재 보유 종목 없음',
        tone: (overview.portfolio.cashWeight ?? 0) > 0.5 ? 'watch' : 'ok',
      },
      {
        label: '낙폭',
        value: formatPercent(overview.portfolio.maxDrawdown),
        caption: 'MDD 기준 위험 점검',
        tone: (overview.portfolio.maxDrawdown ?? 0) > 0.15 ? 'risk' : 'ok',
      },
      {
        label: '기준선 대비',
        value: formatPercent(benchmarkExcess),
        caption: benchmarkToBeat?.shortLabel || benchmarkToBeat?.label || 'KODEX200',
        tone: (benchmarkExcess ?? 0) >= 0 ? 'ok' : 'risk',
      },
      {
        label: '데이터 제외',
        value: `${dataExcluded.toLocaleString('ko-KR')}건`,
        caption: `가격 누락 ${dataQuality.missingPriceSymbols.toLocaleString('ko-KR')}개 심볼`,
        tone: dataExcluded > 0 ? 'data' : 'ok',
      },
    ],
    decisions: buildDecisionItems({ holdings, reports, candidates, latestReportsBySymbol, recentBuys, view }),
    quality: [
      {
        label: '리포트 포함',
        value: `${(dataQuality.reportExclusions.included_reports ?? view.priceMatchedReports).toLocaleString('ko-KR')}건`,
        caption: `원천 ${dataQuality.totalReports.toLocaleString('ko-KR')}건`,
      },
      {
        label: '목표가 도달',
        value: formatPercent(overview.reportStats.targetHitRate),
        caption: `${overview.reportStats.hitCount.toLocaleString('ko-KR')}/${overview.reportStats.total.toLocaleString('ko-KR')}건`,
      },
      {
        label: '검토 플래그',
        value: `${extractReviewFlagCount(dataQuality.extractionQuality).toLocaleString('ko-KR')}건`,
        caption: '등급 누락·비매수·시나리오 목표가',
        tone: extractReviewFlagCount(dataQuality.extractionQuality) > 0 ? 'data' : 'ok',
      },
    ],
    changes: buildChanges({ insights, reports, candidates, recentBuys }),
  };
}

function buildDecisionItems({
  holdings,
  reports,
  candidates,
  latestReportsBySymbol,
  recentBuys,
  view,
}: {
  holdings: HoldingRow[];
  reports: ReportRow[];
  candidates: ReportRow[];
  latestReportsBySymbol: Map<string, ReportRow>;
  recentBuys: TradeRow[];
  view: DashboardViewModel;
}): DecisionItem[] {
  const items: DecisionItem[] = [];

  if (!holdings.length) {
    items.push({
      id: 'cash-reserve',
      title: '현재 보유 종목 없음',
      label: '대기',
      reason: `RP ${formatPercent(view.overview.portfolio.cashWeight)} 상태입니다. 후보는 리포트 검증 화면에서 근거를 먼저 확인합니다.`,
      metric: formatKrw(view.overview.portfolio.cashKrw),
      href: '/portfolio',
      tone: 'watch',
    });
  }

  for (const holding of holdings.slice(0, 4)) {
    const report = latestReportsBySymbol.get(holding.symbol);
    const progress = report?.targetProgressPct ?? null;
    const needsReview = (progress ?? 0) >= 0.85 || (holding.unrealizedReturn ?? 0) < -0.12 || report?.expired;
    items.push({
      id: `holding-${holding.symbol}`,
      title: `${holding.symbol} ${holding.company || ''}`.trim(),
      label: needsReview ? '재검토' : '유지 점검',
      reason: report
        ? `최신 리포트 ${formatDateKo(report.publicationDate)}, 목표 진행 ${formatPercent(progress)}.`
        : '연결된 최신 리포트가 없어 근거 확인이 필요합니다.',
      metric: formatPercent(holding.unrealizedReturn),
      href: report ? exactReportHref(report) : `/reports/${encodeURIComponent(holding.symbol)}`,
      tone: needsReview ? 'review' : 'ok',
    });
  }

  for (const report of candidates.slice(0, Math.max(0, 5 - items.length))) {
    items.push({
      id: `candidate-${report.reportId}`,
      title: `${report.company || report.symbol}`,
      label: '후보 관찰',
      reason: `목표 잔여 ${formatPercent(report.targetRemainingPct)}, 현재 수익률 ${formatPercent(report.currentReturn)}. 매수 신호가 아닌 검토 대기열입니다.`,
      metric: report.symbol,
      href: exactReportHref(report),
      tone: 'watch',
    });
  }

  if (recentBuys.length && items.length < 6) {
    const trade = recentBuys[0];
    items.push({
      id: `trade-${trade.date}-${trade.symbol}`,
      title: `${trade.symbol} 최근 매매`,
      label: '매매 확인',
      reason: `${formatDateKo(trade.date)} 체결 기록입니다. 실시간 주문 신호가 아닙니다.`,
      metric: formatKrw(trade.grossKrw),
      href: exactTradeReportHref(trade),
      tone: 'data',
    });
  }

  for (const report of reports.filter((row) => row.expired || row.targetHit).slice(0, Math.max(0, 6 - items.length))) {
    items.push({
      id: `report-${report.reportId}`,
      title: `${report.company || report.symbol}`,
      label: report.targetHit ? '도달 확인' : '만료 확인',
      reason: `${formatDateKo(report.publicationDate)} 리포트의 목표가 상태를 확인합니다.`,
      metric: report.targetHit ? '도달' : '만료',
      href: exactReportHref(report),
      tone: report.targetHit ? 'ok' : 'review',
    });
  }

  return items.slice(0, 6);
}

function buildChanges({
  insights,
  reports,
  candidates,
  recentBuys,
}: {
  insights: Insight[];
  reports: ReportRow[];
  candidates: ReportRow[];
  recentBuys: TradeRow[];
}): Array<{ title: string; caption: string; href: string }> {
  const rows = [
    ...reports.slice(0, 2).map((report) => ({
      title: `${report.company || report.symbol} 리포트 반영`,
      caption: `${formatDateKo(report.publicationDate)} · ${report.symbol} · 현재 ${formatPercent(report.currentReturn)}`,
      href: exactReportHref(report),
    })),
    ...candidates.slice(0, 2).map((report) => ({
      title: `${report.company || report.symbol} 후보 대기`,
      caption: `${report.symbol} · 목표 잔여 ${formatPercent(report.targetRemainingPct)}`,
      href: exactReportHref(report),
    })),
    ...recentBuys.slice(0, 1).map((trade) => ({
      title: `${trade.symbol} 매매 기록`,
      caption: `${formatDateKo(trade.date)} · ${formatKrw(trade.grossKrw)}`,
      href: exactTradeReportHref(trade),
    })),
    ...insights.slice(0, 2).map((insight) => ({
      title: insight.title,
      caption: insight.sentence,
      href: '/reports',
    })),
  ];
  return rows.slice(0, 5);
}

function exactReportHref(report: ReportRow): string {
  if (!report.reportId) {
    throw new Error(`Report link requires reportId for ${report.symbol}`);
  }
  return `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}`;
}

function exactTradeReportHref(trade: TradeRow): string {
  if (!trade.reportId) {
    return `/portfolio/${encodeURIComponent(trade.persona)}`;
  }
  return `/reports/${encodeURIComponent(trade.symbol)}/${encodeURIComponent(trade.reportId)}`;
}

function extractReviewFlagCount(value: Record<string, unknown>): number {
  const summary = value.summary;
  if (summary && typeof summary === 'object' && 'review_flagged_rows' in summary) {
    const count = Number((summary as { review_flagged_rows?: unknown }).review_flagged_rows);
    return Number.isFinite(count) ? count : 0;
  }
  return 0;
}
