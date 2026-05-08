'use client';

import { useState, type ReactNode } from 'react';

export type Tab = { id: string; label: string; meta?: string; content: ReactNode };

export function Tabs({ tabs, defaultTabId }: { tabs: Tab[]; defaultTabId?: string }) {
  const initial = defaultTabId && tabs.some((t) => t.id === defaultTabId) ? defaultTabId : tabs[0]?.id;
  const [active, setActive] = useState<string | undefined>(initial);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="grid gap-4">
      <div className="tabs tabs-box w-fit max-w-full overflow-x-auto bg-base-200" role="tablist">
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
              className={`tab gap-2 ${tab.id === active ? 'tab-active font-bold' : ''}`}
              onClick={() => setActive(tab.id)}
            >
              {tab.label}
              {tab.meta ? <span className="badge badge-xs badge-ghost">{tab.meta}</span> : null}
            </button>
          );
        })}
      </div>
      <div
        id={activeTab ? `panel-${activeTab.id}` : undefined}
        role="tabpanel"
        aria-labelledby={activeTab ? `tab-${activeTab.id}` : undefined}
        className="tabs__panel"
      >
        {activeTab?.content}
      </div>
    </div>
  );
}
