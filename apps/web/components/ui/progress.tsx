import type * as React from 'react';
import { cn } from '@/lib/utils';

function Progress({ value = 0, className, ...props }: React.ComponentProps<'div'> & { value?: number | null }) {
  const width = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}
      data-slot="progress"
      {...props}
    >
      <div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${width}%` }} />
    </div>
  );
}

export { Progress };
