# Deep Interview Spec: SNUSMIC Action Queue Workstation

## Metadata
- Interview ID: 8dc27531-bf2a-4640-be94-130e1d0b21d4
- Rounds: 14
- Final Ambiguity Score: 3.5%
- Type: brownfield
- Generated: 2026-06-09T08:40:00Z
- Threshold: 0.05
- Threshold Source: default
- Initial Context Summarized: no
- Status: PASSED
- Auto-Researched Rounds: []
- Auto-Answered Rounds: []
- Architect Failures: 1

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.97 | 0.35 | 0.3395 |
| Constraint Clarity | 0.96 | 0.25 | 0.2400 |
| Success Criteria Clarity | 0.96 | 0.25 | 0.2400 |
| Context Clarity | 0.97 | 0.15 | 0.1455 |
| **Total Clarity** | | | **0.9650** |
| **Ambiguity** | | | **0.0350** |

## Topology
| Component | Status | Description | Coverage / Deferral Note |
|-----------|--------|-------------|--------------------------|
| 제품 온톨로지와 명명 체계 | active | 최상위 명사는 Strategy, Portfolio, Report Pool, Action Queue 네 개로 고정한다. Signal은 Strategy 내부 개념이고 Trade Ledger는 Portfolio 내부 기록이다. Prices는 보조 검증 데이터다. | 이름/포함 관계/가격 데이터 역할 확정. |
| 제품 정체성 | active | SNUSMIC은 trades + holdings + reports에서 최소 큐 생성 로직으로 다음 행동 후보를 추론하고 prices로 보조 검증해 Action Queue 중심으로 보여주는 반실행형 2030년식 웹트레이딩 인텔리전스 워크스테이션이다. | 실주문 없음, 매수/매도 예정가와 액션 큐 있음. |
| 정보구조 | active | 기존 AppShell/NAV/현재 페이지 spine을 전면 폐기하고 Action Queue를 첫 화면 중심으로 둔 초고밀도 트레이딩 워크스테이션 하나로 재구성한다. | 기존 AppShell/APP_NAV 기반 IA는 폐기 대상. |
| 디자인 언어 | active | Hyperliquid식 초고밀도 마켓 UI를 연구/보고서 데이터까지 확장한다. 글로우/카운터/마이크로 모션은 적극 허용하고 배경 WebGL·커서 효과는 첫 화면에서만 제한적으로 허용한다. | 2030년형 터미널 감각, 데이터 가독성 우선. |
| 상호작용 모델 | active | Action Queue 행은 Ticker, Action(Buy/Sell/Watch), Planned Price, Current Price, Strategy Reason, Report Evidence, Portfolio Impact, Confidence를 보여준다. | 큐 행의 필수 필드 확정. |
| 컴포넌트 시스템 | active | Next.js/React/TypeScript/Tailwind/shadcn-style 기반이며 React Bits TS-TW 중 성능·의존성 부담이 낮은 컴포넌트만 복사해 내부 primitive로 흡수한다. | React Bits는 선별 흡수. 무거운 의존성은 제한. |

## Goal
SNUSMIC 프론트엔드를 기존 검증/알파/포트폴리오 proof 대시보드가 아니라, **Action Queue 중심의 반실행형 2030년식 웹트레이딩 인텔리전스 워크스테이션**으로 재구상한다. 첫 릴리스는 디자인 완성도를 우선하되, 실제 `trades + holdings + reports` 기반 최소 큐 생성 로직을 포함하고 `prices`로 현재가·목표가 괴리·진입/청산 구간·confidence를 보조 검증한다.

## Constraints
- 기존 `AppShell`, `APP_NAV`, Verification/Alpha/Portfolio Proof/Calendar/Statistics spine은 새 경험의 기준으로 유지하지 않는다.
- 실제 주문 실행 기능은 포함하지 않는다.
- 반실행형 UX로 매수/매도 예정가와 Action Queue는 제공한다.
- 최상위 제품 명사는 `Strategy`, `Portfolio`, `Report Pool`, `Action Queue` 네 개다.
- `Signal`은 `Strategy` 내부 개념, `Trade Ledger`는 `Portfolio` 내부 기록으로 흡수한다.
- Action Queue 1차 생성은 `trades + holdings + reports` 기반 최소 로직으로 한다.
- `prices`는 현재가, 목표가 괴리, 진입/청산 구간, confidence 보정에만 사용한다.
- React Bits 계열은 TS-TW 중심으로 성능·의존성 부담이 낮은 컴포넌트만 내부 primitive로 복사/흡수한다.
- 글로우, 카운터, 마이크로 모션은 적극 허용한다.
- 배경 WebGL과 커서 효과는 첫 화면에서만 제한적으로 허용한다.

## Non-Goals
- 실주문 제출, 브로커 연동, 포지션 변경 실행.
- 기존 AppShell/NAV 구조의 단순 리스킨.
- 모든 React Bits 컴포넌트의 무비판적 도입.
- 데이터 연결 없는 순수 정적 쇼케이스.
- 기존 Verification/Alpha/Portfolio Proof 정보구조 유지.

## Acceptance Criteria
- [ ] 첫 화면은 Action Queue가 중심이어야 한다.
- [ ] Action Queue 행은 `Ticker`, `Action(Buy/Sell/Watch)`, `Planned Price`, `Current Price`, `Strategy Reason`, `Report Evidence`, `Portfolio Impact`, `Confidence`를 표시해야 한다.
- [ ] 최소 큐 생성 로직은 `trades + holdings + reports`를 입력으로 사용해야 한다.
- [ ] `prices`는 현재가·목표가 괴리·진입/청산 구간·confidence 보정에 사용되어야 한다.
- [ ] Strategy, Portfolio, Report Pool, Action Queue 네 명사가 UI의 최상위 개념으로 드러나야 한다.
- [ ] 기존 AppShell/NAV 기반 spine이 새 첫 화면의 구조적 기준으로 남아 있으면 안 된다.
- [ ] 시각 언어는 Hyperliquid식 초고밀도 터미널 감각을 연구/보고서 데이터까지 확장해야 한다.
- [ ] React Bits 계열 효과는 내부 primitive로 선별 흡수되어야 하며, 과한 WebGL/커서 효과는 제한되어야 한다.

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 제품은 트레이딩 터미널이어야 한다 | 실제 주문까지 포함하는가? | 실주문은 없고 Action Queue까지 만드는 반실행형 워크스테이션이다. |
| 기존 IA를 일부 살릴 수 있다 | AppShell/NAV를 얼마나 폐기하는가? | 전면 폐기한다. |
| 명사는 많을수록 좋다 | 가장 단순한 명사 세트는 무엇인가? | Strategy, Portfolio, Report Pool, Action Queue 네 개로 고정한다. |
| Signal과 Trade Ledger가 최상위여야 한다 | 중복 개념인가? | Signal은 Strategy 내부, Trade Ledger는 Portfolio 내부로 흡수한다. |
| React Bits를 많이 쓰면 좋다 | 제품 품질/성능 경계는? | TS-TW 저부담 컴포넌트만 내부 primitive로 선별 흡수한다. |
| 디자인 우선이면 데이터는 없어도 된다 | 1차 릴리스 데이터는 어떻게 할 것인가? | 디자인 우선이지만 최소 실제 큐 생성 로직은 1차에 포함한다. |

## Technical Context
- `apps/web/app/(app)/layout.tsx`는 현재 `AppShell`로 앱 페이지를 감싼다.
- `apps/web/components/ui/app-shell-nav.ts`는 Verification, Alpha, Portfolio Proof, Calendar, Statistics spine을 정의한다.
- `apps/web/components/ui/AppShell.tsx`는 collapsible sidebar와 data-status shell을 구현한다.
- `apps/web/package.json`에는 Next 16, React 19, Tailwind 4, lightweight-charts, lucide, radix, d3가 있으나 `gsap`, `motion/react`, `three`, `ogl`은 없다.
- `data/web/manifest.json`에는 `portfolio/trades.json`, `portfolio/holdings.json`, `portfolio/daily-decisions/*.json`, `alpha/hypotheses.json`, `pages/report-board.json`, `pages/report-verification.json`, `prices/*.json` 등이 있다.
- 초기 Action Queue 입력은 `trades + holdings + reports`; `prices`는 보조 검증이다.

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Action Queue | core domain | Ticker; Action; Planned Price; Current Price; Strategy Reason; Report Evidence; Portfolio Impact; Confidence | 첫 화면 중심. trades+holdings+reports에서 최소 생성되고 prices로 보조 검증된다. |
| Strategy | core domain | signals as internal concept; rules; buy/sell rationale; target conditions | Action Queue의 Strategy Reason을 공급한다. |
| Portfolio | core domain | current holdings; historical composition; performance; trade ledger as internal concept | Portfolio Impact와 과거 결과 추적을 제공한다. |
| Report Pool | core domain | reports; target price; current price; buy opinion; success/failure status | Action Queue의 Report Evidence를 공급한다. |
| Prices | supporting data | current price; target gap; entry zone; exit zone; confidence adjustment | Action Queue를 생성하지 않고 검증/보정한다. |
| AppShell/NAV | legacy system | Verification; Alpha; Portfolio Proof; Calendar; Statistics | 새 IA에서 폐기되는 기존 구조다. |
| Internal React Bits primitive | component system | TS-TW; glow; counter; micro-motion; limited WebGL/cursor | 새 시각/상호작용 언어를 지원한다. |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------:|----:|--------:|-------:|----------------:|
| 1 | 9 | 9 | - | - | - |
| 2 | 6 | 1 | 0 | 5 | 83.33% |
| 3 | 6 | 1 | 1 | 4 | 83.33% |
| 4 | 7 | 2 | 1 | 5 | 85.71% |
| 5 | 7 | 0 | 1 | 6 | 100% |
| 7 | 6 | 0 | 2 | 4 | 85.71% |
| 8 | 6 | 0 | 0 | 6 | 100% |
| 9 | 6 | 0 | 0 | 6 | 100% |
| 14 | 7 | 0 | 0 | 7 | 100% |

## Interview Transcript
<details>
<summary>Full Q&A (14 rounds)</summary>

### Round 1
**Q:** SNUSMIC의 핵심 대상은 무엇입니까?  
**A:** 2030년 스타일의 하이퍼리퀴드보다 진보된 차세대 웹트레이딩시스템. 매매내역, 손절내역, 언제 사고팔았는지, 왜 샀는지, 어떤 전략에 의해 매수 신호가 뜨고 있는지, 왜 매도 신호가 떴는지, 얼마에 도달하면 살 건지 팔건지, 역대 매매내역과 수익률, 과거 포트폴리오 구성, 실패/성공 보고서와 처리, 목표가·현재가·매수의견 활용, 가격 데이터 활용, 보고서 풀 관리까지 포괄한다.  
**Ambiguity:** 73.75%

### Round 2
**Q:** 완성된 첫 화면에서 차세대 웹트레이딩시스템이라고 판단하게 만드는 가장 중요한 시각적 증거는 무엇입니까?  
**A:** Hyperliquid식 초고밀도 마켓 UI를 연구/보고서 데이터까지 확장한 느낌이어야 한다. React Bits도 활용한다.  
**Ambiguity:** 66.50%

### Round 3
**Q:** 새 IA에서 기존 앱의 최상위 구조는 어느 수준까지 폐기해야 합니까?  
**A:** 전면 폐기: AppShell/NAV/현재 페이지 spine을 버리고 초고밀도 트레이딩 워크스테이션 하나로 재구성한다.  
**Ambiguity:** 61.25%

### Round 4
**Q:** 이 제품은 진짜 주문을 넣는 트레이딩 터미널입니까, 아니면 주문 전후의 판단·근거·성과·실패를 추적하는 워크스테이션입니까?  
**A:** 반실행형: 실제 주문 버튼은 없지만 매수/매도 예정가와 액션 큐까지 만든다.  
**Ambiguity:** 55.30%

### Round 5
**Q:** React Bits류 컴포넌트는 새 SNUSMIC에서 어떤 성공 기준을 만족해야 합니까?  
**A:** 선별 채택: 성능·의존성 부담이 낮은 TS-TW 컴포넌트만 복사해 내부 컴포넌트로 흡수한다.  
**Ambiguity:** 47.40%

### Round 6
**Q:** 가장 단순하지만 가치 있는 새 SNUSMIC의 최상위 명사 세트는 무엇이어야 합니까?  
**A:** 전략, 포트폴리오, 보고서 풀 정도만 생각나며 추천을 요청했다.  
**Ambiguity:** 44.45%

### Round 7
**Q:** Strategy / Portfolio / Report Pool / Signal / Action Queue / Trade Ledger 여섯 개를 확정해도 됩니까?  
**A:** Signal은 Strategy 안에, Trade Ledger는 Portfolio 안에 흡수한다.  
**Ambiguity:** 35.95%

### Round 8
**Q:** 앱을 열자마자 화면의 중심을 차지해야 하는 핵심 엔티티는 무엇입니까?  
**A:** Action Queue 중심: 지금 해야 할 매수/매도 계획과 근거가 메인.  
**Ambiguity:** 28.95%

### Round 9
**Q:** Action Queue의 한 행은 최소한 무엇을 보여줘야 합니까?  
**A:** Ticker / Action(Buy/Sell/Watch) / Planned Price / Current Price / Strategy Reason / Report Evidence / Portfolio Impact / Confidence.  
**Ambiguity:** 21.80%

### Round 10
**Q:** 2030년형 느낌을 만들 때 애니메이션/효과의 경계는 어디입니까?  
**A:** 터미널 감각 우선: 글로우/카운터/마이크로 모션은 적극 허용, 배경 WebGL과 커서 효과는 첫 화면에서만 제한적으로 허용.  
**Ambiguity:** 15.80%

### Round 11
**Q:** 초기 버전의 Action Queue는 어떤 기존 데이터에서 생성해야 합니까?  
**A:** trades + holdings + reports: 과거 거래/보유/보고서에서 다음 행동 후보를 추론.  
**Ambiguity:** 10.55%

### Round 12
**Q:** 가격 데이터는 Action Queue에서 어떤 역할이어야 합니까?  
**A:** 보조 검증: trades+holdings+reports로 후보를 만들고 prices는 현재가·목표가 괴리·진입/청산 구간 표시와 confidence 보정에만 사용.  
**Ambiguity:** 8.55%

### Round 13
**Q:** 초기 릴리스의 완성 기준으로 어떤 문장을 채택할까요?  
**A:** 첫 화면에서 큐 생성 로직보다 디자인 완성도가 우선이고, 데이터 연결은 2차 릴리스로 미룬다.  
**Ambiguity:** 9.50%

### Round 14
**Q:** 1차 릴리스에서 Action Queue 데이터는 어떻게 다뤄야 합니까?  
**A:** 완전 실제 데이터: 디자인 우선이지만 최소 큐 생성 로직까지 1차에 포함.  
**Ambiguity:** 3.50%

</details>
