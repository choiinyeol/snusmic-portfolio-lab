import type { SidebarNavItem } from '@/components/ui/SidebarNav';

export const APP_NAV: SidebarNavItem[] = [
  { href: '/', label: '운영 허브', description: '상태·이동', icon: 'dashboard', activePath: '/' },
  { href: '/portfolio', label: '계좌 리포트', description: '보유·매매', icon: 'portfolio' },
  { href: '/reports', label: '리포트 검증', description: '후보·성과', icon: 'review' },
  { href: '/calendar', label: '리포트 캘린더', description: '시점별 후보', icon: 'accounts' },
  { href: '/statistics', label: '성과 통계', description: '분포·경로', icon: 'reports' },
];

export const GITHUB_NAV_ITEM: SidebarNavItem = {
  href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab',
  label: 'GitHub',
  description: '원본 데이터 저장소',
  icon: 'github',
  activePath: null,
};
