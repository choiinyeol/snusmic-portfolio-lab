import type { ReportRow } from '@/lib/artifacts';
import type { KoreanInvestmentMemo } from '@/lib/report-view-model';

type Props = {
  siblingReports: ReportRow[];
  memo: KoreanInvestmentMemo;
  snippet: string;
  markdownHref: string;
  pdfHref: string | null;
};

export function ReportSourcesPanel({ siblingReports, memo, snippet, markdownHref, pdfHref }: Props) {
  return (
    <>
      <div className="grid two-col">
        <article className="dossier-card">
          <span className="dossier-card__label">투자 메모</span>
          <p>{memo.summary}</p>
          <ul>
            {memo.bullets.map((item) => (
              <li key={item.label}><strong>{item.label}.</strong> {item.text}</li>
            ))}
          </ul>
        </article>

        <article className="dossier-card">
          <span className="dossier-card__label">추출 마크다운</span>
          <div className="markdown-snippet">{snippet}</div>
        </article>
      </div>

      <div className="grid two-col source-history-grid">
        <article className="dossier-card">
          <span className="dossier-card__label">동일 티커 발간 이력</span>
          {siblingReports.length ? (
            <ul>
              {siblingReports.map((item) => (
                <li key={item.reportId}>
                  <span className="muted source-date">{item.publicationDate}</span> · {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">해당 티커의 다른 SMIC 리포트는 아카이브에 없습니다.</p>
          )}
        </article>

        <article className="dossier-card">
          <span className="dossier-card__label">원본 자료</span>
          <ul>
            <li><a href={markdownHref}>GitHub Markdown</a></li>
            {pdfHref ? <li><a href={pdfHref}>GitHub PDF</a></li> : null}
          </ul>
        </article>
      </div>
    </>
  );
}
