'use client';

import { useState, type ReactNode } from 'react';

export type Tab = { id: string; label: string; meta?: string; content: ReactNode };

export function Tabs({ tabs, defaultTabId }: { tabs: Tab[]; defaultTabId?: string }) {
  const initial = defaultTabId && tabs.some((t) => t.id === defaultTabId) ? defaultTabId : tabs[0]?.id;
  const [active, setActive] = useState<string | undefined>(initial);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="grid min-w-0 gap-4">
      <div
        className="inline-flex w-full max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-1"
        role="tablist"
      >
        {tabs.map((tab) => {
          const tabId = `tab-${tab.id}`;
          const panelId = `panel-${tab.id}`;
          return (
            <button
              key={tab.id}
              id={tabId}
              role="tab"
              type="button"
              aria-selected={tab.id === active}
              aria-controls={panelId}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium leading-normal transition ${tab.id === active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'}`}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
              {tab.meta ? (
                <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                  {tab.meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        id={activeTab ? `panel-${activeTab.id}` : undefined}
        role="tabpanel"
        aria-labelledby={activeTab ? `tab-${activeTab.id}` : undefined}
        className="grid min-w-0 gap-4"
      >
        {activeTab?.content}
      </div>
    </div>
  );
}
