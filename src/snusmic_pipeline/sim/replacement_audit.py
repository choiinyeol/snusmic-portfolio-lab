"""Replacement-event audit reports for PIT signal accounts."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

import pandas as pd

from .accounts.pit_score import _rebalance_days
from .market import PriceBoard
from .pit_research_board import PitResearchBoardCache
from .runner import _prepare_reports
from .selection_audit import (
    _admissible_rows,
    _board_rank_map,
    _forward_return,
    _mean_defined,
    _pit_signal_config,
    _read_sim_equity,
    _read_sim_trades,
    _replay_account_state,
)
from .target_adjustment import align_report_targets_to_market_scale
from .warehouse import read_table


@dataclass(frozen=True)
class ReplacementEventRow:
    rebalance_date: date
    next_rebalance_date: date
    dropped_symbols: tuple[str, ...]
    replacement_symbol: str
    replacement_company: str
    candidate_rank: int | None
    board_rank: int | None
    candidate_score: float | None
    board_score: float | None
    target_upside: float | None
    current_return: float | None
    target_gap: float | None
    report_age_days: int | None
    return_3m: float | None
    return_6m: float | None
    distance_from_52w_high: float | None
    next_rebalance_return: float | None
    best_available_symbol: str | None
    best_available_company: str | None
    best_available_return: float | None
    selected_minus_best: float | None
    held_until_next_rebalance: bool


def build_replacement_event_audit_report(
    warehouse_dir: Path,
    sim_dir: Path,
    account_id: str,
    *,
    start: date,
    end: date,
    top_rows: int = 20,
) -> str:
    """Build an ex-post audit of same-rebalance replacement buys.

    Decision fields are reconstructed from the point-in-time board on the
    rebalance date. Forward returns and best-available comparisons are ex-post
    review evidence only and must not be used by trading rules.
    """

    config, rows = _collect_replacement_event_rows(warehouse_dir, sim_dir, account_id, start=start, end=end)
    return _render_replacement_event_report(
        account_id=account_id,
        config_label=config.label,
        rows=rows,
        top_rows=top_rows,
    )


def build_replacement_feature_audit_report(
    warehouse_dir: Path,
    sim_dir: Path,
    account_id: str,
    *,
    start: date,
    end: date,
) -> str:
    """Build a bucketed ex-post review of observable replacement-entry features."""

    config, rows = _collect_replacement_event_rows(warehouse_dir, sim_dir, account_id, start=start, end=end)
    return _render_replacement_feature_report(account_id=account_id, config_label=config.label, rows=rows)


def _collect_replacement_event_rows(
    warehouse_dir: Path,
    sim_dir: Path,
    account_id: str,
    *,
    start: date,
    end: date,
):
    config = _pit_signal_config(account_id, start=start, end=end)
    board = PriceBoard.from_warehouse(warehouse_dir)
    if board.is_empty:
        raise RuntimeError(f"Warehouse {warehouse_dir} has no daily price rows")
    trading_dates = board.trading_dates(start=start, end=end)
    reports = read_table(warehouse_dir, "reports")
    reports = _prepare_reports(reports, start, end)
    reports = align_report_targets_to_market_scale(reports, board, end)
    cache = PitResearchBoardCache(reports, board)
    trades = _read_sim_trades(sim_dir)
    equity = _read_sim_equity(sim_dir)

    rebalance_dates = sorted(
        _rebalance_days(
            trading_dates,
            config.rebalance,
            quarter_offset_months=config.quarter_offset_months,
        )
    )
    rows: list[ReplacementEventRow] = []
    for index, rebalance_date in enumerate(rebalance_dates):
        next_rebalance = rebalance_dates[index + 1] if index + 1 < len(rebalance_dates) else end
        day_trades = _account_trades_on_date(trades, account_id, rebalance_date)
        dropped_symbols = _symbols_by_side_and_reason(day_trades, side="sell", reason="rebalance_sell")
        replacement_symbols = _symbols_by_side_and_reason(day_trades, side="buy", reason="rebalance_buy")
        if not dropped_symbols or not replacement_symbols:
            continue

        prices_today = board.close_on(rebalance_date)
        before = _replay_account_state(
            trades,
            equity,
            account_id,
            rebalance_date,
            include_audit_date=False,
            config=config,
        )
        held_next = set(
            _replay_account_state(
                trades,
                equity,
                account_id,
                next_rebalance,
                include_audit_date=False,
                config=config,
            ).holdings
        )
        ranked = _admissible_rows(config, cache, board, rebalance_date, prices_today)
        candidate_rank = {row.symbol: rank for rank, row in enumerate(ranked, start=1)}
        board_rank = _board_rank_map(ranked)
        row_by_symbol = {row.symbol: row for row in ranked}
        best_symbol, best_return = _best_available_forward_return(
            board,
            ranked,
            rebalance_date,
            next_rebalance,
            held_before=set(before.holdings),
        )
        best_row = row_by_symbol.get(best_symbol or "")

        for symbol in sorted(replacement_symbols):
            if symbol in before.holdings:
                continue
            pit_row = row_by_symbol.get(symbol)
            forward_return = _forward_return(board, rebalance_date, next_rebalance, symbol)
            rows.append(
                ReplacementEventRow(
                    rebalance_date=rebalance_date,
                    next_rebalance_date=next_rebalance,
                    dropped_symbols=tuple(sorted(dropped_symbols)),
                    replacement_symbol=symbol,
                    replacement_company=pit_row.company if pit_row is not None else symbol,
                    candidate_rank=candidate_rank.get(symbol),
                    board_rank=board_rank.get(symbol),
                    candidate_score=pit_row.candidate_score if pit_row is not None else None,
                    board_score=pit_row.board_score if pit_row is not None else None,
                    target_upside=pit_row.target_upside_at_pub if pit_row is not None else None,
                    current_return=pit_row.current_return if pit_row is not None else None,
                    target_gap=pit_row.target_gap_pct if pit_row is not None else None,
                    report_age_days=pit_row.report_age_days if pit_row is not None else None,
                    return_3m=pit_row.return_3m if pit_row is not None else None,
                    return_6m=pit_row.return_6m if pit_row is not None else None,
                    distance_from_52w_high=(pit_row.distance_from_52w_high if pit_row is not None else None),
                    next_rebalance_return=forward_return,
                    best_available_symbol=best_symbol,
                    best_available_company=best_row.company if best_row is not None else best_symbol,
                    best_available_return=best_return,
                    selected_minus_best=(
                        forward_return - best_return
                        if forward_return is not None and best_return is not None
                        else None
                    ),
                    held_until_next_rebalance=symbol in held_next,
                )
            )

    return config, rows


def _render_replacement_feature_report(
    *,
    account_id: str,
    config_label: str,
    rows: list[ReplacementEventRow],
) -> str:
    selected_returns = [row.next_rebalance_return for row in rows]
    selected_minus_best = [row.selected_minus_best for row in rows]
    lines = [
        f"# Replacement Feature Audit: `{account_id}`",
        "",
        "## Scope",
        "",
        f"Account label: {config_label}",
        "",
        "This report groups same-rebalance replacement buys by features visible on the "
        "rebalance date. Forward returns are ex-post audit evidence only; the bucket "
        "labels are the only strategy-eligible side of this report.",
        "",
        "## Summary",
        "",
        f"- Replacement buys audited: {len(rows)}",
        f"- Mean next-rebalance return: {_format_percent(_mean_defined(selected_returns))}",
        f"- Mean selected minus best available: {_format_percent(_mean_defined(selected_minus_best))}",
        "",
    ]
    feature_specs = [
        ("candidate rank", lambda row: _bucket_rank(row.candidate_rank)),
        ("board rank", lambda row: _bucket_rank(row.board_rank)),
        ("report age", lambda row: _bucket_report_age(row.report_age_days)),
        ("3M return", lambda row: _bucket_signed_return(row.return_3m)),
        ("6M return", lambda row: _bucket_signed_return(row.return_6m)),
        ("distance from 52W high", lambda row: _bucket_high_gap(row.distance_from_52w_high)),
        ("current return since report", lambda row: _bucket_current_return(row.current_return)),
        ("target gap", lambda row: _bucket_target_gap(row.target_gap)),
    ]
    for title, bucket_fn in feature_specs:
        lines.extend(_render_feature_bucket_table(title, rows, bucket_fn))

    worst_rows = sorted(
        rows,
        key=lambda row: row.next_rebalance_return if row.next_rebalance_return is not None else 999.0,
    )[:12]
    lines.extend(
        [
            "## Worst Replacement Rows",
            "",
            "| date | replacement | company | cand rank | report age | 3M | 6M | 52W gap | current return | target gap | next return |",
            "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for row in worst_rows:
        lines.append(
            "| "
            f"{row.rebalance_date.isoformat()} | "
            f"`{row.replacement_symbol}` | "
            f"{_escape_md_cell(row.replacement_company)} | "
            f"{_format_rank(row.candidate_rank)} | "
            f"{_format_days(row.report_age_days)} | "
            f"{_format_percent(row.return_3m)} | "
            f"{_format_percent(row.return_6m)} | "
            f"{_format_percent(row.distance_from_52w_high)} | "
            f"{_format_percent(row.current_return)} | "
            f"{_format_percent(row.target_gap)} | "
            f"{_format_percent(row.next_rebalance_return)} |"
        )
    lines.append("")
    return "\n".join(lines)


def _render_feature_bucket_table(title: str, rows: list[ReplacementEventRow], bucket_fn) -> list[str]:
    grouped: dict[str, list[ReplacementEventRow]] = {}
    for row in rows:
        grouped.setdefault(bucket_fn(row), []).append(row)
    ordered = sorted(grouped.items(), key=lambda item: _bucket_sort_key(item[0]))
    lines = [
        f"## Bucket: {title}",
        "",
        "| bucket | count | positive | mean next return | mean selected-best |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for bucket, bucket_rows in ordered:
        returns = [row.next_rebalance_return for row in bucket_rows]
        selected_minus_best = [row.selected_minus_best for row in bucket_rows]
        positive = sum(1 for value in returns if value is not None and value > 0)
        lines.append(
            "| "
            f"{bucket} | "
            f"{len(bucket_rows)} | "
            f"{positive}/{len(bucket_rows)} | "
            f"{_format_percent(_mean_defined(returns))} | "
            f"{_format_percent(_mean_defined(selected_minus_best))} |"
        )
    lines.append("")
    return lines


def _bucket_sort_key(bucket: str) -> tuple[int, str]:
    prefixes = ("missing", "<", "0", "1", "3", "6", "9", "top", "rank", ">")
    for index, prefix in enumerate(prefixes):
        if bucket.startswith(prefix):
            return index, bucket
    return len(prefixes), bucket


def _bucket_rank(value: int | None) -> str:
    if value is None:
        return "missing"
    if value <= 2:
        return "top 1-2"
    if value <= 5:
        return "rank 3-5"
    if value <= 10:
        return "rank 6-10"
    return ">10"


def _bucket_report_age(value: int | None) -> str:
    if value is None:
        return "missing"
    if value <= 90:
        return "0-90d"
    if value <= 180:
        return "91-180d"
    if value <= 365:
        return "181-365d"
    return ">365d"


def _bucket_signed_return(value: float | None) -> str:
    if value is None:
        return "missing"
    if value < 0:
        return "<0%"
    if value < 0.2:
        return "0-20%"
    if value < 0.5:
        return "20-50%"
    return ">=50%"


def _bucket_high_gap(value: float | None) -> str:
    if value is None:
        return "missing"
    if value >= -0.05:
        return "within 5%"
    if value >= -0.10:
        return "5-10% below"
    if value >= -0.20:
        return "10-20% below"
    return ">20% below"


def _bucket_current_return(value: float | None) -> str:
    if value is None:
        return "missing"
    if value < 0:
        return "<0%"
    if value < 0.3:
        return "0-30%"
    if value < 1.0:
        return "30-100%"
    return ">=100%"


def _bucket_target_gap(value: float | None) -> str:
    if value is None:
        return "missing"
    if value <= 0:
        return "<=0%"
    if value <= 0.25:
        return "0-25%"
    if value <= 1.0:
        return "25-100%"
    return ">100%"


def _account_trades_on_date(trades: pd.DataFrame, account_id: str, day: date) -> pd.DataFrame:
    if trades.empty:
        return trades
    return trades.loc[(trades["account_id"] == account_id) & (trades["date"] == day)].copy()


def _symbols_by_side_and_reason(trades: pd.DataFrame, *, side: str, reason: str) -> set[str]:
    if trades.empty:
        return set()
    selected = trades.loc[
        (trades["side"].astype(str).str.lower() == side) & (trades["reason"].astype(str) == reason)
    ]
    return set(selected["symbol"].astype(str))


def _best_available_forward_return(
    board: PriceBoard,
    ranked,
    start_day: date,
    end_day: date,
    *,
    held_before: set[str],
) -> tuple[str | None, float | None]:
    best_symbol: str | None = None
    best_return: float | None = None
    for row in ranked:
        if row.symbol in held_before:
            continue
        forward_return = _forward_return(board, start_day, end_day, row.symbol)
        if forward_return is None:
            continue
        if best_return is None or forward_return > best_return:
            best_symbol = row.symbol
            best_return = forward_return
    return best_symbol, best_return


def _render_replacement_event_report(
    *,
    account_id: str,
    config_label: str,
    rows: list[ReplacementEventRow],
    top_rows: int,
) -> str:
    selected_returns = [row.next_rebalance_return for row in rows]
    selected_minus_best = [row.selected_minus_best for row in rows]
    positive_rows = [
        row for row in rows if row.next_rebalance_return is not None and row.next_rebalance_return > 0
    ]
    held_rows = [row for row in rows if row.held_until_next_rebalance]
    sorted_rows = sorted(
        rows,
        key=lambda row: row.next_rebalance_return if row.next_rebalance_return is not None else -999.0,
        reverse=True,
    )
    selected = sorted_rows[:top_rows] + sorted_rows[-top_rows:]
    deduped = list(dict.fromkeys(selected))

    lines = [
        f"# Replacement Event Audit: `{account_id}`",
        "",
        "## Scope",
        "",
        f"Account label: {config_label}",
        "",
        "A replacement event is a rebalance date where the account both sells at least one "
        "`rebalance_sell` symbol and buys at least one new `rebalance_buy` symbol. Rank and "
        "score columns are reconstructed from fields visible on that rebalance date. "
        "Forward-return and best-available columns are ex-post review evidence only.",
        "",
        "## Summary",
        "",
        f"- Replacement buys audited: {len(rows)}",
        f"- Mean next-rebalance return: {_format_percent(_mean_defined(selected_returns))}",
        f"- Positive next-rebalance replacements: {len(positive_rows)} / {len(rows)}",
        f"- Held until next rebalance: {len(held_rows)} / {len(rows)}",
        f"- Mean selected minus best available: {_format_percent(_mean_defined(selected_minus_best))}",
        "",
        "## Replacement Rows",
        "",
        "| date | next rebalance | dropped | replacement | company | cand rank | board rank | cand score | board score | target upside | current return | target gap | next return | best available | best return | selected-best | held next |",
        "| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |",
    ]
    for row in deduped:
        lines.append(
            "| "
            f"{row.rebalance_date.isoformat()} | "
            f"{row.next_rebalance_date.isoformat()} | "
            f"{_escape_md_cell(', '.join(row.dropped_symbols))} | "
            f"`{row.replacement_symbol}` | "
            f"{_escape_md_cell(row.replacement_company)} | "
            f"{_format_rank(row.candidate_rank)} | "
            f"{_format_rank(row.board_rank)} | "
            f"{_format_num(row.candidate_score)} | "
            f"{_format_num(row.board_score)} | "
            f"{_format_percent(row.target_upside)} | "
            f"{_format_percent(row.current_return)} | "
            f"{_format_percent(row.target_gap)} | "
            f"{_format_percent(row.next_rebalance_return)} | "
            f"`{row.best_available_symbol or '-'}` | "
            f"{_format_percent(row.best_available_return)} | "
            f"{_format_percent(row.selected_minus_best)} | "
            f"{'Y' if row.held_until_next_rebalance else '-'} |"
        )
    lines.append("")
    return "\n".join(lines)


def _format_percent(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.2f}%"


def _format_num(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}"


def _format_days(value: int | None) -> str:
    if value is None:
        return "-"
    return str(value)


def _format_rank(value: int | None) -> str:
    if value is None:
        return "-"
    return str(value)


def _escape_md_cell(value: object) -> str:
    return str(value).replace("|", "\\|")
