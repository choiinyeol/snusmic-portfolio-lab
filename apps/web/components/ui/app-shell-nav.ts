import type { SidebarNavItem } from '@/components/ui/SidebarNav';

export const APP_NAV: SidebarNavItem[] = [
  { href: '/', label: '스냅샷', description: '대시보드', icon: 'dashboard' },
  { href: '/portfolio', label: '포트폴리오', description: '원장·보유', icon: 'portfolio' },
  { href: '/reports', label: '리포트 검증', description: '목표가·근거', icon: 'reports' },
  { href: '/strategies', label: '전략 비교', description: '성과·위험', icon: 'strategies' },
  { href: '/screener', label: '후보 탐색', description: '리서치 후보', icon: 'screener' },
  { href: '/guide', label: '읽는 법', description: '방법론', icon: 'guide' },
];

export const GITHUB_NAV_ITEM: SidebarNavItem = {
  href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab',
  label: 'GitHub',
  description: '정적 산출물 소스',
  icon: 'github',
  activePath: null,
};
