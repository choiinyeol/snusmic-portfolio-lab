# Product Spec

SNUSMIC은 point-in-time SMIC 리포트, 가격, 포트폴리오 기록을 **Action Queue 중심 웹트레이딩 인텔리전스 워크스테이션**으로 재구성하는 제품입니다. 기존 Verification-first IA를 첫 화면 구조로 유지하지 않고, trades + holdings + reports에서 다음 행동 후보를 만들고 prices로 보조 검증합니다.

### 현재 제품 목표

- SMIC 리포트 metadata, PDF, markdown, structured extraction 결과를 수집합니다.
- 과거 거래(`trades`), 현재 보유(`holdings`), 보고서 풀(`reports`)을 결합해 **Action Queue** 후보를 만듭니다.
- 가격 데이터(`prices`)는 후보 생성이 아니라 현재가, 목표가 괴리, 진입/청산 구간, confidence 보정에만 사용합니다.
- 사용자가 첫 화면에서 지금 볼 매수/매도/관찰 후보를 보고, Strategy / Portfolio / Report Pool 근거를 바로 따라가도록 제품 surface를 설계합니다.
- Historical execution trace는 Portfolio 내부 기록으로 유지하되, 브로커 주문 실행은 제품 범위에 포함하지 않습니다.

### 핵심 제품 명사

| Concept | Role |
| --- | --- |
| Action Queue | 첫 화면 중심. Buy/Sell/Watch 후보와 planned/current price, strategy reason, report evidence, portfolio impact, confidence를 표시합니다. |
| Strategy | 신호와 규칙의 컨텍스트. `Signal`은 Strategy 내부 개념입니다. |
| Portfolio | 현재/과거 포트폴리오와 성과/거래 기록. `Trade Ledger`는 Portfolio 내부 기록입니다. |
| Report Pool | 리포트 근거, 목표가, 현재가, 의견, 성공/실패 상태를 제공하는 evidence pool입니다. |
| Prices | Action Queue 후보를 생성하지 않는 보조 검증 데이터입니다. |

### 웹 제품 표면

- `/`: Action Queue workstation. 지금 어떤 매수/매도/관찰 후보와 근거를 봐야 하는지 먼저 봅니다.
- `/alpha`: Strategy drilldown. 어떤 전략 규칙과 신호 근거가 후보를 만들었는지 봅니다.
- `/reports`: Report Pool / source report evidence table.
- `/reports/[symbol]/[reportId]`: report evidence detail.
- `/calendar`: 특정 관측일의 리포트/검증 후보를 보는 PIT calendar.
- `/statistics`: 표본 분포와 실패 꼬리 진단.
- `/portfolio`: Portfolio catalogue.
- `/portfolio/[account]`: 특정 Portfolio overview.
- `/portfolio/[account]/holdings`: 현재 Portfolio 노출.
- `/portfolio/[account]/trades`: historical execution trace.

### Action Queue 1차 릴리스 기준

- 첫 화면은 Action Queue가 중심이어야 합니다.
- 각 행은 `Ticker`, `Action(Buy/Sell/Watch)`, `Planned Price`, `Current Price`, `Strategy Reason`, `Report Evidence`, `Portfolio Impact`, `Confidence`를 표시해야 합니다.
- 후보 symbol은 trades, holdings, reports 중 하나 이상의 근거에서 나와야 합니다.
- prices만 있는 symbol은 Action Queue 후보가 될 수 없습니다.
- Confidence는 확률이 아니라 휴리스틱 점수이며, 근거 태그와 caveat를 함께 보여야 합니다.
- 실제 주문 버튼, 브로커 연동, 포지션 변경 실행은 포함하지 않습니다.

### 비목표

- live broker integration 또는 order entry를 제공하지 않습니다.
- 가격 데이터만으로 매수/매도 후보를 만들지 않습니다.
- 모든 React Bits식 효과를 무비판적으로 도입하지 않습니다.
- Action Queue confidence를 확률이나 투자 조언으로 표현하지 않습니다.
- 기존 Verification → Alpha → Portfolio Proof spine을 첫 화면 구조로 유지하지 않습니다.

### 시각/상호작용 원칙

- 템플릿 기반의 안정적인 기관용 대시보드 감각을 우선합니다.
- 기존 shadcn-style primitives(`PageHero`, `Section`, `KpiTile`, `Table`, `Badge`, `Money`, `Button`)를 먼저 사용합니다.
- Hyperliquid식 녹색/검정 네온 톤에 갇히지 않고, white/slate 기반의 차분한 팔레트를 기본으로 둡니다.
- React Bits 계열은 TS-TW 중 성능·의존성 부담이 낮은 아이디어를 필요한 곳에만 참고합니다.
- `gsap`, `motion/react`, `three`, `ogl` 같은 무거운 의존성 도입은 별도 승인 대상입니다.

### 향후 rule / artifact 작업

Action Queue가 product truth 또는 장기 검증 대상이 되면 TypeScript view model에서 Python exporter로 승격해야 합니다. 그때는 다음을 명시합니다.

- 어떤 trades / holdings / reports 집합이 후보 생성 근거가 되는가
- 어떤 가격 검증 조건이 confidence에 영향을 주는가
- Buy / Sell / Watch 휴리스틱의 경계값은 무엇인가
- historical execution trace에서 어떤 결과를 Portfolio 내부 기록으로 보여줄 것인가
- 어떤 benchmark와 어떤 성공 기준으로 큐 품질을 검증할 것인가
