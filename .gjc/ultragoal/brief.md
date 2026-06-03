Goal: Make SNUSMIC Portfolio a deterministic PIT research data product with trustworthy ingest, symbol resolution, artifact validation, and release gates.

Success criteria:
- 새 SNUSMIC report sync가 direct-origin 진단과 함께 성공/실패한다.
- 모든 report symbol이 warehouse/web price artifact와 검증된다.
- .KS/.KQ dual artifact가 발생하면 CI에서 실패한다.
- export-web --check가 artifact determinism + cross-reference를 검증한다.
- release마다 version/CHANGELOG/tag/push가 일관된다.
- 대량 data refresh는 code changes와 분리된다.

Current checkpoint:
- v0.30.9: reader fallback 제거, direct fetch diagnostics 추가.
- v0.30.10: symbol registry 단일화.
- Next: web artifact invariant 강화.

Next milestone: M1: Web artifact cross-reference gate
- check_web_artifacts()에 symbol/price invariant 추가.
- helper-level tests 추가.
- docs에 artifact invariant 반영.
