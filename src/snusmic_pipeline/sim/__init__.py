"""Account-level account simulation.

The canonical (and only) simulation surface in this repo. Simulates a real
Korean brokerage: KRW cash ledger, integer-share holdings, fees and sell-side
tax, and a step-up monthly contribution.

See ``docs/backtest-contract.md`` for the contract.
"""

from .contracts import (
    AccountConfig,
    AccountId,
    AccountSummary,
    AllWeatherConfig,
    BenchmarkAsset,
    BrokerageFees,
    CurrentHolding,
    EquityPoint,
    MonthlyHolding,
    PositionEpisode,
    ProphetConfig,
    ReportPerformance,
    ReportStats,
    SavingsPlan,
    SimulationConfig,
    SimulationResult,
    SmicFollowerConfig,
    SmicFollowerV2Config,
    SymbolStat,
    Trade,
    WeakProphetConfig,
)

__all__ = [
    "AllWeatherConfig",
    "BenchmarkAsset",
    "BrokerageFees",
    "CurrentHolding",
    "EquityPoint",
    "MonthlyHolding",
    "AccountConfig",
    "AccountId",
    "AccountSummary",
    "PositionEpisode",
    "ProphetConfig",
    "ReportPerformance",
    "ReportStats",
    "SavingsPlan",
    "SimulationConfig",
    "SimulationResult",
    "SmicFollowerConfig",
    "SmicFollowerV2Config",
    "SymbolStat",
    "Trade",
    "WeakProphetConfig",
]
