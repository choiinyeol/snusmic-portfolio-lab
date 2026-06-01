"""Markdown comparison tables for strategy research iterations."""

from __future__ import annotations

from pathlib import Path
from typing import cast

import pandas as pd

SUMMARY_COLUMNS = [
    "account_id",
    "money_weighted_return",
    "time_weighted_return",
    "cagr",
    "max_drawdown",
    "sharpe",
    "sortino",
    "final_equity_krw",
    "trade_count",
]


def build_research_report(
    sim_dir: Path,
    account_ids: list[str],
    *,
    baseline_id: str | None = None,
    title: str = "Strategy Research Extract",
) -> str:
    """Return a Markdown report from generated simulation artifacts."""
    if not account_ids:
        raise ValueError("at least one account id is required")

    summary = _read_csv(sim_dir / "summary.csv")
    trades = _read_csv(sim_dir / "trades.csv")
    equity = _read_csv(sim_dir / "equity_daily.csv")
    _require_accounts(summary, account_ids, "summary.csv")
    if baseline_id:
        _require_accounts(summary, [baseline_id], "summary.csv")

    lines = [f"# {title}", ""]
    lines.extend(_summary_table(summary, account_ids))

    if baseline_id:
        lines.append("")
        lines.extend(_daily_delta_table(equity, account_ids, baseline_id))

    lines.append("")
    lines.extend(_trade_reason_table(trades, account_ids))
    lines.append("")
    return "\n".join(lines)


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"missing simulation artifact: {path}")
    return pd.read_csv(path)


def _require_accounts(summary: pd.DataFrame, account_ids: list[str], source: str) -> None:
    available = set(summary["account_id"].astype(str))
    missing = [account_id for account_id in account_ids if account_id not in available]
    if missing:
        raise ValueError(f"{source} does not contain account rows: {', '.join(missing)}")


def _summary_table(summary: pd.DataFrame, account_ids: list[str]) -> list[str]:
    rows = summary.loc[summary["account_id"].isin(account_ids), SUMMARY_COLUMNS].copy()
    rows["account_id"] = pd.Categorical(rows["account_id"], categories=account_ids, ordered=True)
    rows = rows.sort_values("account_id")

    lines = [
        "## Summary",
        "",
        "| account | MWR | TWR | CAGR | MDD | Sharpe | Sortino | final equity | trades |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in rows.itertuples(index=False):
        lines.append(
            "| "
            + " | ".join(
                [
                    f"`{row.account_id}`",
                    _pct(cast(float, row.money_weighted_return)),
                    _pct(cast(float, row.time_weighted_return)),
                    _pct(cast(float, row.cagr)),
                    _pct(cast(float, row.max_drawdown)),
                    _num(cast(float, row.sharpe)),
                    _num(cast(float, row.sortino)),
                    _money_m(cast(float, row.final_equity_krw)),
                    f"{int(cast(float, row.trade_count)):,}",
                ]
            )
            + " |"
        )
    return lines


def _daily_delta_table(equity: pd.DataFrame, account_ids: list[str], baseline_id: str) -> list[str]:
    selected = [*account_ids, baseline_id]
    _require_accounts(equity, selected, "equity_daily.csv")
    pivot = equity.loc[equity["account_id"].isin(selected)].pivot(
        index="date", columns="account_id", values="equity_krw"
    )
    lines = [
        f"## Daily Delta vs `{baseline_id}`",
        "",
        "| account | final delta | positive days | min daily delta | max daily delta |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for account_id in account_ids:
        if account_id == baseline_id:
            continue
        aligned = pivot[[account_id, baseline_id]].dropna()
        delta = aligned[account_id] - aligned[baseline_id]
        lines.append(
            "| "
            + " | ".join(
                [
                    f"`{account_id}`",
                    _money_m(delta.iloc[-1]),
                    _pct(float((delta > 0).mean())),
                    _money_m(delta.min()),
                    _money_m(delta.max()),
                ]
            )
            + " |"
        )
    return lines


def _trade_reason_table(trades: pd.DataFrame, account_ids: list[str]) -> list[str]:
    if trades.empty:
        return ["## Trade Reasons", "", "No trades."]
    selected = trades.loc[trades["account_id"].isin(account_ids), ["account_id", "reason"]]
    counts = selected.groupby(["account_id", "reason"]).size().unstack(fill_value=0)
    reason_columns = sorted(str(column) for column in counts.columns)

    lines = [
        "## Trade Reasons",
        "",
        "| account | " + " | ".join(reason_columns) + " |",
        "| --- | " + " | ".join("---:" for _ in reason_columns) + " |",
    ]
    for account_id in account_ids:
        row = counts.loc[account_id] if account_id in counts.index else pd.Series(dtype=int)
        values = [str(int(row.get(reason, 0))) for reason in reason_columns]
        lines.append("| " + " | ".join([f"`{account_id}`", *values]) + " |")
    return lines


def _pct(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{float(value) * 100:.2f}%"


def _num(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{float(value):.4f}"


def _money_m(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{float(value) / 1_000_000:.1f}M"
