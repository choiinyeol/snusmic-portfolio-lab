from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from snusmic_pipeline.sim.stock_admission import (
    StockAdmissionArtifact,
    StockAdmissionDecision,
    StockAdmissionWindow,
    StockRuleCandidate,
    StockRuleFamily,
    StockRuleMetrics,
    StockRuleParam,
)


def _window() -> StockAdmissionWindow:
    return StockAdmissionWindow(
        search_start=date(2021, 1, 4),
        search_end=date(2023, 12, 29),
        oos_start=date(2024, 1, 2),
        oos_end=date(2026, 4, 30),
    )


def _metrics(*, mwr: float, trades: int = 3, sharpe: float | None = 1.0) -> StockRuleMetrics:
    return StockRuleMetrics(
        money_weighted_return=mwr,
        net_profit_krw=100_000.0,
        final_equity_krw=1_100_000.0,
        max_drawdown=0.10,
        trade_count=trades,
        sharpe=sharpe,
        sortino=1.2,
    )


def _candidate(rule_id: str = "report_upside.win") -> StockRuleCandidate:
    return StockRuleCandidate(
        rule_id=rule_id,
        family="report_upside",
        symbol="WIN.KS",
        company="Winners Co",
        window=_window(),
        params=(StockRuleParam(name="min_target_upside", value=0.30),),
        in_sample_metrics=_metrics(mwr=0.42),
    )


def _accepted_decision(rule_id: str = "report_upside.win") -> StockAdmissionDecision:
    return StockAdmissionDecision(
        candidate=_candidate(rule_id),
        status="accepted",
        reason_codes=("passes_validation_goal",),
        out_of_sample_metrics=_metrics(mwr=0.22),
        benchmark_oos_money_weighted_return=0.10,
        excess_return_vs_benchmark=0.12,
        min_excess_return=0.01,
    )


def test_stock_admission_window_rejects_is_oos_overlap() -> None:
    with pytest.raises(ValidationError, match="strictly before out-of-sample"):
        StockAdmissionWindow(
            search_start=date(2021, 1, 4),
            search_end=date(2024, 1, 2),
            oos_start=date(2024, 1, 2),
            oos_end=date(2026, 4, 30),
        )


def test_stock_admission_window_allows_full_sample_validation_overlap() -> None:
    window = StockAdmissionWindow(
        search_start=date(2021, 1, 4),
        search_end=date(2022, 12, 30),
        oos_start=date(2021, 1, 4),
        oos_end=date(2026, 4, 30),
        validation_mode="full_sample",
    )

    assert window.validation_mode == "full_sample"


def test_stock_admission_decision_recomputes_oos_excess() -> None:
    with pytest.raises(ValidationError, match="must equal OOS money_weighted_return minus benchmark"):
        StockAdmissionDecision(
            candidate=_candidate(),
            status="below_benchmark",
            reason_codes=("below_oos_benchmark",),
            out_of_sample_metrics=_metrics(mwr=0.08),
            benchmark_oos_money_weighted_return=0.10,
            excess_return_vs_benchmark=0.50,
        )


def test_accepted_stock_decision_may_lag_oos_benchmark() -> None:
    decision = StockAdmissionDecision(
        candidate=_candidate(),
        status="accepted",
        reason_codes=("passes_validation_goal",),
        out_of_sample_metrics=_metrics(mwr=0.09),
        benchmark_oos_money_weighted_return=0.10,
        excess_return_vs_benchmark=-0.01,
    )

    assert decision.accepted is True


def test_accepted_stock_decision_requires_oos_trade_count_gate() -> None:
    with pytest.raises(ValidationError, match="min_trades"):
        StockAdmissionDecision(
            candidate=_candidate(),
            status="accepted",
            reason_codes=("passes_validation_goal",),
            out_of_sample_metrics=_metrics(mwr=0.22, trades=0),
            benchmark_oos_money_weighted_return=0.10,
            excess_return_vs_benchmark=0.12,
            min_trades=1,
        )


def test_stock_rule_candidate_rejects_duplicate_param_names() -> None:
    with pytest.raises(ValidationError, match="params must be unique"):
        StockRuleCandidate(
            rule_id="report_upside.dup",
            family="report_upside",
            symbol="WIN.KS",
            window=_window(),
            params=(
                StockRuleParam(name="min_target_upside", value=0.20),
                StockRuleParam(name="min_target_upside", value=0.30),
            ),
            in_sample_metrics=_metrics(mwr=0.42),
        )


def test_stock_rule_candidate_preserves_actual_rule_family_names() -> None:
    families: tuple[StockRuleFamily, ...] = (
        "target_upside_momentum",
        "fresh_report_momentum",
        "target_gap_reversal",
        "price_momentum",
        "ma_crossover",
        "rsi_reversal",
    )

    for family in families:
        candidate = StockRuleCandidate.model_validate(
            {**_candidate().model_dump(mode="python"), "family": family}
        )

        assert candidate.family == family


def test_stock_admission_artifact_roundtrips_and_exposes_accepted_decisions() -> None:
    artifact = StockAdmissionArtifact(
        window=_window(),
        benchmark_persona="benchmark_qqq",
        decisions=(
            _accepted_decision("report_upside.win"),
            StockAdmissionDecision(
                candidate=_candidate("report_upside.mid"),
                status="below_benchmark",
                reason_codes=("below_oos_benchmark",),
                out_of_sample_metrics=_metrics(mwr=0.08),
                benchmark_oos_money_weighted_return=0.10,
                excess_return_vs_benchmark=-0.02,
            ),
        ),
    )

    rebuilt = StockAdmissionArtifact.model_validate_json(artifact.model_dump_json())

    assert rebuilt == artifact
    assert [decision.candidate.rule_id for decision in rebuilt.accepted_decisions] == ["report_upside.win"]


def test_stock_admission_artifact_rejects_duplicate_rule_ids() -> None:
    with pytest.raises(ValidationError, match="rule_id values must be unique"):
        StockAdmissionArtifact(
            window=_window(),
            benchmark_persona="benchmark_qqq",
            decisions=(
                _accepted_decision("report_upside.win"),
                _accepted_decision("report_upside.win"),
            ),
        )


def test_stock_admission_artifact_rejects_decision_window_mismatch() -> None:
    other_window = StockAdmissionWindow(
        search_start=date(2020, 1, 2),
        search_end=date(2022, 12, 30),
        oos_start=date(2023, 1, 2),
        oos_end=date(2024, 12, 31),
    )
    mismatched_candidate = _candidate().model_copy(update={"window": other_window})
    mismatched_decision = _accepted_decision().model_copy(update={"candidate": mismatched_candidate})

    with pytest.raises(ValidationError, match="artifact IS/OOS window"):
        StockAdmissionArtifact(
            window=_window(),
            benchmark_persona="benchmark_qqq",
            decisions=(mismatched_decision,),
        )


def test_stock_admission_contracts_are_frozen_and_forbid_extra_fields() -> None:
    candidate = _candidate()
    with pytest.raises(ValidationError):
        candidate.symbol = "OTHER.KS"  # type: ignore[misc]
    with pytest.raises(ValidationError):
        StockRuleMetrics.model_validate(
            {
                "money_weighted_return": 0.1,
                "net_profit_krw": 1.0,
                "final_equity_krw": 10.0,
                "max_drawdown": 0.0,
                "trade_count": 1,
                "unknown": "forbidden",
            }
        )
