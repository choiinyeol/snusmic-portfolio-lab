import 'server-only';
import {
  getAccountLabel,
  getCurrentHoldings,
  getPriceSeries,
  getReportRows,
  getTrades,
  hasPriceArtifact,
  type HoldingRow,
  type ReportRow,
  type TradeRow,
} from '@/lib/artifacts';
import { getDefaultPortfolioAccount } from '@/lib/product-model';

export type ActionQueueAction = 'Buy' | 'Sell' | 'Watch';

export type ActionQueueRow = {
  ticker: string;
  company: string;
  action: ActionQueueAction;
  plannedPrice: number | null;
  plannedPriceKrw: number | null;
  currentPrice: number | null;
  currentPriceKrw: number | null;
  currency: string;
  strategyReason: string;
  reportEvidence: string;
  portfolioImpact: string;
  confidence: number;
  confidenceReasons: string[];
  validationTags: string[];
  caveats: string[];
  reportHref: string | null;
  reportId: string | null;
  latestTradeDate: string | null;
  latestPriceDate: string | null;
  targetGapPct: number | null;
  entryExitZone: string;
  sortKey: number;
};

export type ActionQueueSummary = {
  accountId: string;
  accountLabel: string;
  rowCount: number;
  buyCount: number;
  sellCount: number;
  watchCount: number;
  averageConfidence: number | null;
  generatedFrom: string[];
};

export type ActionQueueViewModel = {
  summary: ActionQueueSummary;
  rows: ActionQueueRow[];
  strategyRows: Array<{ label: string; value: string; caption: string }>;
  reportPoolRows: Array<{ label: string; value: string; caption: string }>;
};

type Candidate = {
  symbol: string;
  company: string;
  holding?: HoldingRow;
  trades: TradeRow[];
  report?: ReportRow;
};

type PriceDigest = {
  currentPrice: number | null;
  currentPriceKrw: number | null;
  currency: string;
  latestPriceDate: string | null;
};

const MAX_QUEUE_ROWS = 36;
const RECENT_TRADE_LIMIT = 220;
const REPORT_CANDIDATE_LIMIT = 180;

export function getActionQueueViewModel(accountId = getDefaultPortfolioAccount()): ActionQueueViewModel {
  const holdings = getCurrentHoldings().filter((row) => row.account_id === accountId && row.symbol !== 'CASH');
  const trades = getTrades().filter((row) => row.account_id === accountId);
  const reports = getReportRows();
  const candidates = buildCandidates(holdings, trades, reports);
  const rows = balanceQueueRows([...candidates.values()].map((candidate) => toActionQueueRow(candidate)));
  const averageConfidence = rows.length
    ? rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length
    : null;

  return {
    summary: {
      accountId,
      accountLabel: getAccountLabel(accountId),
      rowCount: rows.length,
      buyCount: rows.filter((row) => row.action === 'Buy').length,
      sellCount: rows.filter((row) => row.action === 'Sell').length,
      watchCount: rows.filter((row) => row.action === 'Watch').length,
      averageConfidence,
      generatedFrom: ['portfolio/trades.json', 'portfolio/holdings.json', 'reports/table.json'],
    },
    rows,
    strategyRows: buildStrategyRows(rows),
    reportPoolRows: buildReportPoolRows(rows),
  };
}

function buildCandidates(holdings: HoldingRow[], trades: TradeRow[], reports: ReportRow[]): Map<string, Candidate> {
  const map = new Map<string, Candidate>();
  const latestReports = latestReportBySymbol(reports);

  for (const holding of holdings) {
    const candidate = ensureCandidate(map, holding.symbol, holding.company);
    candidate.holding = holding;
    candidate.report = latestReports.get(holding.symbol) ?? candidate.report;
  }

  for (const trade of trades.slice(0, RECENT_TRADE_LIMIT)) {
    const candidate = ensureCandidate(map, trade.symbol, trade.company || trade.symbol);
    candidate.trades.push(trade);
    const linkedReport = trade.reportId ? reports.find((report) => report.reportId === trade.reportId) : undefined;
    candidate.report = linkedReport ?? latestReports.get(trade.symbol) ?? candidate.report;
  }

  for (const report of reports.slice(0, REPORT_CANDIDATE_LIMIT)) {
    if (!isActionableReport(report)) continue;
    const candidate = ensureCandidate(map, report.symbol, report.company || report.symbol);
    candidate.report = report;
  }

  return map;
}

function ensureCandidate(map: Map<string, Candidate>, symbol: string, company: string): Candidate {
  const normalized = symbol.toUpperCase();
  const existing = map.get(normalized);
  if (existing) {
    if (!existing.company || existing.company === existing.symbol) existing.company = company;
    return existing;
  }
  const next: Candidate = { symbol: normalized, company: company || normalized, trades: [] };
  map.set(normalized, next);
  return next;
}

function toActionQueueRow(candidate: Candidate): ActionQueueRow {
  const report = candidate.report;
  const holding = candidate.holding;
  const latestTrade = candidate.trades[0];
  const price = getPriceDigest(candidate.symbol, report, holding);
  const targetGapPct = calculateTargetGap(report, price.currentPriceKrw, price.currentPrice);
  const action = chooseAction(candidate, targetGapPct);
  const confidenceReasons: string[] = [];
  const validationTags: string[] = [];
  const caveats: string[] = [];

  let confidence = 42;
  if (report) {
    confidence += 16;
    confidenceReasons.push('보고서 근거 있음');
    if (!report.expired) confidence += 6;
    if (report.targetPriceKrw !== null || report.targetPriceNative !== null) confidence += 8;
    if (report.caveatFlags.length) {
      confidence -= Math.min(12, report.caveatFlags.length * 4);
      caveats.push(...report.caveatFlags.slice(0, 3));
    }
  } else {
    caveats.push('연결된 최신 보고서 없음');
  }
  if (holding) {
    confidence += 12;
    confidenceReasons.push('보유 포지션 있음');
  }
  if (latestTrade) {
    confidence += 10;
    confidenceReasons.push(`최근 ${tradeSideLabel(latestTrade.side)} 기록 있음`);
  }
  if (price.latestPriceDate) {
    confidence += 8;
    validationTags.push('가격 검증');
  } else {
    confidence -= 10;
    caveats.push('가격 artifact 없음');
  }
  if (targetGapPct !== null) {
    confidence += targetGapPct > 0 ? 6 : 3;
    validationTags.push('목표가 괴리 계산');
  }

  const plannedPrice = plannedPriceForAction(action, report, holding, price);
  const plannedPriceKrw = plannedPriceKrwForAction(action, report, holding, price);
  const clampedConfidence = clamp(Math.round(confidence), 5, 98);

  return {
    ticker: candidate.symbol,
    company: candidate.company,
    action,
    plannedPrice,
    plannedPriceKrw,
    currentPrice: price.currentPrice,
    currentPriceKrw: price.currentPriceKrw,
    currency: price.currency,
    strategyReason: buildStrategyReason(candidate, action, targetGapPct),
    reportEvidence: buildReportEvidence(report),
    portfolioImpact: buildPortfolioImpact(holding, latestTrade),
    confidence: clampedConfidence,
    confidenceReasons,
    validationTags,
    caveats,
    reportHref: report ? `/reports/${encodeURIComponent(report.symbol)}/${encodeURIComponent(report.reportId)}` : null,
    reportId: report?.reportId ?? null,
    latestTradeDate: latestTrade?.date ?? null,
    latestPriceDate: price.latestPriceDate,
    targetGapPct,
    entryExitZone: buildEntryExitZone(action, targetGapPct),
    sortKey: actionWeight(action) * 1000 + clampedConfidence + recencyScore(report?.publicationDate ?? latestTrade?.date),
  };
}

function latestReportBySymbol(reports: ReportRow[]): Map<string, ReportRow> {
  const map = new Map<string, ReportRow>();
  for (const report of reports) {
    const symbol = report.symbol.toUpperCase();
    const current = map.get(symbol);
    if (!current || report.publicationDate > current.publicationDate) map.set(symbol, report);
  }
  return map;
}

function isActionableReport(report: ReportRow): boolean {
  if (report.expired) return false;
  if (report.targetRemainingPct !== null && report.targetRemainingPct > 0) return true;
  if (report.targetGapPct !== null && report.targetGapPct > 0) return true;
  if (report.targetUpsideAtPub !== null && report.targetUpsideAtPub > 0.05) return true;
  return report.currentReturn !== null && report.currentReturn > -0.2;
}

function getPriceDigest(symbol: string, report: ReportRow | undefined, holding: HoldingRow | undefined): PriceDigest {
  const fallbackCurrency = report?.currency ?? holding?.currency ?? 'KRW';
  if (!hasPriceArtifact(symbol)) {
    return {
      currentPrice: report?.lastCloseNative ?? holding?.lastCloseNative ?? null,
      currentPriceKrw: report?.lastCloseKrw ?? holding?.lastCloseKrw ?? null,
      currency: fallbackCurrency,
      latestPriceDate: report?.lastCloseDate ?? null,
    };
  }
  const series = getPriceSeries(symbol);
  const latest = series.at(-1);
  if (!latest) {
    return { currentPrice: null, currentPriceKrw: null, currency: fallbackCurrency, latestPriceDate: null };
  }
  return {
    currentPrice: latest.close ?? latest.value ?? report?.lastCloseNative ?? holding?.lastCloseNative ?? null,
    currentPriceKrw: latest.closeKrw ?? report?.lastCloseKrw ?? holding?.lastCloseKrw ?? null,
    currency: latest.currency ?? fallbackCurrency,
    latestPriceDate: latest.time,
  };
}

function calculateTargetGap(
  report: ReportRow | undefined,
  currentPriceKrw: number | null,
  currentPrice: number | null,
): number | null {
  if (!report) return null;
  if (report.targetRemainingPct !== null) return report.targetRemainingPct;
  if (report.targetGapPct !== null) return report.targetGapPct;
  if (report.targetPriceKrw !== null && currentPriceKrw !== null && currentPriceKrw > 0) {
    return report.targetPriceKrw / currentPriceKrw - 1;
  }
  if (report.targetPriceNative !== null && currentPrice !== null && currentPrice > 0) {
    return report.targetPriceNative / currentPrice - 1;
  }
  return null;
}

function chooseAction(candidate: Candidate, targetGapPct: number | null): ActionQueueAction {
  const holding = candidate.holding;
  const latestTrade = candidate.trades[0];
  const hasPosition = Boolean(holding && (holding.qty ?? 0) > 0);
  const recentSell = latestTrade?.side === 'sell';
  const recentBuy = latestTrade?.side === 'buy';
  const stretched = targetGapPct !== null && targetGapPct < 0.03;
  const upside = targetGapPct !== null ? targetGapPct : (candidate.report?.targetUpsideAtPub ?? null);
  const weakReport =
    candidate.report?.currentReturn !== null &&
    candidate.report?.currentReturn !== undefined &&
    candidate.report.currentReturn < -0.25;

  if (recentSell || (hasPosition && (stretched || (holding?.unrealizedReturn ?? 0) > 0.25))) return 'Sell';
  if (weakReport || candidate.report?.expired) return 'Watch';
  if (!hasPosition && upside !== null && upside > 0.12) return 'Buy';
  if (!hasPosition && recentBuy && upside !== null && upside > 0.04) return 'Buy';
  return 'Watch';
}

function plannedPriceForAction(
  action: ActionQueueAction,
  report: ReportRow | undefined,
  holding: HoldingRow | undefined,
  price: PriceDigest,
): number | null {
  if (action === 'Sell') return report?.targetPriceNative ?? price.currentPrice ?? holding?.lastCloseNative ?? null;
  if (action === 'Buy') return report?.entryPriceNative ?? price.currentPrice ?? report?.lastCloseNative ?? null;
  return report?.targetPriceNative ?? price.currentPrice ?? null;
}

function plannedPriceKrwForAction(
  action: ActionQueueAction,
  report: ReportRow | undefined,
  holding: HoldingRow | undefined,
  price: PriceDigest,
): number | null {
  if (action === 'Sell') return report?.targetPriceKrw ?? price.currentPriceKrw ?? holding?.lastCloseKrw ?? null;
  if (action === 'Buy') return report?.entryPriceKrw ?? price.currentPriceKrw ?? report?.lastCloseKrw ?? null;
  return report?.targetPriceKrw ?? price.currentPriceKrw ?? null;
}

function buildStrategyReason(candidate: Candidate, action: ActionQueueAction, targetGapPct: number | null): string {
  const latestTrade = candidate.trades[0];
  const reason = latestTrade?.reasonDetail || latestTrade?.reason;
  const gap = targetGapPct !== null ? `목표가 괴리 ${(targetGapPct * 100).toFixed(1)}%` : '목표가 괴리 없음';
  if (action === 'Buy') return `${gap}. ${reason ? `최근 매수 근거: ${reason}` : '보고서 upside 기반 신규 진입 후보'}`;
  if (action === 'Sell') return `${gap}. ${reason ? `최근 거래 근거: ${reason}` : '보유 포지션 리스크/목표가 진행 점검'}`;
  return `${gap}. 매수/매도 조건 확정 전 관찰 대상`;
}

function buildReportEvidence(report: ReportRow | undefined): string {
  if (!report) return '연결 보고서 없음';
  const target = report.targetPriceNative ?? report.targetPriceKrw;
  const parts = [report.company || report.symbol, report.publicationDate];
  if (target !== null) parts.push(`목표가 ${target.toLocaleString('ko-KR')}`);
  if (report.currentReturn !== null) parts.push(`현재 ${(report.currentReturn * 100).toFixed(1)}%`);
  if (report.expired) parts.push('만료');
  return parts.join(' · ');
}

function buildPortfolioImpact(holding: HoldingRow | undefined, latestTrade: TradeRow | undefined): string {
  if (holding) {
    const pnl = holding.unrealizedPnlKrw !== null ? `평가손익 ${Math.round(holding.unrealizedPnlKrw).toLocaleString('ko-KR')}원` : '평가손익 -';
    const weight = holding.marketValueKrw !== null ? `노출 ${Math.round(holding.marketValueKrw).toLocaleString('ko-KR')}원` : '노출 -';
    return `${weight} · ${pnl}`;
  }
  if (latestTrade) return `최근 ${tradeSideLabel(latestTrade.side)} ${latestTrade.date}`;
  return '미보유 후보';
}

function buildEntryExitZone(action: ActionQueueAction, targetGapPct: number | null): string {
  if (targetGapPct === null) return '가격 구간 확인 필요';
  if (action === 'Buy') return targetGapPct > 0.2 ? '진입 여유 큼' : '진입 구간 근접';
  if (action === 'Sell') return targetGapPct < 0.03 ? '청산/축소 구간' : '목표가 진행 점검';
  return targetGapPct > 0.1 ? '관찰: 여유 있음' : '관찰: 목표가 근접';
}

function buildStrategyRows(rows: ActionQueueRow[]): ActionQueueViewModel['strategyRows'] {
  return [
    {
      label: 'Buy 후보',
      value: `${rows.filter((row) => row.action === 'Buy').length.toLocaleString('ko-KR')}개`,
      caption: '보고서 upside와 미보유/저노출 조건',
    },
    {
      label: 'Sell 후보',
      value: `${rows.filter((row) => row.action === 'Sell').length.toLocaleString('ko-KR')}개`,
      caption: '목표가 근접, 최근 매도/축소, 보유 리스크',
    },
    {
      label: 'Watch 후보',
      value: `${rows.filter((row) => row.action === 'Watch').length.toLocaleString('ko-KR')}개`,
      caption: '근거는 있으나 행동 조건 미확정',
    },
  ];
}

function buildReportPoolRows(rows: ActionQueueRow[]): ActionQueueViewModel['reportPoolRows'] {
  const withReports = rows.filter((row) => row.reportId !== null).length;
  const withCaveats = rows.filter((row) => row.caveats.length > 0).length;
  const priceValidated = rows.filter((row) => row.validationTags.includes('가격 검증')).length;
  return [
    { label: '보고서 연결', value: `${withReports.toLocaleString('ko-KR')}개`, caption: 'Report Pool evidence가 큐 행에 연결됨' },
    { label: '가격 검증', value: `${priceValidated.toLocaleString('ko-KR')}개`, caption: 'prices는 보조 검증/보정에만 사용' },
    { label: '주의 태그', value: `${withCaveats.toLocaleString('ko-KR')}개`, caption: '만료·누락·caveat가 confidence에 반영됨' },
  ];
}

function balanceQueueRows(rows: ActionQueueRow[]): ActionQueueRow[] {
  const sorted = [...rows].sort((a, b) => b.sortKey - a.sortKey || b.confidence - a.confidence || a.ticker.localeCompare(b.ticker));
  const buy = sorted.filter((row) => row.action === 'Buy').slice(0, 18);
  const sell = sorted.filter((row) => row.action === 'Sell').slice(0, 9);
  const watch = sorted.filter((row) => row.action === 'Watch').slice(0, 9);
  const selected = new Map<string, ActionQueueRow>();
  for (const row of [...buy, ...sell, ...watch, ...sorted]) {
    if (selected.size >= MAX_QUEUE_ROWS) break;
    selected.set(row.ticker, row);
  }
  return [...selected.values()].sort(
    (a, b) => b.sortKey - a.sortKey || b.confidence - a.confidence || a.ticker.localeCompare(b.ticker),
  );
}
function recencyScore(date: string | null | undefined): number {
  if (!date) return 0;
  const value = Date.parse(date);
  if (!Number.isFinite(value)) return 0;
  return value / 1000 / 60 / 60 / 24 / 365;
}

function actionWeight(action: ActionQueueAction): number {
  if (action === 'Buy') return 3;
  if (action === 'Sell') return 2;
  return 1;
}

function tradeSideLabel(side: string): string {
  if (side === 'buy') return '매수';
  if (side === 'sell') return '매도';
  return side || '거래';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
