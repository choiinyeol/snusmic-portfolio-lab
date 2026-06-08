export function displayPortfolioName(_accountId: string, fallback: string): string {
  return fallback;
}

export function portfolioRoleLabel(role: string) {
  if (role === 'candidate') return '후보';
  if (role === 'robustness') return '견고성';
  if (role === 'follower' || role === 'report_follower') return '추종';
  if (role === 'baseline') return '기준선';
  if (role === 'benchmark') return '벤치마크';
  if (role === 'momentum') return '모멘텀';
  if (role === 'mtt_filter') return '필터';
  if (role === 'entry_gate') return '진입 규칙';
  if (role === 'hold_winner') return '보유 유지';
  return role.replace(/_/g, ' ');
}
