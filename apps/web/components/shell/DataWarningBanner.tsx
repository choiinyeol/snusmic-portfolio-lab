import type { DataWarning } from '@/lib/view-models/shared';

const levelClasses: Record<DataWarning['level'], string> = {
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-red-200 bg-red-50 text-red-700',
};

export function DataWarningBanner({ warnings }: { warnings: DataWarning[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="grid gap-2" aria-label="데이터 상태 알림">
      {warnings.map((warning) => (
        <div
          className={`rounded-md border px-3 py-2 text-sm leading-6 ${levelClasses[warning.level]}`}
          key={warning.id}
        >
          {warning.message}
        </div>
      ))}
    </div>
  );
}
