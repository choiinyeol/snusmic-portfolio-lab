# Docs

한국어 문서는 기본 파일(`*.md`)에 두고, 영어 문서는 같은 위치의 `*.en.md` 파일에 분리합니다. 연구 iteration 로그와 생성 리포트는 원문 맥락을 보존할 수 있지만, 제품/아키텍처/운영 계약처럼 새 독자가 먼저 읽는 문서는 한글판과 영어판을 별도 파일로 유지합니다.

[English docs index](./README.en.md)

### 기본 문서

| 문서 | 영어판 | 목적 |
| --- | --- | --- |
| [product-spec.md](./product-spec.md) | [product-spec.en.md](./product-spec.en.md) | 제품 의도, 비목표, 현재 화면과 계좌 shortlist |
| [technical-architecture.md](./technical-architecture.md) | [technical-architecture.en.md](./technical-architecture.en.md) | pipeline, artifact, frontend data bridge, route inventory |
| [data-artifact-policy.md](./data-artifact-policy.md) | [data-artifact-policy.en.md](./data-artifact-policy.en.md) | 커밋되는 데이터와 local/generated cache의 경계 |
| [backtest-contract.md](./backtest-contract.md) | [backtest-contract.en.md](./backtest-contract.en.md) | PIT boundary, account rule declaration, verification contract |
| [frontend/](./frontend/) | - | frontend design, chart, table, page 작성 규칙 |
| [research/](./research/) | - | strategy research 기록과 generated audit output |
