"""Single source of truth for the persona simulation.

Every contract that crosses a module boundary in :mod:`snusmic_pipeline.sim`
is a frozen Pydantic v2 model with ``extra='forbid'``. This guarantees:

* missing or extra fields raise immediately at the boundary,
* a config hashed with ``model_dump_json(sort_keys=True)`` is reproducible,
* downstream consumers (engine, viz, JSON export) never disagree on shape.

The runner reads ``SimulationConfig`` and never relies on globals — to add a
new knob, extend the relevant config model. See ``docs/decisions/persona-simulation.md``
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

    persona_name: Annotated[str, Field(pattern=r"^(all_weather|benchmark_[a-z0-9_]+)$")] = "all_weather"
    label: str = "All-Weather (25/25/25/25)"
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
# Persona configs. Each carries its own knobs; a discriminator union via
# ``persona_name`` lets the runner dispatch without isinstance().
# ---------------------------------------------------------------------------


class _PersonaBase(_FrozenModel):
    label: str  # human-readable label for legends / tables


class ProphetConfig(_PersonaBase):
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

    persona_name: Literal["oracle"] = "oracle"
    label: str = "Prophet"
    lookahead_months: Annotated[int, Field(ge=1, le=24)] = 6
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0
    rebalance: Literal["monthly", "quarterly"] = "monthly"


class WeakProphetConfig(_PersonaBase):
    """Forward-looking max-Sharpe oracle benchmark.

    It is deliberately stronger than realistic strategies: the benchmark can
    see a future return window and concentrate in the names that the optimizer
    prefers. The web catalog marks it as ``oracle`` so it is never presented as
    a tradable strategy.
    """

    persona_name: Literal["weak_oracle"] = "weak_oracle"
    label: str = "Weak Prophet (3M oracle)"
    lookahead_months: Annotated[int, Field(ge=1, le=24)] = 3
    risk_free_rate: Annotated[float, Field(ge=0.0, le=0.20)] = 0.0
    max_weight: Annotated[float, Field(gt=0.0, le=1.0)] = 1.0
    rebalance: Literal["monthly", "quarterly"] = "monthly"
    min_history_days: Annotated[int, Field(ge=20, le=252)] = 20


class SmicFollowerConfig(_PersonaBase):
    """Pure 1/N true-believer: never sells at a loss."""

    persona_name: Literal["smic_follower"] = "smic_follower"
    label: str = "SMIC Follower (1/N)"
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0
    # SMIC reports drop on irregular dates, so the realistic baseline is to
    # rebalance on every trading day — react when a new report arrives or a
    # symbol's weight drifts. Use "monthly"/"quarterly" only when modelling a
    # passive holder.
    rebalance: Literal["daily", "monthly", "quarterly"] = "daily"


class SmicFollowerV2Config(_PersonaBase):
    """1/N follower with three stop-loss escape hatches."""

    persona_name: Literal["smic_follower_v2"] = "smic_follower_v2"
    label: str = "SMIC Follower v2 (with stop-loss)"
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0
    rebalance: Literal["daily", "monthly", "quarterly"] = "daily"

    # Stop-loss rule (a): held this many days AND still at unrealized loss.
    time_loss_days: Annotated[int, Field(ge=30, le=2000)] = 365

    # Stop-loss rule (b): an averaged-down position with unrealized return below this.
    averaged_down_stop_pct: Annotated[float, Field(gt=0.0, lt=1.0)] = 0.20

    # Stop-loss rule (c): days past report publication after which we give up.
    report_age_stop_days: Annotated[int, Field(ge=30, le=3650)] = 730


class SmicMttStrategyConfig(_PersonaBase):
    """Share-ledger SMIC strategy with MTT trend filters and bounded slots.

    This is the practical strategy persona: it trades actual integer shares,
    keeps cash, pays costs, never sells just to restore weights, and only acts
    on report-day signals, deposits, scheduled top-ups, target hits, stops,
    and report expiry.
    """

    persona_name: Annotated[str, Field(pattern=r"^smic_mtt_strategy(_top[0-9]+)?$")] = "smic_mtt_strategy"
    label: str = "Report Trend Strategy"

    # Report valuation gate, evaluated at publication using market prices.
    min_target_upside_at_pub: Annotated[float, Field(ge=0.0, le=10.0)] = 0.30
    max_target_upside_at_pub: Annotated[float, Field(gt=0.0, le=20.0)] = 5.0
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0

    # Minervini-style trend template, implemented only with local OHLC history.
    require_mtt: bool = True
    trend_filter: Literal["mtt", "supertrend", "atr_breakout", "ma_crossover"] = "mtt"
    fast_ma_window: Annotated[int, Field(ge=5, le=120)] = 50
    slow_ma_window: Annotated[int, Field(ge=10, le=300)] = 200
    min_price_vs_52w_low: Annotated[float, Field(ge=0.0, le=10.0)] = 0.30
    max_pct_below_52w_high: Annotated[float, Field(ge=0.0, le=1.0)] = 0.25
    min_ma200_1m_return: Annotated[float, Field(ge=-1.0, le=1.0)] = 0.0
    atr_period_days: Annotated[int, Field(ge=5, le=60)] = 14
    supertrend_multiplier: Annotated[float, Field(gt=0.0, le=10.0)] = 3.0
    breakout_lookback_days: Annotated[int, Field(ge=5, le=252)] = 20
    breakout_atr_multiple: Annotated[float, Field(ge=0.0, le=5.0)] = 0.0

    # Relative-strength overlay: rank candidates by trailing performance within
    # the available report universe. Defaults keep legacy behavior permissive.
    relative_strength_lookback_days: Annotated[int, Field(ge=20, le=504)] = 126
    min_relative_strength_percentile: Annotated[float, Field(ge=0.0, le=1.0)] = 0.0
    min_momentum_return: Annotated[float, Field(ge=-1.0, le=10.0)] = -1.0

    # Real account controls.
    max_positions: Annotated[int, Field(ge=1, le=200)] = 10
    universe: Literal["all", "domestic", "overseas"] = "overseas"
    top_up_cadence: Literal["deposit_only", "monthly", "quarterly"] = "monthly"
    stop_loss_pct: Annotated[float, Field(gt=0.0, lt=1.0)] = 0.10
    take_profit_pct: Annotated[float, Field(gt=0.0, le=10.0)] = 2.0
    report_age_stop_days: Annotated[int, Field(ge=30, le=3650)] = 730
    source_trial_number: Annotated[int, Field(ge=0)] | None = None
    selection_rank: Annotated[int, Field(ge=1)] | None = None
    train_money_weighted_return: float | None = None

    @model_validator(mode="after")
    def _check_target_upside_band(self) -> SmicMttStrategyConfig:
        if self.max_target_upside_at_pub <= self.min_target_upside_at_pub:
            raise ValueError(
                "max_target_upside_at_pub must exceed min_target_upside_at_pub; "
                f"got {self.max_target_upside_at_pub} <= {self.min_target_upside_at_pub}"
            )
        return self

    @model_validator(mode="after")
    def _check_ma_crossover_windows(self) -> SmicMttStrategyConfig:
        if self.trend_filter == "ma_crossover" and self.fast_ma_window >= self.slow_ma_window:
            raise ValueError(
                "fast_ma_window must be strictly smaller than slow_ma_window for MA crossover trend filter"
            )
        return self


class SmicRsiReversalConfig(_PersonaBase):
    """Short-term broker-ledger strategy for oversold report pullbacks.

    The strategy keeps the same realistic account constraints as
    :class:`SmicMttStrategyConfig`, but its buy signal is deliberately
    contrarian: a still-valid SMIC report with enough target upside is bought
    only after a short-term pullback leaves the symbol oversold by RSI.
    Positions exit quickly on rebound, target/profit, stop-loss, or max hold
    age so this persona tests a reversal-buy lane rather than another trend
    follower.
    """

    persona_name: Annotated[str, Field(pattern=r"^smic_rsi_reversal(_top[0-9]+)?$")] = "smic_rsi_reversal"
    label: str = "RSI Reversal Strategy"

    min_target_upside_at_pub: Annotated[float, Field(ge=0.0, le=10.0)] = 0.10
    max_target_upside_at_pub: Annotated[float, Field(gt=0.0, le=20.0)] = 5.0
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0

    rsi_window: Annotated[int, Field(ge=5, le=60)] = 14
    max_entry_rsi: Annotated[float, Field(gt=0.0, lt=100.0)] = 35.0
    rebound_exit_rsi: Annotated[float, Field(gt=0.0, lt=100.0)] = 55.0
    pullback_lookback_days: Annotated[int, Field(ge=5, le=252)] = 20
    min_pullback_pct: Annotated[float, Field(ge=0.0, le=1.0)] = 0.05

    max_positions: Annotated[int, Field(ge=1, le=200)] = 10
    universe: Literal["all", "domestic", "overseas"] = "all"
    top_up_cadence: Literal["deposit_only", "monthly", "quarterly"] = "monthly"
    signal_valid_days: Annotated[int, Field(ge=1, le=3650)] = 90
    stop_loss_pct: Annotated[float, Field(gt=0.0, lt=1.0)] = 0.12
    take_profit_pct: Annotated[float, Field(gt=0.0, le=10.0)] = 0.25
    max_holding_days: Annotated[int, Field(ge=1, le=3650)] = 60

    @model_validator(mode="after")
    def _check_reversal_bands(self) -> SmicRsiReversalConfig:
        if self.max_target_upside_at_pub <= self.min_target_upside_at_pub:
            raise ValueError(
                "max_target_upside_at_pub must exceed min_target_upside_at_pub; "
                f"got {self.max_target_upside_at_pub} <= {self.min_target_upside_at_pub}"
            )
        if self.rebound_exit_rsi <= self.max_entry_rsi:
            raise ValueError(
                "rebound_exit_rsi must exceed max_entry_rsi; "
                f"got {self.rebound_exit_rsi} <= {self.max_entry_rsi}"
            )
        return self


class StockRulePersonaConfig(_PersonaBase):
    """OOS-admitted stock-level ranking rule promoted into the portfolio engine.

    These personas are created by the stock-rule search lane.  They trade real
    shares in the same account ledger as the hand-written personas, but the
    signal itself is a frozen, audited rule discovered in an in-sample window
    and admitted only after out-of-sample replay.
    """

    persona_name: Annotated[str, Field(pattern=r"^stock_rule_[a-z0-9_]+$")]
    label: str
    rule_id: Annotated[str, Field(min_length=1)]
    family: Literal[
        "target_upside_momentum",
        "fresh_report_momentum",
        "target_gap_reversal",
        "price_momentum",
        "ma_crossover",
        "rsi_reversal",
    ]
    fast_ma_days: Annotated[int, Field(ge=1, le=300)]
    slow_ma_days: Annotated[int, Field(ge=1, le=500)]
    min_report_age_days: Annotated[int, Field(ge=0, le=3650)]
    max_report_age_days: Annotated[int, Field(ge=0, le=3650)]
    rebalance: Literal["D", "W", "M"]
    top_pool: Annotated[int, Field(ge=1, le=200)]
    hold_top: Annotated[int, Field(ge=1, le=200)]
    weight_mode: Literal["equal", "rank_linear", "winner_compress", "score_proportional"]
    score_mode: Literal[
        "dynamic_upside",
        "blend",
        "momentum_blend",
        "reversal_gap",
        "price_momentum",
        "ma_cross",
        "rsi_reversal",
    ]
    min_dynamic_upside: float = 0.0
    min_momentum_return: float = -1.0
    min_pullback_pct: float = 0.0
    coverage_failure_trading_days: Annotated[int, Field(ge=0, le=5000)] = 0
    source_search_start: date | None = None
    source_search_end: date | None = None
    source_oos_start: date | None = None
    source_oos_end: date | None = None
    source_oos_total_return: float | None = None
    source_oos_sharpe: float | None = None
    source_oos_sortino: float | None = None

    @model_validator(mode="after")
    def _check_stock_rule_bounds(self) -> StockRulePersonaConfig:
        if self.slow_ma_days < self.fast_ma_days:
            raise ValueError("slow_ma_days must be >= fast_ma_days")
        if self.max_report_age_days < self.min_report_age_days:
            raise ValueError("max_report_age_days must be >= min_report_age_days")
        if self.hold_top > self.top_pool:
            raise ValueError("hold_top must be <= top_pool")
        return self


class PitResearchBoardConfig(_PersonaBase):
    """Point-in-time research-board score rotation.

    The strategy rebuilds the product screener board for each decision date
    using only reports/prices known as of that date, then trades the top-N
    rows in the real share ledger on the next trading day.
    """

    persona_name: Annotated[str, Field(pattern=r"^pit_research_board_[a-z0-9_]+$")]
    label: str
    top_n: Annotated[int, Field(ge=1, le=50)] = 10
    rebalance: Literal["D", "W", "M"] = "M"
    score_mode: Literal["candidate_score", "board_score", "ta_momentum_score"] = "board_score"
    weight_mode: Literal["equal", "score_proportional", "winner_compress"] = "equal"
    universe: Literal["all", "domestic", "overseas"] = "all"
    min_report_age_days: Annotated[int, Field(ge=0, le=3650)] = 0
    max_report_age_days: Annotated[int, Field(ge=30, le=3650)] = 730
    min_score: Annotated[float, Field(ge=0.0, le=100.0)] = 0.0
    bucket_filter: Literal["all", "fresh", "large-upside", "near-target", "active"] = "all"
    require_ma_stack: bool = False
    require_near_52w_high: bool = False
    min_target_upside_at_pub: Annotated[float, Field(ge=0.0, le=10.0)] = 0.0
    max_target_upside_at_pub: Annotated[float, Field(gt=0.0, le=20.0)] = 20.0
    min_current_return: Annotated[float, Field(ge=-1.0, le=20.0)] = -1.0
    max_current_return: Annotated[float, Field(ge=-1.0, le=20.0)] = 20.0
    min_return_1m: Annotated[float, Field(ge=-1.0, le=20.0)] = -1.0
    min_return_3m: Annotated[float, Field(ge=-1.0, le=20.0)] = -1.0
    min_return_6m: Annotated[float, Field(ge=-1.0, le=20.0)] = -1.0
    min_return_1y: Annotated[float, Field(ge=-1.0, le=20.0)] = -1.0
    min_distance_from_52w_high: Annotated[float, Field(ge=-1.0, le=0.0)] = -1.0
    require_ema_stack: bool = False
    require_macd_bullish: bool = False
    target_hit_multiplier: Annotated[float, Field(gt=0.0, le=2.0)] = 1.0
    stop_loss_pct: Annotated[float, Field(ge=0.0, lt=1.0)] = 0.0
    take_profit_pct: Annotated[float, Field(ge=0.0, le=10.0)] = 0.0
    max_holding_days: Annotated[int, Field(ge=0, le=3650)] = 0
    hold_target_winners: bool = False
    target_winner_trailing_stop_pct: Annotated[float, Field(ge=0.0, lt=1.0)] = 0.0

    @model_validator(mode="after")
    def _check_alpha_rule_bounds(self) -> PitResearchBoardConfig:
        if self.max_report_age_days < self.min_report_age_days:
            raise ValueError("max_report_age_days must be >= min_report_age_days")
        if self.max_target_upside_at_pub <= self.min_target_upside_at_pub:
            raise ValueError("max_target_upside_at_pub must exceed min_target_upside_at_pub")
        if self.max_current_return < self.min_current_return:
            raise ValueError("max_current_return must be >= min_current_return")
        return self


PersonaConfig = (
    ProphetConfig
    | WeakProphetConfig
    | SmicFollowerConfig
    | SmicFollowerV2Config
    | SmicMttStrategyConfig
    | SmicRsiReversalConfig
    | StockRulePersonaConfig
    | PitResearchBoardConfig
    | AllWeatherConfig
)

PersonaName = Literal[
    "oracle",
    "weak_oracle",
    "smic_follower",
    "smic_follower_v2",
    "smic_mtt_strategy",
    "smic_rsi_reversal",
    "all_weather",
    "benchmark_qqq",
    "benchmark_spy",
    "benchmark_kodex200",
    "benchmark_gld",
    "pit_research_board_score_top5",
    "pit_research_board_score_top10",
    "pit_research_board_large_upside_top10",
    "pit_research_board_trend_top10",
    "pit_research_board_near_high_top10",
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
    personas: tuple[PersonaConfig, ...] = (
        AllWeatherConfig(),
        AllWeatherConfig(
            persona_name="benchmark_qqq",
            label="QQQ (NASDAQ-100)",
            assets=(BenchmarkAsset(name="NASDAQ-100", symbol="QQQ", weight=1.0),),
        ),
        AllWeatherConfig(
            persona_name="benchmark_spy",
            label="SPY (S&P 500)",
            assets=(BenchmarkAsset(name="S&P 500", symbol="SPY", weight=1.0),),
        ),
        AllWeatherConfig(
            persona_name="benchmark_kodex200",
            label="KODEX 200 (069500.KS)",
            assets=(BenchmarkAsset(name="KODEX 200", symbol="069500.KS", weight=1.0),),
        ),
        AllWeatherConfig(
            persona_name="benchmark_gld",
            label="GLD (Gold ETF)",
            assets=(BenchmarkAsset(name="Gold", symbol="GLD", weight=1.0),),
        ),
        SmicFollowerConfig(),
        SmicFollowerV2Config(label="SMIC Follower (SL)"),
        WeakProphetConfig(
            label="Weak Prophet (3M oracle)",
            lookahead_months=3,
            risk_free_rate=0.0,
            max_weight=1.0,
            min_history_days=20,
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
        names = [p.persona_name for p in self.personas]
        if len(set(names)) != len(names):
            raise ValueError(f"persona_name must be unique; got {names}")
        return self


# ---------------------------------------------------------------------------
# Per-event records.
# ---------------------------------------------------------------------------


TradeSide = Literal["buy", "sell"]
TradeReason = Literal[
    "deposit_buy",
    "rebalance_buy",
    "rebalance_sell",
    "target_hit",
    "stop_loss_time",
    "stop_loss_average_down",
    "stop_loss_report_age",
    "stop_loss_price",
    "stop_loss_max_hold",
    "rebound_exit",
    "end_of_sim",
]


class Trade(_FrozenModel):
    """One executed fill. Quantity is integer shares; cash effect is signed."""

    persona: str
    date: date
    symbol: str
    side: TradeSide
    qty: Annotated[int, Field(ge=0)]
    fill_price_krw: Annotated[float, Field(gt=0.0)]
    gross_krw: float  # qty × fill_price (no sign)
    commission_krw: Annotated[float, Field(ge=0)]
    tax_krw: Annotated[float, Field(ge=0)]
    cash_after_krw: float
    reason: TradeReason
    report_id: str | None = None


class EquityPoint(_FrozenModel):
    """Daily mark-to-market snapshot for one persona."""

    persona: str
    date: date
    cash_krw: float
    holdings_value_krw: float
    equity_krw: float
    contributed_capital_krw: float
    net_profit_krw: float
    open_positions: int


class PositionEpisode(_FrozenModel):
    """One contiguous holding period for a (persona, symbol) pair.

    An "episode" opens when ``qty`` goes from 0 → >0 and closes when ``qty``
    returns to 0. A partial sell that does NOT fully close the position
    stays inside the same episode. Symbols that the persona buys, sells
    fully, then buys again will produce two distinct episodes.

    ``status`` is ``"closed"`` once ``close_date`` is set, otherwise
    ``"open"`` (still held at the end of the simulation).
    """

    persona: str
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

    persona: str
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

    Persona-agnostic: this is just "how did the price move after the report
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
    last_close_krw: float | None
    last_close_date: date | None
    current_return: float | None  # last_close / entry − 1
    peak_return: float | None
    trough_return: float | None
    target_gap_pct: float | None  # (last_close − target) / target
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
    """Month-end snapshot of one (persona, symbol) pair.

    Used to render the portfolio-evolution stacked-area chart and to
    produce the monthly_holdings.csv long-form table.
    """

    persona: str
    month_end: date
    symbol: str
    company: str
    qty: Annotated[int, Field(ge=1)]
    market_value_krw: float
    weight_in_portfolio: float


class SymbolStat(_FrozenModel):
    """Aggregated lifetime stats for a (persona, symbol) pair across all episodes."""

    persona: str
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


class PersonaSummary(_FrozenModel):
    """Top-line stats for a persona at the end of the simulation."""

    persona: str
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
    summaries: tuple[PersonaSummary, ...]
    equity_points: tuple[EquityPoint, ...]
    trades: tuple[Trade, ...]
    position_episodes: tuple[PositionEpisode, ...] = ()
    current_holdings: tuple[CurrentHolding, ...] = ()
    symbol_stats: tuple[SymbolStat, ...] = ()
    monthly_holdings: tuple[MonthlyHolding, ...] = ()
    report_performance: tuple[ReportPerformance, ...] = ()
    report_stats: ReportStats | None = None


# Discriminator helper so the runner can dispatch by ``persona_name``.
PERSONA_REGISTRY_KEYS: tuple[str, ...] = (
    "oracle",
    "weak_oracle",
    "smic_follower",
    "smic_follower_v2",
    "smic_mtt_strategy",
    "all_weather",
    "benchmark_qqq",
    "benchmark_spy",
    "benchmark_kodex200",
    "benchmark_gld",
)
