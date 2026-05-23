'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type SelectMenuOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

export function SelectMenu<T extends string>({
  ariaLabel,
  className,
  options,
  value,
  onValueChange,
}: {
  ariaLabel: string;
  className?: string;
  options: SelectMenuOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={cn('relative min-w-0', className)} ref={rootRef}>
      <button
        type="button"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="inline-flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-sm font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selected?.label ?? '선택'}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180 text-slate-600')}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-50 grid w-full min-w-[12rem] gap-0.5 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-200/70"
        >
          {options.map((option) => {
            const selectedOption = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selectedOption}
                className={cn(
                  'flex min-h-8 min-w-0 items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm transition-colors',
                  selectedOption
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950',
                )}
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="truncate text-xs font-normal text-slate-500">{option.description}</span>
                  ) : null}
                </span>
                {selectedOption ? <Check aria-hidden="true" className="size-3.5 shrink-0 text-slate-700" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
