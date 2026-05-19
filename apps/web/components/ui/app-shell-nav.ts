import type { SidebarNavItem } from '@/components/ui/SidebarNav';

export const APP_NAV: SidebarNavItem[] = [
  { href: '/main', label: '메인화면', description: '오늘 확인', icon: 'dashboard', activePath: '/main' },
  { href: '/portfolio', label: '포트폴리오', description: '보유·매매', icon: 'portfolio' },
  { href: '/reports', label: '리포트', description: '표본·검증', icon: 'reports' },
  { href: '/screener', label: '후보 탐색', description: '검토 대기열', icon: 'screener' },
  { href: '/statistics', label: '리포트 통계', description: '분포·경로', icon: 'reports' },
  { href: '/strategies', label: '전략', description: '성과·위험', icon: 'strategies' },
  { href: '/guide', label: '가이드', description: '방법론', icon: 'guide' },
];

export const GITHUB_NAV_ITEM: SidebarNavItem = {
  href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab',
  label: 'GitHub',
  description: '원본 데이터 저장소',
  icon: 'github',
  activePath: null,
};
