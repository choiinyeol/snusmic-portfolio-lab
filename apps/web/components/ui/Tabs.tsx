'use client';

import { useState, type ReactNode } from 'react';

export type Tab = { id: string; label: string; meta?: string; content: ReactNode };

export function Tabs({ tabs, defaultTabId }: { tabs: Tab[]; defaultTabId?: string }) {
  const initial = defaultTabId && tabs.some((t) => t.id === defaultTabId) ? defaultTabId : tabs[0]?.id;
  const [active, setActive] = useState<string | undefined>(initial);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="tabs">
      <div className="tabs__bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={tab.id === active}
            aria-pressed={tab.id === active}
            className={tab.id === active ? 'tabs__pill tabs__pill--active' : 'tabs__pill'}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
            {tab.meta ? <span className="tabs__meta">{tab.meta}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="tabs__panel">
        {activeTab?.content}
      </div>
    </div>
  );
}
