import type { ReactNode } from 'react';
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
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SourcesCard label="투자 메모">
          <p className="text-sm leading-relaxed text-base-content/75">{memo.summary}</p>
          <ul className="grid gap-1.5 text-sm leading-relaxed text-base-content/75 marker:text-base-content/40 ml-4 list-disc">
            {memo.bullets.map((item) => (
              <li key={item.label}>
                <strong className="text-base-content">{item.label}.</strong> {item.text}
              </li>
            ))}
          </ul>
        </SourcesCard>

        <SourcesCard label="추출 마크다운">
          <div className="markdown-snippet">{snippet}</div>
        </SourcesCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SourcesCard label="동일 티커 발간 이력">
          {siblingReports.length ? (
            <ul className="grid gap-1.5 text-sm leading-relaxed text-base-content/75 ml-4 list-disc">
              {siblingReports.map((item) => (
                <li key={item.reportId}>
                  <span className="font-mono text-xs text-base-content/55">{item.publicationDate}</span> · {item.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-base-content/55">해당 티커의 다른 SMIC 리포트는 아카이브에 없습니다.</p>
          )}
        </SourcesCard>

        <SourcesCard label="원본 자료">
          <ul className="grid gap-1.5 text-sm">
            <li>
              <a className="link link-primary" href={markdownHref}>
                GitHub Markdown
              </a>
            </li>
            {pdfHref ? (
              <li>
                <a className="link link-primary" href={pdfHref}>
                  GitHub PDF
                </a>
              </li>
            ) : null}
          </ul>
        </SourcesCard>
      </div>
    </div>
  );
}

function SourcesCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <article className="card border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-5">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/55">{label}</span>
        {children}
      </div>
    </article>
  );
}
