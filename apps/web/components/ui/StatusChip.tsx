import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'neutral';

const toneClasses: Record<Tone, string> = {
  info: 'border-primary/15 bg-primary/10 text-primary',
  success: 'border-success/15 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  neutral: 'border-base-300 bg-base-100 text-base-content/65',
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
      className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold leading-none ${toneClasses[tone]} ${className}`}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_16%,transparent)]" />
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
