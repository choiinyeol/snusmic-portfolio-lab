'use client';

import { ArrowRight, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { APP_NAV } from '@/components/ui/app-shell-nav';
import type { SidebarNavItem } from '@/components/ui/SidebarNav';

/** Lightweight global command palette wired to ⌘K / Ctrl+K. Filters APP_NAV
 * client-side and dispatches Next.js router navigation on Enter. Built on raw
 * elements so the static export bundle stays free of cmdk / Radix Dialog. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIdx(0);
      return;
    }
    const handle = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(handle);
  }, [open]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return APP_NAV;
    return APP_NAV.filter((item) =>
      [item.label, item.description, item.href].filter(Boolean).join(' ').toLowerCase().includes(needle),
    );
  }, [query]);

  // Reset activeIdx when the filtered list shrinks past the current index.
  useEffect(() => {
    setActiveIdx((idx) => (items.length ? Math.min(idx, items.length - 1) : 0));
  }, [items.length]);

  const onListKey = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIdx((idx) => (items.length ? (idx + 1) % items.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIdx((idx) => (items.length ? (idx - 1 + items.length) % items.length : 0));
    } else if (event.key === 'Enter') {
      const item = items[activeIdx];
      if (item) {
        event.preventDefault();
        navigate(item);
      }
    }
  };

  const navigate = (item: SidebarNavItem) => {
    setOpen(false);
    if (item.href.startsWith('/')) {
      router.push(item.href);
    } else if (typeof window !== 'undefined') {
      window.open(item.href, '_blank', 'noopener,noreferrer');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start bg-slate-950/40 px-4 py-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${listId}-label`}
    >
      <button
        type="button"
        aria-label="명령 팔레트 닫기"
        className="absolute inset-0 cursor-default"
        onClick={() => setOpen(false)}
      />
      <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
          <Search aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onListKey}
            placeholder="페이지 검색 (메인, 포트폴리오, 스크리너…)"
            className="h-9 w-full border-0 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
            aria-controls={listId}
            aria-activedescendant={items[activeIdx] ? `${listId}-${activeIdx}` : undefined}
          />
          <kbd className="hidden rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline">
            ESC
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1" id={listId} aria-label="결과 목록" role="listbox">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-500">일치하는 페이지가 없습니다.</div>
          ) : (
            items.map((item, idx) => (
              <button
                type="button"
                key={item.href}
                id={`${listId}-${idx}`}
                role="option"
                aria-selected={idx === activeIdx}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  idx === activeIdx ? 'bg-slate-100 text-slate-950' : 'text-slate-700 hover:bg-slate-50'
                }`}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => navigate(item)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.label}</span>
                  {item.description ? (
                    <span className="block truncate text-xs text-slate-500">{item.description}</span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                  <span className="hidden font-mono sm:inline">{item.href}</span>
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
          <span className="font-mono" id={`${listId}-label`}>
            명령 팔레트
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">↑</kbd>
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">↓</kbd>
            이동
            <kbd className="ml-1 rounded border border-slate-300 bg-white px-1 font-mono">Enter</kbd>
            열기
          </span>
        </div>
      </div>
    </div>
  );
}
