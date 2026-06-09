export type WorkstationNavItem = {
  href: string;
  label: string;
  description?: string;
  icon: 'dashboard' | 'portfolio' | 'reports' | 'accounts' | 'review' | 'github';
  activePath?: string | null;
};

export const WORKSTATION_NAV: WorkstationNavItem[] = [
  { href: '/', label: 'Action Queue', description: '지금 해야 할 매수·매도 계획', icon: 'dashboard', activePath: '/' },
  { href: '/alpha', label: 'Strategy', description: '전략별 신호와 근거', icon: 'review' },
  { href: '/portfolio', label: 'Portfolio', description: '보유·성과·거래 기록', icon: 'portfolio' },
  { href: '/reports', label: 'Report Pool', description: '보고서 근거 풀', icon: 'reports' },
];
