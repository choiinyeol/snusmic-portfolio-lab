'use client';

import { useEffect } from 'react';

export type SortDirection = 'asc' | 'desc';
export type SortState<Key extends string> = { key: Key; direction: SortDirection };

export const DEFAULT_ACCOUNT = 'smic_follower_v2';

export function defaultAccountFor(accounts: string[]): string {
  return accounts.includes(DEFAULT_ACCOUNT) ? DEFAULT_ACCOUNT : (accounts[0] ?? '');
}

export function SortHeader<Key extends string>({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: Key;
  sort: SortState<Key>;
  onSort: (key: Key) => void;
}) {
  const active = sort.key === sortKey;
  const indicator = active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕';
  return (
    <button
      type="button"
      className="sort-button"
      onClick={() => onSort(sortKey)}
      aria-label={`${label} 정렬 ${active ? sort.direction : 'none'}`}
    >
      {label}
      <span aria-hidden="true"> {indicator}</span>
    </button>
  );
}

export function PaginationControls({
  page,
  pageCount,
  totalRows,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: {
  page: number;
  pageCount: number;
  totalRows: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
}) {
  const lastPage = Math.max(0, pageCount - 1);
  const safePage = Math.min(Math.max(0, page), lastPage);
  return (
    <nav className="pagination-bar" aria-label="페이지 이동">
      <span className="justify-self-start text-xs">
        총 {totalRows.toLocaleString('ko-KR')}행 · {pageCount ? safePage + 1 : 0}/{Math.max(1, pageCount)}쪽
      </span>
      <BlockPagination page={safePage} pageCount={Math.max(1, pageCount)} onPageChange={onPageChange} />
      <label className="page-size-label justify-self-end">
        <span>페이지당</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}

/** Numbered pagination with a sliding window of page numbers (block
 * pagination). Renders «« «  1 2 3 4 5  » »» with the visible block
 * shifting as the active page leaves the window. */
export function BlockPagination({
  page,
  pageCount,
  onPageChange,
  windowSize = 5,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  windowSize?: number;
}) {
  const lastPage = Math.max(0, pageCount - 1);
  const safePage = Math.min(Math.max(0, page), lastPage);
  const blockIndex = Math.floor(safePage / windowSize);
  const blockStart = blockIndex * windowSize;
  const blockEnd = Math.min(lastPage, blockStart + windowSize - 1);
  const hasPrevBlock = blockStart > 0;
  const hasNextBlock = blockEnd < lastPage;
  const pages: number[] = [];
  for (let i = blockStart; i <= blockEnd; i += 1) pages.push(i);
  return (
    <span className="block-pagination" role="group" aria-label="페이지 번호">
      <button
        type="button"
        aria-label="이전 페이지 묶음"
        onClick={() => onPageChange(Math.max(0, blockStart - windowSize))}
        disabled={!hasPrevBlock}
      >
        ‹‹
      </button>
      <button
        type="button"
        aria-label="이전 페이지"
        onClick={() => onPageChange(Math.max(0, safePage - 1))}
        disabled={safePage === 0}
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === safePage ? 'page' : undefined}
          className={p === safePage ? 'active' : undefined}
          onClick={() => onPageChange(p)}
        >
          {p + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="다음 페이지"
        onClick={() => onPageChange(Math.min(lastPage, safePage + 1))}
        disabled={safePage >= lastPage}
      >
        ›
      </button>
      <button
        type="button"
        aria-label="다음 페이지 묶음"
        onClick={() => onPageChange(Math.min(lastPage, blockStart + windowSize))}
        disabled={!hasNextBlock}
      >
        ››
      </button>
    </span>
  );
}

export function useUrlBackedAccount(account_id: string, setAccount: (value: string) => void, validAccounts: string[]) {
  useEffect(() => {
    if (validAccounts.length === 0) return;
    const query = new URLSearchParams(window.location.search);
    const requested = query.get('account');
    if (requested && validAccounts.includes(requested)) {
      if (requested !== account_id) setAccount(requested);
      return;
    }
    if (!validAccounts.includes(account_id)) {
      const firstAvailable = defaultAccountFor(validAccounts);
      if (firstAvailable && firstAvailable !== account_id) setAccount(firstAvailable);
    }
  }, [account_id, setAccount, validAccounts]);

  useEffect(() => {
    if (!account_id || !validAccounts.includes(account_id)) return;
    const url = new URL(window.location.href);
    const requested = url.searchParams.get('account');
    if (requested && validAccounts.includes(requested) && requested !== account_id) return;
    url.searchParams.set('account', account_id);
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.replaceState(null, '', nextUrl);
  }, [account_id, validAccounts]);
}

export function sortRows<T, Key extends string>(
  rows: T[],
  sort: SortState<Key>,
  read: Record<Key, (row: T) => string | number | null | undefined>,
): T[] {
  const getValue = read[sort.key];
  return [...rows].sort((a, b) => compare(getValue(a), getValue(b), sort.direction));
}

export function compare(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: SortDirection,
): number {
  const modifier = direction === 'asc' ? 1 : -1;
  if (a === null || a === undefined || a === '') return 1;
  if (b === null || b === undefined || b === '') return -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * modifier;
  return String(a).localeCompare(String(b), 'ko-KR', { numeric: true }) * modifier;
}

export function pageRows<T>(rows: T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(0, page);
  return rows.slice(safePage * pageSize, safePage * pageSize + pageSize);
}
