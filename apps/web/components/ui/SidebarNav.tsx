'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavIconKey = 'dashboard' | 'portfolio' | 'reports' | 'strategies' | 'screener' | 'guide' | 'github';

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
  description?: string;
  activePath?: string | null;
};

export function SidebarNav({ items, className = '' }: { items: SidebarNavItem[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={`side-nav ${className}`} aria-label="주요 탐색">
      {items.map((item) => {
        const isInternal = item.href.startsWith('/');
        const activePath = item.activePath === undefined ? item.href : item.activePath;
        const isCurrent =
          isInternal &&
          activePath !== null &&
          (pathname === activePath || (activePath !== '/' && pathname.startsWith(activePath)));
        return (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="side-nav__item"
            aria-current={isCurrent ? 'page' : undefined}
            target={isInternal ? undefined : '_blank'}
            rel={isInternal ? undefined : 'noreferrer'}
          >
            <span className="side-nav__icon" aria-hidden="true">
              <NavIcon icon={item.icon} />
            </span>
            <span className="side-nav__copy">
              <span className="side-nav__label">{item.label}</span>
              {item.description ? <span className="side-nav__description">{item.description}</span> : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function NavIcon({ icon }: { icon: NavIconKey }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
  switch (icon) {
    case 'dashboard':
      return (
        <svg {...common}>
          <title>스냅샷</title>
          <path d="M4 13.5 12 6l8 7.5" />
          <path d="M6.5 12v7h11v-7" />
          <path d="M10 19v-4h4v4" />
        </svg>
      );
    case 'portfolio':
      return (
        <svg {...common}>
          <title>포트폴리오</title>
          <path d="M4 19V7" />
          <path d="M8 19V5" />
          <path d="M12 19v-9" />
          <path d="M16 19V8" />
          <path d="M20 19V4" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <title>리포트</title>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h4" />
          <path d="M9.5 13h5" />
          <path d="M9.5 17h4" />
        </svg>
      );
    case 'strategies':
      return (
        <svg {...common}>
          <title>전략</title>
          <path d="M4 17c4 0 4-10 8-10s4 10 8 10" />
          <path d="M4 7c4 0 4 10 8 10s4-10 8-10" />
        </svg>
      );
    case 'screener':
      return (
        <svg {...common}>
          <title>후보 탐색</title>
          <circle cx="11" cy="11" r="6" />
          <path d="m16 16 4 4" />
          <path d="M8.5 11h5" />
          <path d="M11 8.5v5" />
        </svg>
      );
    case 'guide':
      return (
        <svg {...common}>
          <title>가이드</title>
          <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H20v17H8.5A3.5 3.5 0 0 0 5 22z" />
          <path d="M5 5.5V22" />
          <path d="M9 7h6" />
          <path d="M9 11h7" />
        </svg>
      );
    case 'github':
      return (
        <svg {...common}>
          <title>GitHub</title>
          <path d="M9 19c-5 1.5-5-2.5-7-3" />
          <path d="M15 22v-3.5c.1-1-.3-1.7-.8-2.1 2.8-.3 5.8-1.4 5.8-6A4.7 4.7 0 0 0 18.7 7 4.3 4.3 0 0 0 18.6 4S17.5 3.7 15 5.3a12.3 12.3 0 0 0-6 0C6.5 3.7 5.4 4 5.4 4a4.3 4.3 0 0 0-.1 3A4.7 4.7 0 0 0 4 10.4c0 4.6 3 5.7 5.8 6-.4.4-.8 1-.8 2.1V22" />
        </svg>
      );
  }
}
