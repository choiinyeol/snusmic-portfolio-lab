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
    <header className="page-header">
      <div className="report-hero-compact">
        <div>
          <div className="page-header__eyebrow">Report dossier</div>
          <h1 className="page-header__title">{report.company}</h1>
          <p className="page-header__lede report-hero-compact__lede">
            {report.title || `${report.company} 리포트`} · 발간가 {formatAssetPrice(reportEntryPrice(report), report)} → 목표가 {formatAssetPrice(report.targetPriceNative, report)}
            <strong> {formatPercent(report.targetUpsideAtPub)} {targetMoveLabel(report)}</strong>
          </p>
        </div>
        <div className="report-hero-compact__actions">
          <Link className="terminal-link" href="/reports">← 아카이브</Link>
          {report.pdfUrl ? <a className="terminal-link" href={report.pdfUrl}>원본 PDF</a> : null}
          <a className="terminal-link" href={markdownHref}>Markdown</a>
        </div>
      </div>
      <dl className="page-header__meta report-hero-chips">
        <span className="page-header__meta-item"><dt>티커</dt><dd>{report.symbol}</dd></span>
        {report.exchange ? <span className="page-header__meta-item"><dt>거래소</dt><dd>{report.exchange}</dd></span> : null}
        <span className="page-header__meta-item"><dt>통화</dt><dd>{report.currency}</dd></span>
        <span className="page-header__meta-item"><dt>발간일</dt><dd>{report.publicationDate}</dd></span>
        {report.lastCloseDate ? <span className="page-header__meta-item"><dt>최근 종가일</dt><dd>{report.lastCloseDate}</dd></span> : null}
        <span className="page-header__meta-item"><dt>상태</dt><dd>{status.label}</dd></span>
      </dl>
    </header>
  );
}
