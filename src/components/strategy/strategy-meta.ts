// ─── Shared strategy metadata — labels, descriptions, verdicts ────────────────
// Used by both the server page (research record table) and the client selector.
// No cryptic symbols (★/⚠) — explicit chips with reasons instead.

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
  L_rsi2_reversion:        "L. 민리버전 (RSI-2)",
  M_short_reversal:        "M. 단기 리버설",
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
  U_chandelier_scaleout:   "U. 과열 스케일아웃",
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
  L_rsi2_reversion:        "RSI(2) < 10 AND close > 200MA 진입. RSI(2) > 70 OR 10거래일 청산. Connors & Alvarez (2009).",
  M_short_reversal:        "월초: 직전 1개월 수익률 하위 20% 매수, 1개월 보유. 단기 리버설 팩터 (Jegadeesh 1990).",
  N_52w_high:              "리포트 당일 close ≥ 52w high × 85% 진입. 월말 close < 52w high × 70% 청산. George & Hwang (2004).",
  O_mtt_alpha16:           "alpha16 MTT 이식. RS 퍼센타일 + Minervini 5-조건 필터. 시그널 종가 → 익일 시가 체결. [KRX 파라미터, 본 유니버스 미튜닝]",
  P_deepbuy_chandelier:    "딥바이 진입(≥20% 하락, 6개월 내) + 추가 10% 하락 시 스케일인(1회) + ATR 트레일링 스탑 청산(타겟 캡 없음).",
  Q_kangto_trend:          "시장신호등(KOSPI 200MA+50MA상승→2유닛). 진입: RS≥KOSPI RS AND 60d돌파 AND 거래량≥20d평균×1.5. 스탑 -8%(1R)/BE/트레일/절반익절 +3R.",
  R_kelly_chandelier:      "D+ 샹들리에 규칙 + Kelly 포지션 사이징. Rolling 40거래 fractional Kelly (cap 25%, safety 0.5, floor 1%).",
  S_hrp:                   "HRP 배분형. 상관거리 단일연결 클러스터링 → 준대각 재정렬 → 역분산 재귀분할. 월간 리밸런스.",
  S_msharpe:               "max-Sharpe 배분형. LedoitWolf 공분산 수축, 개별 비중 ≤15%. 월간 리밸런스.",
  S_mincvar:               "min-CVaR 95% 배분형. scipy linprog LP, 개별 비중 ≤15%. 월간 리밸런스.",
  T_kospi_core_chandelier: "D+ 샹들리에 규칙 + 유휴 현금을 KOSPI 익스포저(KODEX200)로 주차. 베이스라인 = KOSPI DCA.",
  "T-_kospi_core_regime":  "T와 동일 + KOSPI < 200MA 구간에서는 파킹 수익률 0%(현금 보유). Faber (2007) 레짐 필터.",
  U_chandelier_scaleout:   "T-와 동일 + 과열 스케일아웃. extension > 8× → 절반 익절, > 12× → 나머지 절반 익절. Minervini circle / Fred6724.",
};

// ─── Verdict chips — why each non-curated strategy is out of the selector ────
// chip: "기각" (rejected — cost/performance) | "연구용" (research reference only)

export type StrategyVerdict = { chip: "기각" | "연구용"; reason: string };

export const STRATEGY_VERDICT: Record<string, StrategyVerdict> = {
  A_12mo:                  { chip: "연구용", reason: "기준선 전략 — 비교 앵커로만 유지" },
  E_half_runner:           { chip: "기각",   reason: "조기 절반 익절이 러너(멀티배거) 수익을 희석" },
  G_dip_buy:               { chip: "기각",   reason: "-20% 하락이 저점이 아니라 시작인 경우 다수 — IS/OOS 모두 벤치마크 하회" },
  H_minervini:             { chip: "연구용", reason: "OOS 양호하나 IS 샤프 미달 — 표본 부족" },
  I_supertrend:            { chip: "기각",   reason: "잦은 추세 전환 → 거래비용 누적으로 알파 소진" },
  J_core_satellite:        { chip: "연구용", reason: "D 오버레이 참고용 — 차입비용·폭락 타이밍 리스크" },
  K_rr_trend:              { chip: "기각",   reason: "빠른 사이클이 거래비용을 키움" },
  L_rsi2_reversion:        { chip: "기각",   reason: "거래비용 사망 (0.3%/side × 단기 회전) — 룩어헤드 수정 후 구현 검증, 제외" },
  M_short_reversal:        { chip: "기각",   reason: "월간 전체 교체 비용 사망 (연 24회 편도) — 구현 검증 후 제외" },
  N_52w_high:              { chip: "연구용", reason: "OOS 양호, IS 샤프 미달 — 참고용" },
  O_mtt_alpha16:           { chip: "연구용", reason: "alpha16 KRX 파라미터 이식 — 본 유니버스 미튜닝, 비교 참고용" },
  Q_kangto_trend:          { chip: "기각",   reason: "IS 음(-) 샤프 — 손절 다발, 이 유니버스에서 미작동" },
  R_kelly_chandelier:      { chip: "연구용", reason: "Kelly 사이징 효과 단독 검증용 오버레이" },
  S_hrp:                   { chip: "연구용", reason: "S 배분형 변형 — IS 샤프 베스트 변형만 셀렉터 채택" },
  S_msharpe:               { chip: "연구용", reason: "S 배분형 변형 — IS 샤프 베스트 변형만 셀렉터 채택" },
  S_mincvar:               { chip: "연구용", reason: "S 배분형 변형 — IS 샤프 베스트 변형만 셀렉터 채택" },
  T_kospi_core_chandelier: { chip: "연구용", reason: "레짐 필터 없는 T 변형 — T-(레짐)에 열위" },
  U_chandelier_scaleout:   { chip: "기각",   reason: "과열 스케일아웃이 텐배거 상승 여력을 깎음 — T- 대비 부의 비율 열위" },
};

/** Build the curated selector key list from data (SOTA + core set + best-of-S). */
export function buildCuratedKeys(headlineKey: string, bestSKey: string | null | undefined): string[] {
  const base = [
    headlineKey,                 // SOTA (T- 등 — 데이터가 정함)
    "D+_chandelier_optuna",
    "D_chandelier",
    "B_36mo",
    "C_narrative",
    "P_deepbuy_chandelier",
    "F_momentum_narrative",
    ...(bestSKey ? [bestSKey] : []),
  ];
  return [...new Set(base)];
}

export const BENCHMARK_KO: Record<string, string> = {
  KOSPI: "KOSPI", SP500: "S&P500", NASDAQ: "NASDAQ", AllWeather: "올웨더",
};
