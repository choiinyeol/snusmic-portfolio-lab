'use client';

import { useMemo } from 'react';
import { DailyEquityHistory } from '@/components/trading/DailyEquityHistory';
import { HoldingsTreemap } from '@/components/trading/HoldingsTreemap';
import { PositionDecisionPanel } from '@/components/trading/PositionDecisionPanel';
import { PortfolioAnalyticsPanel } from '@/components/trading/PortfolioAnalyticsPanel';
import { PortfolioTables } from '@/components/trading/PortfolioTables';
import { StrategySelector, type StrategySelectorOption } from '@/components/trading/StrategySelector';
import { TradesTable } from '@/components/trading/TradesTable';
import { KpiTile } from '@/components/ui/KpiTile';
import { Tabs } from '@/components/ui/Tabs';
import type {
  AccountingReconciliationRow,
  EquityPoint,
  HoldingRow,
  PositionEpisodeRow,
  ReportTargetDigest,
  TradeRow,
} from '@/lib/artifacts';
import { formatKrw, formatPercent } from '@/lib/format';
import type { StrategyLeaderboardRow } from '@/lib/product-model';

type Props = {
  holdings: HoldingRow[];
  accounting: AccountingReconciliationRow[];
  equity: EquityPoint[];
  trades: TradeRow[];
  episodes: PositionEpisodeRow[];
  personas: string[];
  personaLabels: Record<string, string>;
  strategyOptions: StrategySelectorOption[];
  strategyRows: StrategyLeaderboardRow[];
  defaultPersona: string;
  selectedPersona: string;
  invalidStrategyId: string | null;
  methodsByPersona: Record<
    string,
    { summary: string; buyRules: string[]; sellRules: string[]; riskControls: string[] }
  >;
  capitalByPersona: Record<string, number>;
  cashByPersona: Record<string, number>;
  reportSymbolsById: Record<string, string>;
  targetsBySymbol: Record<string, ReportTargetDigest>;
  targetsByReportId: Record<string, ReportTargetDigest>;
};

export function PortfolioStrategyView({
  holdings,
  accounting,
  equity,
  trades,
  episodes,
  personas,
  personaLabels,
  strategyOptions,
  strategyRows,
  defaultPersona,
  selectedPersona,
  invalidStrategyId,
  methodsByPersona,
  capitalByPersona,
  cashByPersona,
  reportSymbolsById,
  targetsBySymbol,
  targetsByReportId,
}: Props) {
  const persona = personas.includes(selectedPersona)
    ? selectedPersona
    : personas.includes(defaultPersona)
      ? defaultPersona
      : (personas[0] ?? '');

  const personaHoldings = useMemo(() => holdings.filter((row) => row.persona === persona), [holdings, persona]);
  const cashKrw = cashByPersona[persona] ?? 0;
  const treemapHoldings = useMemo(
    () => withCashHolding(personaHoldings, cashKrw, persona),
    [cashKrw, personaHoldings, persona],
  );
  const personaEpisodes = useMemo(() => episodes.filter((row) => row.persona === persona), [episodes, persona]);
  const personaTrades = useMemo(() => trades.filter((row) => row.persona === persona), [trades, persona]);
  const personaAccounting = useMemo(() => accounting.find((row) => row.persona === persona), [accounting, persona]);
  const reportHrefBySymbol = useMemo(
    () => Object.fromEntries(Object.values(targetsBySymbol).map((target) => [target.symbol, reportTargetHref(target)])),
    [targetsBySymbol],
  );

  const holdingsValue = personaHoldings.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const totalValue = holdingsValue + cashKrw;
  const totalPnl = personaHoldings.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const cost = totalValue - totalPnl;
  const realizedPnl = personaEpisodes.reduce((sum, episode) => sum + (episode.realizedPnlKrw ?? 0), 0);
  const closedCount = personaEpisodes.filter((e) => e.status === 'closed').length;
  const buyCount = personaTrades.filter((t) => t.side === 'buy').length;
  const sellCount = personaTrades.filter((t) => t.side === 'sell').length;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="lab-panel p-3 md:p-4">
        <div className="grid min-w-0 gap-2">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="snapshot-pill">전략 선택</span>
            <span className="text-xs font-bold text-slate-950/45">
              고유 전략 {strategyOptions.filter((item) => item.kind === 'strategy').length} · 기준선{' '}
              {strategyOptions.filter((item) => item.kind !== 'strategy').length}
            </span>
          </div>
          <StrategySelector ariaLabel="포트폴리오 전략 선택" options={strategyOptions} value={persona} />
        </div>
        {invalidStrategyId ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            요청한 전략 <code>{invalidStrategyId}</code>는 현재 산출물에 없습니다. 현재 기본 전략 기준으로 표시합니다.
          </div>
        ) : null}
        <p className="m-0 mt-2 text-xs text-slate-950/55">
          <strong className="text-slate-950">{personaLabels[persona] ?? persona}</strong>의 보유·현금·체결·매수/매도
          규칙을 함께 봅니다. 기준선과 상한선은 비교용이고, 고유 전략만 선택해 검토할 수 있는 포트폴리오 전략입니다.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiTile
          compact
          label="평가액"
          value={formatKrw(totalValue)}
          caption={`${personaHoldings.length}종목 · 현금 ${formatPercent(totalValue > 0 ? cashKrw / totalValue : null)}`}
          tone="accent"
        />
        <KpiTile compact label="현금" value={formatKrw(cashKrw)} delta="미투자 대기 자금" tone="neutral" />
        <KpiTile compact label="출자 원금" value={formatKrw(capitalByPersona[persona] ?? null)} delta="입금 기준" />
        <KpiTile
          compact
          label="미실현 손익"
          value={formatKrw(totalPnl)}
          delta={formatPercent(cost > 0 ? totalPnl / cost : null)}
          tone={totalPnl >= 0 ? 'good' : 'bad'}
        />
        <KpiTile
          compact
          label="확정 손익"
          value={formatKrw(realizedPnl)}
          delta={`${closedCount}건 청산`}
          tone={realizedPnl >= 0 ? 'good' : 'bad'}
        />
        <KpiTile
          compact
          label="체결"
          value={personaTrades.length.toLocaleString('ko-KR')}
          delta={`매수 ${buyCount} · 매도 ${sellCount}`}
        />
      </div>

      <PortfolioAnalyticsPanel equity={equity} persona={persona} rows={strategyRows} personaLabels={personaLabels} />

      <AccountingExplanationPanel row={personaAccounting} />

      <article className="lab-panel p-3 md:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="lab-panel__eyebrow">보유 현황</div>
            <h2 className="lab-panel__title">현재 보유 트리맵</h2>
          </div>
          <span className="snapshot-pill">면적=평가액</span>
        </div>
        <HoldingsTreemap holdings={treemapHoldings} height={360} compact hrefBySymbol={reportHrefBySymbol} />
        <p className="mt-3 text-xs leading-5 text-slate-950/55">
          매도 후 즉시 다른 종목을 사지 않는 경우는 전략의 리밸런싱/입금 주기, 최대 보유 종목 수, 추세
          필터·업사이드·가격 조건을 동시에 만족하는 후보 부족 때문입니다. 그 구간의 미투자 금액은 현금으로 보존되어
          평가액과 트리맵에 포함됩니다.
        </p>
      </article>

      <StrategyMethodPanel method={methodsByPersona[persona]} personaLabel={personaLabels[persona] ?? persona} />

      <PositionDecisionPanel
        holdings={holdings}
        trades={trades}
        persona={persona}
        targetsBySymbol={targetsBySymbol}
        targetsByReportId={targetsByReportId}
        reportSymbolsById={reportSymbolsById}
      />

      <Tabs
        tabs={[
          {
            id: 'current',
            label: '현재 보유',
            meta: personaHoldings.length.toString(),
            content: (
              <PortfolioTables
                holdings={holdings}
                persona={persona}
                personaLabels={personaLabels}
                capitalByPersona={capitalByPersona}
                targetsBySymbol={targetsBySymbol}
              />
            ),
          },
          {
            id: 'history',
            label: '일별 평가액',
            meta: equity.filter((row) => row.persona === persona).length.toString(),
            content: (
              <DailyEquityHistory equity={equity} trades={trades} persona={persona} personaLabels={personaLabels} />
            ),
          },
          {
            id: 'trades',
            label: '매매내역',
            meta: personaTrades.length.toString(),
            content: (
              <TradesTable
                trades={trades}
                episodes={episodes}
                persona={persona}
                personaLabels={personaLabels}
                capitalByPersona={capitalByPersona}
                reportSymbolsById={reportSymbolsById}
                targetsBySymbol={targetsBySymbol}
                targetsByReportId={targetsByReportId}
              />
            ),
          },
        ]}
      />
    </div>
  );
}

function reportTargetHref(target: ReportTargetDigest): string {
  return `/reports/${encodeURIComponent(target.symbol)}/${encodeURIComponent(target.reportId)}`;
}

function StrategyMethodPanel({
  method,
  personaLabel,
}: {
  method: { summary: string; buyRules: string[]; sellRules: string[]; riskControls: string[] } | undefined;
  personaLabel: string;
}) {
  if (!method) return null;
  return (
    <article className="lab-panel p-4">
      <div className="mb-3">
        <div className="lab-panel__eyebrow">운용 규칙</div>
        <h2 className="lab-panel__title">{personaLabel} 매수·매도 규칙</h2>
        <p className="mt-2 text-sm leading-6 text-slate-950/62">{method.summary}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <RuleList title="매수 판단" items={method.buyRules} />
        <RuleList title="매도 판단" items={method.sellRules} />
        <RuleList title="위험 관리" items={method.riskControls} />
      </div>
    </article>
  );
}

function AccountingExplanationPanel({ row }: { row: AccountingReconciliationRow | undefined }) {
  if (!row) return null;
  const realizedOverCash = (row.realizedPnlKrw ?? 0) > (row.finalCashKrw ?? 0);
  return (
    <article className="lab-panel p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem] xl:items-start">
        <div>
          <div className="lab-panel__eyebrow">현금 검산</div>
          <h2 className="lab-panel__title">확정 손익과 현금은 같은 숫자가 아닙니다</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {row.explanationKo} 이 검산은 저장된 매매내역과 현재 보유 포지션을 이용해 만든 파생 데이터입니다. 현금은
            “입금액 + 실현손익 − 아직 들고 있는 주식의 매입 원가”로 다시 계산하며, 평가액은 현금과 보유 주식의 현재
            가치가 합쳐진 값입니다.
          </p>
          {realizedOverCash ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              따라서 일부 리포트 추세 전략처럼 확정 손익이 약 {formatKrw(row.realizedPnlKrw)}인데 현금이{' '}
              {formatKrw(row.finalCashKrw)}로 보이는 상황은, 약 {formatKrw(row.openCostBasisKrw)}가 현재 보유 종목의
              원가로 묶여 있으면 회계적으로 자연스럽습니다.
            </p>
          ) : null}
        </div>
        <dl className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <AccountingLine label="입금 누계" value={row.totalContributedKrw} />
          <AccountingLine label="+ 확정 손익" value={row.realizedPnlKrw} />
          <AccountingLine label="- 보유 원가" value={row.openCostBasisKrw === null ? null : -row.openCostBasisKrw} />
          <AccountingLine label="= 계산 현금" value={row.expectedCashKrw} strong />
          <AccountingLine label="표시 현금" value={row.finalCashKrw} />
          <AccountingLine
            label="검산 차이"
            value={row.cashGapKrw}
            tone={Math.abs(row.cashGapKrw ?? 0) > 5000 ? 'bad' : 'good'}
          />
        </dl>
      </div>
    </article>
  );
}

function AccountingLine({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: number | null;
  strong?: boolean;
  tone?: 'good' | 'bad';
}) {
  const color = tone === 'bad' ? 'text-rose-600' : tone === 'good' ? 'text-emerald-600' : 'text-slate-950';
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-slate-950/55">{label}</dt>
      <dd className={`font-mono tabular-nums ${strong ? 'font-black' : 'font-semibold'} ${color}`}>
        {formatKrw(value)}
      </dd>
    </div>
  );
}

function RuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <h3 className="text-sm font-black">{title}</h3>
      <ul className="mt-2 grid gap-1.5 text-sm leading-5 text-slate-500">
        {items.length ? (
          items.map((item) => <li key={item}>• {item}</li>)
        ) : (
          <li className="text-slate-950/45">기록된 규칙이 없습니다.</li>
        )}
      </ul>
    </div>
  );
}

function withCashHolding(holdings: HoldingRow[], cashKrw: number, persona: string): HoldingRow[] {
  if (cashKrw <= 0) return holdings;
  return [
    ...holdings,
    {
      persona,
      symbol: 'CASH',
      company: '현금',
      qty: null,
      avgCostKrw: null,
      lastCloseKrw: 1,
      lastCloseNative: 1,
      currency: 'KRW',
      marketValueKrw: cashKrw,
      unrealizedPnlKrw: 0,
      unrealizedReturn: 0,
      holdingDays: null,
      firstBuyDate: null,
    },
  ];
}
