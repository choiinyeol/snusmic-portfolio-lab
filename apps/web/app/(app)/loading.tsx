export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-5 p-1">
      <div className="grid gap-3 border-b border-slate-200 pb-6">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
        <div className="h-8 w-72 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-2/3 max-w-2xl animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {['kpi-a', 'kpi-b', 'kpi-c', 'kpi-d', 'kpi-e'].map((slot) => (
          <div className="h-20 animate-pulse rounded border border-slate-200 bg-white" key={slot} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,.7fr)]">
        <div className="h-72 animate-pulse rounded border border-slate-200 bg-white" />
        <div className="h-72 animate-pulse rounded border border-slate-200 bg-white" />
      </div>
      <span className="sr-only">데이터 불러오는 중</span>
    </div>
  );
}
