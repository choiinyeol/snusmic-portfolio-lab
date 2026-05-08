import Link from 'next/link';
import { KpiTile } from '@/components/ui/KpiTile';
import { Section } from '@/components/ui/Section';
import { Sparkline } from '@/components/ui/Sparkline';
import {
  getCurrentHoldings,
  getEquityDaily,
  getLatestReportTargetsBySymbol,
  getOverview,
  getPersonaLabel,
  getReportRows,
  getSummaryRows,
  type EquityPoint,
  type HoldingRow,
  type ReportRow,
  type SummaryRow,
} from '@/lib/artifacts';
import { formatDateKo, formatKrw, formatNativeWithKrw, formatPercent } from '@/lib/format';

const PERSONA_PRIMARY = 'smic_follower_v2';

export default function DashboardPage() {
  const personas = getSummaryRows();
  const reports = getReportRows();
  const holdings = getCurrentHoldings()
    .filter((row) => row.persona === PERSONA_PRIMARY)
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  const targets = getLatestReportTargetsBySymbol();
  const equity = getEquityDaily();
  const overview = getOverview();

  const persona = personas.find((row) => row.persona === PERSONA_PRIMARY);
  const portfolio = summarizeHoldings(holdings);
  const equitySpark = sparkPoints(equity, PERSONA_PRIMARY);
  const lastUpdated = equityLatestDate(equity) ?? overview.simulation_window?.report_end ?? null;
  const newestReports = [...reports]
    .filter((report) => report.publicationDate)
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
    .slice(0, 5);
  const verdict = strategyVerdict(personas);
  const trend = trendSnapshot(equity, holdings, persona);
  const overseasCount = holdings.filter((row) => row.currency && row.currency !== 'KRW').length;
  const focus = buildFocusCards(holdings, reports);

  return (
    <>
      <section className="hero min-h-[520px] overflow-hidden rounded-box border border-base-300 bg-base-100 shadow-sm" aria-labelledby="dashboard-title">
        <div className="hero-content grid w-full max-w-none gap-8 p-5 md:grid-cols-[minmax(0,1.18fr)_minmax(340px,.82fr)] md:p-8 xl:p-10">
          <div className="grid content-center gap-5">
            <div className="badge badge-primary badge-soft w-fit tracking-[0.18em]">RESEARCH VERIFICATION</div>
            <div className="grid gap-3">
              <h1 id="dashboard-title" className="max-w-5xl text-4xl font-black leading-[0.98] tracking-[-0.06em] text-base-content md:text-6xl">
                리포트가 실제 성과로 이어졌는지, 포트폴리오 기준으로 확인하세요.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-base-content/70">
                SMIC 리포트의 목표가 도달 여부, 현재 보유 종목, 전략 백테스트, 외화 자산 가격을 연결해 보여주는 리서치 검증 대시보드입니다. 수익률만 보여주지 않고 근거·검증·리스크를 함께 봅니다.
              </p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap" aria-label="주요 페이지 이동">
              <Link className="btn btn-primary w-full sm:w-auto" href="/portfolio">현재 포트폴리오 보기</Link>
              <Link className="btn btn-outline w-full sm:w-auto" href="/reports">리포트 검증 보기</Link>
              <Link className="btn btn-ghost w-full sm:w-auto" href="/strategies">전략 백테스트 보기</Link>
            </div>
            <div className="stats stats-vertical w-full border border-base-300 bg-base-200/60 shadow-sm sm:stats-horizontal">
              <div className="stat py-4"><div className="stat-title">기준일</div><div className="stat-value text-base">{formatDateKo(lastUpdated)}</div></div>
              <div className="stat py-4"><div className="stat-title">보유</div><div className="stat-value text-base">{holdings.length}종목</div></div>
              <div className="stat py-4"><div className="stat-title">외화</div><div className="stat-value text-base">{overseasCount}종목</div></div>
              <div className="stat py-4"><div className="stat-title">전략</div><div className="stat-value text-base">{getPersonaLabel(PERSONA_PRIMARY)}</div></div>
            </div>
          </div>

          <aside className="card bg-base-200/70 shadow-sm">
            <div className="card-body gap-5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-base-content/65">현재 계좌 스냅샷</span>
                <span className={`badge ${trend.tone === 'good' ? 'badge-success' : trend.tone === 'bad' ? 'badge-error' : 'badge-warning'} badge-soft`}>{trend.mode}</span>
              </div>
              <div>
                <div className="text-5xl font-black tracking-[-0.06em] text-base-content">{formatKrw(portfolio.marketValue)}</div>
                <div className={`mt-2 font-bold ${portfolio.unrealizedPnl >= 0 ? 'text-success' : 'text-error'}`}>
                  {formatKrw(portfolio.unrealizedPnl)} · {formatPercent(portfolio.unrealizedReturn)}
                </div>
              </div>
              <Sparkline values={equitySpark} height={64} tone={trend.tone === 'bad' ? 'bad' : trend.tone === 'good' ? 'good' : 'accent'} />
              <div className="grid grid-cols-2 gap-3">
                <Metric label="MWR" value={formatPercent(persona?.moneyWeightedReturn ?? persona?.irr)} />
                <Metric label="MDD" value={formatPercent(persona?.maxDrawdown)} />
                <Metric label="Top5 집중" value={formatPercent(portfolio.top5Weight)} />
                <Metric label="목표 적중" value={formatPercent(overview.target_stats?.target_hit_rate)} />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <Section
        eyebrow="오늘의 판단"
        title="먼저 확인할 신호"
        caption="사용자가 다음에 봐야 할 곳을 숫자와 이유로 연결합니다. 과장된 추천이 아니라, 검증 가능한 이상 신호와 우선순위입니다."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {focus.map((item) => (
            <Link key={item.title} href={item.href} className="card border border-base-300 bg-base-100 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
              <div className="card-body gap-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`badge badge-soft ${item.tone === 'good' ? 'badge-success' : item.tone === 'bad' ? 'badge-error' : item.tone === 'warn' ? 'badge-warning' : 'badge-primary'}`}>{item.label}</span>
                  <span className="text-sm text-base-content/45">보기</span>
                </div>
                <h3 className="card-title text-xl leading-tight">{item.title}</h3>
                <p className="text-sm leading-6 text-base-content/65">{item.body}</p>
                <div className={`text-2xl font-black tracking-[-0.04em] ${item.tone === 'bad' ? 'text-error' : item.tone === 'good' ? 'text-success' : item.tone === 'warn' ? 'text-warning' : 'text-primary'}`}>{item.metric}</div>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <section className="decision-grid grid gap-4 md:grid-cols-4" aria-label="투자 판단 요약">
        <KpiTile label="시장 대응 상태" value={trend.mode} delta={trend.caption} tone={trend.tone} emphasis />
        <KpiTile label="90일 계좌 모멘텀" value={<span>{formatPercent(trend.return90d)}</span>} delta={`120일 ${formatPercent(trend.return120d)}`} tone={(trend.return90d ?? 0) >= 0 ? 'good' : 'bad'} />
        <KpiTile label="상승 포지션 비율" value={<span>{formatPercent(trend.positiveBreadth)}</span>} delta={`${trend.positiveCount}/${holdings.length} 종목 플러스`} tone={(trend.positiveBreadth ?? 0) >= 0.5 ? 'good' : 'warn'} />
        <KpiTile label="고점 대비 낙폭" value={<span>{formatPercent(trend.currentDrawdown)}</span>} delta="최근 계좌 수익률 기준" tone={(trend.currentDrawdown ?? 0) > -0.1 ? 'good' : 'bad'} />
      </section>

      <Section
        eyebrow="Positions"
        title="보유 종목마다 리포트 근거와 현재 가격을 연결합니다"
        caption="해외 자산은 USD·JPY 등 현지 통화를 우선 표시하고, 원화 환산액은 보조로만 붙였습니다."
        actions={<Link className="btn btn-sm btn-outline" href="/portfolio">전체 원장</Link>}
      >
        <div className="grid gap-3">
          {holdings.slice(0, 6).map((row, index) => {
            const display = holdingValueDisplay(row);
            const target = targets[row.symbol];
            const gap = targetGap(row.lastCloseNative, target?.targetPriceNative);
            return (
              <Link key={row.symbol} href={`/reports/${row.symbol}`} className="card card-side border border-base-300 bg-base-100 shadow-sm transition hover:border-primary/40 hover:bg-base-200/40">
                <div className="grid w-14 place-items-center border-r border-base-300 font-mono text-sm font-bold text-base-content/45">{String(index + 1).padStart(2, '0')}</div>
                <div className="card-body grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
                  <div>
                    <h3 className="font-bold leading-tight">{row.company || row.symbol}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5"><span className="badge badge-ghost badge-sm">{row.symbol}</span><span className="badge badge-outline badge-sm">{row.currency || 'KRW'}</span></div>
                  </div>
                  <div className="text-left md:text-right">
                    <strong className="block text-lg tabular-nums">{display.primary}</strong>
                    {display.secondary ? <span className="text-sm text-base-content/50">{display.secondary}</span> : null}
                  </div>
                  <div className="text-left md:text-right">
                    <span className={`font-black ${(row.unrealizedReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{formatPercent(row.unrealizedReturn)}</span>
                    <small className="block text-base-content/50">목표까지 {formatPercent(gap)}</small>
                  </div>
                </div>
              </Link>
            );
          })}
          {!holdings.length ? <p className="text-base-content/60">현재 보유 포지션이 없습니다.</p> : null}
        </div>
      </Section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)]">
        <Section
          eyebrow="Research"
          title="최근 리포트 — 행동 신호만"
          caption="최신 발간 순으로 현재 수익률, 목표까지 남은 거리, 실행 상태만 압축했습니다."
          actions={<Link className="btn btn-sm btn-outline" href="/reports">전체 리포트</Link>}
        >
          <div className="grid gap-3">
            {newestReports.map((report) => (
              <Link key={report.symbol + report.publicationDate} href={`/reports/${report.symbol}`} className="card border border-base-300 bg-base-100 shadow-sm transition hover:border-primary/40 hover:bg-base-200/40">
                <div className="card-body grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <div>
                    <span className="text-xs font-semibold text-base-content/45">{formatDateKo(report.publicationDate)}</span>
                    <h3 className="font-bold leading-tight">{report.company || report.symbol}</h3>
                    <span className="badge badge-ghost badge-sm mt-1">{report.symbol}</span>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <span className={`text-lg font-black ${(report.currentReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}>{formatPercent(report.currentReturn)}</span>
                    {targetUpsidePill(report)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Validation"
          title="전략은 수익률보다 검증 상태를 먼저 봅니다"
          caption="추세 추종 모델은 기준선 대비 우위와 낙폭을 같이 봐야 합니다."
          actions={<Link className="btn btn-sm btn-outline" href="/strategies">리더보드</Link>}
        >
          <article className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <span className={`badge badge-soft w-fit ${verdict.tone === 'good' ? 'badge-success' : verdict.tone === 'bad' ? 'badge-error' : 'badge-warning'}`}>{verdict.headline}</span>
              <h3 className="card-title text-2xl leading-tight">{verdict.summary}</h3>
              <p className="leading-7 text-base-content/65">{verdict.detail}</p>
              <div className="stats stats-vertical border border-base-300 bg-base-200/50 shadow-sm">
                {personas
                  .filter((row) => ['smic_follower_v2', 'all_weather'].includes(row.persona))
                  .map((row) => (
                    <div className="stat py-4" key={row.persona}>
                      <div className="stat-title">{row.label || row.persona}</div>
                      <div className="stat-value text-xl">{formatPercent(row.moneyWeightedReturn ?? row.irr)}</div>
                      <div className="stat-desc">MDD {formatPercent(row.maxDrawdown)}</div>
                    </div>
                  ))}
              </div>
            </div>
          </article>
        </Section>
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-3">
      <span className="block text-xs font-semibold text-base-content/45">{label}</span>
      <strong className="mt-1 block tabular-nums text-base-content">{value}</strong>
    </div>
  );
}

function buildFocusCards(holdings: HoldingRow[], reports: ReportRow[]) {
  const worstHolding = [...holdings].sort((a, b) => (a.unrealizedPnlKrw ?? 0) - (b.unrealizedPnlKrw ?? 0))[0];
  const nearTarget = [...reports]
    .filter((report) => !report.targetHit && (report.targetGapPct ?? Infinity) > 0)
    .sort((a, b) => (a.targetGapPct ?? Infinity) - (b.targetGapPct ?? Infinity))[0];
  const strongest = [...holdings].sort((a, b) => (b.unrealizedPnlKrw ?? 0) - (a.unrealizedPnlKrw ?? 0))[0];
  return [
    {
      label: '리스크',
      title: worstHolding ? `${worstHolding.company || worstHolding.symbol} 손실 기여 점검` : '손실 기여 없음',
      body: '포트폴리오 성과를 깎는 포지션을 먼저 확인합니다. 손절/리밸런싱 기준 검토에 사용합니다.',
      metric: worstHolding ? formatKrw(worstHolding.unrealizedPnlKrw) : '—',
      tone: 'bad' as const,
      href: worstHolding ? `/reports/${worstHolding.symbol}` : '/portfolio',
    },
    {
      label: '목표가',
      title: nearTarget ? `${nearTarget.company || nearTarget.symbol} 목표가 근접` : '진행 중 리포트 확인',
      body: '목표까지 남은 거리가 작은 리포트를 보여줍니다. 단기 과열과 목표 도달 가능성을 함께 봅니다.',
      metric: nearTarget ? formatPercent(nearTarget.targetGapPct) : '—',
      tone: 'warn' as const,
      href: nearTarget ? `/reports/${nearTarget.symbol}` : '/reports',
    },
    {
      label: '기여',
      title: strongest ? `${strongest.company || strongest.symbol} 성과 기여` : '성과 기여 확인',
      body: '수익 기여가 큰 포지션도 목표가, 보유 비중, 추세 훼손 여부를 함께 확인합니다.',
      metric: strongest ? formatKrw(strongest.unrealizedPnlKrw) : '—',
      tone: 'good' as const,
      href: strongest ? `/reports/${strongest.symbol}` : '/portfolio',
    },
  ];
}

function summarizeHoldings(rows: HoldingRow[]) {
  const marketValue = rows.reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  const unrealizedPnl = rows.reduce((sum, row) => sum + (row.unrealizedPnlKrw ?? 0), 0);
  const cost = marketValue - unrealizedPnl;
  const top5 = rows.slice(0, 5).reduce((sum, row) => sum + (row.marketValueKrw ?? 0), 0);
  return {
    marketValue,
    unrealizedPnl,
    unrealizedReturn: cost > 0 ? unrealizedPnl / cost : null,
    top5Weight: marketValue > 0 ? top5 / marketValue : null,
  };
}

function holdingValueDisplay(row: HoldingRow): { primary: string; secondary: string | null } {
  const nativeMarketValue = row.lastCloseNative !== null && row.qty !== null ? row.lastCloseNative * row.qty : null;
  return formatNativeWithKrw(nativeMarketValue, row.marketValueKrw, row.currency);
}

function targetGap(current: number | null | undefined, target: number | null | undefined): number | null {
  if (!current || !target || current <= 0) return null;
  return target / current - 1;
}

function targetUpsidePill(report: ReportRow) {
  if ((report.targetUpsideAtPub ?? 0) <= 0) return <span className="badge badge-ghost badge-sm">비실행</span>;
  if (report.targetHit) return <span className="badge badge-success badge-soft badge-sm">도달</span>;
  return <span className="badge badge-primary badge-soft badge-sm">진행</span>;
}

function sparkPoints(equity: EquityPoint[], persona: string): number[] {
  const series = equity
    .filter((point) => point.persona === persona && point.cumulativeReturn !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => point.cumulativeReturn ?? 0);
  return series.slice(-90);
}

function equityLatestDate(equity: EquityPoint[]): string | null {
  return equity.reduce<string | null>((latest, point) => (point.date > (latest ?? '') ? point.date : latest), null);
}

function trendSnapshot(equity: EquityPoint[], holdings: HoldingRow[], persona: SummaryRow | undefined) {
  const series = equity
    .filter((point) => point.persona === PERSONA_PRIMARY && point.cumulativeReturn !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => point.cumulativeReturn ?? 0);
  const last = series.at(-1) ?? null;
  const return90d = windowReturn(series, 90);
  const return120d = windowReturn(series, 120);
  const peak = series.reduce<number | null>((max, value) => (max === null || value > max ? value : max), null);
  const currentDrawdown = last !== null && peak !== null ? (1 + last) / Math.max(0.0001, 1 + peak) - 1 : null;
  const positiveCount = holdings.filter((row) => (row.unrealizedReturn ?? 0) > 0).length;
  const positiveBreadth = holdings.length ? positiveCount / holdings.length : null;
  const score = [
    (return90d ?? 0) > 0,
    (return120d ?? 0) > 0,
    (positiveBreadth ?? 0) >= 0.5,
    (currentDrawdown ?? -1) > -0.1,
    (persona?.moneyWeightedReturn ?? persona?.irr ?? 0) > 0,
  ].filter(Boolean).length;
  if (score >= 4) return { mode: 'Risk-on', tone: 'good' as const, caption: '추세 유지 · 보유 우선', return90d, return120d, currentDrawdown, positiveBreadth, positiveCount };
  if (score >= 2) return { mode: 'Neutral', tone: 'warn' as const, caption: '선별 보유 · 신규 진입 보수적', return90d, return120d, currentDrawdown, positiveBreadth, positiveCount };
  return { mode: 'Defense', tone: 'bad' as const, caption: '현금/손절 규칙 우선 점검', return90d, return120d, currentDrawdown, positiveBreadth, positiveCount };
}

function windowReturn(series: number[], days: number): number | null {
  if (series.length < 2) return null;
  const last = series.at(-1);
  const past = series.at(Math.max(0, series.length - 1 - days));
  if (last === undefined || past === undefined) return null;
  return (1 + last) / Math.max(0.0001, 1 + past) - 1;
}

function strategyVerdict(personas: SummaryRow[]) {
  const v2 = personas.find((row) => row.persona === 'smic_follower_v2');
  const v1 = personas.find((row) => row.persona === 'smic_follower');
  const aw = personas.find((row) => row.persona === 'all_weather');
  const v2Return = v2?.moneyWeightedReturn ?? v2?.irr ?? null;
  const awReturn = aw?.moneyWeightedReturn ?? aw?.irr ?? null;
  const v1Return = v1?.moneyWeightedReturn ?? v1?.irr ?? null;
  const beatsAw = v2Return !== null && awReturn !== null && v2Return > awReturn;
  const beatsV1 = v2Return !== null && v1Return !== null && v2Return > v1Return;
  if (beatsAw && beatsV1) {
    return {
      tone: 'good' as const,
      headline: '검증 신호',
      summary: 'v2가 기준선과 v1을 모두 상회합니다.',
      detail: `v2 MWR ${formatPercent(v2Return)}는 all-weather ${formatPercent(awReturn)}와 v1 ${formatPercent(v1Return)}를 동시에 상회합니다.`,
    };
  }
  if (beatsAw) {
    return {
      tone: 'warn' as const,
      headline: '부분 신호',
      summary: 'v2는 기준선보다 낫지만 v1 대비 추가 검증이 필요합니다.',
      detail: `v2 MWR ${formatPercent(v2Return)}가 all-weather ${formatPercent(awReturn)}를 상회하지만 v1 대비 우위는 아직 충분하지 않습니다.`,
    };
  }
  return {
    tone: 'bad' as const,
    headline: '재검토 필요',
    summary: '기준선 대비 통계적 우위가 확보되지 않았습니다.',
    detail: `v2 MWR ${formatPercent(v2Return)}가 all-weather ${formatPercent(awReturn)}를 안정적으로 상회한다고 보기 어렵습니다. 리포트 선택 기준과 청산 규칙을 다시 점검해야 합니다.`,
  };
}
