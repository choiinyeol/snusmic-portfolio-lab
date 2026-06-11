import { ExternalLink } from "lucide-react";
import type { ReportRecord } from "@/lib/report-model";
import { ReportViewer } from "@/components/report-viewer";
import { cn } from "@/lib/utils";

/**
 * 원문 링크 — 각주처럼 작게. 전사 MD(GitHub blob)와 학회 사이트의 원문 게시글로 이어진다.
 * 파싱이 의심스러운 기록을 원문으로 추적하는 통로라, 모든 리포트 화면에 같은 모양으로 박힌다.
 * "본문 읽기" 버튼을 앞에 두어 사이트 내 인라인 뷰어를 먼저 권장한다.
 */
export function SourceLinks({ report, className }: { report: ReportRecord; className?: string }) {
  if (!report.source_md_url && !report.source_pdf_url) return null;
  return (
    <span className={cn("inline-flex items-center gap-2.5 whitespace-nowrap font-mono text-[10px] tracking-normal", className)}>
      {report.source_md_url && <ReportViewer report={report} />}
      <span className="text-muted-foreground/70">원문</span>
      {report.source_md_url && <SourceAnchor href={report.source_md_url} label="MD" title="전사 마크다운 원문 보기 (GitHub)" />}
      {report.source_pdf_url && <SourceAnchor href={report.source_pdf_url} label="게시글" title="학회 사이트의 원문 게시글 열기" />}
    </span>
  );
}

function SourceAnchor({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      title={title}
      className="inline-flex items-center gap-0.5 font-semibold text-muted-foreground underline decoration-dotted decoration-border underline-offset-[3px] transition hover:text-stamp hover:decoration-stamp/60"
    >
      {label}
      <ExternalLink className="h-2.5 w-2.5 opacity-70" aria-hidden="true" />
    </a>
  );
}
