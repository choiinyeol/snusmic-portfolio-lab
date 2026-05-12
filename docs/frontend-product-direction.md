# Frontend Product Direction / User Context

Last updated: 2026-05-13

이 문서는 SMIC portfolio/web 프론트엔드 작업에서 사용자가 전달한 레퍼런스, 요구사항, 반복적으로 답답해한 지점, 그리고 앞으로 지켜야 할 운영 원칙을 한 곳에 모은다. 다음 작업자는 이 문서를 먼저 읽고 같은 문제를 반복하지 않는다.

## 1. 현재 제품의 목표

이 프로젝트는 단순한 “quant terminal”이 아니라, SMIC 리포트가 실제 시장에서 어떻게 검증됐는지 보여주는 투자 리서치 검증 제품이어야 한다.

사용자가 페이지에서 바로 이해해야 하는 것:

- 어떤 리포트가 성과가 좋았는가
- 목표가에 도달했는가, 얼마나 걸렸는가
- 지금 가격 기준으로 목표가까지 얼마나 남았는가
- 리포트 발간 이후 가격 경로가 어땠는가
- 리포트를 추종하는 전략별 포트폴리오가 실제로 어떻게 매매했는가
- 현재 보유/손익/매매 원장이 신뢰 가능한가

핵심 인상:

> “SMIC 리포트가 실제로 맞았는지, 지금 따라가도 되는지, 어떤 전략이 돈을 벌었는지 한눈에 보인다.”

## 1.1 2026-05-13 제품 IA 결정

Deep interview 결과, 프론트엔드는 다음 1차 내비게이션 흐름으로 고정한다.

```text
Overview → Portfolio → Research → Strategy → Screener
```

- **Overview**: 30초 안에 프로젝트 개요, 현재 포트폴리오, 우수 전략, 최근 리포트를 이해시키는 executive summary.
- **Portfolio**: 보유/원장/포지션 생애주기/리포트 근거.
- **Research**: 리포트 발간 후 가격 경로, 목표가 진행률, 적중/실패 통계.
- **Strategy**: 수익률, Sharpe, Sortino, MDD, 벤치마크 아웃퍼폼을 같은 표에서 비교.
- **Screener**: 리포트 기반 후보 탐색. 전략 매수 신호나 포트폴리오 액션 추천이 아니라, 최근성/업사이드/목표 진행률/미도달·미만료 상태만으로 설명 가능한 후보를 보여준다.

명시적 비목표:

- 실시간 시세, 주문, 브로커 연동 금지.
- 블랙박스 추천 점수 금지.
- legacy/fallback/deprecated 호환 래퍼 금지. 필요한 스키마가 없으면 fast-fail 한다.

최우선 성공 기준:

> 첫 화면에서 30초 안에 이 프로젝트가 무엇이고, 포트폴리오/전략/리포트 상태가 좋은지 나쁜지 이해된다.


## 1.2 UI/UX 원칙 문서

구현 전술과 반복 방지 규칙은 [`docs/ui-ux-principles.md`](./ui-ux-principles.md)를 canonical UI/UX contract로 둔다. 특히 표는 기본적으로 정렬/필터/페이지네이션을 갖추고, 같은 데이터를 공유하는 표는 뷰를 분리하지 말고 탭·필터·정렬로 통합한다.

## 2. 사용자가 전달한 레퍼런스 링크

### 현재 서비스 / 배포

- https://smic-portfolio-lab.vercel.app/

### UI/UX 참고 서비스

- https://www.moneytoring.ai/
- https://www.moneytoring.ai/stock/EVC/brief
- https://www.butler.works/ko/screener
- https://www.tossinvest.com/

참고 방향:

- Toss처럼 쉽고 직관적인 금융 UI
- Moneytoring처럼 종목/리포트 브리프 중심 화면
- Butler screener처럼 정보 밀도가 있지만 정돈된 테이블/필터 UX
- WTS/투자 서비스처럼 차트, 가격, 수익률, 거래량이 금융 서비스답게 보일 것

### 차트 / 컴포넌트 / 템플릿 레퍼런스

- TradingView Lightweight Charts 공식 레포/문서
  - 차트 구현 시 공식 예제를 확인하고, OHLC/volume/price scale/fit content/marker 처리 방식을 따라야 함
- MUI Dashboard Template
  - https://github.com/mui/material-ui/tree/v9.0.1/docs/data/material/getting-started/templates/dashboard
- shadcn landing page 예시
  - https://github.com/leoMirandaa/shadcn-landing-page
- HyperUI
  - https://github.com/markmead/hyperui
- daisyUI themes docs
  - https://daisyui.com/docs/themes/
- daisyUI repo
  - https://github.com/saadeghi/daisyui

### UI/UX Skill / 디자인 시스템

- UI UX Pro Max Skill
  - https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- UI UX Pro Max 사이트
  - https://uupm.cc

### daisyUI LLM/문서 링크

- https://daisyui.com/llms.txt
- https://daisyui.com/docs/editor/
- https://daisyui.com/docs/v5/
- https://daisyui.com/docs/upgrade/
- https://daisyui.com/docs/install/
- https://daisyui.com/docs/config/
- https://daisyui.com/theme-generator/

## 3. 사용자가 명시적으로 요구한 것들

### 3.1 전체 UI/UX 방향

- version 2를 만든다고 생각하고 근본적으로 개선할 것
- 사용자에게 불친절한 UI를 버릴 것
- 쓸데없는 정보만 크게 보여주는 구조를 고칠 것
- 더 모던하고 미니멀하게 필요한 정보만 직관적으로 보여줄 것
- “terminal”이라는 용어/감성에 너무 빠지지 말 것
- 이 서비스가 유용해서 고객이 계속 쓰고 싶게 보일 것
- 실제 결제/회원가입 페이지를 만들 필요는 없음
- 과한 마케팅 문구, 과한 가입/결제 유도는 지양
- 마케터/기획자/개발자/디자이너 관점으로 제품 가치를 판단할 것

### 3.2 디자인 시스템 / UI 라이브러리

- shadcn/ui, Tailwind 4, daisyUI 5 같은 최신 컴포넌트/스타일을 활용할 것
- daisyUI 5는 Tailwind 4 방식으로 설치/사용
  - `tailwind.config.js`에 의존하지 말고 CSS에서 `@plugin "daisyui";` 형태
- daisyUI semantic color를 우선 사용
- 필요 이상 custom CSS를 늘리지 말 것
- Refactoring UI식 원칙 적용
  - 충분한 여백
  - 명확한 위계
  - 숫자 alignment
  - contrast
  - hover/focus state
- UI UX Pro Max skill을 사용 가능한 로컬 스킬로 활용 가능

### 3.3 리포트 상세 페이지

- 왼쪽에는 차트를 크게 배치하고, 우측 열에는 핵심 정보/KPI를 둘 것
- 페이지를 좀 더 시원하게, 화면을 꽉 차게 사용할 것
- 차트 높이를 키울 것
- 하단에는 Path observations, Trades, Source, Evidence 등을 더 정돈해서 배치
- 리포트 발간가, 현재가, 목표가, 남은 upside/downside를 명확하게 보여줄 것
- 사용자가 “지금 가격에서 목표까지 얼마나 남았는지” 바로 이해해야 함

### 3.4 차트 요구사항

- TradingView Lightweight Charts 공식 레포/문서 기준으로 고칠 것
- y축 범위를 능동적으로 조정해서 목표가가 반드시 보이도록 할 것
- 목표가/발간가/현재가가 잘리지 않게 할 것
- OHLC + volume이 보이는 스탠다드한 금융 차트로 보여줄 것
- 통화별 자리수/표시를 정확히 할 것
- 자산 가격은 해당 표시자산 통화 기준으로 고정
  - 미국 주식은 USD
  - 일본 주식은 JPY
  - 홍콩 주식은 HKD
  - 한국 주식은 KRW
- 원화 환산은 포트폴리오 합산 가치 산정에서만 보조적으로 사용

### 3.5 Path observations / 가격 시나리오

사용자가 특히 답답해한 영역.

요구사항:

- `25% 경과`, `75% 경과`는 시간 기준이 아님
- 발간 이후 저점~고점 가격 범위에서 가격 기준 25%/75% 수준을 의미
- 용어는 `25% 가격 수준`, `75% 가격 수준`처럼 오해 없게 쓸 것
- 해당 가격 수준에 가장 가까운 관측 종가를 사용
- 기존 price band는 “완전 구리게 보이고 레이아웃이 깨진다”고 피드백함
- Path observations가 너무 허전하거나 표만 있으면 안 됨
- 가격 레인지, 현재 위치, 시나리오별 수익률을 읽기 쉽게 시각화하되 alignment가 깨지면 안 됨

### 3.6 Trades / 매매 기록 영역

사용자가 가장 답답해한 영역 중 하나.

기존 문제:

- `Trades`, `페르소나별 매매 기록`, `페르소나별 매매 내역`, `포트폴리오 원장` 등 중복 문구가 많음
- 같은 설명을 여러 번 반복
- 테이블/카드 alignment가 안 맞고 심미적으로 좋지 않음
- 손익/체결/포지션 생애주기 정보가 너무 복잡하게 나열됨
- 정보는 많은데 사용자가 무엇을 봐야 하는지 모름

개선 방향:

- 먼저 요약 카드:
  - 포지션 수
  - 체결 수
  - 실현손익
  - 미실현손익
  - 평균 진입가
  - 최근가/청산가
- 그 다음 포지션 생애주기
- 마지막에 체결 원장 compact table
- 원장은 필요할 때 자세히 보는 정보로 밀도 조정
- 숫자 column alignment 통일
- 통화/원화 보조 표기 규칙 통일

### 3.7 리포트 목록 / 전략 / 포트폴리오

리포트 목록:

- 단순 table dump가 아니라 투자자가 훑는 screener처럼 구성
- 최근 발간, 목표 도달, 현재 수익률, 목표가 괴리, 리스크 플래그 등 관점별 탐색
- 검색/필터는 sticky toolbar 고려
- 모바일에서는 카드 리스트 고려

전략 페이지:

- “전략 실험표”가 아니라 선택 가능한 전략 카드처럼 보여줄 것
- 각 전략의 최종 자산, 수익률, MDD, 거래 수, 현재 보유 수, 장단점 badge 명확화

포트폴리오:

- 현재 보유/월말 보유/매매 기록/전략별 기록을 구분
- 원화 합산 가치는 필요하지만 개별 자산 가격은 원자산 통화 기준

## 4. 사용자가 답답해한 포인트

### 4.1 여러 번 고쳤는데도 alignment/미감 문제가 반복됨

사용자 피드백:

- “여전히 컴포넌트들이 얼라인이 안맞고 심미적으로 문제가 많습니다.”
- “구조적인 이유를 찾아야 할 거 같습니다.”
- “여러번 수정을 요청했는데도 해결이 안되네요.”

해석:

- 단순 CSS patch가 아니라 디자인 시스템/공통 컴포넌트 레벨의 문제
- panel/card/table/section spacing이 통일되어야 함
- 숫자/통화/테이블 셀 alignment가 공통 규칙으로 관리되어야 함
- custom class가 너무 많이 흩어지면 다시 깨짐

### 4.2 데이터 SSOT/계산 책임이 흐림

사용자 피드백:

- “리서치나 데이터 쪽 계산 영역의 복잡성이 ssot 원칙이나 효율적인 data 제공 원칙이나 api원칙을 다 위배하고 있는 거 같음”
- “그래서 프론트엔드 결과물도 잘 안나오는 거 같아.”

해석:

- 프론트는 되도록 `data/web`만 읽어야 함
- `data/sim`, `data/warehouse` 직접 참조는 점진적으로 제거
- Python exporter가 UI에 필요한 JSON을 만들어야 함
- 프론트는 계산보다 표현에 집중

현재 남은 구조적 과제:

- `apps/web/lib/artifacts.ts`가 아직 `data/sim/trades.csv`, `data/sim/equity_daily.csv` 등을 직접 읽음
- 빠른 배포를 위해 일부 sim artifact를 커밋했지만, 장기적으로는 `data/web`으로 옮기는 게 맞음

### 4.3 배포가 느림

사용자 피드백:

- “왜 이렇게 web deploy가 느리냐”
- “로컬에서 build하고 push하면 되는 거 아님?”
- “action 상에서 갱신될 때만 쓰면 되는 거잖아”
- “평소에는 그냥 로컬에서 갱신 build 하고 push하면 되는데”

결론/조치:

- 일반 web push에서 Python refresh 제거
- `web.yml`은 기본적으로 Next build + Vercel deploy만 수행
- `workflow_dispatch refresh_artifacts=true`일 때만 Actions에서 Python artifact refresh
- 데이터 갱신은 로컬 또는 sync/price workflow에서 명시적으로 수행

### 4.4 SMIC 원본 트래픽 우려

사용자 피드백:

- “내가 다운 시킨 건 아니겠지? 너무 트래픽이 잦아서.”
- “지금 url이 smic site로 연결되어있는 거 있으면 다 고쳐 내 github url로”

조치:

- 공개 웹/CSV의 PDF URL을 GitHub raw URL로 변경
- 리포트 상세에서 `SMIC 원본 PDF` 링크 제거
- sync workflow daily schedule 제거
- 원본 접근은 수동 sync 시에만 발생

남겨도 되는 곳:

- 내부 수집 코드 (`fetch_index.py`, `change_detection.py`)
- `data/manifest.json`의 원본 출처 메타데이터
- 테스트 fixture

노출되면 안 되는 곳:

- `apps/web/**` 렌더링 결과
- `data/web/**`
- `apps/web/public/downloads/**`
- `data/warehouse/reports.csv`
- `data/extracted_reports.csv`
- README 외부 링크

## 5. 페르소나별 토론 요약

### 마케터 관점

- 첫 화면에서 과하게 가입/결제/세일즈 문구를 밀지 말 것
- 사용자가 바로 느낄 가치는 “리포트 검증”과 “전략 결과”
- “터미널”보다 “투자 리포트 검증 서비스”처럼 보여야 함

### 기획자 관점

- 홈은 모든 데이터를 다 보여주지 말고 의사결정 요약 중심
- 리포트 상세는 차트 → 핵심 KPI → 경로/매매/근거 순서
- 용어는 오해 없게 짧고 정확하게
- Trades는 summary → lifecycle → ledger 순서

### 개발자 관점

- 프론트 결과물이 흔들리는 핵심 원인 중 하나는 데이터 boundary 문제
- 프론트는 `data/web`만 읽게 만드는 게 최종 방향
- 원자산 통화 표시 규칙을 공통 유틸로 강제
- 일반 배포와 데이터 갱신 workflow를 분리

### 디자이너/UX 관점

- Toss/Moneytoring/Butler처럼 넓은 여백, 명확한 숫자, 가벼운 카드, 정돈된 표
- 차트 중심의 리포트 상세
- 너무 많은 설명보다 시각적 계층과 요약 우선
- 금융 제품답게 신뢰감 있는 chart/table polish 필요

## 6. 앞으로의 프론트엔드 우선순위

### 1순위: 프론트 데이터 boundary 정리

목표:

- Next.js는 `data/web`만 읽기
- `data/sim/*.csv` 직접 참조 제거
- 필요한 trades/equity/monthly holdings를 Python export 단계에서 `data/web/*.json`으로 생성

이유:

- SSOT 명확화
- 빠른 배포 유지
- 커밋해야 하는 raw sim artifact 최소화
- UI 컴포넌트가 계산 로직에 끌려가지 않게 함

### 2순위: 리포트 상세 v3

- 왼쪽 큰 차트
- 오른쪽 KPI rail
- 하단 path/trades/source/evidence 정리
- 차트 y축/volume/OHLC/목표가 marker 완성도 향상

### 3순위: Trades 영역 재설계

- 중복 제목/설명 제거
- 요약 → 생애주기 → 체결 원장
- compact table과 카드 조합
- 숫자 alignment/통화 표기 통일

### 4순위: Path observations 재설계

- price band 레이아웃 깨짐 방지
- 25%/75% 가격 수준 설명을 간결하게
- 레인지/현재 위치/시나리오 수익률을 더 읽기 쉽게 표현

### 5순위: 리포트 목록/전략/포트폴리오 polish

- 리포트 screener UX
- 전략 카드 UX
- 포트폴리오 요약/원장 UX
- 모바일 대응

### 6순위: 디자인 시스템 정리

- daisyUI/Tailwind 중심으로 공통 패턴 정리
- custom CSS 줄이기
- card/table/section/badge/number typography 통일

## 7. 운영 원칙

### 일반 UI 작업

1. 로컬에서 수정
2. 로컬 검증
   - `cd apps/web && pnpm lint && pnpm typecheck && pnpm build`
3. 커밋/푸시
4. GitHub Actions는 Next build + Vercel deploy만 수행

### 데이터 갱신 작업

로컬 또는 명시적 workflow에서만:

```bash
uv run python -m snusmic_pipeline build-warehouse
uv run python -m snusmic_pipeline refresh-prices
scripts/refresh_web_artifacts.sh
```

이후:

```bash
git add data/warehouse data/sim data/web apps/web/public/downloads
git commit
git push
```

### 신규 리포트 sync

- SMIC overTraffic이 해소됐을 때만 수동 실행
- daily schedule 금지
- 공개 링크는 GitHub raw로 유지

```bash
uv run python -m snusmic_pipeline sync --pages auto
```

또는 필요 시:

```bash
gh workflow run sync.yml --ref main -f report_pages=auto -f force_full=true
```

## 8. 금지/주의사항

- 공개 UI/CSV에서 `snusmic.com` PDF 링크를 다시 노출하지 말 것
- UI 문구에 `terminal` 감성을 과하게 넣지 말 것
- 사용자가 요청하지 않은 결제/회원가입 페이지를 만들지 말 것
- “오늘은 이 4가지만 보면 됩니다” 같은 어색한/과한 안내 문구 지양
- `25% 경과`처럼 시간 기준으로 오해되는 표현 금지
- 개별 자산 가격을 무조건 KRW로 보여주지 말 것
- 차트 목표가가 y축 밖으로 사라지게 하지 말 것
- 테이블/카드 alignment를 임시 CSS로 대충 맞추지 말 것
- 일반 push에서 Python artifact refresh를 다시 켜지 말 것

## 9. 리포트 라이프사이클 / 만료 정책

리포트는 발간일 기준 **유효 기간**을 가진다. 기본값은 730일(약 2년)이며
`SimulationConfig.report_expiry_days`로 조정한다.

### 만료된 리포트의 정의
- `pub_date + report_expiry_days <= 오늘` 이고
- 해당 기간 안에 목표가가 한 번도 도달되지 않은 경우

### 만료 시 동작
- `compute_report_performance`의 평가 윈도우는 `[pub_date, min(end, pub_date + 730d)]`로 캡됨
- `current_return` / `peak_return` / `trough_return` / `last_close_*` 는 만료일 종가에 동결됨
- `target_hit_date` 는 만료 윈도우 내에서만 인정 (이후 도달은 무시)
- `expired: true`, `expiry_date` 가 `data/web/reports.json` 에 노출됨
- SMIC follower v1·v2 는 만료된 리포트의 보유 종목을 만료일 종가에 자동 청산
  (`stop_loss_report_age` reason). 새 리포트가 다시 나오기 전엔 재진입 불가.

### UI 표면
- ReportsTable: "목표 달성" 컬럼에 "만료" 빨간 배지, "현재 수익률" 에 `(최종)` 접미사 + 만료일 툴팁
- ReportsTable 필터 드롭다운: `진행 중` / `달성` / `만료` 3-state
- 메인 대시보드 status 배지: `진행` / `도달` / `매도 적중` / `매도 만료` / `만료` / `비실행`
- 만료된 보유 종목은 v1·v2 portfolio 화면에 나타나지 않음 (백엔드에서 청산됨)

### 정책을 끄려면
`SimulationConfig.report_expiry_days` 를 `None` 또는 `0` 으로 두면 만료 캡 없이 전체 윈도우 사용. `_simulate_follower` 의 expiry 스윕도 함께 자동으로 비활성화된다.
