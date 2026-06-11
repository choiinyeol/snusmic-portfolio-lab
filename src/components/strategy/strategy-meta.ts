// ─── Shared strategy metadata — labels, descriptions, groups ──────────────────
// Used by both the server page (research record table) and the client selector.
// 판정(SOTA/채택/연구용/기각)과 그 사유는 여기에 없다 — 백테스트가 실행 시점의
// 실제 수치로 생성해 strategy-backtest.json에 기록한다 (multi_strategy.strategies[].verdict).
// 이 파일은 규칙 메커니즘 설명(라벨·전략 규칙·그룹)만 갖는다.

export const STRATEGY_LABEL_KO: Record<string, string> = {
  A_12mo:                  "A. 12개월 보유",
  B_36mo:                  "B. 36개월 보유",
  C_narrative:             "C. 내러티브 홀드",
  D_chandelier:            "D. 샹들리에 래칫",
  "D+_chandelier_optuna":  "D+. 샹들리에 (Optuna)",
  E_half_runner:           "E. 절반익절+러너",
  F_momentum_narrative:    "F. 모멘텀 필터",
  G_dip_buy:               "G. 딥바이",
  H_minervini:             "H. 미너비니 템플릿",
  I_supertrend:            "I. 슈퍼트렌드",
  J_core_satellite:        "J. 코어-새틀라이트",
  K_rr_trend:              "K. R:R 2.5 추세추종",
  // L/M: v18 가지치기 — 비용 사망 확정으로 백테스트에서 제거 (방법론 한 줄로만 기록)
  N_52w_high:              "N. 52주 고가 근접",
  O_mtt_alpha16:           "O. MTT (alpha16)",
  P_deepbuy_chandelier:    "P. 딥바이 샹들리에",
  Q_kangto_trend:          "Q. 깡토 추세추종",
  R_kelly_chandelier:      "R. Kelly 샹들리에",
  S_hrp:                   "S-a. HRP (배분형)",
  S_msharpe:               "S-b. max-Sharpe (배분형)",
  S_mincvar:               "S-c. min-CVaR (배분형)",
  T_kospi_core_chandelier: "T. 코어-KOSPI 샹들리에",
  "T-_kospi_core_regime":  "T-. 코어-KOSPI 샹들리에 (레짐)",
  W_allweather_chandelier: "W. 올웨더-샹들리에",
  U_chandelier_scaleout:   "U. 과열 스케일아웃",
  V_spo:                   "V-a. SPO+ 포트폴리오 (배분형)",
  V_ls:                    "V-b. SPO LS 베이스라인 (배분형)",
};

export const STRATEGY_DESC_KO: Record<string, string> = {
  A_12mo:                  "진입 후 12개월 고정 보유. 단순·강건한 기준선.",
  B_36mo:                  "진입 후 36개월 보유. 장기 복리 극대화.",
  C_narrative:             "내러티브가 살아있으면 무한 보유. 월말 체크: close < 200MA AND < 진입가 → 청산 (Faber 2007).",
  D_chandelier:            "ATR(42)×5 트레일링 스탑. 신고점에서 래칫 상승. 멀티배거를 살려두되 큰 낙폭은 차단. 문헌 표준값 고정.",
  "D+_chandelier_optuna":  "Optuna IS 2-폴드 강건 최적화. ATR 기간·배수·최대포지션 탐색. OOS 채택 기준 통과 시 헤드라인 후보.",
  E_half_runner:           "목표가 도달 시 절반 익절 + 나머지 C 규칙으로 트레일.",
  F_momentum_narrative:    "200MA 위에서만 진입 + C 청산 규칙.",
  G_dip_buy:               "발간일 종가 대비 ≥20% 하락 후 매수 (6개월 내). 목표가/+50%/12mo/ATR×3 스탑 중 선착 청산.",
  H_minervini:             "트렌드 템플릿: close>50MA>150MA>200MA, 52w고점 70% 이상, RS양(+). 주간 close<50MA 청산. (Minervini 2013)",
  I_supertrend:            "Supertrend(10, 3) 불리시 시 진입. 베어리시 전환 시 청산.",
  J_core_satellite:        "D 오버레이. 80% 코어·20% 현금. KOSPI -15% 시 120% 레버리지. 차입비용 6%/년.",
  K_rr_trend:              "Stop=1×ATR(20). 반절 +2.5R 익절, 나머지 Chandelier ATR×3. 최대 10종목.",
  N_52w_high:              "리포트 당일 close ≥ 52w high × 85% 진입. 월말 close < 52w high × 70% 청산. George & Hwang (2004).",
  O_mtt_alpha16:           "alpha16 MTT 이식. RS 퍼센타일 + Minervini 5-조건 필터. 시그널 종가 → 익일 시가 체결. [KRX 파라미터, 본 유니버스 미튜닝]",
  P_deepbuy_chandelier:    "딥바이 진입(≥20% 하락, 6개월 내) + 추가 10% 하락 시 스케일인(1회) + ATR 트레일링 스탑 청산(타겟 캡 없음).",
  Q_kangto_trend:          "시장신호등(KOSPI 200MA+50MA상승→2유닛). 진입: RS≥KOSPI RS AND 60d돌파 AND 거래량≥20d평균×1.5. 스탑 -8%(1R)/BE/트레일/절반익절 +3R.",
  R_kelly_chandelier:      "D+ 샹들리에 규칙 + Kelly 포지션 사이징. Rolling 40거래 fractional Kelly (cap 25%, safety 0.5, floor 1%).",
  S_hrp:                   "HRP 배분형. 상관거리 단일연결 클러스터링 → 준대각 재정렬 → 역분산 재귀분할. 월간 리밸런스.",
  S_msharpe:               "max-Sharpe 배분형. LedoitWolf 공분산 수축, 개별 비중 ≤15%. 월간 리밸런스.",
  S_mincvar:               "min-CVaR 95% 배분형. scipy linprog LP, 개별 비중 ≤15%. 월간 리밸런스.",
  T_kospi_core_chandelier: "D+ 샹들리에 규칙 + 유휴 현금을 KOSPI 익스포저(KODEX200)로 주차. 베이스라인 = KOSPI DCA.",
  "T-_kospi_core_regime":  "T와 동일 + KOSPI < 200MA 구간에서는 파킹 수익 대신 현금 이자 연 3%(일복리). Faber (2007) 레짐 필터.",
  W_allweather_chandelier: "D+ 샹들리에 규칙 + 유휴 현금을 올웨더 바스켓(25% GLD/NASDAQ/S&P500/KOSPI, 분기 리밸런스)에 상시 주차. 레짐 게이트 없음 — 방어를 타이밍이 아닌 자산 배분으로 해결. 베이스라인 = 올웨더 DCA.",
  U_chandelier_scaleout:   "T-와 동일 + 과열 스케일아웃. extension > 8× → 절반 익절, > 12× → 나머지 절반 익절. Minervini circle / Fred6724.",
  V_spo:                   "Smart 'Predict, then Optimize' (Elmachtoub & Grigas 2022). 선형모델 ĉ=Bx를 SPO+ 손실(의사결정 리그렛 상계) SGD로 학습 → 캡 심플렉스(Σw=1, w≤15%) LP 월간 리밸런스. 워크포워드 확장 윈도우(최소 24개월).",
  V_ls:                    "V-a와 완전 동일 파이프라인, 손실만 최소제곱(LS) — 전통적 predict-then-optimize 베이스라인. SPO+ 손실 효과 단독 분리용 대조군.",
};

// ─── 전략 그룹 — 셀렉터 칩 보드의 헤더 분류 ──────────────────────────────────
export const STRATEGY_GROUPS: { name: string; keys: string[] }[] = [
  {
    name: "보유형",
    keys: ["A_12mo", "B_36mo", "C_narrative", "E_half_runner", "F_momentum_narrative", "G_dip_buy", "N_52w_high"],
  },
  {
    name: "추세형",
    keys: [
      "D_chandelier", "D+_chandelier_optuna", "H_minervini", "I_supertrend", "K_rr_trend",
      "O_mtt_alpha16", "P_deepbuy_chandelier", "Q_kangto_trend",
      "T_kospi_core_chandelier", "T-_kospi_core_regime", "W_allweather_chandelier", "U_chandelier_scaleout",
    ],
  },
  { name: "오버레이", keys: ["J_core_satellite", "R_kelly_chandelier"] },
  { name: "배분형", keys: ["S_hrp", "S_msharpe", "S_mincvar"] },
  { name: "회귀형", keys: ["V_spo", "V_ls"] },
];

export const BENCHMARK_KO: Record<string, string> = {
  KOSPI: "KOSPI", SP500: "S&P500", NASDAQ: "NASDAQ", AllWeather: "올웨더",
};
