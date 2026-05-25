"""Single source of truth for the account simulation.

Every contract that crosses a module boundary in :mod:`snusmic_pipeline.sim`
is a frozen Pydantic v2 model with ``extra='forbid'``. This guarantees:

* missing or extra fields raise immediately at the boundary,
* a config hashed with ``model_dump_json(sort_keys=True)`` is reproducible,
* downstream consumers (engine, viz, JSON export) never disagree on shape.

The runner reads ``SimulationConfig`` and never relies on globals; to add a
new knob, extend the relevant config model. See ``docs/backtest-contract.md``
for the methodology.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ---------------------------------------------------------------------------
# Frozen-config base.
# ``frozen=True``  → immutable after construction (run-id stability).
# ``extra='forbid'`` → unknown keys raise (SSOT enforcement).
# ``validate_assignment=True`` → catches mutation attempts.
# ---------------------------------------------------------------------------


class _FrozenModel(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", validate_assignment=True)


# ---------------------------------------------------------------------------
# Money / fee primitives.
# ---------------------------------------------------------------------------


class SavingsPlan(_FrozenModel):
    """User's savings ladder.

    The plan starts with ``initial_capital_krw`` on day 0, then deposits
    ``monthly_contribution_krw`` on the first trading day of every later
    month. The contribution steps up by ``escalation_step_krw`` every
    ``escalation_period_years`` years (so ``2y → +500k`` makes month-25's
    deposit 1.5M, month-49's deposit 2.0M, etc.). Idle cash is modeled
    as RP이자 accruing ``cash_yield_annual_rate`` daily."""

    initial_capital_krw: Annotated[float, Field(ge=0)] = 10_000_000.0
    monthly_contribution_krw: Annotated[float, Field(ge=0)] = 1_000_000.0
    escalation_step_krw: Annotated[float, Field(ge=0)] = 500_000.0
    escalation_period_years: Annotated[int, Field(ge=1, le=10)] = 2
    max_escalations: Annotated[int, Field(ge=0, le=20)] = 10
    cash_yield_annual_rate: Annotated[float, Field(ge=0.0, le=0.20)] = 0.025


class BrokerageFees(_FrozenModel):
    """Korean retail brokerage costs, in basis points (bps = 1/10000)."""

    commission_bps: Annotated[float, Field(ge=0, le=200)] = 1.5
    sell_tax_bps: Annotated[float, Field(ge=0, le=200)] = 18.0
    slippage_bps: Annotated[float, Field(ge=0, le=200)] = 5.0


# ---------------------------------------------------------------------------
# Benchmark (all-weather) asset spec.
# ---------------------------------------------------------------------------


class BenchmarkAsset(_FrozenModel):
    """One slot of the all-weather basket.

    ``symbol`` is a yfinance ticker (``GLD``, ``QQQ``, ``SPY``, ``069500.KS``).
    ``weight`` must be in (0, 1] and the sum across all assets in an
    :class:`AllWeatherConfig` must equal 1.0 within 1e-6 (validated below).
    """

    name: str
    symbol: str
    weight: Annotated[float, Field(gt=0.0, le=1.0)]


class AllWeatherConfig(_FrozenModel):
    """Buy-and-hold benchmark basket with monthly rebalance."""

    account_id: Annotated[str, Field(pattern=r"^(all_weather|benchmark_[a-z0-9_]+)$")] = "all_weather"
    contribution_timing: Literal["first", "middle", "last"] = "first"
    label: str = "올웨더 (25/25/25/25)"
    assets: tuple[BenchmarkAsset, ...] = (
        BenchmarkAsset(name="Gold", symbol="GLD", weight=0.25),
        BenchmarkAsset(name="NASDAQ-100", symbol="QQQ", weight=0.25),
        BenchmarkAsset(name="S&P 500", symbol="SPY", weight=0.25),
        BenchmarkAsset(name="KOSPI 200", symbol="069500.KS", weight=0.25),
    )
    rebalance: Literal["monthly", "quarterly", "yearly"] = "monthly"

    @model_validator(mode="after")
    def _check_weights(self) -> AllWeatherConfig:
        total = sum(asset.weight for asset in self.assets)
        if abs(total - 1.0) > 1e-6:
            raise ValueError(f"AllWeather weights must sum to 1.0; got {total:.6f}")
        if len({a.symbol for a in self.assets}) != len(self.assets):
            raise ValueError("AllWeather asset symbols must be unique")
        return self


# ---------------------------------------------------------------------------
# Account configs. Each carries its own knobs; a discriminator union via
# ``account_id`` lets the runner dispatch without isinstance().
# ---------------------------------------------------------------------------


class _AccountBase(_FrozenModel):
    label: str  # human-readable label for legends / tables
    fees: BrokerageFees | None = None
    contribution_timing: Literal["first", "middle", "last"] = "first"


class ProphetConfig(_AccountBase):
    """SMIC-constrained prophet — knows which reports will hit target.

    Trade-off framing: free-form 'pick top-K future winners' compounds
    too fast (reaches absurd 10^15-KRW final balances by month 60).
    This prophet keeps the upper-bound spirit but constrains the
    selection universe to **published SMIC reports**, which is exactly
    the domain question the simulator is designed for: *"if you used
    only SMIC research but knew in advance which reports would actually
    hit their target, how would you have done?"*

    Algorithm at each rebalance day ``t``:

    1. Take every SMIC report published on or before ``t`` whose
       target has not yet been reached by ``t``.
    2. Keep only the reports whose price will hit
       ``target × target_hit_multiplier`` *within the next*
       ``lookahead_months``.
    3. Equal-weight that basket. If empty → sit in cash.

    Naturally bounded sizing — the basket is at most ~the count of
    open SMIC reports active in the window, weights are 1/N each, so
    the prophet's deployable AUM tracks the universe's market depth.
    """

    account_id: Literal["oracle"] = "oracle"
    label: str = "Prophet"
    lookahead_months: Annotated[int, Field(ge=1, le=24)] = 6
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0
    rebalance: Literal["monthly", "quarterly"] = "monthly"


class WeakProphetConfig(_AccountBase):
    """Forward-looking max-Sharpe oracle benchmark.

    It is deliberately stronger than realistic strategies: the benchmark can
    see a future return window and concentrate in the names that the optimizer
    prefers. The web catalog marks it as ``oracle`` so it is never presented as
    a tradable account.
    """

    account_id: Literal["weak_oracle"] = "weak_oracle"
    label: str = "미래정보 상한선 (3개월)"
    lookahead_months: Annotated[int, Field(ge=1, le=24)] = 3
    risk_free_rate: Annotated[float, Field(ge=0.0, le=0.20)] = 0.0
    max_weight: Annotated[float, Field(gt=0.0, le=1.0)] = 1.0
    rebalance: Literal["monthly", "quarterly"] = "monthly"
    min_history_days: Annotated[int, Field(ge=20, le=252)] = 20


class SmicFollowerConfig(_AccountBase):
    """Pure 1/N true-believer: never sells at a loss."""

    account_id: Literal["smic_follower"] = "smic_follower"
    label: str = "단순 리포트 추종"
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0
    # SMIC reports drop on irregular dates, so the realistic baseline is to
    # rebalance on every trading day — react when a new report arrives or a
    # symbol's weight drifts. Use "monthly"/"quarterly" only when modelling a
    # passive holder.
    rebalance: Literal["daily", "monthly", "quarterly"] = "daily"


class SmicFollowerV2Config(_AccountBase):
    """1/N follower with three stop-loss escape hatches."""

    account_id: Literal["smic_follower_v2"] = "smic_follower_v2"
    label: str = "손절 리포트 추종"
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0
    rebalance: Literal["daily", "monthly", "quarterly"] = "daily"

    # Stop-loss rule (a): held this many days AND still at unrealized loss.
    time_loss_days: Annotated[int, Field(ge=30, le=2000)] = 365

    # Stop-loss rule (b): an averaged-down position with unrealized return below this.
    averaged_down_stop_pct: Annotated[float, Field(gt=0.0, lt=1.0)] = 0.20

    # Stop-loss rule (c): days past report publication after which we give up.
    report_age_stop_days: Annotated[int, Field(ge=30, le=3650)] = 730


class PitScoreTopNConfig(_AccountBase):
    """Equal-weight PIT board score portfolio.

    The account re-ranks the report universe on each rebalance date using only
    values observable as of that date, then holds the top ``top_n`` names.
    """

    account_id: Literal["pit_score_top3", "pit_score_top5", "pit_score_top10"] = "pit_score_top5"
    label: str = "PIT 점수 Top 5"
    top_n: Literal[3, 5, 10] = 5
    rebalance: Literal["monthly", "quarterly"] = "monthly"
    max_report_age_days: Annotated[int, Field(ge=30, le=3650)] = 730
    universe: Literal["all", "domestic", "overseas"] = "all"

    @model_validator(mode="after")
    def _check_account_id_matches_top_n(self) -> PitScoreTopNConfig:
        expected = f"pit_score_top{self.top_n}"
        if self.account_id != expected:
            raise ValueError(f"account_id {self.account_id!r} must match top_n={self.top_n}: {expected!r}")
        return self


class PitSignalRuleConfig(_AccountBase):
    """Equal-weight PIT board strategy with explicit rank and admission rules."""

    account_id: Literal[
        "pit_momentum_top5",
        "pit_trend_top5",
        "pit_fresh_top5",
        "pit_trend_top7",
        "pit_trend_stop_top5",
        "pit_trend_stop_top7",
        "pit_trend_rotate_top5",
        "pit_trend_rotate_fast_top5",
        "pit_trend_rotate_stop_top5",
        "pit_trend_persist20_top5",
        "pit_trend_persist30_top5",
        "pit_trend_persist20_hold90_top5",
        "pit_trend_persist20_top3",
        "pit_trend_persist20_top7",
        "pit_trend_persist20_52w10_top5",
        "pit_trend_persist20_domestic_top5",
        "pit_trend_persist20_score_top5",
        "pit_trend_persist20_scorecap_top5",
        "pit_trend_persist20_invvol_top5",
        "pit_trend_persist20_invvolcap_top5",
        "pit_trend_persist20_semimonthly_top5",
        "pit_trend_persist20_quarterly_top5",
        "pit_trend_persist30_quarterly_top5",
        "pit_trend_persist20_quarterly_risk_top5",
        "pit_trend_persist30_quarterly_risk_top5",
        "pit_trend_persist20_quarterly_hold120_top5",
        "pit_trend_quarterly_ret3_top5",
        "pit_trend_quarterly_ret6_top5",
        "pit_trend_quarterly_ret36_top5",
        "pit_trend_quarterly_fresh365_top5",
        "pit_trend_quarterly_fresh540_top5",
        "pit_trend_persist20_fresh540_top5",
        "pit_trend_persist20_fresh540_top3",
        "pit_trend_persist20_fresh540_top7",
        "pit_trend_quarterly_fresh540_top3",
        "pit_trend_quarterly_fresh540_top7",
        "pit_trend_quarterly_fresh540_gross_top5",
        "pit_trend_quarterly_fresh540_slip25_top5",
        "pit_trend_quarterly_fresh540_slip50_top5",
        "pit_trend_quarterly_fresh540_feb_top5",
        "pit_trend_quarterly_fresh540_mar_top5",
        "pit_trend_quarterly_fresh540_cash90_top5",
        "pit_trend_quarterly_fresh540_cash80_top5",
        "pit_trend_quarterly_fresh540_vol35_top5",
        "pit_trend_quarterly_fresh540_vol40_top5",
        "pit_trend_quarterly_fresh540_vol45_top5",
        "pit_trend_quarterly_fresh540_vol50_top5",
        "pit_trend_quarterly_fresh540_vol55_top5",
        "pit_trend_quarterly_fresh540_mar_vol45_top5",
        "pit_trend_quarterly_fresh540_entry270_top5",
        "pit_trend_quarterly_fresh540_entry270_vol50_top5",
        "pit_trend_quarterly_fresh540_entry270_mar_top5",
        "pit_trend_quarterly_fresh540_entry365_top5",
        "pit_trend_quarterly_fresh540_entry450_top5",
        "pit_trend_quarterly_fresh540_entry365_vol50_top5",
        "pit_trend_quarterly_fresh540_rank15_top5",
        "pit_trend_quarterly_fresh540_rank25_top5",
        "pit_trend_quarterly_fresh540_runwinners_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_top5",
        "pit_trend_quarterly_fresh540_runwinners_top3",
        "pit_trend_quarterly_fresh540_runwinners_top7",
        "pit_trend_quarterly_fresh540_runwinners_feb_top5",
        "pit_trend_quarterly_fresh540_runwinners_mar_top5",
        "pit_trend_quarterly_fresh540_runwinners_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_cap40_top5",
        "pit_trend_quarterly_fresh540_runwinners_cap35_top5",
        "pit_trend_quarterly_fresh540_runwinners_soft45_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_dualrank_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_mixedentry_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm5_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_ret3m20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_high10_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail35_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim35_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol45_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol55_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank15_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank30_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_cool20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap15_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap18_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap22_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploy_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash15_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim120dd25cap20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim150dd25cap20_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap30_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20cap25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim30cap25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap35_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_midcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_lastcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit70_mixedentry_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit75_top5",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5",
        "pit_trend_quarterly_fresh540_confirm5_top5",
        "pit_trend_quarterly_fresh540_confirm10_top5",
        "pit_trend_quarterly_fresh540_confirm10_vol50_top5",
        "pit_trend_persist20_kodex50_top5",
        "pit_trend_persist20_kodex200_top5",
    ]
    label: str
    top_n: Annotated[int, Field(ge=1, le=20)] = 5
    rebalance: Literal["monthly", "semimonthly", "quarterly"] = "monthly"
    max_report_age_days: Annotated[int, Field(ge=30, le=3650)] = 730
    min_report_age_days: Annotated[int, Field(ge=0, le=3650)] = 0
    universe: Literal["all", "domestic", "overseas"] = "all"
    score_field: Literal["board_score", "candidate_score", "ta_momentum_score"] = "board_score"
    entry_score_field: Literal["board_score", "candidate_score", "ta_momentum_score"] | None = None
    retention_score_field: Literal["board_score", "candidate_score", "ta_momentum_score"] | None = None
    rank_mode: Literal["score", "dual_rank"] = "score"
    require_above_200ma: bool = False
    require_ma_stack: bool = False
    require_macd_bullish: bool = False
    min_return_3m: float | None = None
    min_return_6m: float | None = None
    min_distance_from_52w_high: float | None = None
    exit_below_50ma: bool = False
    stop_loss_pct: Annotated[float, Field(gt=0, lt=1)] | None = None
    rotate_on_exit: bool = False
    rank_exit_threshold: Annotated[int, Field(ge=1, le=100)] | None = None
    min_holding_days: Annotated[int, Field(ge=0, le=3650)] = 0
    weighting: Literal["equal", "score", "inverse_volatility"] = "equal"
    max_weight: Annotated[float, Field(gt=0.0, le=1.0)] | None = None
    volatility_lookback_days: Annotated[int, Field(ge=20, le=730)] = 180
    market_gate: Literal["none", "above_50ma", "above_200ma"] = "none"
    market_gate_symbol: str = "069500.KS"
    quarter_offset_months: Literal[0, 1, 2] = 0
    target_gross_exposure: Annotated[float, Field(gt=0.0, le=1.0)] = 1.0
    volatility_target_annual: Annotated[float, Field(gt=0.0, le=2.0)] | None = None
    entry_max_report_age_days: Annotated[int, Field(ge=30, le=3650)] | None = None
    entry_confirmation_rebalances: Annotated[int, Field(ge=1, le=4)] = 1
    entry_confirmation_rank: Annotated[int, Field(ge=1, le=100)] | None = None
    replacement_delay_rebalances: Literal[0, 1] = 0
    allow_rebalance_sell_down: bool = True
    retained_weight_cap: Annotated[float, Field(gt=0.0, le=1.0)] | None = None
    retained_weight_cap_trigger: Annotated[float, Field(gt=0.0, le=1.0)] | None = None
    retained_weight_cap_cadence: Literal["rebalance", "weekly", "daily"] = "rebalance"
    retained_weight_cap_min_unrealized_return: Annotated[float, Field(ge=0.0, le=10.0)] | None = None
    trail_stop_min_unrealized_return: Annotated[float, Field(ge=0.0, le=10.0)] | None = None
    trail_stop_drawdown_pct: Annotated[float, Field(gt=0.0, lt=1.0)] | None = None
    trail_trim_min_unrealized_return: Annotated[float, Field(ge=0.0, le=10.0)] | None = None
    trail_trim_drawdown_pct: Annotated[float, Field(gt=0.0, lt=1.0)] | None = None
    trail_trim_weight_cap: Annotated[float, Field(gt=0.0, le=1.0)] | None = None
    trail_trim_cooldown_days: Annotated[int, Field(ge=0, le=252)] = 0
    redeploy_after_trailing_trim: bool = False
    redeploy_after_trailing_trim_min_cash_pct: Annotated[float, Field(gt=0.0, le=1.0)] | None = None
    redeploy_after_trailing_trim_buy_fraction: Annotated[float, Field(gt=0.0, le=1.0)] = 1.0

    @model_validator(mode="after")
    def _check_age_window(self) -> PitSignalRuleConfig:
        if self.min_report_age_days > self.max_report_age_days:
            raise ValueError(
                f"min_report_age_days {self.min_report_age_days} must be <= "
                f"max_report_age_days {self.max_report_age_days}"
            )
        if self.rank_exit_threshold is not None and self.rank_exit_threshold < self.top_n:
            raise ValueError(f"rank_exit_threshold {self.rank_exit_threshold} must be >= top_n {self.top_n}")
        if self.max_weight is not None and self.max_weight < 1.0 / self.top_n:
            raise ValueError(f"max_weight {self.max_weight} must be >= 1/top_n for top_n {self.top_n}")
        if self.quarter_offset_months != 0 and self.rebalance != "quarterly":
            raise ValueError("quarter_offset_months can only be used with quarterly rebalance")
        if self.entry_confirmation_rank is not None and self.entry_confirmation_rank < self.top_n:
            raise ValueError(
                f"entry_confirmation_rank {self.entry_confirmation_rank} must be >= top_n {self.top_n}"
            )
        if (
            self.entry_max_report_age_days is not None
            and self.entry_max_report_age_days > self.max_report_age_days
        ):
            raise ValueError(
                f"entry_max_report_age_days {self.entry_max_report_age_days} must be <= "
                f"max_report_age_days {self.max_report_age_days}"
            )
        if self.retained_weight_cap is not None and self.retained_weight_cap < 1.0 / self.top_n:
            raise ValueError(
                f"retained_weight_cap {self.retained_weight_cap} must be >= 1/top_n for top_n {self.top_n}"
            )
        if self.retained_weight_cap_trigger is not None:
            if self.retained_weight_cap is None:
                raise ValueError("retained_weight_cap_trigger requires retained_weight_cap")
            if self.retained_weight_cap_trigger < self.retained_weight_cap:
                raise ValueError(
                    "retained_weight_cap_trigger must be >= retained_weight_cap "
                    f"({self.retained_weight_cap_trigger} < {self.retained_weight_cap})"
                )
        if self.retained_weight_cap_cadence != "rebalance" and self.retained_weight_cap is None:
            raise ValueError("retained_weight_cap_cadence requires retained_weight_cap")
        if self.retained_weight_cap_min_unrealized_return is not None and self.retained_weight_cap is None:
            raise ValueError("retained_weight_cap_min_unrealized_return requires retained_weight_cap")
        if (self.trail_stop_min_unrealized_return is None) != (self.trail_stop_drawdown_pct is None):
            raise ValueError(
                "trail_stop_min_unrealized_return and trail_stop_drawdown_pct must be set together"
            )
        trim_values = (
            self.trail_trim_min_unrealized_return,
            self.trail_trim_drawdown_pct,
            self.trail_trim_weight_cap,
        )
        if any(value is None for value in trim_values) and any(value is not None for value in trim_values):
            raise ValueError(
                "trail_trim_min_unrealized_return, trail_trim_drawdown_pct, "
                "and trail_trim_weight_cap must be set together"
            )
        if self.trail_trim_cooldown_days > 0 and self.trail_trim_min_unrealized_return is None:
            raise ValueError("trail_trim_cooldown_days requires trailing profit trim settings")
        if self.redeploy_after_trailing_trim and self.trail_trim_min_unrealized_return is None:
            raise ValueError("redeploy_after_trailing_trim requires trailing profit trim settings")
        if (
            self.redeploy_after_trailing_trim_min_cash_pct is not None
            and not self.redeploy_after_trailing_trim
        ):
            raise ValueError(
                "redeploy_after_trailing_trim_min_cash_pct requires redeploy_after_trailing_trim"
            )
        if self.redeploy_after_trailing_trim_buy_fraction < 1.0 and not self.redeploy_after_trailing_trim:
            raise ValueError(
                "redeploy_after_trailing_trim_buy_fraction below 1 requires redeploy_after_trailing_trim"
            )
        return self


AccountConfig = (
    ProphetConfig
    | WeakProphetConfig
    | SmicFollowerConfig
    | SmicFollowerV2Config
    | PitScoreTopNConfig
    | PitSignalRuleConfig
    | AllWeatherConfig
)

AccountId = Literal[
    "oracle",
    "weak_oracle",
    "smic_follower",
    "smic_follower_v2",
    "pit_score_top3",
    "pit_score_top5",
    "pit_score_top10",
    "pit_momentum_top5",
    "pit_trend_top5",
    "pit_fresh_top5",
    "pit_trend_top7",
    "pit_trend_stop_top5",
    "pit_trend_stop_top7",
    "pit_trend_rotate_top5",
    "pit_trend_rotate_fast_top5",
    "pit_trend_rotate_stop_top5",
    "pit_trend_persist20_top5",
    "pit_trend_persist30_top5",
    "pit_trend_persist20_hold90_top5",
    "pit_trend_persist20_top3",
    "pit_trend_persist20_top7",
    "pit_trend_persist20_52w10_top5",
    "pit_trend_persist20_domestic_top5",
    "pit_trend_persist20_score_top5",
    "pit_trend_persist20_scorecap_top5",
    "pit_trend_persist20_invvol_top5",
    "pit_trend_persist20_invvolcap_top5",
    "pit_trend_persist20_semimonthly_top5",
    "pit_trend_persist20_quarterly_top5",
    "pit_trend_persist30_quarterly_top5",
    "pit_trend_persist20_quarterly_risk_top5",
    "pit_trend_persist30_quarterly_risk_top5",
    "pit_trend_persist20_quarterly_hold120_top5",
    "pit_trend_quarterly_ret3_top5",
    "pit_trend_quarterly_ret6_top5",
    "pit_trend_quarterly_ret36_top5",
    "pit_trend_quarterly_fresh365_top5",
    "pit_trend_quarterly_fresh540_top5",
    "pit_trend_persist20_fresh540_top5",
    "pit_trend_persist20_fresh540_top3",
    "pit_trend_persist20_fresh540_top7",
    "pit_trend_quarterly_fresh540_top3",
    "pit_trend_quarterly_fresh540_top7",
    "pit_trend_quarterly_fresh540_gross_top5",
    "pit_trend_quarterly_fresh540_slip25_top5",
    "pit_trend_quarterly_fresh540_slip50_top5",
    "pit_trend_quarterly_fresh540_feb_top5",
    "pit_trend_quarterly_fresh540_mar_top5",
    "pit_trend_quarterly_fresh540_cash90_top5",
    "pit_trend_quarterly_fresh540_cash80_top5",
    "pit_trend_quarterly_fresh540_vol35_top5",
    "pit_trend_quarterly_fresh540_vol40_top5",
    "pit_trend_quarterly_fresh540_vol45_top5",
    "pit_trend_quarterly_fresh540_vol50_top5",
    "pit_trend_quarterly_fresh540_vol55_top5",
    "pit_trend_quarterly_fresh540_mar_vol45_top5",
    "pit_trend_quarterly_fresh540_entry270_top5",
    "pit_trend_quarterly_fresh540_entry270_vol50_top5",
    "pit_trend_quarterly_fresh540_entry270_mar_top5",
    "pit_trend_quarterly_fresh540_entry365_top5",
    "pit_trend_quarterly_fresh540_entry450_top5",
    "pit_trend_quarterly_fresh540_entry365_vol50_top5",
    "pit_trend_quarterly_fresh540_rank15_top5",
    "pit_trend_quarterly_fresh540_rank25_top5",
    "pit_trend_quarterly_fresh540_runwinners_top5",
    "pit_trend_quarterly_fresh540_runwinners_vol50_top5",
    "pit_trend_quarterly_fresh540_runwinners_top3",
    "pit_trend_quarterly_fresh540_runwinners_top7",
    "pit_trend_quarterly_fresh540_runwinners_feb_top5",
    "pit_trend_quarterly_fresh540_runwinners_mar_top5",
    "pit_trend_quarterly_fresh540_runwinners_slip25_top5",
    "pit_trend_quarterly_fresh540_runwinners_slip50_top5",
    "pit_trend_quarterly_fresh540_runwinners_cap40_top5",
    "pit_trend_quarterly_fresh540_runwinners_cap35_top5",
    "pit_trend_quarterly_fresh540_runwinners_soft45_top5",
    "pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5",
    "pit_trend_quarterly_fresh540_runwinners_dailycap45_top5",
    "pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_dualrank_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_mixedentry_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm5_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_ret3m20_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_high10_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail35_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim35_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol45_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol55_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank15_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank30_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_cool20_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap15_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap18_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap22_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploy_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash15_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim120dd25cap20_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim150dd25cap20_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap30_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20cap25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim30cap25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap35_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_midcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_lastcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit70_mixedentry_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top3",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top7",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit75_top5",
    "pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5",
    "pit_trend_quarterly_fresh540_confirm5_top5",
    "pit_trend_quarterly_fresh540_confirm10_top5",
    "pit_trend_quarterly_fresh540_confirm10_vol50_top5",
    "pit_trend_persist20_kodex50_top5",
    "pit_trend_persist20_kodex200_top5",
    "all_weather",
    "benchmark_qqq",
    "benchmark_spy",
    "benchmark_kodex200",
    "benchmark_gld",
]


# ---------------------------------------------------------------------------
# Root simulation config.
# ---------------------------------------------------------------------------


class SimulationConfig(_FrozenModel):
    """Root config consumed by :func:`snusmic_pipeline.sim.runner.run_simulation`."""

    start_date: date
    end_date: date
    savings_plan: SavingsPlan = SavingsPlan()
    fees: BrokerageFees = BrokerageFees()
    accounts: tuple[AccountConfig, ...] = (
        AllWeatherConfig(),
        AllWeatherConfig(
            account_id="benchmark_qqq",
            label="QQQ (NASDAQ-100)",
            assets=(BenchmarkAsset(name="NASDAQ-100", symbol="QQQ", weight=1.0),),
        ),
        AllWeatherConfig(
            account_id="benchmark_spy",
            label="SPY (S&P 500)",
            assets=(BenchmarkAsset(name="S&P 500", symbol="SPY", weight=1.0),),
        ),
        AllWeatherConfig(
            account_id="benchmark_kodex200",
            label="KODEX 200 (069500.KS)",
            assets=(BenchmarkAsset(name="KODEX 200", symbol="069500.KS", weight=1.0),),
        ),
        AllWeatherConfig(
            account_id="benchmark_gld",
            label="GLD (Gold ETF)",
            assets=(BenchmarkAsset(name="Gold", symbol="GLD", weight=1.0),),
        ),
        SmicFollowerConfig(),
        SmicFollowerV2Config(label="손절 리포트 추종"),
        PitScoreTopNConfig(account_id="pit_score_top3", label="PIT 점수 Top 3", top_n=3),
        PitScoreTopNConfig(account_id="pit_score_top5", label="PIT 점수 Top 5", top_n=5),
        PitScoreTopNConfig(account_id="pit_score_top10", label="PIT 점수 Top 10", top_n=10),
        PitSignalRuleConfig(
            account_id="pit_momentum_top5",
            label="PIT 모멘텀 Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_3m=0.0,
            min_return_6m=0.0,
            min_distance_from_52w_high=-0.25,
            require_above_200ma=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_top5",
            label="PIT 추세 Top 5",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
        ),
        PitSignalRuleConfig(
            account_id="pit_fresh_top5",
            label="PIT 최근 리포트 Top 5",
            score_field="board_score",
            top_n=5,
            max_report_age_days=365,
            min_return_3m=0.0,
            require_above_200ma=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_top7",
            label="PIT 추세 Top 7",
            score_field="board_score",
            top_n=7,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_stop_top5",
            label="PIT 추세 손절 Top 5",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            exit_below_50ma=True,
            stop_loss_pct=0.12,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_stop_top7",
            label="PIT 추세 손절 Top 7",
            score_field="board_score",
            top_n=7,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            exit_below_50ma=True,
            stop_loss_pct=0.12,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_rotate_top5",
            label="PIT 추세 회전 Top 5",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            exit_below_50ma=True,
            rotate_on_exit=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_rotate_fast_top5",
            label="PIT 추세 월2회 회전 Top 5",
            score_field="board_score",
            top_n=5,
            rebalance="semimonthly",
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            exit_below_50ma=True,
            rotate_on_exit=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_rotate_stop_top5",
            label="PIT 추세 손절회전 Top 5",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            exit_below_50ma=True,
            stop_loss_pct=0.12,
            rotate_on_exit=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_top5",
            label="PIT Trend Persist Top 20 Band",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist30_top5",
            label="PIT Trend Persist Top 30 Band",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=30,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_hold90_top5",
            label="PIT Trend Persist Top 20 Hold 90",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=90,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_top3",
            label="PIT Trend Persist Top 20 Band Top 3",
            score_field="board_score",
            top_n=3,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_top7",
            label="PIT Trend Persist Top 20 Band Top 7",
            score_field="board_score",
            top_n=7,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_52w10_top5",
            label="PIT Trend Persist Top 20 Near High",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.10,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_domestic_top5",
            label="PIT Trend Persist Top 20 Domestic",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            universe="domestic",
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_score_top5",
            label="PIT Trend Persist Score Weight",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            weighting="score",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_scorecap_top5",
            label="PIT Trend Persist Score Cap",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            weighting="score",
            max_weight=0.30,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_invvol_top5",
            label="PIT Trend Persist Inverse Vol",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            weighting="inverse_volatility",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_invvolcap_top5",
            label="PIT Trend Persist Inverse Vol Cap",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            weighting="inverse_volatility",
            max_weight=0.30,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_semimonthly_top5",
            label="PIT Trend Persist Twice Monthly",
            score_field="board_score",
            top_n=5,
            rebalance="semimonthly",
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_quarterly_top5",
            label="PIT Trend Persist Quarterly",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist30_quarterly_top5",
            label="PIT Trend Persist Quarterly Top 30 Band",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=30,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_quarterly_risk_top5",
            label="PIT Trend Persist Quarterly 50MA Risk Review",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            exit_below_50ma=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist30_quarterly_risk_top5",
            label="PIT Trend Persist Quarterly Top 30 50MA Risk Review",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=30,
            min_holding_days=60,
            exit_below_50ma=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_quarterly_hold120_top5",
            label="PIT Trend Persist Quarterly Hold 120",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=120,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_ret3_top5",
            label="PIT Trend Quarterly 3M Return Gate",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            min_return_3m=0.0,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_ret6_top5",
            label="PIT Trend Quarterly 6M Return Gate",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            min_return_6m=0.0,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_ret36_top5",
            label="PIT Trend Quarterly 3M+6M Return Gate",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            min_return_3m=0.0,
            min_return_6m=0.0,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh365_top5",
            label="PIT Trend Quarterly Fresh 365",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=365,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_top5",
            label="PIT Trend Quarterly Fresh 540",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_fresh540_top5",
            label="PIT Trend Persist Fresh 540",
            score_field="board_score",
            top_n=5,
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_fresh540_top3",
            label="PIT Trend Persist Fresh 540 Top 3",
            score_field="board_score",
            top_n=3,
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_fresh540_top7",
            label="PIT Trend Persist Fresh 540 Top 7",
            score_field="board_score",
            top_n=7,
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_top3",
            label="PIT Trend Quarterly Fresh 540 Top 3",
            score_field="board_score",
            top_n=3,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_top7",
            label="PIT Trend Quarterly Fresh 540 Top 7",
            score_field="board_score",
            top_n=7,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_gross_top5",
            label="PIT Trend Quarterly Fresh 540 Gross",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            fees=BrokerageFees(commission_bps=0.0, sell_tax_bps=0.0, slippage_bps=0.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_slip25_top5",
            label="PIT Trend Quarterly Fresh 540 Slip 25",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=25.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_slip50_top5",
            label="PIT Trend Quarterly Fresh 540 Slip 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=50.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_feb_top5",
            label="PIT Trend Quarterly Fresh 540 Feb Cycle",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            quarter_offset_months=1,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_mar_top5",
            label="PIT Trend Quarterly Fresh 540 Mar Cycle",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            quarter_offset_months=2,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_cash90_top5",
            label="PIT Trend Quarterly Fresh 540 Cash 10",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            target_gross_exposure=0.90,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_cash80_top5",
            label="PIT Trend Quarterly Fresh 540 Cash 20",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            target_gross_exposure=0.80,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_vol35_top5",
            label="PIT Trend Quarterly Fresh 540 Vol 35",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.35,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_vol40_top5",
            label="PIT Trend Quarterly Fresh 540 Vol 40",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.40,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_vol45_top5",
            label="PIT Trend Quarterly Fresh 540 Vol 45",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.45,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_vol50_top5",
            label="PIT Trend Quarterly Fresh 540 Vol 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.50,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_vol55_top5",
            label="PIT Trend Quarterly Fresh 540 Vol 55",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.55,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_mar_vol45_top5",
            label="PIT Trend Quarterly Fresh 540 Mar Cycle Vol 45",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            quarter_offset_months=2,
            volatility_target_annual=0.45,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_entry270_top5",
            label="PIT Trend Quarterly Fresh 540 Entry 270",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            entry_max_report_age_days=270,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_entry270_vol50_top5",
            label="PIT Trend Quarterly Fresh 540 Entry 270 Vol 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            entry_max_report_age_days=270,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.50,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_entry270_mar_top5",
            label="PIT Trend Quarterly Fresh 540 Entry 270 Mar Cycle",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            entry_max_report_age_days=270,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            quarter_offset_months=2,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_entry365_top5",
            label="PIT Trend Quarterly Fresh 540 Entry 365",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            entry_max_report_age_days=365,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_entry450_top5",
            label="PIT Trend Quarterly Fresh 540 Entry 450",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            entry_max_report_age_days=450,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_entry365_vol50_top5",
            label="PIT Trend Quarterly Fresh 540 Entry 365 Vol 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            entry_max_report_age_days=365,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.50,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_rank15_top5",
            label="PIT Trend Quarterly Fresh 540 Rank 15",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=15,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_rank25_top5",
            label="PIT Trend Quarterly Fresh 540 Rank 25",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=25,
            min_holding_days=60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_vol50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Vol 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.50,
            allow_rebalance_sell_down=False,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_top3",
            label="PIT Trend Quarterly Fresh 540 Run Winners Top 3",
            score_field="board_score",
            top_n=3,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_top7",
            label="PIT Trend Quarterly Fresh 540 Run Winners Top 7",
            score_field="board_score",
            top_n=7,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_feb_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Feb",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            quarter_offset_months=1,
            allow_rebalance_sell_down=False,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_mar_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Mar",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            quarter_offset_months=2,
            allow_rebalance_sell_down=False,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_slip25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Slip 25",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=25.0),
            allow_rebalance_sell_down=False,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_slip50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Slip 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=50.0),
            allow_rebalance_sell_down=False,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_cap40_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Cap 40",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_cap35_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Cap 35",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.35,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_soft45_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Soft 45",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Vol 50 Cap 40",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.50,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_dailycap45_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Daily 45 Cap",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="daily",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Vol 50 Weekly 45 Cap",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.50,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 50 Cap",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.50,
            retained_weight_cap_cadence="weekly",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 10",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.10,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 25",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 40",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.40,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.50,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 50 Slip 25",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.50,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=25.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_slip50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 50 Slip 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.50,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=50.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Candidate Score",
            score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_dualrank_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Candidate Dual Rank",
            score_field="candidate_score",
            rank_mode="dual_rank",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit50_mixedentry_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 50 Mixed Entry",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.50,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_delay1_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Delay 1",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            replacement_delay_rebalances=1,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm5_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Confirm 5",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            entry_confirmation_rebalances=2,
            entry_confirmation_rank=5,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_confirm10_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Confirm 10",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            entry_confirmation_rebalances=2,
            entry_confirmation_rank=10,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_ret3m20_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry 3M 20",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_return_3m=0.20,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_high10_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry High 10",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.10,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail 25",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_stop_min_unrealized_return=1.00,
            trail_stop_drawdown_pct=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trail35_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail 35",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_stop_min_unrealized_return=1.00,
            trail_stop_drawdown_pct=0.35,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.30,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim35_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 35",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.35,
            trail_trim_weight_cap=0.30,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 20",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.20,
            trail_trim_weight_cap=0.30,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol45_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Vol 45",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
            volatility_target_annual=0.45,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Vol 50",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
            volatility_target_annual=0.50,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_vol55_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Vol 55",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
            volatility_target_annual=0.55,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank15_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Rank 15",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=15,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Rank 25",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=25,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_rank30_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Rank 30",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=30,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_cool20_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Cool 20",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
            trail_trim_cooldown_days=20,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap15_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 15",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.15,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap18_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 18",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.18,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 20",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap22_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 22",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.22,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploy_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 20 Redeploy",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
            redeploy_after_trailing_trim=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 20 Redeploy Cash 12.5",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
            redeploy_after_trailing_trim=True,
            redeploy_after_trailing_trim_min_cash_pct=0.125,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 20 Redeploy Cash 12.5 Partial 75",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
            redeploy_after_trailing_trim=True,
            redeploy_after_trailing_trim_min_cash_pct=0.125,
            redeploy_after_trailing_trim_buy_fraction=0.75,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash15_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 20 Redeploy Cash 15",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
            redeploy_after_trailing_trim=True,
            redeploy_after_trailing_trim_min_cash_pct=0.15,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim120dd25cap20_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim Profit 120 Drawdown 25 Cap 20",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.20,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim150dd25cap20_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim Profit 150 Drawdown 25 Cap 20",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.50,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap30_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 30",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.30,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim20cap25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 20 Cap 25",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.20,
            trail_trim_weight_cap=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim30cap25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 30 Cap 25",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.30,
            trail_trim_weight_cap=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap35_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 35",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.35,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Slip 25",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=25.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_slip50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Slip 50",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=50.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_midcontrib_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Mid-Month Contribution",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
            contribution_timing="middle",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_lastcontrib_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Month-End Contribution",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
            contribution_timing="last",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top3",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Top 3",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=3,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap25_top7",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mixed Entry Trail Trim 25 Cap 25 Top 7",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=7,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=1.00,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit70_mixedentry_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 70 Mixed Entry",
            score_field="candidate_score",
            retention_score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.70,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Candidate Score Top 3",
            score_field="candidate_score",
            top_n=3,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Candidate Score Top 7",
            score_field="candidate_score",
            top_n=7,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Candidate Score Slip 25",
            score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=25.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Candidate Score Slip 50",
            score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=50.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Candidate Score Mid-Month Contribution",
            score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            contribution_timing="middle",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Candidate Score Month-End Contribution",
            score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            contribution_timing="last",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Momentum Score",
            score_field="ta_momentum_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Mid-Month Contribution",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            contribution_timing="middle",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Month-End Contribution",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            contribution_timing="last",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Slip 25",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=25.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_slip50_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Slip 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            fees=BrokerageFees(commission_bps=5.0, sell_tax_bps=18.0, slippage_bps=50.0),
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top3",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Top 3",
            score_field="board_score",
            top_n=3,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top7",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 60 Top 7",
            score_field="board_score",
            top_n=7,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit75_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Weekly 45 Cap Profit 75",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.75,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5",
            label="PIT Trend Quarterly Fresh 540 Run Winners Daily 45 Cap Profit 25",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            allow_rebalance_sell_down=False,
            retained_weight_cap=0.40,
            retained_weight_cap_trigger=0.45,
            retained_weight_cap_cadence="daily",
            retained_weight_cap_min_unrealized_return=0.25,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_confirm5_top5",
            label="PIT Trend Quarterly Fresh 540 Confirm Top 5",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            entry_confirmation_rebalances=2,
            entry_confirmation_rank=5,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_confirm10_top5",
            label="PIT Trend Quarterly Fresh 540 Confirm Top 10",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            entry_confirmation_rebalances=2,
            entry_confirmation_rank=10,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_confirm10_vol50_top5",
            label="PIT Trend Quarterly Fresh 540 Confirm Top 10 Vol 50",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            volatility_target_annual=0.50,
            entry_confirmation_rebalances=2,
            entry_confirmation_rank=10,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_kodex50_top5",
            label="PIT Trend Persist KODEX 50MA Gate",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            market_gate="above_50ma",
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_persist20_kodex200_top5",
            label="PIT Trend Persist KODEX 200MA Gate",
            score_field="board_score",
            top_n=5,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            market_gate="above_200ma",
        ),
    )
    seed: int = 42  # used only for tie-breaking; the engine itself is deterministic.

    # Report-level "valid for" window: target hits, current_return, and
    # follower positions are all frozen / closed at pub_date + this many days.
    report_expiry_days: Annotated[int, Field(ge=30, le=3650)] = 730

    @model_validator(mode="after")
    def _check_dates(self) -> SimulationConfig:
        if self.end_date <= self.start_date:
            raise ValueError(f"end_date {self.end_date} must be after start_date {self.start_date}")
        names = [p.account_id for p in self.accounts]
        if len(set(names)) != len(names):
            raise ValueError(f"account_id must be unique; got {names}")
        return self


# ---------------------------------------------------------------------------
# Per-event records.
# ---------------------------------------------------------------------------


TradeSide = Literal["buy", "sell"]
TradeReason = Literal[
    "deposit_buy",
    "rebalance_buy",
    "rebalance_sell",
    "retained_cap_trim",
    "target_hit",
    "stop_loss_time",
    "stop_loss_average_down",
    "stop_loss_report_age",
    "stop_loss_price",
    "stop_loss_max_hold",
    "trailing_profit_trim",
    "trailing_profit_stop",
    "rebound_exit",
    "end_of_sim",
]


class Trade(_FrozenModel):
    """One executed fill. Quantity is integer shares; cash effect is signed."""

    account_id: str
    date: date
    symbol: str
    side: TradeSide
    qty: Annotated[int, Field(ge=0)]
    fill_price_krw: Annotated[float, Field(gt=0.0)]
    gross_krw: float  # qty × fill_price (no sign)
    commission_krw: Annotated[float, Field(ge=0)]
    tax_krw: Annotated[float, Field(ge=0)]
    realized_pnl_krw: float | None = None
    cash_after_krw: float
    reason: TradeReason
    report_id: str | None = None


class EquityPoint(_FrozenModel):
    """Daily mark-to-market snapshot for one account_id."""

    account_id: str
    date: date
    cash_krw: float
    holdings_value_krw: float
    equity_krw: float
    contributed_capital_krw: float
    net_profit_krw: float
    open_positions: int


class PositionEpisode(_FrozenModel):
    """One contiguous holding period for a (account_id, symbol) pair.

    An "episode" opens when ``qty`` goes from 0 → >0 and closes when ``qty``
    returns to 0. A partial sell that does NOT fully close the position
    stays inside the same episode. Symbols that the account_id buys, sells
    fully, then buys again will produce two distinct episodes.

    ``status`` is ``"closed"`` once ``close_date`` is set, otherwise
    ``"open"`` (still held at the end of the simulation).
    """

    account_id: str
    symbol: str
    company: str | None
    open_date: date
    close_date: date | None
    holding_days: int
    buy_fills: int
    sell_fills: int
    total_qty_bought: int
    total_qty_sold: int
    avg_entry_price_krw: float
    avg_exit_price_krw: float | None
    realized_pnl_krw: float
    unrealized_pnl_krw: float | None  # only when status == "open"
    last_close_krw: float | None
    status: Literal["open", "closed"]
    exit_reasons: tuple[str, ...]


class CurrentHolding(_FrozenModel):
    """A still-open position at the end of the simulation."""

    account_id: str
    symbol: str
    company: str | None
    qty: Annotated[int, Field(ge=1)]
    avg_cost_krw: float
    last_close_krw: float | None
    market_value_krw: float
    unrealized_pnl_krw: float
    unrealized_return: float | None  # last_close / avg_cost - 1
    holding_days: int
    first_buy_date: date


class ReportPerformance(_FrozenModel):
    """One SMIC report's realised outcome between publication and ``as_of_date``.

    Account-agnostic: this is just "how did the price move after the report
    came out". Used by :class:`ReportStats` to aggregate target-hit rates,
    top winners/losers, and target-gap analysis.
    """

    report_id: str
    symbol: str
    company: str
    publication_date: date
    entry_price_krw: float | None  # first close on/after pub_date
    target_price_krw: float | None
    target_upside_at_pub: float | None  # target / entry − 1
    target_hit: bool
    target_hit_date: date | None
    days_to_target: int | None  # None when not hit
    last_close_krw: float | None  # latest close at simulation end
    last_close_date: date | None
    current_return: float | None  # latest close / entry − 1
    peak_return: float | None
    trough_return: float | None
    target_gap_pct: float | None  # latest close vs target
    evaluation_close_krw: float | None = None  # close at the capped report evaluation window
    evaluation_close_date: date | None = None
    evaluation_return: float | None = None  # evaluation_close / entry − 1
    expiry_date: date | None = None  # publication_date + config.report_expiry_days
    expired: bool = False  # True once today >= expiry_date and target was not hit in-window


class ReportStats(_FrozenModel):
    """Aggregate statistics across the entire SMIC report universe."""

    total_reports: int
    reports_with_prices: int
    target_hit_count: int
    target_hit_rate: float  # 0.0..1.0
    avg_days_to_target: float | None  # only over hit reports
    median_days_to_target: float | None
    avg_current_return: float | None  # mean across reports with prices
    median_current_return: float | None
    avg_target_upside_at_pub: float | None  # implied promised return at pub
    avg_target_gap_pct: float | None  # mean (last − target)/target across not-hit reports
    top_winners: tuple[ReportPerformance, ...]
    top_losers: tuple[ReportPerformance, ...]
    biggest_target_gaps_below: tuple[ReportPerformance, ...]  # furthest below target
    biggest_target_overshoots: tuple[ReportPerformance, ...]  # blew past target the most
    fastest_target_hits: tuple[ReportPerformance, ...]
    slowest_target_hits: tuple[ReportPerformance, ...]
    most_aggressive_targets: tuple[ReportPerformance, ...]  # highest target_upside_at_pub


class MonthlyHolding(_FrozenModel):
    """Month-end snapshot of one (account_id, symbol) pair.

    Used to render the portfolio-evolution stacked-area chart and to
    produce the monthly_holdings.csv long-form table.
    """

    account_id: str
    month_end: date
    symbol: str
    company: str
    qty: Annotated[int, Field(ge=1)]
    market_value_krw: float
    weight_in_portfolio: float


class SymbolStat(_FrozenModel):
    """Aggregated lifetime stats for a (account_id, symbol) pair across all episodes."""

    account_id: str
    symbol: str
    company: str | None
    episodes: int
    total_buy_fills: int
    total_sell_fills: int
    total_holding_days: int  # sum across all episodes
    total_realized_pnl_krw: float
    is_currently_held: bool
    current_qty: int
    current_unrealized_pnl_krw: float | None


class AccountSummary(_FrozenModel):
    """Top-line stats for a account_id at the end of the simulation."""

    account_id: str
    label: str
    initial_capital_krw: float
    total_contributed_krw: float
    final_equity_krw: float
    final_cash_krw: float
    final_holdings_value_krw: float
    net_profit_krw: float
    money_weighted_return: float  # IRR on the cash-flow stream
    time_weighted_return: float | None  # geometric link of daily returns
    cagr: float | None
    max_drawdown: float
    realized_pnl_krw: float
    sharpe: float | None = None
    sortino: float | None = None
    trade_count: int
    open_positions: int


class SimulationResult(_FrozenModel):
    """Output bundle written by :func:`runner.run_simulation`."""

    config: SimulationConfig
    summaries: tuple[AccountSummary, ...]
    equity_points: tuple[EquityPoint, ...]
    trades: tuple[Trade, ...]
    position_episodes: tuple[PositionEpisode, ...] = ()
    current_holdings: tuple[CurrentHolding, ...] = ()
    symbol_stats: tuple[SymbolStat, ...] = ()
    monthly_holdings: tuple[MonthlyHolding, ...] = ()
    report_performance: tuple[ReportPerformance, ...] = ()
    report_stats: ReportStats | None = None


# Discriminator helper so the runner can dispatch by ``account_id``.
ACCOUNT_REGISTRY_KEYS: tuple[str, ...] = (
    "oracle",
    "weak_oracle",
    "smic_follower",
    "smic_follower_v2",
    "pit_score_top3",
    "pit_score_top5",
    "pit_score_top10",
    "pit_momentum_top5",
    "pit_trend_top5",
    "pit_fresh_top5",
    "pit_trend_top7",
    "pit_trend_stop_top5",
    "pit_trend_stop_top7",
    "pit_trend_rotate_top5",
    "pit_trend_rotate_fast_top5",
    "pit_trend_rotate_stop_top5",
    "pit_trend_persist20_top5",
    "pit_trend_persist30_top5",
    "pit_trend_persist20_hold90_top5",
    "pit_trend_persist20_top3",
    "pit_trend_persist20_top7",
    "pit_trend_persist20_52w10_top5",
    "pit_trend_persist20_domestic_top5",
    "pit_trend_persist20_score_top5",
    "pit_trend_persist20_scorecap_top5",
    "pit_trend_persist20_invvol_top5",
    "pit_trend_persist20_invvolcap_top5",
    "pit_trend_persist20_semimonthly_top5",
    "pit_trend_persist20_quarterly_top5",
    "pit_trend_quarterly_fresh540_top5",
    "pit_trend_persist20_fresh540_top5",
    "pit_trend_persist20_fresh540_top3",
    "pit_trend_persist20_fresh540_top7",
    "pit_trend_quarterly_fresh540_top3",
    "pit_trend_quarterly_fresh540_top7",
    "pit_trend_quarterly_fresh540_gross_top5",
    "pit_trend_quarterly_fresh540_slip25_top5",
    "pit_trend_quarterly_fresh540_slip50_top5",
    "pit_trend_persist20_kodex50_top5",
    "pit_trend_persist20_kodex200_top5",
    "all_weather",
    "benchmark_qqq",
    "benchmark_spy",
    "benchmark_kodex200",
    "benchmark_gld",
)
