"""Optuna search for real broker-ledger SMIC MTT strategy personas."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, cast

import optuna
import pandas as pd

from .contracts import BrokerageFees, SavingsPlan, SmicMttStrategyConfig
from .market import PriceBoard
from .personas.smic_mtt_strategy import simulate_smic_mtt_strategy
from .runner import _prepare_reports
from .savings import build_cash_flow_schedule
from .target_adjustment import align_report_targets_to_market_scale
from .warehouse import read_table


@dataclass(frozen=True)
class BrokerStrategySearchResult:
    configs: tuple[SmicMttStrategyConfig, ...]
    trial_rows: pd.DataFrame


def find_top_broker_strategy_configs(
    *,
    warehouse_dir: Path,
    start_date: date,
    end_date: date,
    train_start: date,
    train_end: date,
    plan: SavingsPlan,
    fees: BrokerageFees,
    benchmark_money_weighted_return: float,
    trials: int = 80,
    top_n: int = 5,
    seed: int = 42,
    min_excess_return: float = 0.0,
) -> BrokerStrategySearchResult:
    """Select Optuna train winners, then admit only full-period winners.

    Selection is intentionally two-stage:
    1. Optuna maximizes actual train-period broker-ledger performance.
    2. Candidate configs are replayed on the full window and only accepted
       when they beat the strongest benchmark by ``min_excess_return``.
    """
    if trials < top_n:
        raise ValueError(f"trials ({trials}) must be >= top_n ({top_n})")
    if train_end < train_start:
        raise ValueError(f"train_end {train_end} must be on or after train_start {train_start}")
    if end_date <= start_date:
        raise ValueError(f"end_date {end_date} must be after start_date {start_date}")

    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily_prices rows; cannot search strategies.")
    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, start_date, end_date)
    reports = align_report_targets_to_market_scale(reports, board, end_date)

    train_dates = board.trading_dates(start=train_start, end=train_end)
    full_dates = board.trading_dates(start=start_date, end=end_date)
    if not train_dates:
        raise RuntimeError(f"No trading dates in train window {train_start}..{train_end}")
    if not full_dates:
        raise RuntimeError(f"No trading dates in full window {start_date}..{end_date}")
    train_cashflows = build_cash_flow_schedule(train_dates, plan)
    full_cashflows = build_cash_flow_schedule(full_dates, plan)

    optuna.logging.set_verbosity(optuna.logging.WARNING)
    sampler = optuna.samplers.TPESampler(seed=seed)
    study = optuna.create_study(direction="maximize", sampler=sampler, study_name="smic-mtt-broker-ledger")
    train_cache: dict[str, dict[str, Any]] = {}

    def objective(trial: optuna.Trial) -> float:
        config = _sample_config(trial)
        key = config.model_dump_json(
            exclude={
                "persona_name",
                "label",
                "source_trial_number",
                "selection_rank",
                "train_money_weighted_return",
            }
        )
        cached = train_cache.get(key)
        if cached is None:
            output = simulate_smic_mtt_strategy(
                config,
                plan,
                fees,
                board,
                reports,
                train_cashflows,
                train_dates,
            )
            summary = output.summary
            score = _score_summary(
                money_weighted_return=summary.money_weighted_return,
                max_drawdown=summary.max_drawdown,
                trade_count=summary.trade_count,
                open_positions=summary.open_positions,
            )
            cached = {
                **config.model_dump(mode="json"),
                "train_score": score,
                "train_money_weighted_return": summary.money_weighted_return,
                "train_max_drawdown": summary.max_drawdown,
                "train_trade_count": summary.trade_count,
                "train_open_positions": summary.open_positions,
            }
            train_cache[key] = cached
        for name, value in cached.items():
            trial.set_user_attr(name, value)
        return float(cached["train_score"])

    study.optimize(objective, n_trials=trials)

    rows: list[dict[str, Any]] = []
    seen_param_keys: set[str] = set()
    seen_behavior_keys: set[tuple[float, float, float, int, int]] = set()
    selected: list[SmicMttStrategyConfig] = []
    ranked_trials = sorted(study.trials, key=lambda trial: float(trial.value or -1e9), reverse=True)

    for train_rank, trial in enumerate(ranked_trials, start=1):
        config = _config_from_attrs(trial.user_attrs)
        param_key = config.model_dump_json(
            exclude={
                "persona_name",
                "label",
                "source_trial_number",
                "selection_rank",
                "train_money_weighted_return",
            }
        )
        if param_key in seen_param_keys:
            continue
        seen_param_keys.add(param_key)

        output = simulate_smic_mtt_strategy(config, plan, fees, board, reports, full_cashflows, full_dates)
        summary = output.summary
        excess = summary.money_weighted_return - benchmark_money_weighted_return
        beats_benchmark = excess > min_excess_return
        behavior_key = (
            round(summary.money_weighted_return, 6),
            round(summary.net_profit_krw, 2),
            round(summary.max_drawdown, 6),
            summary.trade_count,
            summary.open_positions,
        )
        duplicate_behavior = behavior_key in seen_behavior_keys
        accepted = beats_benchmark and not duplicate_behavior
        row = {
            "trial_number": trial.number,
            "train_rank": train_rank,
            "accepted": accepted,
            "admission_status": _admission_status(
                beats_benchmark=beats_benchmark,
                duplicate_behavior=duplicate_behavior,
            ),
            "excess_return_vs_best_benchmark": excess,
            **trial.user_attrs,
            "full_money_weighted_return": summary.money_weighted_return,
            "full_net_profit_krw": summary.net_profit_krw,
            "full_final_equity_krw": summary.final_equity_krw,
            "full_max_drawdown": summary.max_drawdown,
            "full_trade_count": summary.trade_count,
            "full_open_positions": summary.open_positions,
        }
        rows.append(row)
        if not accepted:
            continue
        seen_behavior_keys.add(behavior_key)
        rank = len(selected) + 1
        selected.append(
            config.model_copy(
                update={
                    "persona_name": f"smic_mtt_strategy_optuna_top{rank}",
                    "label": f"SMIC MTT Optuna #{rank}",
                    "source_trial_number": trial.number,
                    "selection_rank": train_rank,
                    "train_money_weighted_return": trial.user_attrs["train_money_weighted_return"],
                }
            )
        )
        if len(selected) >= top_n:
            break

    if len(selected) < top_n:
        raise RuntimeError(
            f"Only {len(selected)} optimized broker-ledger strategies beat the strongest benchmark; "
            f"required {top_n}. Increase trials or revise the search space."
        )

    return BrokerStrategySearchResult(configs=tuple(selected), trial_rows=pd.DataFrame(rows))


def _admission_status(*, beats_benchmark: bool, duplicate_behavior: bool) -> str:
    if not beats_benchmark:
        return "below_benchmark"
    if duplicate_behavior:
        return "duplicate_behavior"
    return "accepted"


def _score_summary(
    *,
    money_weighted_return: float,
    max_drawdown: float,
    trade_count: int,
    open_positions: int,
) -> float:
    trade_penalty = max(0.0, (trade_count - 250) / 2500.0)
    idle_penalty = 0.05 if open_positions == 0 and money_weighted_return <= 0 else 0.0
    return money_weighted_return - 0.35 * max_drawdown - trade_penalty - idle_penalty


def _sample_config(trial: optuna.Trial) -> SmicMttStrategyConfig:
    min_upside = trial.suggest_float("min_target_upside_at_pub", 0.05, 0.80, step=0.05)
    max_upside = trial.suggest_float(
        "max_target_upside_at_pub",
        max(1.0, min_upside + 0.10),
        5.0,
        step=0.25,
    )
    require_mtt = trial.suggest_categorical("require_mtt", [False, True])
    return SmicMttStrategyConfig(
        min_target_upside_at_pub=min_upside,
        max_target_upside_at_pub=max_upside,
        target_hit_multiplier=trial.suggest_float("target_hit_multiplier", 0.8, 1.1, step=0.05),
        require_mtt=require_mtt,
        min_price_vs_52w_low=trial.suggest_float("min_price_vs_52w_low", 0.0, 1.0, step=0.10),
        max_pct_below_52w_high=trial.suggest_float("max_pct_below_52w_high", 0.10, 1.0, step=0.05),
        min_ma200_1m_return=trial.suggest_float("min_ma200_1m_return", -0.05, 0.05, step=0.01),
        max_positions=trial.suggest_int("max_positions", 5, 40, step=5),
        universe=cast(Any, trial.suggest_categorical("universe", ["all", "domestic", "overseas"])),
        top_up_cadence=cast(
            Any, trial.suggest_categorical("top_up_cadence", ["deposit_only", "monthly", "quarterly"])
        ),
        stop_loss_pct=trial.suggest_float("stop_loss_pct", 0.05, 0.30, step=0.05),
        take_profit_pct=trial.suggest_float("take_profit_pct", 0.50, 3.00, step=0.25),
        report_age_stop_days=trial.suggest_categorical("report_age_stop_days", [180, 365, 730, 1095]),
    )


def _config_from_attrs(attrs: dict[str, Any]) -> SmicMttStrategyConfig:
    fields = set(SmicMttStrategyConfig.model_fields)
    payload = {
        key: value
        for key, value in attrs.items()
        if key in fields
        and key
        not in {
            "persona_name",
            "label",
            "source_trial_number",
            "selection_rank",
            "train_money_weighted_return",
        }
    }
    return SmicMttStrategyConfig(**payload)
