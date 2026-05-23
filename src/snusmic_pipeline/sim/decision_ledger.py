"""Daily decision ledger derived from the account simulation.

The full simulator can be replayed historically, but the product surface should
think in one-day increments: after today's close, what did each account decide
to do, and what account state did that leave behind?
"""

from __future__ import annotations

import pandas as pd

from .contracts import SimulationResult

DECISION_COLUMNS = [
    "date",
    "account_id",
    "decision",
    "buy_count",
    "sell_count",
    "trade_count",
    "symbols",
    "reasons",
    "cash_krw",
    "holdings_value_krw",
    "equity_krw",
    "contributed_capital_krw",
    "net_profit_krw",
    "open_positions",
]


def build_daily_decision_ledger(result: SimulationResult) -> pd.DataFrame:
    """Return one row per account_id per trading day.

    Trade rows already contain fill-level detail. This ledger is the daily
    decision surface: buy/sell/rebalance/hold plus the post-decision account
    snapshot from the equity curve.
    """

    equity = pd.DataFrame([point.model_dump() for point in result.equity_points])
    if equity.empty:
        return pd.DataFrame(columns=DECISION_COLUMNS)
    equity["date"] = equity["date"].astype(str)
    equity["account_id"] = equity["account_id"].astype(str)

    trades = pd.DataFrame([trade.model_dump() for trade in result.trades])
    if trades.empty:
        out = equity.copy()
        out["decision"] = "hold"
        out["buy_count"] = 0
        out["sell_count"] = 0
        out["trade_count"] = 0
        out["symbols"] = ""
        out["reasons"] = ""
        return out[DECISION_COLUMNS].sort_values(["date", "account_id"]).reset_index(drop=True)

    trades["date"] = trades["date"].astype(str)
    trades["account_id"] = trades["account_id"].astype(str)
    trades["symbol"] = trades["symbol"].astype(str)
    trades["reason"] = trades["reason"].astype(str)
    trades["side"] = trades["side"].astype(str)
    grouped = trades.groupby(["date", "account_id"], as_index=False).agg(
        buy_count=("side", lambda values: int((values == "buy").sum())),
        sell_count=("side", lambda values: int((values == "sell").sum())),
        trade_count=("side", "size"),
        symbols=("symbol", _join_unique),
        reasons=("reason", _join_unique),
    )
    out = equity.merge(grouped, on=["date", "account_id"], how="left")
    for column in ("buy_count", "sell_count", "trade_count"):
        out[column] = pd.to_numeric(out[column], errors="coerce").fillna(0).astype(int)
    out["symbols"] = out["symbols"].fillna("")
    out["reasons"] = out["reasons"].fillna("")
    out["decision"] = out.apply(_decision_label, axis=1)
    return out[DECISION_COLUMNS].sort_values(["date", "account_id"]).reset_index(drop=True)


def _join_unique(values: pd.Series) -> str:
    return "|".join(sorted({str(value) for value in values if str(value)}))


def _decision_label(row: pd.Series) -> str:
    buy_count = int(row.get("buy_count") or 0)
    sell_count = int(row.get("sell_count") or 0)
    if buy_count > 0 and sell_count > 0:
        return "rebalance"
    if buy_count > 0:
        return "buy"
    if sell_count > 0:
        return "sell"
    return "hold"
