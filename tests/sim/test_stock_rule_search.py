from __future__ import annotations

import runpy
from collections.abc import Callable
from pathlib import Path
from typing import cast

import pandas as pd

from snusmic_pipeline.sim.market import PriceBoard
from snusmic_pipeline.sim.stock_rule_search import (
    StockRuleConfig,
    _prepare_stock_reports,
    _report_state_matrices,
    _weights_for_config,
)

_SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "run_stock_rule_search.py"
_SCRIPT_HELPERS = runpy.run_path(str(_SCRIPT_PATH))
_apply_diversity_gate = cast(
    Callable[..., tuple[pd.DataFrame, list[dict[str, object]], dict[str, object]]],
    _SCRIPT_HELPERS["_apply_diversity_gate"],
)
_artifact_family = cast(Callable[[str], str], _SCRIPT_HELPERS["_artifact_family"])
_passes_goal = cast(Callable[..., bool], _SCRIPT_HELPERS["_passes_goal"])


def test_stock_rule_admission_artifact_preserves_actual_rule_family_names() -> None:
    assert _artifact_family("target_gap_reversal") == "target_gap_reversal"
    assert _artifact_family("price_momentum") == "price_momentum"
    assert _artifact_family("fresh_report_momentum") == "fresh_report_momentum"


def test_stock_rule_goal_gate_requires_deployable_drawdown() -> None:
    row = {
        "accepted": True,
        "oos_total_return": 6.0,
        "oos_annualized_sharpe": 0.5,
        "oos_annualized_sortino": 0.5,
        "oos_max_drawdown": -0.70,
    }

    assert not _passes_goal(
        row,
        min_sharpe=1.5,
        min_sortino=1.5,
        min_return=5.0,
        max_drawdown=0.65,
    )
    assert _passes_goal(
        row,
        min_sharpe=1.5,
        min_sortino=1.5,
        min_return=5.0,
        max_drawdown=0.0,
    )


def test_stock_rule_coverage_failure_removes_unresolved_report_after_trading_days() -> None:
    dates = pd.bdate_range("2024-01-02", periods=10)
    close = pd.DataFrame({"AAA": [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]}, index=dates)
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    weights = _stock_rule_weights(
        board,
        target_price=200.0,
        coverage_failure_trading_days=4,
    )

    active = [idx for idx, value in enumerate(weights[:, 0]) if value > 0]

    assert active
    assert max(active) == 5


def test_stock_rule_target_touch_keeps_symbol_in_coverage_pool() -> None:
    dates = pd.bdate_range("2024-01-02", periods=10)
    close = pd.DataFrame({"AAA": [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]}, index=dates)
    high = close.copy()
    high.loc[dates[1], "AAA"] = 210.0
    board = PriceBoard(close=close, open=close.copy(), high=high, low=close.copy())
    weights = _stock_rule_weights(
        board,
        target_price=200.0,
        coverage_failure_trading_days=4,
    )

    assert weights[-1, 0] > 0


def test_stock_rule_late_target_touch_does_not_reopen_failed_coverage() -> None:
    dates = pd.bdate_range("2024-01-02", periods=10)
    close = pd.DataFrame({"AAA": [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]}, index=dates)
    high = close.copy()
    high.loc[dates[6], "AAA"] = 210.0
    board = PriceBoard(close=close, open=close.copy(), high=high, low=close.copy())
    weights = _stock_rule_weights(
        board,
        target_price=200.0,
        coverage_failure_trading_days=4,
    )

    active = [idx for idx, value in enumerate(weights[:, 0]) if value > 0]

    assert active
    assert max(active) == 5


def test_stock_rule_coverage_failure_uses_pre_window_trading_age() -> None:
    dates = pd.bdate_range("2024-01-02", periods=10)
    close = pd.DataFrame({"AAA": [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]}, index=dates)
    board = PriceBoard(close=close, open=close.copy(), high=close.copy(), low=close.copy())
    reports = _prepare_stock_reports(pd.DataFrame(_reports(target_price=200.0)), board)
    state = _report_state_matrices(
        pd.DatetimeIndex(dates[5:]),
        ["AAA"],
        reports,
        board.high,
        trading_calendar=pd.DatetimeIndex(dates),
    )

    weights, _ = _weights_for_config(
        close.loc[dates[5:]],
        state,
        _test_config(coverage_failure_trading_days=2),
    )

    assert state["trading_age"][:, 0].tolist() == [5.0, 6.0, 7.0, 8.0, 9.0]
    assert not weights[:, 0].any()


def test_stock_rule_pre_window_target_touch_keeps_coverage_live() -> None:
    dates = pd.bdate_range("2024-01-02", periods=10)
    close = pd.DataFrame({"AAA": [100, 101, 102, 103, 104, 105, 106, 107, 108, 109]}, index=dates)
    high = close.copy()
    high.loc[dates[2], "AAA"] = 210.0
    board = PriceBoard(close=close, open=close.copy(), high=high, low=close.copy())
    reports = _prepare_stock_reports(pd.DataFrame(_reports(target_price=200.0)), board)
    state = _report_state_matrices(
        pd.DatetimeIndex(dates[5:]),
        ["AAA"],
        reports,
        board.high,
        trading_calendar=pd.DatetimeIndex(dates),
    )

    weights, _ = _weights_for_config(
        close.loc[dates[5:]],
        state,
        _test_config(coverage_failure_trading_days=2),
    )

    assert state["target_touched"][:, 0].all()
    assert weights[-1, 0] > 0


def test_stock_rule_diversity_gate_never_exceeds_persona_top_with_coverage_representatives() -> None:
    frame = pd.DataFrame(
        [
            _admission_row(
                "target_upside_momentum_ma10_30_D_age0-120_pool3_hold2_equal_blend",
                "target_upside_momentum",
                sharpe=1.4,
            ),
            _admission_row(
                "ma_crossover_ma5_20_M_age0-3650_fail500t_pool5_hold3_equal_ma_cross",
                "ma_crossover",
                sharpe=0.8,
            ),
        ]
    )

    updated, selected, summary = _apply_diversity_gate(
        frame,
        returns_by_rule_id={},
        persona_top=1,
        min_sharpe=0.7,
        min_sortino=0.7,
        min_return=2.0,
        max_drawdown=0.65,
        max_correlation=0.95,
    )

    assert len(selected) == 1
    assert summary["selected_count"] == 1
    assert updated["diversity_status"].isin({"selected", "coverage_pool_representative"}).sum() == 1


def _stock_rule_weights(
    board: PriceBoard,
    *,
    target_price: float,
    coverage_failure_trading_days: int,
):
    reports = pd.DataFrame(_reports(target_price=target_price))
    prepared = _prepare_stock_reports(reports, board)
    state = _report_state_matrices(
        pd.DatetimeIndex(board.close.index),
        ["AAA"],
        prepared,
        board.high,
        trading_calendar=pd.DatetimeIndex(board.close.index),
    )
    weights, _ = _weights_for_config(
        board.close,
        state,
        _test_config(coverage_failure_trading_days=coverage_failure_trading_days),
    )
    return weights


def _reports(*, target_price: float) -> list[dict[str, object]]:
    return [
        {
            "report_id": "r-aaa",
            "symbol": "AAA",
            "publication_date": pd.Timestamp("2024-01-02"),
            "report_current_price_krw": 100.0,
            "target_price_krw": target_price,
        }
    ]


def _admission_row(rule_id: str, family: str, *, sharpe: float) -> dict[str, object]:
    return {
        "rule_id": rule_id,
        "family": family,
        "accepted": True,
        "oos_total_return": 2.2,
        "oos_annualized_sharpe": sharpe,
        "oos_annualized_sortino": sharpe,
        "oos_max_drawdown": -0.25,
    }


def _test_config(*, coverage_failure_trading_days: int) -> StockRuleConfig:
    return StockRuleConfig(
        rule_id="price_momentum_test",
        family="price_momentum",
        fast_ma_days=3,
        slow_ma_days=3,
        min_report_age_days=0,
        max_report_age_days=3650,
        rebalance="D",
        top_pool=1,
        hold_top=1,
        weight_mode="equal",
        score_mode="price_momentum",
        min_momentum_return=-1.0,
        coverage_failure_trading_days=coverage_failure_trading_days,
    )
