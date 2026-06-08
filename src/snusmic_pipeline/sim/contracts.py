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
        "pit_momentum_1m3m_top5",
        "pit_momentum_3m6m_top5",
        "pit_momentum_6m12m_top5",
        "pit_momentum_ma_stack_top5",
        "pit_momentum_strict_top5",
        "pit_mtt_rs70_top5",
        "pit_mtt_rs80_top5",
        "pit_mtt_rs90_top5",
        "pit_mtt_low100_top5",
        "pit_mtt_low300_top5",
        "pit_momentum_rs70_mtt_top5",
        "pit_momentum_breakout_top5",
        "pit_momentum_balanced_top10",
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
    require_above_150ma: bool = False
    require_above_50ma: bool = False
    require_ma_stack: bool = False
    require_mtt_template: bool = False
    require_macd_bullish: bool = False
    min_return_1m: float | None = None
    min_return_3m: float | None = None
    min_return_6m: float | None = None
    min_return_1y: float | None = None
    min_sma200_return_1m: float | None = None
    min_sma200_return_120d: float | None = None
    min_sma200_return_150d: float | None = None
    min_distance_from_52w_high: float | None = None
    min_distance_from_52w_low: float | None = None
    min_relative_strength_percentile: Annotated[float, Field(ge=0.0, le=1.0)] | None = None
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
    "pit_momentum_1m3m_top5",
    "pit_momentum_3m6m_top5",
    "pit_momentum_6m12m_top5",
    "pit_momentum_ma_stack_top5",
    "pit_momentum_strict_top5",
    "pit_mtt_rs70_top5",
    "pit_mtt_rs80_top5",
    "pit_mtt_rs90_top5",
    "pit_mtt_low100_top5",
    "pit_mtt_low300_top5",
    "pit_momentum_rs70_mtt_top5",
    "pit_momentum_breakout_top5",
    "pit_momentum_balanced_top10",
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
            account_id="pit_momentum_1m3m_top5",
            label="PIT 모멘텀 1M/3M Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_1m=0.0,
            min_return_3m=0.0,
            min_distance_from_52w_high=-0.25,
            min_distance_from_52w_low=0.30,
            require_above_150ma=True,
            require_above_50ma=True,
            min_sma200_return_1m=0.0,
            min_relative_strength_percentile=0.70,
            market_gate="above_200ma",
            require_above_200ma=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_momentum_3m6m_top5",
            label="PIT 모멘텀 3M/6M Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_3m=0.0,
            min_return_6m=0.0,
            min_distance_from_52w_high=-0.25,
            min_distance_from_52w_low=0.30,
            require_above_150ma=True,
            require_above_50ma=True,
            min_sma200_return_120d=0.0,
            min_relative_strength_percentile=0.80,
            market_gate="above_200ma",
            require_above_200ma=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_momentum_6m12m_top5",
            label="PIT 모멘텀 6M/12M Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_6m=0.0,
            min_return_1y=0.0,
            min_distance_from_52w_high=-0.25,
            min_distance_from_52w_low=0.30,
            require_above_150ma=True,
            require_above_50ma=True,
            min_sma200_return_150d=0.0,
            min_relative_strength_percentile=0.80,
            market_gate="above_200ma",
            require_ma_stack=True,
        ),
        PitSignalRuleConfig(
            account_id="pit_mtt_rs70_top5",
            label="PIT MTT RS70 Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_1m=0.0,
            min_return_3m=0.0,
            min_distance_from_52w_high=-0.25,
            min_distance_from_52w_low=0.30,
            require_mtt_template=True,
            min_sma200_return_1m=0.0,
            min_relative_strength_percentile=0.70,
            market_gate="above_200ma",
        ),
        PitSignalRuleConfig(
            account_id="pit_mtt_rs80_top5",
            label="PIT MTT RS80 Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_3m=0.0,
            min_return_6m=0.0,
            min_distance_from_52w_high=-0.25,
            min_distance_from_52w_low=0.30,
            require_mtt_template=True,
            min_sma200_return_120d=0.0,
            min_relative_strength_percentile=0.80,
            market_gate="above_200ma",
        ),
        PitSignalRuleConfig(
            account_id="pit_mtt_rs90_top5",
            label="PIT MTT RS90 Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_1m=0.0,
            min_return_3m=0.0,
            min_return_6m=0.0,
            min_return_1y=0.0,
            min_distance_from_52w_high=-0.25,
            min_distance_from_52w_low=0.30,
            require_mtt_template=True,
            min_sma200_return_150d=0.0,
            min_relative_strength_percentile=0.90,
            market_gate="above_200ma",
        ),
        PitSignalRuleConfig(
            account_id="pit_mtt_low100_top5",
            label="PIT MTT 52주저점+100% Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_3m=0.0,
            min_return_6m=0.0,
            min_distance_from_52w_high=-0.25,
            min_distance_from_52w_low=1.00,
            require_mtt_template=True,
            min_sma200_return_120d=0.0,
            min_relative_strength_percentile=0.80,
            market_gate="above_200ma",
        ),
        PitSignalRuleConfig(
            account_id="pit_mtt_low300_top5",
            label="PIT MTT 52주저점+300% Top 5",
            score_field="ta_momentum_score",
            top_n=5,
            min_return_3m=0.0,
            min_return_6m=0.0,
            min_distance_from_52w_high=-0.25,
            min_distance_from_52w_low=3.00,
            require_mtt_template=True,
            min_sma200_return_120d=0.0,
            min_relative_strength_percentile=0.80,
            market_gate="above_200ma",
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
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
            label="PIT 추세 Profit60 Top 5",
            score_field="board_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            min_return_6m=0.0,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            market_gate="above_200ma",
            retained_weight_cap=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
            label="PIT 추세 Candidate Profit60 Top 5",
            score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            min_return_6m=0.0,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            market_gate="above_200ma",
            retained_weight_cap=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_top5",
            label="PIT 추세 Mixed Entry Profit60 Top 5",
            score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            min_return_6m=0.0,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            market_gate="above_200ma",
            retained_weight_cap=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5",
            label="PIT 추세 실전 후보 Top 5",
            score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            min_return_6m=0.0,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            market_gate="above_200ma",
            retained_weight_cap=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=0.25,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5",
            label="PIT 추세 CashGate 12.5 Top 5",
            score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            min_return_6m=0.0,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            market_gate="above_200ma",
            retained_weight_cap=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=0.25,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
            redeploy_after_trailing_trim=True,
            redeploy_after_trailing_trim_min_cash_pct=0.125,
        ),
        PitSignalRuleConfig(
            account_id="pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
            label="PIT 추세 Partial 75 Top 5",
            score_field="board_score",
            entry_score_field="candidate_score",
            top_n=5,
            rebalance="quarterly",
            max_report_age_days=540,
            min_return_6m=0.0,
            require_ma_stack=True,
            min_distance_from_52w_high=-0.20,
            rank_exit_threshold=20,
            min_holding_days=60,
            market_gate="above_200ma",
            retained_weight_cap=0.45,
            retained_weight_cap_cadence="weekly",
            retained_weight_cap_min_unrealized_return=0.60,
            trail_trim_min_unrealized_return=0.25,
            trail_trim_drawdown_pct=0.25,
            trail_trim_weight_cap=0.20,
            redeploy_after_trailing_trim=True,
            redeploy_after_trailing_trim_min_cash_pct=0.125,
            redeploy_after_trailing_trim_buy_fraction=0.75,
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


class VerificationCase(_FrozenModel):
    """One PIT validation case for a report claim.

    This is the verification-first downstream object. It may wrap the same
    market path as :class:`ReportPerformance`, but adds downside-aware quality
    and explicit alpha-eligibility semantics.
    """

    case_id: str
    report_id: str
    symbol: str
    company: str
    claim_type: Literal["target_price", "thesis"]
    publication_date: date
    entry_price_krw: float | None
    target_price_krw: float | None
    target_upside_at_pub: float | None
    target_hit: bool
    target_hit_date: date | None
    days_to_target: int | None
    last_close_krw: float | None
    last_close_date: date | None
    current_return: float | None
    peak_return: float | None
    trough_return: float | None
    max_drawdown: float | None
    failure_tail_return: float | None
    target_gap_pct: float | None
    expiry_date: date | None = None
    expired: bool = False
    quality_score: float | None = None
    veto_reasons: tuple[str, ...] = ()
    eligible_for_alpha: bool = True


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

class AlphaQualityDistribution(_FrozenModel):
    sample_size: int
    mean_quality_score: float | None = None
    median_quality_score: float | None = None
    worst_quality_score: float | None = None
    veto_case_count: int = 0


class AlphaHypothesis(_FrozenModel):
    """Repeated selection rule promoted from many non-vetoed verification cases."""

    hypothesis_id: str
    selection_rule: str
    evidence_case_ids: tuple[str, ...]
    distinct_symbol_count: int
    support_count: int
    support_start_date: date | None = None
    support_end_date: date | None = None
    regime_count: int = 0
    quality_distribution: AlphaQualityDistribution
    promotion_status: Literal["candidate", "promoted", "rejected"]
    rejection_reasons: tuple[str, ...] = ()

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
    verification_cases: tuple[VerificationCase, ...] = ()
    alpha_hypotheses: tuple[AlphaHypothesis, ...] = ()
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
    "pit_momentum_1m3m_top5",
    "pit_momentum_3m6m_top5",
    "pit_momentum_6m12m_top5",
    "pit_momentum_ma_stack_top5",
    "pit_momentum_strict_top5",
    "pit_mtt_rs70_top5",
    "pit_mtt_rs80_top5",
    "pit_mtt_rs90_top5",
    "pit_mtt_low100_top5",
    "pit_mtt_low300_top5",
    "pit_momentum_rs70_mtt_top5",
    "pit_momentum_breakout_top5",
    "pit_momentum_balanced_top10",
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
