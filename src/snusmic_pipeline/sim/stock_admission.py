"""Stock-level rule-search admission contracts.

These models are the schema boundary between an in-sample stock-rule search
(`search_is`) and a later validation replay.  The validation window is normally
out-of-sample, but can intentionally be a full-sample replay when the product
goal is to keep universal, famous-rule-style personas instead of harshly
optimizing an already short history split.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal, TypeAlias

from pydantic import BaseModel, ConfigDict, Field, model_validator


class _FrozenStockModel(BaseModel):
    """Immutable stock-admission boundary model with strict fields."""

    model_config = ConfigDict(frozen=True, extra="forbid", validate_assignment=True)


StockRuleFamily: TypeAlias = Literal[
    "report_upside",
    "mtt",
    "rsi_reversal",
    "ma_crossover",
    "atr_breakout",
    "relative_strength",
]
StockAdmissionStatus: TypeAlias = Literal[
    "accepted",
    "below_benchmark",
    "below_risk_gate",
    "duplicate_behavior",
    "insufficient_trades",
    "lookahead_violation",
]
StockAdmissionReason: TypeAlias = Literal[
    "beats_oos_benchmark",
    "below_oos_benchmark",
    "below_sharpe_gate",
    "below_sortino_gate",
    "duplicate_behavior",
    "insufficient_trades",
    "is_oos_overlap",
]
JsonParamValue: TypeAlias = str | int | float | bool | None


class StockAdmissionWindow(_FrozenStockModel):
    """Date split used by stock-rule search and admission.

    ``search_*`` is the in-sample ranking window. ``oos_*`` is the legacy field
    name for the validation replay window.  In strict OOS mode the search window
    must end before validation starts.  In full-sample mode overlap is deliberate:
    the search ranks candidates on IS, then replays frozen rules on the whole
    available sample for product admission.
    """

    search_start: date
    search_end: date
    oos_start: date
    oos_end: date
    validation_mode: Literal["oos", "full_sample"] = "oos"

    @model_validator(mode="after")
    def _check_order_and_gap(self) -> StockAdmissionWindow:
        if self.search_end < self.search_start:
            raise ValueError(
                f"search_end {self.search_end} must be on or after search_start {self.search_start}"
            )
        if self.oos_end < self.oos_start:
            raise ValueError(f"oos_end {self.oos_end} must be on or after oos_start {self.oos_start}")
        if self.validation_mode == "oos" and self.search_end >= self.oos_start:
            raise ValueError(
                "in-sample search window must end strictly before out-of-sample admission starts; "
                f"got search_end={self.search_end}, oos_start={self.oos_start}"
            )
        return self


class StockRuleParam(_FrozenStockModel):
    """One deterministic, JSON-safe rule parameter."""

    name: Annotated[str, Field(pattern=r"^[a-z][a-z0-9_]*$")]
    value: JsonParamValue


class StockRuleMetrics(_FrozenStockModel):
    """Comparable performance metrics for one rule in one window."""

    money_weighted_return: float
    net_profit_krw: float
    final_equity_krw: Annotated[float, Field(ge=0.0)]
    max_drawdown: Annotated[float, Field(ge=0.0, le=1.0)]
    trade_count: Annotated[int, Field(ge=0)]
    sharpe: float | None = None
    sortino: float | None = None


class StockRuleCandidate(_FrozenStockModel):
    """A stock-level rule discovered only from the in-sample window."""

    rule_id: Annotated[str, Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")]
    family: StockRuleFamily
    symbol: Annotated[str, Field(min_length=1)]
    company: str | None = None
    window: StockAdmissionWindow
    params: tuple[StockRuleParam, ...] = ()
    in_sample_metrics: StockRuleMetrics

    @model_validator(mode="after")
    def _check_unique_params(self) -> StockRuleCandidate:
        names = [param.name for param in self.params]
        if len(set(names)) != len(names):
            raise ValueError(f"Stock rule params must be unique; got {names}")
        return self


class StockAdmissionDecision(_FrozenStockModel):
    """OOS admission result for one in-sample stock-rule candidate."""

    candidate: StockRuleCandidate
    status: StockAdmissionStatus
    reason_codes: tuple[StockAdmissionReason, ...]
    out_of_sample_metrics: StockRuleMetrics
    benchmark_oos_money_weighted_return: float
    excess_return_vs_benchmark: float
    min_excess_return: float = 0.0
    min_trades: Annotated[int, Field(ge=0)] = 1
    min_sharpe: float | None = None
    min_sortino: float | None = None

    @property
    def accepted(self) -> bool:
        return self.status == "accepted"

    @model_validator(mode="after")
    def _check_admission_consistency(self) -> StockAdmissionDecision:
        expected_excess = (
            self.out_of_sample_metrics.money_weighted_return - self.benchmark_oos_money_weighted_return
        )
        if abs(self.excess_return_vs_benchmark - expected_excess) > 1e-9:
            raise ValueError(
                "excess_return_vs_benchmark must equal OOS money_weighted_return minus benchmark; "
                f"got {self.excess_return_vs_benchmark} vs expected {expected_excess}"
            )
        if self.status == "accepted":
            if expected_excess <= self.min_excess_return:
                raise ValueError(
                    "accepted stock-rule candidates must beat the OOS benchmark by min_excess_return; "
                    f"got excess={expected_excess}, min_excess_return={self.min_excess_return}"
                )
            if self.out_of_sample_metrics.trade_count < self.min_trades:
                raise ValueError(
                    "accepted stock-rule candidates must satisfy the OOS min_trades gate; "
                    f"got {self.out_of_sample_metrics.trade_count} < {self.min_trades}"
                )
            if self.min_sharpe is not None and (
                self.out_of_sample_metrics.sharpe is None
                or self.out_of_sample_metrics.sharpe < self.min_sharpe
            ):
                raise ValueError("accepted stock-rule candidates must satisfy the OOS Sharpe gate")
            if self.min_sortino is not None and (
                self.out_of_sample_metrics.sortino is None
                or self.out_of_sample_metrics.sortino < self.min_sortino
            ):
                raise ValueError("accepted stock-rule candidates must satisfy the OOS Sortino gate")
            if "beats_oos_benchmark" not in self.reason_codes:
                raise ValueError("accepted stock-rule candidates must include beats_oos_benchmark reason")
        return self


class StockAdmissionArtifact(_FrozenStockModel):
    """Deterministic JSON artifact for stock-rule admission audit."""

    schema_version: Literal["1.0.0"] = "1.0.0"
    window: StockAdmissionWindow
    benchmark_persona: Annotated[str, Field(min_length=1)]
    decisions: tuple[StockAdmissionDecision, ...]
    methodology: tuple[str, ...] = (
        "search_is discovers candidates using only the in-sample ranking window",
        "validation replay promotes only rules that beat the configured benchmark gate",
    )

    @property
    def accepted_decisions(self) -> tuple[StockAdmissionDecision, ...]:
        return tuple(decision for decision in self.decisions if decision.accepted)

    @model_validator(mode="after")
    def _check_artifact_consistency(self) -> StockAdmissionArtifact:
        rule_ids = [decision.candidate.rule_id for decision in self.decisions]
        if len(set(rule_ids)) != len(rule_ids):
            raise ValueError(f"Stock admission artifact rule_id values must be unique; got {rule_ids}")
        for decision in self.decisions:
            if decision.candidate.window != self.window:
                raise ValueError(
                    "Every stock admission decision must use the artifact IS/OOS window; "
                    f"rule_id={decision.candidate.rule_id} has {decision.candidate.window}"
                )
        return self
