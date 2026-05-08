import Link from 'next/link';
import type { ReportRow } from '@/lib/artifacts';
import { formatPercent } from '@/lib/format';
import { formatAssetPrice, reportEntryPrice, targetMoveLabel, type TargetStatus } from '@/lib/report-view-model';

type Props = {
  report: ReportRow;
  status: TargetStatus;
  markdownHref: string;
};

export function ReportHero({ report, status, markdownHref }: Props) {
  return (
    <header className="page-header card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-5 p-5 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-primary badge-soft tracking-[0.16em]">REPORT DOSSIER</span>
              <span className={`badge badge-soft ${status.tone === 'good' ? 'badge-success' : status.tone === 'bad' ? 'badge-error' : status.tone === 'warn' ? 'badge-warning' : 'badge-primary'}`}>{status.label}</span>
            </div>
            <h1 className="page-header__title text-4xl font-black tracking-[-0.055em] text-base-content md:text-6xl">{report.company}</h1>
            <p className="page-header__lede report-hero-compact__lede max-w-4xl text-lg leading-8 text-base-content/70">
              {report.title || `${report.company} 리포트`} · 발간가 {formatAssetPrice(reportEntryPrice(report), report)} → 목표가 {formatAssetPrice(report.targetPriceNative, report)}
              <strong className="text-primary"> {formatPercent(report.targetUpsideAtPub)} {targetMoveLabel(report)}</strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-sm btn-outline" href="/reports">아카이브</Link>
            {report.pdfUrl ? <a className="btn btn-sm btn-outline" href={report.pdfUrl}>원본 PDF</a> : null}
            <a className="btn btn-sm btn-ghost" href={markdownHref}>Markdown</a>
          </div>
        </div>
        <dl className="flex flex-wrap gap-2">
          <Meta label="티커" value={report.symbol} />
          {report.exchange ? <Meta label="거래소" value={report.exchange} /> : null}
          <Meta label="통화" value={report.currency} />
          <Meta label="발간일" value={report.publicationDate} />
          {report.lastCloseDate ? <Meta label="최근 종가일" value={report.lastCloseDate} /> : null}
          <Meta label="상태" value={status.detail} />
        </dl>
      </div>
    </header>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="badge badge-outline gap-1 py-3 text-sm">
      <span className="text-base-content/45">{label}</span>
      <strong className="text-base-content">{value}</strong>
    </span>
  );
}
