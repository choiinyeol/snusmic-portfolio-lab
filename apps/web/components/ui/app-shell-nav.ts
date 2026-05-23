import type { SidebarNavItem } from '@/components/ui/SidebarNav';

export const APP_NAV: SidebarNavItem[] = [
  { href: '/', label: '신호 보드', description: '현재 상태', icon: 'dashboard', activePath: '/' },
  { href: '/portfolio', label: '계좌 리포트', description: '보유·매매', icon: 'portfolio' },
  { href: '/reports', label: '신호 검증 보드', description: '후보·리포트', icon: 'review' },
  { href: '/statistics', label: '성과 통계', description: '분포·경로', icon: 'reports' },
];

export const GITHUB_NAV_ITEM: SidebarNavItem = {
  href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab',
  label: 'GitHub',
  description: '원본 데이터 저장소',
  icon: 'github',
  activePath: null,
};
