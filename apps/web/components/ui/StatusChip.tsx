import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'neutral';

const toneClasses: Record<Tone, string> = {
  info: 'border-blue-100 bg-blue-50 text-blue-600',
  success: 'border-emerald-100 bg-emerald-50 text-emerald-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-600',
  neutral: 'border-slate-200 bg-white text-slate-500',
};

export function StatusChip({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold leading-normal ${toneClasses[tone]} ${className}`}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_16%,transparent)]" />
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
