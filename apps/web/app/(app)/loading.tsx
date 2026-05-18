export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-7">
      <div className="grid gap-3 border-b border-slate-200 pb-6">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        <div className="h-8 w-72 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-2/3 max-w-2xl animate-pulse rounded bg-slate-100" />
      </div>
      <section className="border-y border-slate-200 bg-white" aria-hidden="true">
        <div className="grid divide-y divide-slate-100 md:grid-cols-5 md:divide-x md:divide-y-0">
          {['kpi-a', 'kpi-b', 'kpi-c', 'kpi-d', 'kpi-e'].map((slot) => (
            <div className="grid gap-2 p-4" key={slot}>
              <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(360px,.72fr)]">
        <div className="h-72 animate-pulse rounded border border-slate-200 bg-white" />
        <div className="h-72 animate-pulse rounded border border-slate-200 bg-white" />
      </div>
      <span className="sr-only">데이터 불러오는 중</span>
    </div>
  );
}
