"use client";

/**
 * Lazily-loaded markdown renderer — split from report-viewer.tsx so that
 * react-markdown + remark-gfm are NOT included in the initial bundle.
 * Only imported when the user first opens a report viewer.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      // No rehype-raw — no raw HTML rendering (sanitized by default in react-markdown v8+)
      components={{
        // ── Headings — serif, editorial weight ──────────────────────────────
        h1: ({ children }) => (
          <h1 className="mb-4 mt-8 font-display text-2xl font-black leading-tight tracking-tight first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-7 font-display text-xl font-black leading-tight tracking-tight first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-5 font-display text-base font-bold leading-snug first:mt-0">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="mb-2 mt-4 text-sm font-bold first:mt-0">{children}</h4>
        ),

        // ── Body text ────────────────────────────────────────────────────────
        p: ({ children }) => (
          <p className="mb-3 text-sm leading-7 text-foreground/90">{children}</p>
        ),

        // ── Lists ────────────────────────────────────────────────────────────
        ul: ({ children }) => (
          <ul className="mb-3 ml-5 list-disc space-y-1 text-sm leading-7 text-foreground/90">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 ml-5 list-decimal space-y-1 text-sm leading-7 text-foreground/90">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-7">{children}</li>,

        // ── Inline ───────────────────────────────────────────────────────────
        strong: ({ children }) => (
          <strong className="font-bold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className: langClass }) => {
          // Inline code
          if (!langClass) {
            return (
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          }
          return <code className={cn("font-mono text-xs", langClass)}>{children}</code>;
        },
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-md border border-border bg-secondary p-4 font-mono text-xs leading-6">
            {children}
          </pre>
        ),

        // ── Block elements ───────────────────────────────────────────────────
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-[3px] border-stamp/60 pl-4 italic text-muted-foreground">
            {children}
          </blockquote>
        ),
        hr: () => (
          <hr className="my-6 border-0 border-t-2 border-dashed border-border" />
        ),

        // ── Links ────────────────────────────────────────────────────────────
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stamp underline decoration-stamp/40 decoration-dotted underline-offset-[3px] transition hover:decoration-stamp"
          >
            {children}
          </a>
        ),

        // ── GFM Tables — mono, compact, ink aesthetic ────────────────────────
        table: ({ children }) => (
          <div className="mb-6 overflow-x-auto">
            <table className="w-full border-collapse font-mono text-xs">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b-2 border-foreground/70">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody className="divide-y divide-dashed divide-border">{children}</tbody>
        ),
        tr: ({ children }) => <tr className="hover:bg-secondary/40">{children}</tr>,
        th: ({ children }) => (
          <th className="px-2 py-1.5 text-left font-bold uppercase tracking-[0.08em] text-foreground/70">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="tnum px-2 py-1.5 text-foreground/85">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
