import type { SidebarNavItem } from '@/components/ui/SidebarNav';

export const APP_NAV: SidebarNavItem[] = [
  { href: '/', label: 'Verification', description: '검증 케이스 보드', icon: 'dashboard', activePath: '/' },
  { href: '/alpha', label: 'Alpha', description: '승격 규칙과 근거', icon: 'review' },
  { href: '/portfolio', label: 'Portfolio Proof', description: '전략 증명과 실행 trace', icon: 'portfolio' },
  { href: '/calendar', label: 'Calendar', description: '발간일별 검증 후보', icon: 'accounts' },
  { href: '/statistics', label: 'Statistics', description: '검증 분포와 실패 꼬리', icon: 'reports' },
];

export const GITHUB_NAV_ITEM: SidebarNavItem = {
  href: 'https://github.com/ChoiInYeol/snusmic-portfolio-lab',
  label: 'GitHub',
  description: '원본 데이터 저장소',
  icon: 'github',
  activePath: null,
};
