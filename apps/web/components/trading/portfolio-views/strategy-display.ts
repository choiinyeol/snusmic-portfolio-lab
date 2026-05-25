export function displayPortfolioName(accountId: string, fallback: string): string {
  if (accountId.includes('redeploycash125_partial75')) return 'Partial 75';
  if (accountId.includes('redeploycash125')) return 'CashGate 12.5';
  if (accountId.includes('trailtrim25cap20')) return 'TrailTrim 20';
  if (accountId === 'pit_trend_top5') return 'Trend Top5';
  if (accountId === 'pit_score_top5') return 'Score Top5';
  if (accountId === 'smic_follower') return 'SMIC Follower';
  return fallback;
}

export function strategyMeta(accountId: string) {
  if (accountId.includes('redeploycash125_partial75')) {
    return {
      role: 'candidate',
      subtitle: '현재 연구 후보',
      description:
        '분기별로 당시 확인 가능한 리포트와 가격만 사용해 상위 5개를 보유합니다. 보유 중 큰 수익이 난 종목은 고점 대비 25% 이상 꺾이면 20% 비중까지 줄이고, 현금이 12.5% 이상일 때 그중 75%만 재투입합니다. 수익을 다시 밀어 넣되 과열 구간의 전액 재투입을 피하려는 후보입니다.',
    };
  }
  if (accountId.includes('redeploycash125')) {
    return {
      role: 'robustness',
      subtitle: '현금 게이트 기준선',
      description:
        'TrailTrim 20 규칙에 더해 현금 비중이 12.5% 이상일 때만 다시 매수합니다. Partial 75가 정말 개선인지 비교하는 견고성 기준선입니다.',
    };
  }
  if (accountId.includes('trailtrim25cap20')) {
    return {
      role: 'baseline',
      subtitle: '이익 보호 기준선',
      description:
        '상위 PIT trend 후보를 보유하되 주간 비중 상한 45%, 이익 60%, trailing trim 25%, 종목 상한 20%를 둔 기본형입니다. 현금 재투입 규칙을 붙이기 전 기준선으로 봅니다.',
    };
  }
  if (accountId === 'pit_trend_top5') {
    return {
      role: 'simple pit',
      subtitle: '단순 추세 기준',
      description:
        '발간 시점에 알 수 있었던 가격·리포트 정보만으로 추세 점수 상위 5개를 동일 비중 보유합니다. 복잡한 매도 규칙 없이 비교하는 단순 기준선입니다.',
    };
  }
  if (accountId === 'pit_score_top5') {
    return {
      role: 'score baseline',
      subtitle: '점수-only 기준',
      description:
        'PIT 점수 상위 5개를 동일 비중으로 보유합니다. 추세, freshness, trailing trim 같은 추가 규칙이 어느 정도 값을 더하는지 보기 위한 기준선입니다.',
    };
  }
  return {
    role: 'report follower',
    subtitle: '리포트 추종 기준선',
    description:
      'SMIC 리포트를 실제 매수·보유·매도 원장으로 추적한 기준선입니다. 새 PIT 전략이 단순 리포트 follower보다 나은지 비교하기 위해 유지합니다.',
  };
}
