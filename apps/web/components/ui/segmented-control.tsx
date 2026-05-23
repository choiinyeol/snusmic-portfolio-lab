'use client';

import { cn } from '@/lib/utils';

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  size = 'sm',
  className,
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      className={cn(
        'relative inline-grid min-w-max rounded-full bg-slate-100 p-1 shadow-inner ring-1 ring-slate-200/80',
        className,
      )}
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      <span
        aria-hidden="true"
        className="absolute bottom-1 top-1 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out"
        style={{
          left: '0.25rem',
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cn(
              'relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors',
              size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-4 text-sm',
              selected ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800',
            )}
            onClick={() => onValueChange(option.value)}
          >
            <span>{option.label}</span>
            {option.count !== undefined ? (
              <span
                className={cn('font-mono text-[10px] tabular-nums', selected ? 'text-slate-500' : 'text-slate-400')}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
