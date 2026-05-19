import type * as React from 'react';
import { cn } from '@/lib/utils';

export function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'min-h-10 min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-normal text-slate-950 outline-none transition-colors focus:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-300',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function NativeSelectOption(props: React.ComponentProps<'option'>) {
  return <option {...props} />;
}

export function NativeSelectOptGroup(props: React.ComponentProps<'optgroup'>) {
  return <optgroup {...props} />;
}
