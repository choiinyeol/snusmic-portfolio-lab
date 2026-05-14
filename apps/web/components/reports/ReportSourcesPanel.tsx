import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { ReportRow } from '@/lib/artifacts';
import { formatDateKo } from '@/lib/format';
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <SourcesBlock label="투자 메모">
        <p className="text-sm leading-6 text-slate-600">{memo.summary}</p>
        <div className="mt-3 grid gap-2">
          {memo.bullets.map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium text-slate-500">{item.label}</div>
              <p className="mt-1 text-sm leading-6 text-slate-700">{item.text}</p>
            </div>
          ))}
        </div>
      </SourcesBlock>

      <aside className="grid content-start gap-4">
        <SourcesBlock label="동일 티커 발간 이력">
          {siblingReports.length ? (
            <ul className="grid gap-2 text-sm leading-6 text-slate-700">
              {siblingReports.map((item) => (
                <li key={item.reportId} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                  <span className="font-mono text-xs text-slate-500">{formatDateKo(item.publicationDate)}</span>
                  <div className="line-clamp-2 font-medium text-slate-950">{item.title}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">해당 티커의 다른 SMIC 리포트는 없습니다.</p>
          )}
        </SourcesBlock>

        <SourcesBlock label="원본 자료">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={markdownHref}>Markdown</a>
            </Button>
            {pdfHref ? (
              <Button asChild size="sm" variant="outline">
                <a href={pdfHref}>PDF</a>
              </Button>
            ) : null}
          </div>
        </SourcesBlock>
      </aside>

      <SourcesBlock className="xl:col-span-2" label="추출 마크다운 미리보기">
        <div className="markdown-snippet rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-5 text-slate-700">
          {snippet}
        </div>
      </SourcesBlock>
    </div>
  );
}

function SourcesBlock({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <article className={`min-w-0 rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      {children}
    </article>
  );
}
