'use client';

import { Download, SearchX } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { BlockPagination } from '@/components/trading/TableControls';

/** Shared dense-table chrome: header (title + actions + optional search),
 * scrollable body with sticky `<thead>` (via global CSS), and a centered
 * pagination footer. Every dense table on the site should consume this
 * panel so the layout is consistent and affordances (sort/page/CSV/search)
 * stay aligned. See `docs/portfolio-restructure-plan.md`. */
export type DataPanelProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    ariaLabel?: string;
    inputRef?: Ref<HTMLInputElement>;
  };
  toolbar?: ReactNode;
  pagination?: {
    page: number;
    pageCount: number;
    totalRows: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: readonly number[];
  };
  children: ReactNode;
};

export function DataPanel({ title, subtitle, actions, search, toolbar, pagination, children }: DataPanelProps) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <header className="grid gap-2 border-b border-slate-200 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {search ? (
            <input
              ref={search.inputRef}
              type="search"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              placeholder={search.placeholder ?? '검색'}
              aria-label={search.ariaLabel ?? '검색'}
              className="min-h-9 w-44 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-normal text-slate-700 outline-none transition-colors focus:border-slate-500"
            />
          ) : null}
          {actions}
        </div>
      </header>
      {toolbar ? <div className="border-b border-slate-200 bg-white px-4 py-3">{toolbar}</div> : null}
      <div className="max-h-[72vh] overflow-auto">{children}</div>
      {pagination ? (
        <footer className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-[11px] text-slate-500">
          <span className="justify-self-start leading-normal">
            총 {pagination.totalRows.toLocaleString('ko-KR')}행 ·{' '}
            {pagination.pageCount ? Math.min(pagination.page, pagination.pageCount - 1) + 1 : 0}/
            {Math.max(1, pagination.pageCount)}쪽
          </span>
          <BlockPagination
            page={pagination.page}
            pageCount={Math.max(1, pagination.pageCount)}
            onPageChange={pagination.onPageChange}
          />
          {pagination.onPageSizeChange && pagination.pageSize !== undefined ? (
            <label className="inline-flex items-center justify-self-end gap-1.5">
              <span>페이지당</span>
              <select
                value={pagination.pageSize}
                onChange={(event) => pagination.onPageSizeChange?.(Number(event.target.value))}
                className="min-h-8 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs leading-normal"
              >
                {(pagination.pageSizeOptions ?? [10, 25, 50, 100]).map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span aria-hidden="true" />
          )}
        </footer>
      ) : null}
    </section>
  );
}

export function CsvDownloadButton({
  onClick,
  label = 'CSV',
  disabled,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-normal text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );
}

/** Standardized empty-state cell for a `<DataPanel>` table body. Pass
 * inside a `<tr>` spanning the full column count. */
export function EmptyTableState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-md gap-3 px-6 py-10 text-center">
      <SearchX aria-hidden="true" className="mx-auto size-6 text-slate-400" />
      <div className="text-sm font-semibold text-slate-950">{message}</div>
      {actionLabel && onAction ? (
        <div>
          <button
            type="button"
            onClick={onAction}
            className="inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold leading-normal text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            {actionLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Build a UTF-8 BOM-prefixed CSV blob and download it client-side.
 * Centralized so every table downloads CSVs with the same escape rules
 * and the BOM that lets Excel render Korean characters correctly. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
) {
  const csv = [headers.join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
