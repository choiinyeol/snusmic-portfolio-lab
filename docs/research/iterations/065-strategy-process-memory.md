# 065 AlphaMemo-style Strategy Process Memory MVP

## Idea

기존 전략 연구 ledger는 사람이 iteration note를 읽고 다음 mutation을 결정합니다. 이 반복은 효과적이지만, 어떤 config 변화가 어떤 전략 문맥에서 반복적으로 실패/성공했는지를 기계가 재사용하지는 못합니다. 이번 iteration은 AlphaMemo 논문의 핵심을 `PitSignalRuleConfig` 기반 전략 탐색에 맞게 번역해, research-only structured search-process memory MVP를 추가합니다.

## Point-in-time contract

- 새 memory는 기존 `run-sim` 결과와 curated research edge만 읽습니다.
- 실시간 가격/미래 정보/추가 web promotion 로직은 쓰지 않습니다.
- memory는 product UI나 account shortlist를 직접 바꾸지 않습니다.
- memory score는 guidance/veto 용도만 가지며, 실제 전략 promotion은 기존 연구/검증 절차를 따릅니다.

## Buy rule

직접 매매 rule을 바꾸지 않습니다. 대신 다음 전략 탐색에서 사용할 연구 메모리를 만듭니다.

- parent = 기존 account config
- child = mutation 이후 account config
- motif = `PitSignalRuleConfig` diff를 motif vocabulary로 정규화한 결과
- residual = parent 대비 복합 quality 점수 변화

## Sell/rebalance rule

직접 매매 rule을 바꾸지 않습니다. 실패가 반복된 motif는 future search에서 veto 대상으로 해석합니다.

예시:

- `change_top_n` in high-return trend branches → Top3/Top7 반복 실패
- `change_replacement_timing` in mixed-entry branches → blanket delay 실패
- `change_redeploy_after_trim` in trail-trim redeploy branches → blanket redeploy 실패, gated redeploy만 허용 여지

## Result

새 MVP는 다음을 추가합니다.

1. `src/snusmic_pipeline/sim/strategy_memory.py`
   - config diff → motif 추출
   - parent context bucket 생성
   - residual / confidence / failure posterior / veto 계산
   - curated historical strategy edge ledger 내장
2. `python -m snusmic_pipeline strategy-memory`
   - current `data/sim/account-configs.json` + `summary.csv` 기반 report 생성
3. focused test
   - motif extraction
   - context bucketing
   - high-confidence failure veto
   - confidence collapse behavior
현재 `data/sim`은 curated shortlist 위주라서 historical edge 전체를 다 담지 않습니다. 따라서 generated report는 지원되는 edge와 누락된 edge를 함께 보여줘야 하며, coverage가 얕을 때는 future branch veto를 자동 결정하는 도구가 아니라 research guidance로만 써야 합니다.
또한 하나의 mutation이 여러 전략 축을 동시에 바꾸는 경우에는 `mixed_config_change`로 남기고, motif 통계/veto 계산에서는 제외해 false precision을 피합니다.


이 MVP는 AlphaMemo를 formula AST 대신 strategy-config diff에 맞춘 첫 버전입니다.

## Retrospective

좋았던 점:

- 현재 repo에는 이미 강한 human research ledger가 있어서, 작은 curated edge set만으로도 유용한 memory를 만들 수 있습니다.
- `PitSignalRuleConfig` 필드가 명확해서 AST보다 config-diff motif가 훨씬 구현하기 쉽습니다.
- 반복 실패 branch(Top3/Top7, blanket delayed replacement, blanket redeploy)를 veto memory로 표현하기 적합합니다.

제한:

- historical edge extraction은 아직 fully automatic이 아니라 curated mapping입니다.
- account id가 giant literal allowlist라서 auto-generated research branches를 무한 확장하기엔 구조가 빡빡합니다.
- quality score는 MVP용 휴리스틱입니다. 이후 cost sensitivity / subperiod robustness / concentration penalty를 더 엄격하게 포함해야 합니다.
- 현재 `data/sim` shortlist 때문에 많은 curated edge가 coverage 밖에 있을 수 있습니다. 누락 edge는 조용히 버리면 안 되고 report에서 명시적으로 surfaced 되어야 합니다.

## Next mutation

1. curated edge를 수동 상수에서 `docs/research/strategy-autoresearch.md` / iteration metadata 기반 반자동 추출로 이동
2. slippage/base-cost pair를 함께 읽어 cost-sensitive motif를 별도 veto bucket으로 분리
3. strategy-memory report를 다음 iteration brief 생성의 입력으로 연결
