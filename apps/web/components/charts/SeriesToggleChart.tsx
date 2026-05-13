'use client';

import { useMemo, useState } from 'react';
import { CumulativeReturnChart, type ReturnSeries } from '@/components/charts/CumulativeReturnChart';

export function SeriesToggleChart({ series }: { series: ReturnSeries[] }) {
  const available = useMemo(() => series.filter((item) => item.points.length), [series]);
  const [activeIds, setActiveIds] = useState<Set<string>>(() => new Set(available.map((item) => item.id)));
  const activeSeries = available.filter((item) => activeIds.has(item.id));

  function toggle(id: string) {
    setActiveIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        if (next.size === 1) return next;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function setAll() {
    setActiveIds(new Set(available.map((item) => item.id)));
  }

  function setPrimaryOnly() {
    setActiveIds(new Set(available.slice(0, 3).map((item) => item.id)));
  }

  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" aria-label="차트 표시 항목">
          {available.map((item) => {
            const active = activeIds.has(item.id);
            return (
              <button
                className={`snapshot-pill border transition ${active ? 'border-primary/30 bg-primary/10 text-primary' : 'opacity-55'}`}
                key={item.id}
                onClick={() => toggle(item.id)}
                title={item.label}
                type="button"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.shortLabel ?? item.label}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button className="snapshot-pill" onClick={setPrimaryOnly} type="button">
            핵심만
          </button>
          <button className="snapshot-pill" onClick={setAll} type="button">
            전체
          </button>
        </div>
      </div>
      <CumulativeReturnChart series={activeSeries} showLegend={false} />
    </div>
  );
}
