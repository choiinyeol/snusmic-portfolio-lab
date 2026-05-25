"""Markdown audit for PIT strategy selection mechanics."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd

from .accounts.pit_score import (
    _apply_signal_exits,
    _passes_entry_rule,
    _ranked_signal_rows,
    _rebalance_days,
    _signal_rule_weights,
)
from .brokerage import Account, Lot
from .contracts import BrokerageFees, PitSignalRuleConfig, SimulationConfig
from .market import PriceBoard
from .pit_research_board import PitResearchBoardCache, PitResearchBoardRow
from .runner import _prepare_reports
from .target_adjustment import align_report_targets_to_market_scale
from .warehouse import read_table


@dataclass(frozen=True)
class SelectionAuditRow:
    rebalance_date: date
    rank: int
    board_rank: int | None
    symbol: str
    company: str
    score: float
    target_upside_component: float
    current_return_component: float
    over_target_penalty: float
    target_upside: float
    current_return: float
    target_gap: float
    report_age_days: int
    distance_from_52w_high: float | None
    ma_stack: bool | None


@dataclass(frozen=True)
class SelectionDiffRow:
    rebalance_date: date
    side: str
    symbol: str
    company: str
    candidate_rank: int | None
    board_rank: int | None
    candidate_score: float
    board_score: float
    forward_return: float | None
    target_upside: float
    current_return: float
    target_gap: float


@dataclass(frozen=True)
class FirstBuyTimingRow:
    symbol: str
    candidate_first_buy: date | None
    baseline_first_buy: date | None
    candidate_minus_baseline_days: int | None


@dataclass(frozen=True)
class RankSnapshot:
    as_of_date: date
    symbol: str
    company: str
    candidate_rank: int | None
    board_rank: int | None
    candidate_score: float | None
    board_score: float | None
    target_upside: float | None
    current_return: float | None
    target_gap: float | None
    report_age_days: int | None
    distance_from_52w_high: float | None
    ma_stack: bool | None
    forward_return: float | None


@dataclass(frozen=True)
class EntryTimingAuditRow:
    timing: FirstBuyTimingRow
    company: str
    candidate_entry_snapshot: RankSnapshot | None
    baseline_entry_snapshot: RankSnapshot | None


@dataclass(frozen=True)
class RebalanceStateRow:
    audit_date: date
    account_id: str
    symbol: str
    company: str
    candidate_rank: int | None
    board_rank: int | None
    held_before: bool
    held_weight_before: float | None
    target_weight: float | None
    trade_action: str
    trade_qty: int
    trade_gross_krw: float
    current_return: float | None
    target_gap: float | None


@dataclass(frozen=True)
class RebalanceStateAccount:
    audit_date: date
    account_id: str
    cash_before_krw: float
    equity_before_krw: float
    open_positions_before: int
    rows: tuple[RebalanceStateRow, ...]


def build_selection_audit_report(
    warehouse_dir: Path,
    sim_dir: Path,
    account_id: str,
    *,
    start: date,
    end: date,
    recent_rebalances: int = 8,
) -> str:
    """Build a PIT-only audit report for a signal-rule account.

    The report reconstructs the account's eligible rank board on each
    rebalance date from committed warehouse artifacts. It does not inspect
    future prices beyond the rebalance date.
    """

    config = _pit_signal_config(account_id, start=start, end=end)
    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily price rows")
    trading_dates = board.trading_dates(start=start, end=end)
    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, start, end)
    reports = align_report_targets_to_market_scale(reports, board, end)
    cache = PitResearchBoardCache(reports, board)

    rebalance_dates = sorted(
        _rebalance_days(
            trading_dates,
            config.rebalance,
            quarter_offset_months=config.quarter_offset_months,
        )
    )
    action_by_date = _load_actions(sim_dir, account_id)

    rows: list[SelectionAuditRow] = []
    overlaps: list[float] = []
    for day in rebalance_dates:
        prices_today = board.close_on(day)
        ranked = _admissible_rows(config, cache, board, day, prices_today)
        board_rank = _board_rank_map(ranked)
        selected = ranked[: config.top_n]
        board_top = set(_board_sorted_rows(ranked)[: config.top_n])
        selected_symbols = {row.symbol for row in selected}
        if selected_symbols or board_top:
            overlaps.append(len(selected_symbols & board_top) / max(1, len(selected_symbols | board_top)))
        for rank, row in enumerate(selected, start=1):
            components = candidate_score_components(row)
            rows.append(
                SelectionAuditRow(
                    rebalance_date=day,
                    rank=rank,
                    board_rank=board_rank.get(row.symbol),
                    symbol=row.symbol,
                    company=row.company,
                    score=float(getattr(row, config.score_field)),
                    target_upside_component=components["target_upside_component"],
                    current_return_component=components["current_return_component"],
                    over_target_penalty=components["over_target_penalty"],
                    target_upside=row.target_upside_at_pub,
                    current_return=row.current_return,
                    target_gap=row.target_gap_pct,
                    report_age_days=row.report_age_days,
                    distance_from_52w_high=row.distance_from_52w_high,
                    ma_stack=row.ma_stack,
                )
            )

    return _render_report(
        account_id=account_id,
        config=config,
        rows=rows,
        overlaps=overlaps,
        action_by_date=action_by_date,
        recent_rebalances=recent_rebalances,
    )


def build_selection_diff_audit_report(
    warehouse_dir: Path,
    account_id: str,
    *,
    start: date,
    end: date,
) -> str:
    """Build an ex-post audit of candidate-score Top-N versus board-score Top-N.

    The selection sets are built using only PIT fields available on each
    rebalance date. The next-rebalance return is ex-post evidence for research
    review and is never part of the decision rule.
    """

    config = _pit_signal_config(account_id, start=start, end=end)
    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily price rows")
    trading_dates = board.trading_dates(start=start, end=end)
    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, start, end)
    reports = align_report_targets_to_market_scale(reports, board, end)
    cache = PitResearchBoardCache(reports, board)

    rebalance_dates = sorted(
        _rebalance_days(
            trading_dates,
            config.rebalance,
            quarter_offset_months=config.quarter_offset_months,
        )
    )

    rows: list[SelectionDiffRow] = []
    spreads: list[float] = []
    for index, day in enumerate(rebalance_dates):
        next_day = rebalance_dates[index + 1] if index + 1 < len(rebalance_dates) else end
        prices_today = board.close_on(day)
        ranked = _admissible_rows(config, cache, board, day, prices_today)
        candidate_top = ranked[: config.top_n]
        board_ranked = _board_sorted_objects(ranked)
        board_top = board_ranked[: config.top_n]
        candidate_rank = {row.symbol: rank for rank, row in enumerate(candidate_top, start=1)}
        board_rank = {row.symbol: rank for rank, row in enumerate(board_ranked, start=1)}
        row_by_symbol = {row.symbol: row for row in ranked}
        candidate_only = [
            row for row in candidate_top if row.symbol not in {item.symbol for item in board_top}
        ]
        board_only = [row for row in board_top if row.symbol not in {item.symbol for item in candidate_top}]
        if not candidate_only and not board_only:
            continue

        candidate_returns = [_forward_return(board, day, next_day, row.symbol) for row in candidate_only]
        board_returns = [_forward_return(board, day, next_day, row.symbol) for row in board_only]
        candidate_mean = _mean_defined(candidate_returns)
        board_mean = _mean_defined(board_returns)
        if candidate_mean is not None and board_mean is not None:
            spreads.append(candidate_mean - board_mean)

        for row in candidate_only:
            rows.append(
                _selection_diff_row(
                    row,
                    side="candidate_only",
                    candidate_rank=candidate_rank.get(row.symbol),
                    board_rank=board_rank.get(row.symbol),
                    forward_return=_forward_return(board, day, next_day, row.symbol),
                    rebalance_date=day,
                )
            )
        for row in board_only:
            source = row_by_symbol[row.symbol]
            rows.append(
                _selection_diff_row(
                    source,
                    side="board_only",
                    candidate_rank=candidate_rank.get(source.symbol),
                    board_rank=board_rank.get(source.symbol),
                    forward_return=_forward_return(board, day, next_day, source.symbol),
                    rebalance_date=day,
                )
            )

    return _render_diff_report(
        account_id=account_id,
        config=config,
        rows=rows,
        spreads=spreads,
    )


def build_entry_timing_audit_report(
    warehouse_dir: Path,
    sim_dir: Path,
    account_id: str,
    baseline_id: str,
    *,
    start: date,
    end: date,
) -> str:
    """Build a PIT rank-board audit for symbols first bought on different dates.

    The first-buy dates come from generated trade ledgers. Rank snapshots are
    reconstructed with only data visible on that date. Forward returns are
    ex-post review evidence and are not part of either decision rule.
    """

    config = _pit_signal_config(account_id, start=start, end=end)
    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily price rows")

    trading_dates = board.trading_dates(start=start, end=end)
    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, start, end)
    reports = align_report_targets_to_market_scale(reports, board, end)
    cache = PitResearchBoardCache(reports, board)
    company_by_symbol = _company_by_symbol(reports)
    rebalance_dates = sorted(
        _rebalance_days(
            trading_dates,
            config.rebalance,
            quarter_offset_months=config.quarter_offset_months,
        )
    )

    trades_path = sim_dir / "trades.csv"
    if not trades_path.exists():
        raise FileNotFoundError(f"Missing generated trades artifact: {trades_path}")
    trades = pd.read_csv(trades_path, usecols=["account_id", "date", "symbol", "side"])
    timing_rows = _first_buy_timing_rows(trades, account_id, baseline_id)

    rows: list[EntryTimingAuditRow] = []
    for timing in timing_rows:
        candidate_snapshot = (
            _rank_snapshot(
                config,
                cache,
                board,
                timing.candidate_first_buy,
                _next_rebalance_after(rebalance_dates, timing.candidate_first_buy, end),
                timing.symbol,
            )
            if timing.candidate_first_buy is not None
            else None
        )
        baseline_snapshot = (
            _rank_snapshot(
                config,
                cache,
                board,
                timing.baseline_first_buy,
                _next_rebalance_after(rebalance_dates, timing.baseline_first_buy, end),
                timing.symbol,
            )
            if timing.baseline_first_buy is not None
            else None
        )
        rows.append(
            EntryTimingAuditRow(
                timing=timing,
                company=(
                    candidate_snapshot.company
                    if candidate_snapshot is not None and candidate_snapshot.company
                    else baseline_snapshot.company
                    if baseline_snapshot is not None and baseline_snapshot.company
                    else company_by_symbol.get(timing.symbol, timing.symbol)
                ),
                candidate_entry_snapshot=candidate_snapshot,
                baseline_entry_snapshot=baseline_snapshot,
            )
        )

    return _render_entry_timing_report(
        account_id=account_id,
        baseline_id=baseline_id,
        config=config,
        rows=rows,
    )


def build_rebalance_state_audit_report(
    warehouse_dir: Path,
    sim_dir: Path,
    account_ids: list[str],
    *,
    audit_dates: list[date],
    start: date,
    end: date,
    top_rows: int = 10,
) -> str:
    """Build a PIT account-state audit for selected rebalance dates.

    The rank board and target weights use only information visible on each
    audit date. Generated trades/equity artifacts are used to reconstruct the
    account state entering the rebalance.
    """

    if not account_ids:
        raise ValueError("At least one account id is required")
    if not audit_dates:
        raise ValueError("At least one audit date is required")

    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily price rows")
    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, start, end)
    reports = align_report_targets_to_market_scale(reports, board, end)
    cache = PitResearchBoardCache(reports, board)

    trades = _read_sim_trades(sim_dir)
    equity = _read_sim_equity(sim_dir)
    configs = {account_id: _pit_signal_config(account_id, start=start, end=end) for account_id in account_ids}

    audits: list[RebalanceStateAccount] = []
    for audit_date in audit_dates:
        prices_today = board.close_on(audit_date)
        for account_id in account_ids:
            config = configs[account_id]
            account_before = _replay_account_state(
                trades,
                equity,
                account_id,
                audit_date,
                include_audit_date=False,
                config=config,
            )
            account_for_weights = _copy_account_state(account_before)
            exited = _apply_signal_exits(config, cache, board, account_for_weights, audit_date, prices_today)
            target_weights = _signal_rule_weights(
                config,
                cache,
                board,
                audit_date,
                prices_today,
                account=account_for_weights,
                excluded_symbols=exited,
            )
            rows = _rebalance_state_rows(
                config,
                cache,
                board,
                trades,
                audit_date,
                account_before,
                target_weights,
                top_rows=top_rows,
            )
            equity_before = account_before.equity(prices_today)
            audits.append(
                RebalanceStateAccount(
                    audit_date=audit_date,
                    account_id=account_id,
                    cash_before_krw=account_before.cash_krw,
                    equity_before_krw=equity_before,
                    open_positions_before=account_before.open_position_count(),
                    rows=tuple(rows),
                )
            )

    return _render_rebalance_state_report(
        account_ids=account_ids,
        audit_dates=audit_dates,
        audits=audits,
        top_rows=top_rows,
    )


def candidate_score_components(row: PitResearchBoardRow) -> dict[str, float]:
    """Return the observable components of ``candidate_score``."""

    upside = row.target_upside_at_pub * 1.4
    current = max(0.0, row.current_return)
    penalty = max(0.0, row.target_gap_pct * 0.25)
    return {
        "target_upside_component": round(float(upside), 6),
        "current_return_component": round(float(current), 6),
        "over_target_penalty": round(float(penalty), 6),
        "total": round(float(upside + current - penalty), 6),
    }


def _pit_signal_config(account_id: str, *, start: date, end: date) -> PitSignalRuleConfig:
    config = SimulationConfig(start_date=start, end_date=end)
    for account in config.accounts:
        if account.account_id == account_id:
            if not isinstance(account, PitSignalRuleConfig):
                raise ValueError(f"{account_id} is not a PIT signal-rule account")
            return account
    raise ValueError(f"Unknown account id: {account_id}")


def _admissible_rows(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    day: date,
    prices_today: dict[str, float],
) -> list[PitResearchBoardRow]:
    rows: list[PitResearchBoardRow] = []
    for row in _ranked_signal_rows(config, cache, day):
        if not _passes_entry_rule(config, row):
            continue
        price = prices_today.get(row.symbol) or board.asof(day, row.symbol)
        if price is None or price <= 0:
            continue
        rows.append(row)
    return rows


def _company_by_symbol(reports: pd.DataFrame) -> dict[str, str]:
    if reports.empty or "symbol" not in reports.columns or "company" not in reports.columns:
        return {}
    frame = reports.loc[:, ["symbol", "company"]].dropna(subset=["symbol"]).copy()
    frame["symbol"] = frame["symbol"].astype(str)
    frame["company"] = frame["company"].fillna("").astype(str)
    return dict(frame.groupby("symbol", sort=False)["company"].last())


def _first_buy_timing_rows(
    trades: pd.DataFrame,
    account_id: str,
    baseline_id: str,
) -> list[FirstBuyTimingRow]:
    if trades.empty:
        return []
    frame = trades.loc[:, ["account_id", "date", "symbol", "side"]].copy()
    frame["account_id"] = frame["account_id"].astype(str)
    frame["symbol"] = frame["symbol"].astype(str)
    frame["side"] = frame["side"].astype(str).str.lower()
    frame["date"] = pd.to_datetime(frame["date"]).dt.date

    candidate = _first_buy_by_symbol(frame, account_id)
    baseline = _first_buy_by_symbol(frame, baseline_id)
    symbols = sorted(set(candidate) | set(baseline))
    rows: list[FirstBuyTimingRow] = []
    for symbol in symbols:
        candidate_date = candidate.get(symbol)
        baseline_date = baseline.get(symbol)
        if candidate_date == baseline_date:
            continue
        lead_days = (
            (candidate_date - baseline_date).days
            if candidate_date is not None and baseline_date is not None
            else None
        )
        rows.append(
            FirstBuyTimingRow(
                symbol=symbol,
                candidate_first_buy=candidate_date,
                baseline_first_buy=baseline_date,
                candidate_minus_baseline_days=lead_days,
            )
        )
    return sorted(
        rows,
        key=lambda row: (
            row.candidate_minus_baseline_days is None,
            row.candidate_minus_baseline_days if row.candidate_minus_baseline_days is not None else 0,
            row.symbol,
        ),
    )


def _first_buy_by_symbol(frame: pd.DataFrame, account_id: str) -> dict[str, date]:
    selected = frame.loc[
        (frame["account_id"] == account_id) & (frame["side"] == "buy"), ["symbol", "date"]
    ].copy()
    if selected.empty:
        return {}
    return selected.groupby("symbol", sort=False)["date"].min().to_dict()


def _read_sim_trades(sim_dir: Path) -> pd.DataFrame:
    path = sim_dir / "trades.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing generated trades artifact: {path}")
    frame = pd.read_csv(path)
    if frame.empty:
        return frame
    frame["account_id"] = frame["account_id"].astype(str)
    frame["symbol"] = frame["symbol"].astype(str)
    frame["side"] = frame["side"].astype(str).str.lower()
    frame["date"] = pd.to_datetime(frame["date"]).dt.date
    return frame


def _read_sim_equity(sim_dir: Path) -> pd.DataFrame:
    path = sim_dir / "equity_daily.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing generated equity artifact: {path}")
    frame = pd.read_csv(path)
    if frame.empty:
        return frame
    frame["account_id"] = frame["account_id"].astype(str)
    frame["date"] = pd.to_datetime(frame["date"]).dt.date
    return frame


def _replay_account_state(
    trades: pd.DataFrame,
    equity: pd.DataFrame,
    account_id: str,
    audit_date: date,
    *,
    include_audit_date: bool,
    config: PitSignalRuleConfig,
) -> Account:
    account = Account(account_id=account_id, fees=config.fees or BrokerageFees())
    account.cash_krw = _cash_before_or_on(
        equity, account_id, audit_date, include_audit_date=include_audit_date
    )
    if trades.empty:
        return account
    if include_audit_date:
        selected = trades.loc[(trades["account_id"] == account_id) & (trades["date"] <= audit_date)].copy()
    else:
        selected = trades.loc[(trades["account_id"] == account_id) & (trades["date"] < audit_date)].copy()
    if selected.empty:
        return account
    selected = selected.sort_values(["date", "side", "symbol"])
    for row in selected.to_dict("records"):
        symbol = str(row["symbol"])
        lot = account.holdings.setdefault(symbol, Lot())
        qty = int(row.get("qty") or 0)
        if qty <= 0:
            continue
        if row.get("side") == "buy":
            cost = float(row.get("gross_krw") or 0.0) + float(row.get("commission_krw") or 0.0)
            lot.qty += qty
            lot.total_cost_krw += cost
            lot.avg_cost_krw = lot.total_cost_krw / lot.qty if lot.qty else 0.0
            lot.buy_count += 1
            when = row["date"]
            lot.last_buy_date = when
            if lot.first_buy_date is None:
                lot.first_buy_date = when
        elif row.get("side") == "sell" and lot.qty > 0:
            fill_qty = min(qty, lot.qty)
            cost_basis_sold = lot.avg_cost_krw * fill_qty
            lot.qty -= fill_qty
            lot.total_cost_krw = max(0.0, lot.total_cost_krw - cost_basis_sold)
            realized = row.get("realized_pnl_krw")
            if pd.notna(realized):
                lot.realized_pnl_krw += float(realized)
                account.realized_pnl_krw += float(realized)
            if lot.qty == 0:
                lot.avg_cost_krw = 0.0
                lot.total_cost_krw = 0.0
                lot.first_buy_date = None
                lot.buy_count = 0
    account.holdings = {symbol: lot for symbol, lot in account.holdings.items() if lot.qty > 0}
    return account


def _cash_before_or_on(
    equity: pd.DataFrame,
    account_id: str,
    audit_date: date,
    *,
    include_audit_date: bool,
) -> float:
    if equity.empty:
        return 0.0
    selected = equity.loc[equity["account_id"] == account_id, ["date", "cash_krw"]].copy()
    if selected.empty:
        return 0.0
    selected = selected.loc[
        selected["date"] <= audit_date if include_audit_date else selected["date"] < audit_date
    ]
    if selected.empty:
        return 0.0
    return float(selected.sort_values("date").iloc[-1]["cash_krw"])


def _copy_account_state(account: Account) -> Account:
    return Account.from_snapshot(account.to_snapshot())


def _rebalance_state_rows(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    trades: pd.DataFrame,
    audit_date: date,
    account_before: Account,
    target_weights: dict[str, float],
    *,
    top_rows: int,
) -> list[RebalanceStateRow]:
    prices_today = board.close_on(audit_date)
    ranked = _admissible_rows(config, cache, board, audit_date, prices_today)
    candidate_rank = {row.symbol: rank for rank, row in enumerate(ranked, start=1)}
    board_rank = _board_rank_map(ranked)
    row_by_symbol = {row.symbol: row for row in ranked}
    trade_by_symbol = _trades_on_date_by_symbol(trades, config.account_id, audit_date)
    symbols = set(account_before.holdings) | set(target_weights) | set(trade_by_symbol)
    symbols.update(row.symbol for row in ranked[: max(top_rows, config.top_n)])
    symbols.update(row.symbol for row in _board_sorted_objects(ranked)[: max(top_rows, config.top_n)])
    equity_before = account_before.equity(prices_today)

    rows: list[RebalanceStateRow] = []
    for symbol in sorted(
        symbols,
        key=lambda item: (
            min(candidate_rank.get(item, 9999), board_rank.get(item, 9999)),
            item,
        ),
    ):
        pit_row = row_by_symbol.get(symbol)
        lot = account_before.holdings.get(symbol)
        price = prices_today.get(symbol) or board.asof(audit_date, symbol)
        held_value = (lot.qty * price) if lot is not None and price is not None and price > 0 else 0.0
        trade = trade_by_symbol.get(symbol, {"action": "-", "qty": 0, "gross_krw": 0.0})
        rows.append(
            RebalanceStateRow(
                audit_date=audit_date,
                account_id=config.account_id,
                symbol=symbol,
                company=pit_row.company if pit_row is not None and pit_row.company else symbol,
                candidate_rank=candidate_rank.get(symbol),
                board_rank=board_rank.get(symbol),
                held_before=lot is not None and lot.qty > 0,
                held_weight_before=(held_value / equity_before)
                if equity_before > 0 and held_value > 0
                else None,
                target_weight=target_weights.get(symbol),
                trade_action=str(trade["action"]),
                trade_qty=int(trade["qty"]),
                trade_gross_krw=float(trade["gross_krw"]),
                current_return=pit_row.current_return if pit_row is not None else None,
                target_gap=pit_row.target_gap_pct if pit_row is not None else None,
            )
        )
    return rows


def _trades_on_date_by_symbol(
    trades: pd.DataFrame, account_id: str, audit_date: date
) -> dict[str, dict[str, object]]:
    if trades.empty:
        return {}
    selected = trades.loc[(trades["account_id"] == account_id) & (trades["date"] == audit_date)].copy()
    if selected.empty:
        return {}
    grouped: dict[str, dict[str, object]] = {}
    for symbol, group in selected.groupby("symbol", sort=False):
        sides = sorted(set(group["side"].astype(str)))
        action = "/".join(sides)
        grouped[str(symbol)] = {
            "action": action,
            "qty": int(group["qty"].fillna(0).sum()),
            "gross_krw": float(group["gross_krw"].fillna(0).sum()),
        }
    return grouped


def _next_rebalance_after(rebalance_dates: list[date], day: date, end: date) -> date:
    for rebalance_date in rebalance_dates:
        if rebalance_date > day:
            return rebalance_date
    return end


def _rank_snapshot(
    config: PitSignalRuleConfig,
    cache: PitResearchBoardCache,
    board: PriceBoard,
    day: date,
    next_day: date,
    symbol: str,
) -> RankSnapshot:
    prices_today = board.close_on(day)
    ranked = _admissible_rows(config, cache, board, day, prices_today)
    candidate_rank = {row.symbol: rank for rank, row in enumerate(ranked, start=1)}
    board_rank = _board_rank_map(ranked)
    row_by_symbol = {row.symbol: row for row in ranked}
    row = row_by_symbol.get(symbol)
    if row is None:
        return RankSnapshot(
            as_of_date=day,
            symbol=symbol,
            company="",
            candidate_rank=None,
            board_rank=None,
            candidate_score=None,
            board_score=None,
            target_upside=None,
            current_return=None,
            target_gap=None,
            report_age_days=None,
            distance_from_52w_high=None,
            ma_stack=None,
            forward_return=_forward_return(board, day, next_day, symbol),
        )
    return RankSnapshot(
        as_of_date=day,
        symbol=symbol,
        company=row.company,
        candidate_rank=candidate_rank.get(symbol),
        board_rank=board_rank.get(symbol),
        candidate_score=row.candidate_score,
        board_score=row.board_score,
        target_upside=row.target_upside_at_pub,
        current_return=row.current_return,
        target_gap=row.target_gap_pct,
        report_age_days=row.report_age_days,
        distance_from_52w_high=row.distance_from_52w_high,
        ma_stack=row.ma_stack,
        forward_return=_forward_return(board, day, next_day, symbol),
    )


def _board_sorted_rows(rows: list[PitResearchBoardRow]) -> list[str]:
    return [row.symbol for row in _board_sorted_objects(rows)]


def _board_sorted_objects(rows: list[PitResearchBoardRow]) -> list[PitResearchBoardRow]:
    return sorted(
        rows,
        key=lambda row: (
            -row.board_score,
            -row.candidate_score,
            row.publication_date,
            row.symbol,
        ),
    )


def _board_rank_map(rows: list[PitResearchBoardRow]) -> dict[str, int]:
    return {symbol: index for index, symbol in enumerate(_board_sorted_rows(rows), start=1)}


def _selection_diff_row(
    row: PitResearchBoardRow,
    *,
    side: str,
    candidate_rank: int | None,
    board_rank: int | None,
    forward_return: float | None,
    rebalance_date: date,
) -> SelectionDiffRow:
    return SelectionDiffRow(
        rebalance_date=rebalance_date,
        side=side,
        symbol=row.symbol,
        company=row.company,
        candidate_rank=candidate_rank,
        board_rank=board_rank,
        candidate_score=row.candidate_score,
        board_score=row.board_score,
        forward_return=forward_return,
        target_upside=row.target_upside_at_pub,
        current_return=row.current_return,
        target_gap=row.target_gap_pct,
    )


def _forward_return(board: PriceBoard, start_day: date, end_day: date, symbol: str) -> float | None:
    start_price = board.asof(start_day, symbol)
    end_price = board.asof(end_day, symbol)
    if start_price is None or end_price is None or start_price <= 0:
        return None
    return (end_price / start_price) - 1.0


def _mean_defined(values: list[float | None]) -> float | None:
    defined = [value for value in values if value is not None]
    if not defined:
        return None
    return sum(defined) / len(defined)


def _load_actions(sim_dir: Path, account_id: str) -> dict[date, str]:
    path = sim_dir / "daily_decisions.csv"
    if not path.exists():
        return {}
    frame = pd.read_csv(
        path,
        usecols=[
            "date",
            "account_id",
            "buy_count",
            "sell_count",
            "trade_count",
            "reasons",
        ],
    )
    selected = frame.loc[frame["account_id"].astype(str) == account_id].copy()
    if selected.empty:
        return {}
    selected["date"] = pd.to_datetime(selected["date"]).dt.date
    return {
        row["date"]: (
            f"trades={int(row.get('trade_count') or 0)} "
            f"buy={int(row.get('buy_count') or 0)} "
            f"sell={int(row.get('sell_count') or 0)} "
            f"reasons={row.get('reasons') or '-'}"
        )
        for row in selected.to_dict("records")
    }


def _render_report(
    *,
    account_id: str,
    config: PitSignalRuleConfig,
    rows: list[SelectionAuditRow],
    overlaps: list[float],
    action_by_date: dict[date, str],
    recent_rebalances: int,
) -> str:
    selected_counter = Counter(row.symbol for row in rows)
    company_by_symbol = {row.symbol: row.company for row in rows}
    rebalance_dates = sorted({row.rebalance_date for row in rows})
    recent_dates = set(rebalance_dates[-recent_rebalances:])
    recent_rows = [row for row in rows if row.rebalance_date in recent_dates]
    mean_overlap = sum(overlaps) / len(overlaps) if overlaps else 0.0

    lines = [
        f"# Selection Audit: `{account_id}`",
        "",
        "## Score Formula",
        "",
        "`candidate_score = 1.4 * target_upside_at_publication + max(current_return, 0) - max(target_gap_to_target * 0.25, 0)`",
        "",
        "All fields are measured on the rebalance date from committed warehouse prices and reports. "
        "No future return, future target hit, or future price path is used.",
        "",
        "## Summary",
        "",
        f"- Rebalance cadence: `{config.rebalance}`",
        f"- Score field: `{config.score_field}`",
        f"- Top-N: `{config.top_n}`",
        f"- Rebalance dates audited: {len(rebalance_dates)}",
        f"- Distinct selected symbols: {len(selected_counter)}",
        f"- Mean overlap with board-score Top{config.top_n}: {_format_percent(mean_overlap)}",
        "",
        "## Most Frequent Top-N Selections",
        "",
        "| symbol | company | selected rebalances |",
        "| --- | --- | ---: |",
    ]
    for symbol, count in selected_counter.most_common(12):
        lines.append(f"| `{symbol}` | {_escape_md_cell(company_by_symbol.get(symbol, symbol))} | {count} |")

    lines.extend(
        [
            "",
            f"## Recent {min(recent_rebalances, len(rebalance_dates))} Rebalance Boards",
            "",
            "| date | rank | board rank | symbol | company | score | upside part | winner part | over-target penalty | target upside | current return | target gap | age | 52w gap | MA stack | action note |",
            "| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
        ]
    )
    for row in recent_rows:
        lines.append(
            "| "
            f"{row.rebalance_date.isoformat()} | "
            f"{row.rank} | "
            f"{row.board_rank if row.board_rank is not None else '-'} | "
            f"`{row.symbol}` | "
            f"{_escape_md_cell(row.company)} | "
            f"{row.score:.2f} | "
            f"{row.target_upside_component:.2f} | "
            f"{row.current_return_component:.2f} | "
            f"{row.over_target_penalty:.2f} | "
            f"{_format_percent(row.target_upside)} | "
            f"{_format_percent(row.current_return)} | "
            f"{_format_percent(row.target_gap)} | "
            f"{row.report_age_days} | "
            f"{_format_percent(row.distance_from_52w_high)} | "
            f"{_format_bool(row.ma_stack)} | "
            f"{_escape_md_cell(action_by_date.get(row.rebalance_date, ''))} |"
        )
    lines.append("")
    return "\n".join(lines)


def _render_entry_timing_report(
    *,
    account_id: str,
    baseline_id: str,
    config: PitSignalRuleConfig,
    rows: list[EntryTimingAuditRow],
) -> str:
    earlier = [
        row
        for row in rows
        if row.timing.candidate_minus_baseline_days is not None
        and row.timing.candidate_minus_baseline_days < 0
    ]
    later = [
        row
        for row in rows
        if row.timing.candidate_minus_baseline_days is not None
        and row.timing.candidate_minus_baseline_days > 0
    ]
    candidate_only = [row for row in rows if row.timing.baseline_first_buy is None]
    baseline_only = [row for row in rows if row.timing.candidate_first_buy is None]
    common_leads = [
        row.timing.candidate_minus_baseline_days
        for row in rows
        if row.timing.candidate_minus_baseline_days is not None
    ]
    candidate_entry_top_n = [
        row
        for row in rows
        if row.candidate_entry_snapshot is not None
        and row.candidate_entry_snapshot.board_rank is not None
        and row.candidate_entry_snapshot.board_rank <= config.top_n
    ]

    lines = [
        f"# Entry Timing Audit: `{account_id}`",
        "",
        "## Scope",
        "",
        f"Candidate account: `{account_id}`",
        "",
        f"Baseline account: `{baseline_id}`",
        "",
        "This report starts from generated trade ledgers, finds symbols whose first buy date differs, "
        "then reconstructs the point-in-time rank board on each account's first-buy date. Rank fields "
        "use only data available on that date. Forward returns are ex-post review evidence only.",
        "",
        "## Summary",
        "",
        f"- Rebalance cadence: `{config.rebalance}`",
        f"- Top-N: `{config.top_n}`",
        f"- Symbols with different first-buy timing: {len(rows)}",
        f"- Candidate entered earlier: {len(earlier)}",
        f"- Candidate entered later: {len(later)}",
        f"- Candidate-only traded symbols: {len(candidate_only)}",
        f"- Baseline-only traded symbols: {len(baseline_only)}",
        f"- Mean candidate minus baseline days: {_format_days(_mean_defined(common_leads))}",
        f"- Candidate first-buy date also board-score Top{config.top_n}: {len(candidate_entry_top_n)}",
        "",
        "## Timing Rows",
        "",
        "| symbol | company | candidate first buy | baseline first buy | candidate minus baseline | candidate-date candidate rank | candidate-date board rank | baseline-date candidate rank | baseline-date board rank | audited entry next return | audited target upside | audited current return | audited target gap | age | 52w gap | MA stack |",
        "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for row in rows:
        candidate_snapshot = row.candidate_entry_snapshot
        baseline_snapshot = row.baseline_entry_snapshot
        audited_snapshot = candidate_snapshot if candidate_snapshot is not None else baseline_snapshot
        lines.append(
            "| "
            f"`{row.timing.symbol}` | "
            f"{_escape_md_cell(row.company)} | "
            f"{_format_date(row.timing.candidate_first_buy)} | "
            f"{_format_date(row.timing.baseline_first_buy)} | "
            f"{_format_days(row.timing.candidate_minus_baseline_days)} | "
            f"{_format_rank(candidate_snapshot.candidate_rank if candidate_snapshot else None)} | "
            f"{_format_rank(candidate_snapshot.board_rank if candidate_snapshot else None)} | "
            f"{_format_rank(baseline_snapshot.candidate_rank if baseline_snapshot else None)} | "
            f"{_format_rank(baseline_snapshot.board_rank if baseline_snapshot else None)} | "
            f"{_format_percent(audited_snapshot.forward_return if audited_snapshot else None)} | "
            f"{_format_percent(audited_snapshot.target_upside if audited_snapshot else None)} | "
            f"{_format_percent(audited_snapshot.current_return if audited_snapshot else None)} | "
            f"{_format_percent(audited_snapshot.target_gap if audited_snapshot else None)} | "
            f"{audited_snapshot.report_age_days if audited_snapshot and audited_snapshot.report_age_days is not None else '-'} | "
            f"{_format_percent(audited_snapshot.distance_from_52w_high if audited_snapshot else None)} | "
            f"{_format_bool(audited_snapshot.ma_stack if audited_snapshot else None)} |"
        )
    lines.append("")
    return "\n".join(lines)


def _render_rebalance_state_report(
    *,
    account_ids: list[str],
    audit_dates: list[date],
    audits: list[RebalanceStateAccount],
    top_rows: int,
) -> str:
    lines = [
        "# Rebalance State Audit",
        "",
        "## Scope",
        "",
        "This report reconstructs account state immediately before selected rebalance dates and "
        "compares holdings, same-day PIT ranks, target weights, and actual generated trades. "
        "Rank and target-weight fields use only data visible on the audit date; generated trade "
        "ledgers are used only to explain what the already-simulated account did.",
        "",
        "## Parameters",
        "",
        f"- Accounts: {', '.join(f'`{account_id}`' for account_id in account_ids)}",
        f"- Dates: {', '.join(day.isoformat() for day in audit_dates)}",
        f"- Rank rows shown per account/date: candidate Top{top_rows} + board Top{top_rows} + held/traded/target symbols",
        "",
    ]

    for audit_date in audit_dates:
        date_audits = [audit for audit in audits if audit.audit_date == audit_date]
        lines.extend(
            [
                f"## {audit_date.isoformat()}",
                "",
                "| account | equity before | cash before | open positions before | target symbols | buy/sell symbols |",
                "| --- | ---: | ---: | ---: | --- | --- |",
            ]
        )
        for audit in date_audits:
            target_symbols = [row.symbol for row in audit.rows if row.target_weight is not None]
            trade_symbols = [
                f"{row.trade_action}:{row.symbol}"
                for row in audit.rows
                if row.trade_action and row.trade_action != "-"
            ]
            lines.append(
                "| "
                f"`{audit.account_id}` | "
                f"{_format_krw(audit.equity_before_krw)} | "
                f"{_format_krw(audit.cash_before_krw)} | "
                f"{audit.open_positions_before} | "
                f"{_escape_md_cell(', '.join(target_symbols) or '-')} | "
                f"{_escape_md_cell(', '.join(trade_symbols) or '-')} |"
            )

        for audit in date_audits:
            lines.extend(
                [
                    "",
                    f"### `{audit.account_id}`",
                    "",
                    "| symbol | company | cand rank | board rank | held before | held weight | target weight | trade | gross | current return | target gap |",
                    "| --- | --- | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |",
                ]
            )
            for row in audit.rows:
                lines.append(
                    "| "
                    f"`{row.symbol}` | "
                    f"{_escape_md_cell(row.company)} | "
                    f"{_format_rank(row.candidate_rank)} | "
                    f"{_format_rank(row.board_rank)} | "
                    f"{'Y' if row.held_before else '-'} | "
                    f"{_format_percent(row.held_weight_before)} | "
                    f"{_format_percent(row.target_weight)} | "
                    f"{_escape_md_cell(_format_trade(row))} | "
                    f"{_format_krw(row.trade_gross_krw) if row.trade_gross_krw else '-'} | "
                    f"{_format_percent(row.current_return)} | "
                    f"{_format_percent(row.target_gap)} |"
                )
        lines.append("")
    return "\n".join(lines)


def _render_diff_report(
    *,
    account_id: str,
    config: PitSignalRuleConfig,
    rows: list[SelectionDiffRow],
    spreads: list[float],
) -> str:
    candidate_rows = [row for row in rows if row.side == "candidate_only"]
    board_rows = [row for row in rows if row.side == "board_only"]
    divergent_dates = sorted({row.rebalance_date for row in rows})
    candidate_forward = _mean_defined([row.forward_return for row in candidate_rows])
    board_forward = _mean_defined([row.forward_return for row in board_rows])
    mean_spread = _mean_defined(spreads)

    lines = [
        f"# Selection Difference Audit: `{account_id}`",
        "",
        "## Scope",
        "",
        "This report compares the promoted candidate-score Top-N selection with the board-score Top-N "
        "selection on the same admissible PIT universe. Set membership uses only fields available on "
        "the rebalance date. The next-rebalance return is ex-post review evidence and is not used by "
        "the strategy.",
        "",
        "## Summary",
        "",
        f"- Rebalance cadence: `{config.rebalance}`",
        f"- Top-N: `{config.top_n}`",
        f"- Divergent rebalance dates: {len(divergent_dates)}",
        f"- Candidate-only rows: {len(candidate_rows)}",
        f"- Board-only rows: {len(board_rows)}",
        f"- Candidate-only mean next-rebalance return: {_format_percent(candidate_forward)}",
        f"- Board-only mean next-rebalance return: {_format_percent(board_forward)}",
        f"- Mean candidate minus board spread on divergent dates: {_format_percent(mean_spread)}",
        "",
        "## Difference Rows",
        "",
        "| date | side | symbol | company | candidate rank | board rank | candidate score | board score | next-rebalance return | target upside | current return | target gap |",
        "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in rows:
        lines.append(
            "| "
            f"{row.rebalance_date.isoformat()} | "
            f"{row.side} | "
            f"`{row.symbol}` | "
            f"{_escape_md_cell(row.company)} | "
            f"{row.candidate_rank if row.candidate_rank is not None else '-'} | "
            f"{row.board_rank if row.board_rank is not None else '-'} | "
            f"{row.candidate_score:.2f} | "
            f"{row.board_score:.2f} | "
            f"{_format_percent(row.forward_return)} | "
            f"{_format_percent(row.target_upside)} | "
            f"{_format_percent(row.current_return)} | "
            f"{_format_percent(row.target_gap)} |"
        )
    lines.append("")
    return "\n".join(lines)


def _format_percent(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.2f}%"


def _format_days(value: float | int | None) -> str:
    if value is None:
        return "-"
    return f"{value:.1f}" if isinstance(value, float) and not value.is_integer() else str(int(value))


def _format_date(value: date | None) -> str:
    if value is None:
        return "-"
    return value.isoformat()


def _format_rank(value: int | None) -> str:
    if value is None:
        return "-"
    return str(value)


def _format_krw(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:,.0f}"


def _format_trade(row: RebalanceStateRow) -> str:
    if not row.trade_action or row.trade_action == "-":
        return "-"
    return f"{row.trade_action} {row.trade_qty}"


def _format_bool(value: bool | None) -> str:
    if value is None:
        return "-"
    return "Y" if value else "N"


def _escape_md_cell(value: object) -> str:
    return str(value).replace("|", "\\|")
