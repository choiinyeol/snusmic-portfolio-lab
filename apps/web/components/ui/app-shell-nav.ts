import type { SidebarNavItem } from '@/components/ui/SidebarNav';

export const APP_NAV: SidebarNavItem[] = [
  { href: '/', label: '스냅샷', description: '오늘 확인', icon: 'dashboard' },
  { href: '/portfolio', label: '원장', description: '보유·체결', icon: 'portfolio' },
  { href: '/reports', label: '리포트', description: '검증·후보', icon: 'reports' },
  { href: '/strategies', label: '전략', description: '성과·위험', icon: 'strategies' },
  { href: '/screener', label: '후보', description: '재검토', icon: 'screener' },
  { href: '/guide', label: '가이드', description: '방법론', icon: 'guide' },
];

export const GITHUB_NAV_ITEM: SidebarNavItem = {
  href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab',
  label: 'GitHub',
  description: '정적 산출물 소스',
  icon: 'github',
  activePath: null,
};
