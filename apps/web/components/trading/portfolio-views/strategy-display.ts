import { displayPortfolioName } from '@/lib/portfolio-labels';

export { displayPortfolioName };

export function strategyMeta(accountId: string) {
  if (accountId.includes('redeploycash125_partial75')) {
    return {
      role: 'candidate',
      subtitle: '현재 연구 후보',
      description:
        '분기 리밸런싱일마다 그날까지 확인 가능한 리포트와 가격만 사용합니다. 최근 540일 안에 발간됐고 정배열과 52주 고점 -20% 이내 조건을 통과한 종목 중 신규 진입은 candidate_score 상위, 기존 보유는 board_score Top20 안에 있거나 매수 60일 미만이면 유지합니다. 기본은 최대 5종목 동일비중이며, 목표 도달 여부는 감사 라벨일 뿐 편입 제외 조건이 아닙니다. 보유 종목이 +60% 이상 수익 중이고 주간 점검에서 계좌의 45%를 넘으면 40%까지 줄이고, +100% 이상 갔다가 보유 후 고점 대비 25% 이상 밀리면 20%까지 줄입니다. 이 trim 이후 현금이 계좌의 12.5% 이상일 때만 그 현금의 75%를 다시 후보에 배분합니다.',
    };
  }
  if (accountId.includes('redeploycash125')) {
    return {
      role: 'robustness',
      subtitle: '현금 게이트 기준선',
      description:
        'Partial 75와 같은 분기 Top5, candidate_score 신규 진입, board_score 보유 유지, 주간 45% 트리거/40% 캡, trailing trim 20% 규칙을 씁니다. 차이는 trim으로 현금이 12.5% 이상 생기면 현금 전부를 다시 목표 비중까지 투입한다는 점입니다. 따라서 Partial 75의 부분 재투입이 실제로 과열 재진입을 줄였는지 비교하는 기준선입니다.',
    };
  }
  if (accountId.includes('trailtrim25cap20')) {
    return {
      role: 'baseline',
      subtitle: '이익 보호 기준선',
      description:
        '분기마다 최근 540일 리포트 후보를 다시 계산하고 최대 5종목을 동일비중으로 보유합니다. 신규 편입은 candidate_score 순서, 기존 보유 유지 판단은 board_score Top20과 최소 보유 60일 규칙을 사용합니다. 수익률 +60% 이상인 종목이 주간 점검에서 계좌의 45%를 넘으면 40%까지 줄이고, +100% 이상 오른 뒤 보유 후 고점 대비 25% 이상 되돌리면 20%까지 줄입니다. trim으로 생긴 현금을 즉시 재투입하는 게이트는 붙이지 않은 이익 보호 기준선입니다.',
    };
  }
  if (accountId === 'pit_trend_top5') {
    return {
      role: 'simple pit',
      subtitle: '단순 추세 기준',
      description:
        '월별 리밸런싱일에 최근 730일 리포트 중 정배열이고 52주 고점 -20% 이내인 후보를 board_score 순으로 5개 보유합니다. 매번 목표 비중으로 다시 맞추는 단순형이라, 보유 승자 유지·부분 trim·현금 재투입 규칙이 성과에 얼마나 더해졌는지 비교하기 위한 출발점입니다.',
    };
  }
  if (accountId === 'pit_score_top5') {
    return {
      role: 'score baseline',
      subtitle: '점수-only 기준',
      description:
        '월별 리밸런싱일에 최근 730일 리포트 전체를 board_score 순으로 정렬하고 상위 5개를 동일비중으로 보유합니다. 정배열, 52주 고점 근접, 보유 승자 유지, trailing trim 같은 추가 규칙을 넣지 않은 순수 점수 기준선입니다.',
    };
  }
  return {
    role: 'report follower',
    subtitle: '리포트 추종 기준선',
    description:
      'SMIC 리포트 발간과 목표가 도달을 실제 매수·보유·매도 원장으로 연결한 기준선입니다. 점수 기반 TopN 전략이 단순 리포트 추종보다 나은지 비교하기 위한 원장입니다.',
  };
}
