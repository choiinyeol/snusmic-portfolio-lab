"""Account-path attribution reports for strategy research."""

from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import pandas as pd

SUMMARY_COLUMNS = [
    "money_weighted_return",
    "time_weighted_return",
    "cagr",
    "max_drawdown",
    "realized_pnl_krw",
    "final_equity_krw",
    "trade_count",
]


def build_account_path_audit_report(
    sim_dir: Path,
    account_id: str,
    baseline_id: str,
    *,
    title: str = "Account Path Audit",
    top_symbols: int = 12,
) -> str:
    """Return a Markdown account-path audit from generated sim artifacts."""
    summary = _read_csv(sim_dir / "summary.csv")
    equity = _read_csv(sim_dir / "equity_daily.csv")
    trades = _read_csv(sim_dir / "trades.csv")
    episodes = _read_csv(sim_dir / "position_episodes.csv")
    _require_accounts(summary, [account_id, baseline_id], "summary.csv")

    lines = [f"# {title}", ""]
    lines.extend(_summary_delta_table(summary, account_id, baseline_id))
    lines.append("")
    lines.extend(_equity_delta_path_table(equity, account_id, baseline_id))
    lines.append("")
    lines.extend(_symbol_pnl_delta_table(episodes, account_id, baseline_id, top_symbols=top_symbols))
    lines.append("")
    lines.extend(_trade_reason_delta_table(trades, account_id, baseline_id))
    lines.append("")
    lines.extend(_first_buy_timing_table(trades, account_id, baseline_id, top_symbols=top_symbols))
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


def _summary_delta_table(summary: pd.DataFrame, account_id: str, baseline_id: str) -> list[str]:
    rows = summary.set_index("account_id")
    account = rows.loc[account_id]
    baseline = rows.loc[baseline_id]
    lines = [
        "## Summary Delta",
        "",
        f"Candidate: `{account_id}`",
        "",
        f"Baseline: `{baseline_id}`",
        "",
        "| metric | candidate | baseline | delta |",
        "| --- | ---: | ---: | ---: |",
    ]
    for column in SUMMARY_COLUMNS:
        candidate_value = float(account[column])
        baseline_value = float(baseline[column])
        delta = candidate_value - baseline_value
        formatter = _summary_formatter(column)
        lines.append(
            "| "
            + " | ".join(
                [
                    column,
                    formatter(candidate_value),
                    formatter(baseline_value),
                    formatter(delta),
                ]
            )
            + " |"
        )
    return lines


def _equity_delta_path_table(equity: pd.DataFrame, account_id: str, baseline_id: str) -> list[str]:
    selected = equity.loc[
        equity["account_id"].isin([account_id, baseline_id]), ["date", "account_id", "equity_krw"]
    ]
    pivot = selected.pivot(index="date", columns="account_id", values="equity_krw").dropna()
    if pivot.empty:
        return ["## Equity Delta Path", "", "No aligned equity rows."]
    pivot.index = pd.to_datetime(pivot.index)
    pivot["delta"] = pivot[account_id] - pivot[baseline_id]
    annual = pivot.groupby(pivot.index.year).tail(1)
    positive_share = float((pivot["delta"] > 0).mean())
    nonzero = pivot.loc[pivot["delta"] != 0]
    nonzero_positive_share = float((nonzero["delta"] > 0).mean()) if not nonzero.empty else 0.0
    first_nonzero = nonzero.index.min() if not nonzero.empty else pd.NaT
    first_positive = pivot.loc[pivot["delta"] > 0].index.min()
    lines = [
        "## Equity Delta Path",
        "",
        f"- Positive daily delta share: {_pct(positive_share)}",
        f"- Positive share after paths diverge: {_pct(nonzero_positive_share)}",
        f"- First nonzero delta date: {_format_timestamp_date(first_nonzero)}",
        f"- First positive delta date: {_format_timestamp_date(first_positive)}",
        "",
        "| year-end | candidate equity | baseline equity | delta |",
        "| --- | ---: | ---: | ---: |",
    ]
    for row in annual.itertuples():
        lines.append(
            "| "
            + " | ".join(
                [
                    _format_timestamp_date(row.Index),
                    _money_m(cast(float, getattr(row, account_id))),
                    _money_m(cast(float, getattr(row, baseline_id))),
                    _money_m(cast(float, row.delta)),
                ]
            )
            + " |"
        )
    return lines


def _symbol_pnl_delta_table(
    episodes: pd.DataFrame,
    account_id: str,
    baseline_id: str,
    *,
    top_symbols: int,
) -> list[str]:
    symbol_pnl = _episode_symbol_pnl(episodes, [account_id, baseline_id])
    if symbol_pnl.empty:
        return ["## Symbol Episode PnL Delta", "", "No episode rows."]
    pivot = symbol_pnl.pivot_table(
        index=["symbol", "company"], columns="account_id", values="pnl", aggfunc="sum"
    )
    for account in [account_id, baseline_id]:
        if account not in pivot:
            pivot[account] = 0.0
    pivot = pivot.fillna(0.0)
    pivot["delta"] = pivot[account_id] - pivot[baseline_id]
    rows = pivot.reset_index().sort_values("delta", ascending=False)
    selected = pd.concat([rows.head(top_symbols), rows.tail(top_symbols)]).drop_duplicates(subset=["symbol"])
    lines = [
        "## Symbol Episode PnL Delta",
        "",
        "| symbol | company | candidate PnL | baseline PnL | delta |",
        "| --- | --- | ---: | ---: | ---: |",
    ]
    for row in selected.itertuples(index=False):
        lines.append(
            "| "
            + " | ".join(
                [
                    f"`{row.symbol}`",
                    _escape_md_cell(row.company),
                    _money_m(cast(float, getattr(row, account_id))),
                    _money_m(cast(float, getattr(row, baseline_id))),
                    _money_m(cast(float, row.delta)),
                ]
            )
            + " |"
        )
    return lines


def _episode_symbol_pnl(episodes: pd.DataFrame, account_ids: list[str]) -> pd.DataFrame:
    selected = episodes.loc[episodes["account_id"].isin(account_ids)].copy()
    if selected.empty:
        return pd.DataFrame(columns=["account_id", "symbol", "company", "pnl"])
    selected["realized_pnl_krw"] = pd.to_numeric(selected["realized_pnl_krw"], errors="coerce").fillna(0.0)
    selected["unrealized_pnl_krw"] = pd.to_numeric(selected["unrealized_pnl_krw"], errors="coerce").fillna(
        0.0
    )
    selected["pnl"] = selected["realized_pnl_krw"] + selected["unrealized_pnl_krw"]
    return (
        selected.groupby(["account_id", "symbol", "company"], as_index=False)
        .agg(pnl=("pnl", "sum"))
        .sort_values(["account_id", "pnl"], ascending=[True, False])
    )


def _trade_reason_delta_table(trades: pd.DataFrame, account_id: str, baseline_id: str) -> list[str]:
    selected = trades.loc[trades["account_id"].isin([account_id, baseline_id])].copy()
    if selected.empty:
        return ["## Trade Reason Delta", "", "No trade rows."]
    selected["realized_pnl_krw"] = pd.to_numeric(selected["realized_pnl_krw"], errors="coerce").fillna(0.0)
    counts = selected.groupby(["account_id", "reason"]).agg(
        trades=("symbol", "size"),
        realized_pnl=("realized_pnl_krw", "sum"),
    )
    lines = [
        "## Trade Reason Delta",
        "",
        "| reason | candidate trades | baseline trades | trade delta | candidate realized | baseline realized | realized delta |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ]
    reasons = sorted(set(selected["reason"].astype(str)))
    for reason in reasons:
        candidate = (
            cast(pd.Series, counts.loc[(account_id, reason)])
            if (account_id, reason) in counts.index
            else None
        )
        baseline = (
            cast(pd.Series, counts.loc[(baseline_id, reason)])
            if (baseline_id, reason) in counts.index
            else None
        )
        candidate_trades = int(candidate["trades"]) if candidate is not None else 0
        baseline_trades = int(baseline["trades"]) if baseline is not None else 0
        candidate_pnl = float(candidate["realized_pnl"]) if candidate is not None else 0.0
        baseline_pnl = float(baseline["realized_pnl"]) if baseline is not None else 0.0
        lines.append(
            "| "
            + " | ".join(
                [
                    str(reason),
                    f"{candidate_trades:,}",
                    f"{baseline_trades:,}",
                    f"{candidate_trades - baseline_trades:+,}",
                    _money_m(candidate_pnl),
                    _money_m(baseline_pnl),
                    _money_m(candidate_pnl - baseline_pnl),
                ]
            )
            + " |"
        )
    return lines


def _first_buy_timing_table(
    trades: pd.DataFrame,
    account_id: str,
    baseline_id: str,
    *,
    top_symbols: int,
) -> list[str]:
    buys = trades.loc[
        (trades["side"] == "buy") & trades["account_id"].isin([account_id, baseline_id]),
        ["account_id", "symbol", "date"],
    ].copy()
    if buys.empty:
        return ["## First Buy Timing", "", "No buy rows."]
    buys["date"] = pd.to_datetime(buys["date"])
    first = buys.groupby(["account_id", "symbol"], as_index=False)["date"].min()
    pivot = first.pivot(index="symbol", columns="account_id", values="date")
    both = pivot.dropna(subset=[account_id, baseline_id]).copy()
    both["candidate_minus_baseline_days"] = (both[account_id] - both[baseline_id]).dt.days
    both = both.loc[both["candidate_minus_baseline_days"] != 0]
    both["abs_days"] = both["candidate_minus_baseline_days"].abs()
    both = both.sort_values("abs_days", ascending=False).head(top_symbols)

    candidate_only = sorted(set(pivot.loc[pivot[baseline_id].isna()].index.astype(str)))
    baseline_only = sorted(set(pivot.loc[pivot[account_id].isna()].index.astype(str)))
    lines = [
        "## First Buy Timing",
        "",
        f"- Candidate-only traded symbols: {len(candidate_only)}",
        f"- Baseline-only traded symbols: {len(baseline_only)}",
        "",
        "| symbol | candidate first buy | baseline first buy | candidate minus baseline days |",
        "| --- | --- | --- | ---: |",
    ]
    for _, row in both.reset_index().iterrows():
        lines.append(
            "| "
            + " | ".join(
                [
                    f"`{row['symbol']}`",
                    row[account_id].date().isoformat(),
                    row[baseline_id].date().isoformat(),
                    f"{int(row['candidate_minus_baseline_days']):+,}",
                ]
            )
            + " |"
        )
    return lines


def _pct(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{float(value) * 100:.2f}%"


def _format_timestamp_date(value: object) -> str:
    if pd.isna(cast(Any, value)):
        return "-"
    return cast(pd.Timestamp, value).date().isoformat()


def _summary_formatter(column: str):
    if column == "trade_count":
        return _integer
    if column.endswith("_krw"):
        return _money_m
    if "return" in column or column in {"cagr", "max_drawdown"}:
        return _pct
    return _num


def _integer(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{int(value):,}"


def _num(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{float(value):,.4f}"


def _money_m(value: float) -> str:
    if pd.isna(value):
        return "-"
    return f"{float(value) / 1_000_000:,.1f}M"


def _escape_md_cell(value: object) -> str:
    return str(value).replace("|", "\\|")
