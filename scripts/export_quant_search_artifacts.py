#!/usr/bin/env python3
"""Export OMX quant strategy search results into web-consumable artifacts."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

TRADING_DAYS = 252
INITIAL_EQUITY = 100_000_000.0
ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".omx" / "quant" / "leader-meta-search-fixed.json"
JSON_OUT = ROOT / "data" / "web" / "strategies" / "quant-search-top.json"
EQUITY_SOURCE = ROOT / "data" / "sim" / "equity_daily.csv"


def finite_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed != parsed or parsed in (float("inf"), float("-inf")):
        return None
    return parsed


def fmt_params(params: dict[str, Any]) -> str:
    order = [
        "family",
        "persona",
        "lookback",
        "top_k",
        "score",
        "gate",
        "filter",
        "vol_target",
        "max_leverage",
    ]
    parts: list[str] = []
    for key in order:
        if key in params:
            parts.append(f"{key}={params[key]}")
    for key in sorted(params):
        if key not in order:
            parts.append(f"{key}={params[key]}")
    return ", ".join(parts)


def metric(row: dict[str, Any], key: str) -> float | None:
    return finite_float(row.get("metrics", {}).get(key))


def split_metric(row: dict[str, Any], split: str, key: str) -> float | None:
    return finite_float(row.get("split_metrics", {}).get(split, {}).get(key))


def build_row(rank: int, row: dict[str, Any]) -> dict[str, Any]:
    sharpe = metric(row, "annualized_sharpe")
    sortino_lpm0 = metric(row, "annualized_sortino_lpm0")
    sortino_downside_std = metric(row, "annualized_sortino_downside_std")
    robust_hit = (sharpe is not None and sharpe >= 2) or (
        sortino_downside_std is not None and sortino_downside_std >= 2
    )
    goal_hit = robust_hit or (sortino_lpm0 is not None and sortino_lpm0 >= 2)
    params = dict(row.get("params") or {})
    return {
        "rank": rank,
        "strategy_id": row.get("strategy_id", ""),
        "family": params.get("family", "unknown"),
        "params": params,
        "params_summary": fmt_params(params),
        "days": metric(row, "days"),
        "annualized_sharpe": sharpe,
        "annualized_sortino_lpm0": sortino_lpm0,
        "annualized_sortino_downside_std": sortino_downside_std,
        "cagr": metric(row, "cagr"),
        "total_return": metric(row, "total_return"),
        "max_drawdown": metric(row, "max_drawdown"),
        "ann_vol": metric(row, "ann_vol"),
        "score": max(
            [v for v in [sharpe, sortino_lpm0, sortino_downside_std] if v is not None], default=None
        ),
        "goal_hit": goal_hit,
        "robust_goal_hit": robust_hit,
        "hit_basis": "Sharpe/Sortino(Downside Std)"
        if robust_hit
        else ("Sortino(LPM0)" if goal_hit else "none"),
        "split_2021_2023_sharpe": split_metric(row, "2021_2023", "annualized_sharpe"),
        "split_2021_2023_sortino_lpm0": split_metric(row, "2021_2023", "annualized_sortino_lpm0"),
        "split_2021_2023_sortino_downside_std": split_metric(
            row, "2021_2023", "annualized_sortino_downside_std"
        ),
        "split_2024_2026_sharpe": split_metric(row, "2024_2026", "annualized_sharpe"),
        "split_2024_2026_sortino_lpm0": split_metric(row, "2024_2026", "annualized_sortino_lpm0"),
        "split_2024_2026_sortino_downside_std": split_metric(
            row, "2024_2026", "annualized_sortino_downside_std"
        ),
    }


def load_returns() -> pd.DataFrame:
    df = pd.read_csv(EQUITY_SOURCE, parse_dates=["date"]).sort_values(["persona", "date"])
    parts = []
    for persona, group in df.groupby("persona", sort=False):
        if persona == "weak_oracle":
            continue
        group = group.sort_values("date").copy()
        eq = group["equity_krw"].astype(float)
        cc = group["contributed_capital_krw"].astype(float)
        returns = (eq - eq.shift(1) - (cc - cc.shift(1))) / eq.shift(1)
        parts.append(
            pd.DataFrame({"date": group["date"].to_numpy(), "persona": persona, "ret": returns.to_numpy()})
        )
    ret = pd.concat(parts, ignore_index=True)
    mat = ret.pivot(index="date", columns="persona", values="ret").sort_index()
    return mat.dropna(axis=1, thresh=1000).fillna(0.0)


def strategy_returns_and_weights(params: dict[str, Any], mat: pd.DataFrame) -> tuple[pd.Series, pd.DataFrame]:
    family = params.get("family")
    if family in {"persona_momentum_filter", "persona_momentum_volcap"}:
        persona = str(params["persona"])
        lookback = int(params["lookback"])
        base = mat[persona]
        equity = (1 + base).cumprod()
        signal = ((equity / equity.shift(lookback) - 1) > 0).shift(1, fill_value=False).astype(float)
        weight = signal.copy()
        if family == "persona_momentum_volcap":
            vol_target = float(params["vol_target"])
            max_leverage = float(params.get("max_leverage", 1.0))
            vol = base.rolling(lookback, min_periods=max(20, lookback // 2)).std(ddof=0).shift(1) * np.sqrt(
                TRADING_DAYS
            )
            weight = (vol_target / vol).clip(0, max_leverage).fillna(0.0) * signal
        weights = pd.DataFrame({persona: weight}, index=mat.index)
        return base * weight, weights

    if family == "persona_rotation":
        lookback = int(params["lookback"])
        top_k = int(params["top_k"])
        score_name = str(params["score"])
        gate = str(params["gate"])
        mean = mat.rolling(lookback, min_periods=max(20, lookback // 2)).mean()
        std = mat.rolling(lookback, min_periods=max(20, lookback // 2)).std(ddof=0)
        mom = (1 + mat).rolling(lookback, min_periods=max(20, lookback // 2)).apply(np.prod, raw=True) - 1
        scores = {
            "trail_sharpe": mean / std,
            "trail_mom": mom,
            "trail_mean": mean,
            "rank_sharpe_mom": (mean / std).rank(axis=1, pct=True) + mom.rank(axis=1, pct=True),
        }
        score = scores[score_name].shift(1)
        mom_s = mom.shift(1)
        ranks = score.rank(axis=1, ascending=False, method="first")
        raw = (ranks <= top_k).astype(float)
        if gate in {"score_pos", "both_pos"}:
            raw = raw.where(score > 0, 0.0)
        if gate in {"mom_pos", "both_pos"}:
            raw = raw.where(mom_s > 0, 0.0)
        denom = raw.sum(axis=1).replace(0, np.nan)
        weights = raw.div(denom, axis=0).fillna(0.0)
        returns = weights.mul(mat).sum(axis=1).fillna(0.0)
        return returns, weights

    raise ValueError(f"Unsupported quant strategy family: {family}")


def build_detail(row: dict[str, Any], rank: int, mat: pd.DataFrame) -> dict[str, Any]:
    params = dict(row.get("params") or {})
    returns, weights = strategy_returns_and_weights(params, mat)
    equity = (1 + returns).cumprod() * INITIAL_EQUITY
    drawdown = equity / equity.cummax() - 1
    allocations = current_allocations(weights)
    events = allocation_events(weights, equity)
    return {
        **build_row(rank, row),
        "methodology_summary": methodology_summary(params),
        "buy_rules": buy_rules(params),
        "sell_rules": sell_rules(params),
        "risk_controls": risk_controls(params),
        "current_allocations": allocations,
        "allocation_events": events,
        "latest_equity_krw": finite_float(equity.iloc[-1]),
        "latest_cumulative_return": finite_float(equity.iloc[-1] / INITIAL_EQUITY - 1),
        "latest_drawdown": finite_float(drawdown.iloc[-1]),
    }


def current_allocations(weights: pd.DataFrame) -> list[dict[str, Any]]:
    latest = weights.iloc[-1]
    rows = [
        {"persona": str(persona), "weight": finite_float(weight)}
        for persona, weight in latest.items()
        if finite_float(weight) and abs(float(weight)) > 1e-9
    ]
    return sorted(rows, key=lambda x: abs(x["weight"] or 0), reverse=True)


def allocation_events(weights: pd.DataFrame, equity: pd.Series) -> list[dict[str, Any]]:
    previous: pd.Series | None = None
    rows: list[dict[str, Any]] = []
    for date, current in weights.iterrows():
        active_current = current[current.abs() > 1e-9]
        if previous is None and active_current.empty:
            previous = current
            continue
        delta = current - previous if previous is not None else current
        changed = delta[delta.abs() > 1e-9]
        if changed.empty:
            previous = current
            continue
        buys = sorted(
            [
                {
                    "persona": str(persona),
                    "weight_delta": finite_float(weight),
                    "weight_after": finite_float(current[persona]),
                }
                for persona, weight in changed.items()
                if weight > 0
            ],
            key=lambda x: abs(x["weight_delta"] or 0),
            reverse=True,
        )
        sells = sorted(
            [
                {
                    "persona": str(persona),
                    "weight_delta": finite_float(weight),
                    "weight_after": finite_float(current[persona]),
                }
                for persona, weight in changed.items()
                if weight < 0
            ],
            key=lambda x: abs(x["weight_delta"] or 0),
            reverse=True,
        )
        rows.append(
            {
                "date": str(date.date()),
                "equity_krw": finite_float(equity.loc[date]),
                "buys": buys,
                "sells": sells,
            }
        )
        previous = current
    return rows[-150:]


def methodology_summary(params: dict[str, Any]) -> str:
    family = params.get("family")
    if family == "persona_rotation":
        return (
            "기존 포트폴리오 persona들의 유량보정 일수익률을 대상으로, 직전 lookback 기간의 점수만 사용해 "
            f"상위 {params.get('top_k')}개 persona에 동일비중 배분하는 메타 로테이션 전략입니다."
        )
    if family == "persona_momentum_filter":
        return "단일 persona의 누적 equity 모멘텀이 lookback 기준 양수일 때만 해당 persona를 보유하고, 아니면 현금화하는 오버레이 전략입니다."
    if family == "persona_momentum_volcap":
        return "단일 persona 모멘텀 필터에 변동성 목표 비중을 곱해 위험 노출을 줄이는 오버레이 전략입니다."
    return "OMX 팀 탐색에서 생성된 퀀트 리서치 후보입니다."


def buy_rules(params: dict[str, Any]) -> list[str]:
    family = params.get("family")
    if family == "persona_rotation":
        return [
            f"매일 장 시작 전 직전 {params.get('lookback')}거래일 {params.get('score')} 점수 계산",
            f"점수 상위 {params.get('top_k')}개 persona 편입",
            f"gate={params.get('gate')} 조건 통과 시 동일비중 리밸런싱",
        ]
    return [
        f"persona={params.get('persona')} 누적 equity의 직전 {params.get('lookback')}거래일 모멘텀 확인",
        "모멘텀이 양수이면 다음 거래일 해당 persona 노출 보유",
    ]


def sell_rules(params: dict[str, Any]) -> list[str]:
    family = params.get("family")
    if family == "persona_rotation":
        return [
            "다음 리밸런싱에서 top_k 밖으로 밀린 persona 전량 제외",
            "gate 조건이 꺼진 persona는 비중 0으로 축소",
        ]
    return ["모멘텀이 0 이하로 전환되면 비중 0으로 축소", "변동성 캡 전략은 목표 변동성 초과 시 비중 축소"]


def risk_controls(params: dict[str, Any]) -> list[str]:
    controls = ["당일 수익률을 고르는 lookahead 방지를 위해 모든 신호를 1거래일 shift", "weak_oracle 제외"]
    if params.get("family") == "persona_momentum_volcap":
        controls.append(
            f"목표 변동성 {float(params.get('vol_target', 0)):.0%}, 최대 레버리지 {params.get('max_leverage')}"
        )
    if params.get("family") == "persona_rotation":
        controls.append("선택 persona 수가 0이면 현금 상태로 간주")
    return controls


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source artifact: {SOURCE}")
    if not EQUITY_SOURCE.exists():
        raise SystemExit(f"missing equity source: {EQUITY_SOURCE}")
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    seen: set[str] = set()
    input_rows: list[dict[str, Any]] = []
    for bucket in ("top_candidates", "goal_hits"):
        for row in source.get(bucket, []):
            key = row.get("strategy_id") or json.dumps(row.get("params", {}), sort_keys=True)
            if key in seen:
                continue
            seen.add(key)
            input_rows.append(row)
    mat = load_returns()
    rows = [build_row(index, row) for index, row in enumerate(input_rows, start=1)]
    details = [build_detail(row, index, mat) for index, row in enumerate(input_rows, start=1)]

    artifact = {
        "schema_version": "1.0.0",
        "generated_at": datetime.now(UTC).isoformat(),
        "source_artifact": str(SOURCE.relative_to(ROOT)),
        "rerun_command": source.get("rerun_command"),
        "candidate_count": source.get("candidate_count"),
        "goal_hit_count": source.get("goal_hit_count"),
        "display_count": len(rows),
        "goal": "annualized Sharpe >= 2 or annualized Sortino >= 2",
        "metric_definitions": source.get("metric_definitions", {}),
        "excluded": source.get("excluded", []),
        "caveats": [
            "Research candidates only; not live trading advice.",
            "Rows are selected from a 2,772-candidate search and can be overfit.",
            "Signals are shifted to avoid same-day lookahead; weak_oracle is excluded.",
            "Sortino(LPM0) and Sortino(downside-std) use different denominators; both are shown.",
        ],
        "rows": rows,
        "details": details,
    }

    JSON_OUT.parent.mkdir(parents=True, exist_ok=True)
    JSON_OUT.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"wrote {JSON_OUT.relative_to(ROOT)} ({len(rows)} rows, {len(details)} details)")


if __name__ == "__main__":
    main()
