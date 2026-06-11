"use client";

/**
 * ReportViewer — 리포트 본문을 사이트 안에서 바로 읽는 모달/드로어.
 *
 * - source_md_url (GitHub blob URL) → raw.githubusercontent.com 으로 변환해 fetch
 * - react-markdown + remark-gfm: 테이블 포함 GFM 렌더
 * - 모듈 스코프 캐시: 같은 URL 재요청 없음
 * - 모바일: 전체화면 시트 / 데스크톱: 최대폭 prose 모달
 * - ESC / 배경 클릭으로 닫기, 포커스 트랩(최소)
 * - 마크다운 라이브러리는 처음 열릴 때 dynamic import → 번들 경량 유지
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, X, FileText, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportRecord } from "@/lib/report-model";

// ─── URL transform ─────────────────────────────────────────────────────────────

/**
 * GitHub blob URL → raw.githubusercontent.com URL
 *
 * blob:  https://github.com/{user}/{repo}/blob/{ref}/{path}
 * raw:   https://raw.githubusercontent.com/{user}/{repo}/{ref}/{path}
 */
export function blobToRaw(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return url;
    // pathname: /{user}/{repo}/blob/{ref}/{path...}
    const parts = u.pathname.split("/").filter(Boolean);
    const blobIdx = parts.indexOf("blob");
    if (blobIdx === -1) return url;
    const rawParts = [...parts.slice(0, blobIdx), ...parts.slice(blobIdx + 1)];
    return `https://raw.githubusercontent.com/${rawParts.join("/")}`;
  } catch {
    return url;
  }
}

// ─── Module-level fetch cache ──────────────────────────────────────────────────

const mdCache = new Map<string, string>();

async function fetchMarkdown(blobUrl: string): Promise<string> {
  if (mdCache.has(blobUrl)) return mdCache.get(blobUrl)!;
  const rawUrl = blobToRaw(blobUrl);
  const res = await fetch(rawUrl, { cache: "force-cache" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  mdCache.set(blobUrl, text);
  return text;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type ViewerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; content: string }
  | { status: "error" };

type RendererType = React.ComponentType<{ content: string }>;

// ─── Inner viewer (hooks-safe — only rendered when blobUrl is present) ─────────

function ReportViewerInner({
  blobUrl,
  report,
  label,
  className,
}: {
  blobUrl: string;
  report: ReportRecord;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ViewerState>({ status: "idle" });
  // Stored as { Renderer } so setState(fn) does not confuse React with a function value
  const [renderer, setRenderer] = useState<{ Renderer: RendererType } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const openViewer = useCallback(async () => {
    setOpen(true);

    // Parallel: dynamic import of renderer + content fetch
    await Promise.all([
      renderer === null
        ? import("./report-viewer-renderer").then((m) => {
            setRenderer({ Renderer: m.MarkdownContent });
          })
        : Promise.resolve(),
      (async () => {
        // Already loaded — skip
        if (state.status === "ok" || state.status === "loading") return;
        setState({ status: "loading" });
        try {
          const text = await fetchMarkdown(blobUrl);
          setState({ status: "ok", content: text });
        } catch {
          setState({ status: "error" });
        }
      })(),
    ]);
  }, [renderer, blobUrl, state.status]);

  // ESC key closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Prevent background scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const displayName = report.display_name ?? report.company ?? report.source_name;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openViewer}
        title="마크다운으로 전사된 리포트 본문을 사이트 안에서 읽습니다"
        className={cn(
          "inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-normal text-muted-foreground transition hover:border-stamp hover:text-stamp",
          className,
        )}
      >
        <FileText className="h-2.5 w-2.5" aria-hidden="true" />
        {label}
      </button>

      {/* Modal overlay — rendered in-place; portal not needed for this layout */}
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          aria-modal="true"
          role="dialog"
          aria-label="리포트 본문"
          onClick={(e) => {
            if (e.target === overlayRef.current) close();
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" aria-hidden="true" />

          {/* Panel */}
          <div
            className={cn(
              "relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden bg-card",
              "border-t-4 border-foreground/80",
              "sm:max-h-[88dvh] sm:max-w-3xl sm:rounded-lg sm:border-2 sm:border-foreground/80",
              "shadow-[0_-4px_0_0_hsl(var(--foreground)/0.12)] sm:shadow-[7px_7px_0_0_hsl(var(--foreground)/0.85)]",
            )}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-dashed border-border px-5 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">리포트 원문</p>
                <p className="truncate text-sm font-bold">{displayName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noopener"
                  title="GitHub에서 원문 열기"
                  className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-muted-foreground transition hover:text-stamp"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  <span className="hidden sm:inline">GitHub</span>
                </a>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label="닫기"
                  className="rounded-sm p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Scrollable content area */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
              {state.status === "loading" && (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  <p className="font-mono text-[11px]">원문을 불러오는 중…</p>
                </div>
              )}

              {state.status === "error" && (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
                  <AlertTriangle className="h-6 w-6 text-warn" aria-hidden="true" />
                  <p className="text-sm font-semibold">원문을 불러오지 못했습니다</p>
                  <a
                    href={blobUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-xs font-semibold transition hover:border-stamp hover:text-stamp"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    GitHub에서 열기
                  </a>
                </div>
              )}

              {/* Skeleton while renderer module is still loading */}
              {state.status === "ok" && renderer === null && (
                <div className="animate-pulse space-y-3">
                  {[100, 82, 91, 65, 78, 88, 55].map((w, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                    <div key={i} className="h-3 rounded bg-secondary" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}

              {state.status === "ok" && renderer !== null && (
                <renderer.Renderer content={state.content} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Public export — guards null blobUrl before mounting inner ─────────────────

interface ReportViewerProps {
  report: ReportRecord;
  /** Trigger button label */
  label?: string;
  className?: string;
}

/**
 * Renders a "본문 읽기" button that opens an inline modal with the report's
 * transcribed markdown content. Returns null when the record has no source_md_url.
 */
export function ReportViewer({ report, label = "본문 읽기", className }: ReportViewerProps) {
  if (!report.source_md_url) return null;
  return (
    <ReportViewerInner
      blobUrl={report.source_md_url}
      report={report}
      label={label}
      className={className}
    />
  );
}
