import type { SidebarNavItem } from '@/components/ui/SidebarNav';

export const APP_NAV: SidebarNavItem[] = [
  { href: '/', label: 'Board', description: '오늘 볼 리포트·대표 계좌', icon: 'dashboard', activePath: '/' },
  { href: '/reports', label: 'Reports', description: '리포트 원장·후속 확인', icon: 'review' },
  { href: '/portfolio', label: 'Portfolio', description: '대표 계좌·보유 기록', icon: 'portfolio' },
  { href: '/calendar', label: 'Calendar', description: '발간일별 후보 추적', icon: 'accounts' },
  { href: '/statistics', label: 'Statistics', description: '성과 분포·가격 경로', icon: 'reports' },
];

export const GITHUB_NAV_ITEM: SidebarNavItem = {
  href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab',
  label: 'GitHub',
  description: '원본 데이터 저장소',
  icon: 'github',
  activePath: null,
};
