import Link from 'next/link';
import { Money } from '@/components/ui/Money';
import { PageHero } from '@/components/ui/PageHero';
import { Section } from '@/components/ui/Section';
import {
  getCurrentHoldings,
  getLatestReportTargetsBySymbol,
  getPersonaLabel,
  getReportRows,
  type ReportRow,
} from '@/lib/artifacts';
import { formatDateKo, formatPercent } from '@/lib/format';

const PERSONA_PRIMARY = 'smic_follower_v2';

export default function DashboardPage() {
  const reports = getReportRows();
  const holdings = getCurrentHoldings()
    .filter((row) => row.persona === PERSONA_PRIMARY)
    .sort((a, b) => (b.marketValueKrw ?? 0) - (a.marketValueKrw ?? 0));
  const targets = getLatestReportTargetsBySymbol();
  const latestDate = reports.reduce(
    (latest, report) => (report.publicationDate > latest ? report.publicationDate : latest),
    '',
  );
  const newestReports = [...reports]
    .filter((report) => report.publicationDate)
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
    .slice(0, 12);

  return (
    <>
      <PageHero
        eyebrow="DASHBOARD"
        title="SMIC 리포트 검증"
        badges={[
          { label: '리포트', value: `${reports.length}건` },
          { label: '최신 발간', value: latestDate || '—' },
          { label: '보유', value: `${holdings.length}종목` },
          { label: '전략', value: getPersonaLabel(PERSONA_PRIMARY) },
        ]}
        actions={
          <>
            <Link className="btn btn-sm btn-primary" href="/reports">
              리포트
            </Link>
            <Link className="btn btn-sm btn-outline" href="/portfolio">
              포트폴리오
            </Link>
            <Link className="btn btn-sm btn-ghost" href="/strategies">
              전략
            </Link>
          </>
        }
      />

      <Section
        eyebrow="Latest"
        title="최근 리포트"
        actions={
          <Link className="btn btn-sm btn-outline" href="/reports">
            전체 보기 →
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {newestReports.map((report) => (
            <Link
              key={`${report.symbol}-${report.publicationDate}`}
              href={`/reports/${report.symbol}`}
              className="card border border-base-300 bg-base-100 shadow-sm transition hover:border-primary/40"
            >
              <div className="card-body grid gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/55">
                      {formatDateKo(report.publicationDate)}
                    </div>
                    <h3 className="mt-1 truncate text-base font-bold">{report.company || report.symbol}</h3>
                  </div>
                  {statusBadge(report)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="badge badge-ghost badge-sm">{report.symbol}</span>
                    {report.exchange ? <span className="badge badge-outline badge-sm">{report.exchange}</span> : null}
                  </div>
                  <strong
                    className={`tabular-nums text-sm ${(report.currentReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}
                  >
                    {formatPercent(report.currentReturn)}
                  </strong>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {holdings.length ? (
        <Section
          eyebrow="Positions"
          title={`현재 보유 (${getPersonaLabel(PERSONA_PRIMARY)})`}
          actions={
            <Link className="btn btn-sm btn-outline" href="/portfolio">
              전체 원장 →
            </Link>
          }
        >
          <div className="grid gap-2">
            {holdings.slice(0, 6).map((row) => {
              const target = targets[row.symbol];
              const gap =
                target?.targetPriceKrw && row.lastCloseKrw && row.lastCloseKrw > 0
                  ? target.targetPriceKrw / row.lastCloseKrw - 1
                  : null;
              const nativeMarketValue =
                row.lastCloseNative !== null && row.qty !== null ? row.lastCloseNative * row.qty : null;
              return (
                <Link
                  key={row.symbol}
                  href={`/reports/${row.symbol}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-4 py-2.5 transition hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <strong className="truncate text-base">{row.company || row.symbol}</strong>
                    <div className="mt-0.5 flex gap-1.5">
                      <span className="badge badge-ghost badge-sm">{row.symbol}</span>
                      <span className="badge badge-outline badge-sm">{row.currency || 'KRW'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Money native={nativeMarketValue} krw={row.marketValueKrw} currency={row.currency} />
                  </div>
                  <div className="text-right">
                    <strong
                      className={`tabular-nums ${(row.unrealizedReturn ?? 0) >= 0 ? 'text-success' : 'text-error'}`}
                    >
                      {formatPercent(row.unrealizedReturn)}
                    </strong>
                    {gap !== null ? (
                      <div className="text-xs text-base-content/55">목표까지 {formatPercent(gap)}</div>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      ) : null}
    </>
  );
}

function statusBadge(report: ReportRow) {
  if (report.targetDirection === 'downside') {
    if (report.targetHit) return <span className="badge badge-success badge-soft badge-sm">매도 적중</span>;
    if (report.expired) return <span className="badge badge-error badge-soft badge-sm">매도 만료</span>;
    return <span className="badge badge-warning badge-soft badge-sm">매도 의견</span>;
  }
  if ((report.targetUpsideAtPub ?? 0) <= 0) {
    return <span className="badge badge-warning badge-soft badge-sm">비실행</span>;
  }
  if (report.targetHit) {
    return <span className="badge badge-success badge-soft badge-sm">도달</span>;
  }
  if (report.expired) {
    return <span className="badge badge-error badge-soft badge-sm">만료</span>;
  }
  return <span className="badge badge-primary badge-soft badge-sm">진행</span>;
}
