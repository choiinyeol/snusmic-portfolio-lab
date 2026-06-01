# Docs

## 한국어

이 디렉터리의 기본 문서는 한국어를 먼저 쓰고, 같은 파일 안에 영어 요약 또는 영어 대응 섹션을 함께 둡니다. 연구 iteration 로그와 생성 리포트는 원문 맥락을 보존할 수 있지만, 제품/아키텍처/운영 계약처럼 새 독자가 먼저 읽는 문서는 한국어 우선/영어 병기를 기본값으로 합니다.

### 기본 문서

| 문서 | 목적 |
| --- | --- |
| [product-spec.md](./product-spec.md) | 제품 의도, 비목표, 현재 화면과 계좌 shortlist |
| [technical-architecture.md](./technical-architecture.md) | pipeline, artifact, frontend data bridge, route inventory |
| [data-artifact-policy.md](./data-artifact-policy.md) | 커밋되는 데이터와 local/generated cache의 경계 |
| [backtest-contract.md](./backtest-contract.md) | PIT boundary, account rule declaration, verification contract |
| [frontend/](./frontend/) | frontend design, chart, table, page 작성 규칙 |
| [research/](./research/) | strategy research 기록과 generated audit output |

## English

Default docs in this directory should put Korean first and include an English summary or matching English section in the same file. Research iteration logs and generated reports may preserve their original context, but product, architecture, and operating-contract docs should default to Korean-first bilingual writing.

### Default Documents

| Document | Purpose |
| --- | --- |
| [product-spec.md](./product-spec.md) | Product intent, non-goals, current surfaces, and account shortlist |
| [technical-architecture.md](./technical-architecture.md) | Pipeline, artifacts, frontend data bridge, and route inventory |
| [data-artifact-policy.md](./data-artifact-policy.md) | Boundary between committed data and local/generated cache |
| [backtest-contract.md](./backtest-contract.md) | PIT boundary, account rule declaration, and verification contract |
| [frontend/](./frontend/) | Frontend design, chart, table, and page rules |
| [research/](./research/) | Strategy research records and generated audit output |
