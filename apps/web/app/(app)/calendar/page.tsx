import { ResearchCalendarScreen } from '@/components/research-calendar/ResearchCalendarScreen';
import { getResearchCalendarViewModel } from '@/lib/view-models/research-calendar';

export default function CalendarPage() {
  const model = getResearchCalendarViewModel();

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem] xl:items-start">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {model.header.meta}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{model.header.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{model.header.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(model.header.badges ?? []).map((badge) => (
                <span
                  key={`${badge.label}-${badge.value}`}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600"
                >
                  {badge.label} {badge.value}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {model.metrics.map((metric) => (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5" key={metric.id}>
                <div className="text-[11px] text-slate-500">{metric.label}</div>
                <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-950">{metric.value}</div>
                {metric.helper ? <div className="mt-1 text-[11px] text-slate-500">{metric.helper}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </section>
      <ResearchCalendarScreen model={model} />
    </div>
  );
}
