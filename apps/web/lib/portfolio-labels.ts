export function displayPortfolioName(accountId: string, fallback: string): string {
  if (accountId.includes('redeploycash125_partial75')) return 'Partial 75';
  if (accountId.includes('redeploycash125')) return 'CashGate 12.5';
  if (accountId.includes('trailtrim25cap20')) return 'TrailTrim 20';
  if (accountId === 'pit_trend_top5') return 'Trend Top5';
  if (accountId === 'pit_score_top5') return 'Score Top5';
  if (accountId === 'smic_follower') return 'SMIC Follower';
  return fallback;
}
