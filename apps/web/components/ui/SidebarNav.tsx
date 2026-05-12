'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: string;
  activePath?: string | null;
};

export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="side-nav" aria-label="주요 탐색">
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
          >
            <span className="side-nav__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
