import type { DataWarning } from '@/lib/view-models/shared';

const noticeClass: Record<DataWarning['level'], string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
};

export function DataQualityNotice({ warnings }: { warnings: DataWarning[] }) {
  if (!warnings.length) return null;
  return (
    <section className="grid gap-2" aria-label="데이터 품질 알림">
      {warnings.map((warning) => (
        <p className={`rounded-md border px-3 py-2 text-xs leading-5 ${noticeClass[warning.level]}`} key={warning.id}>
          {warning.message}
        </p>
      ))}
    </section>
  );
}
