"""Matplotlib renderers for :class:`SimulationResult`.

Two figures:

* ``plot_equity_curves`` — line chart of equity over time, one line per
  account_id, plus a dashed line of cumulative contributions to make
  net-of-deposit performance obvious.
* ``plot_net_profit_bars`` — final-day net profit per account_id, sorted.

Each figure is saved at the requested path. The callers (CLI / tests) own
choosing where artifacts land — this module never picks paths.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # always headless; CI and CLI use the same backend.

import matplotlib.pyplot as plt  # noqa: E402
import matplotlib.ticker as mticker  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib import font_manager  # noqa: E402

from .contracts import SimulationResult  # noqa: E402

ACCOUNT_COLORS = {
    "oracle": "#16a34a",
    "weak_oracle": "#2563eb",
    "smic_follower": "#f59e0b",
    "smic_follower_v2": "#dc2626",
    "all_weather": "#475569",
    "benchmark_qqq": "#0ea5e9",
    "benchmark_spy": "#64748b",
    "benchmark_kodex200": "#22c55e",
    "benchmark_gld": "#eab308",
}


def _configure_korean_font() -> None:
    """Use an installed CJK-capable font so Korean labels render in PNGs."""
    for family in ("AppleGothic", "NanumGothic", "Noto Sans CJK KR", "Noto Sans KR", "Malgun Gothic"):
        try:
            font_manager.findfont(family, fallback_to_default=False)
        except ValueError:
            continue
        plt.rcParams["font.family"] = family
        plt.rcParams["axes.unicode_minus"] = False
        return


_configure_korean_font()


def _multiplier_to_pct_label(value: float, _pos: int) -> str:
    """Format a wealth multiplier (1.0 = breakeven) as a signed percent return."""
    if value <= 0:
        return ""
    pct = (value - 1.0) * 100.0
    if pct == 0:
        return "+0%"
    if abs(pct) >= 1000:
        return f"+{pct:,.0f}%" if pct > 0 else f"{pct:,.0f}%"
    return f"+{pct:.0f}%" if pct > 0 else f"{pct:.0f}%"


def plot_equity_curves(result: SimulationResult, out_path: Path) -> Path:
    """Cumulative return (% vs cumulative deposits) over time, log Y.

    The plotted quantity is ``equity / cumulative_contributions`` — i.e. the
    wealth multiplier on every won the user has deposited up to that date,
    which is what a brokerage app shows as "your account is up X%". Log Y
    so a constant compound growth rate reads as a straight line and
    Prophet's 184× outcome doesn't crush mid-tier accounts visually.
    """
    if not result.equity_points:
        raise ValueError("SimulationResult has no equity points to plot.")
    by_account: dict[str, list[tuple[date, float]]] = defaultdict(list)
    for ep in result.equity_points:
        if ep.contributed_capital_krw > 0:
            mult = ep.equity_krw / ep.contributed_capital_krw
        else:
            mult = 1.0
        by_account[ep.account_id].append((ep.date, mult))

    fig, ax = plt.subplots(figsize=(12, 6))
    account_labels = {s.account_id: s.label for s in result.summaries}
    for account_id, points in by_account.items():
        points.sort(key=lambda x: x[0])
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        ax.plot(
            xs,
            ys,
            label=account_labels.get(account_id, account_id),
            color=ACCOUNT_COLORS.get(account_id),
            linewidth=1.6,
        )
    ax.axhline(1.0, color="black", linestyle="--", linewidth=0.9, alpha=0.6, label="Breakeven (+0%)")

    ax.set_yscale("log")
    # Decades plus 2× and 5× intermediates so mid-tier accounts (+30%, +100%,
    # +400%) get readable tick labels instead of disappearing into the gap
    # between +0% and +900%.
    ax.yaxis.set_major_locator(mticker.LogLocator(base=10.0, subs=(1.0, 2.0, 5.0), numticks=12))
    ax.yaxis.set_minor_locator(
        mticker.LogLocator(base=10.0, subs=(3.0, 4.0, 6.0, 7.0, 8.0, 9.0), numticks=12)
    )
    ax.yaxis.set_major_formatter(mticker.FuncFormatter(_multiplier_to_pct_label))
    ax.yaxis.set_minor_formatter(mticker.NullFormatter())
    ax.set_title("Account cumulative return — equity ÷ cumulative deposits (log scale)")
    ax.set_xlabel("Date")
    ax.set_ylabel("Cumulative return")
    ax.grid(True, which="both", alpha=0.3)
    ax.legend(loc="upper left", fontsize=9)
    fig.autofmt_xdate()
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=140)
    plt.close(fig)
    return out_path


def plot_net_profit_bars(result: SimulationResult, out_path: Path) -> Path:
    """Bar chart of final total return (%) per account_id (sorted ascending).

    Total return is ``net_profit / total_contributed`` — i.e. "for every
    won deposited, how many won did the account_id end up with on top".
    Comparable across accounts and immune to the absolute scale of the
    savings plan.
    """
    if not result.summaries:
        raise ValueError("SimulationResult has no summaries to plot.")

    def total_return_pct(s) -> float:
        if s.total_contributed_krw <= 0:
            return 0.0
        return (s.net_profit_krw / s.total_contributed_krw) * 100.0

    summaries = sorted(result.summaries, key=total_return_pct)
    labels = [s.label for s in summaries]
    values = [total_return_pct(s) for s in summaries]
    colors = [ACCOUNT_COLORS.get(s.account_id, "#6b7280") for s in summaries]

    fig, ax = plt.subplots(figsize=(10, 5.5))
    bars = ax.barh(labels, values, color=colors)
    for bar, value in zip(bars, values, strict=True):
        sign = "+" if value >= 0 else ""
        ax.text(
            bar.get_width(),
            bar.get_y() + bar.get_height() / 2,
            f" {sign}{value:,.1f}%",
            va="center",
            ha="left" if value >= 0 else "right",
            fontsize=9,
        )
    ax.axvline(0, color="black", linewidth=0.6)
    ax.set_title("Account total return (%) — net profit ÷ total contributed")
    ax.set_xlabel("Total Return (%)")
    ax.xaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _p: f"{v:,.0f}%"))
    ax.grid(True, axis="x", alpha=0.3)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=140)
    plt.close(fig)
    return out_path


def plot_portfolio_composition(
    result: SimulationResult,
    out_path: Path,
    *,
    top_k: int = 8,
) -> Path:
    """Stacked-area chart of every account's month-end portfolio composition.

    One subplot per account_id, each showing the top ``top_k`` holdings by
    end-of-sim weight as named bands plus an "others" band. The Y axis
    is the share of the invested book (cash excluded), so each subplot's
    bands always sum to 1.0 on any given month-end.
    """
    if not result.monthly_holdings:
        raise ValueError("SimulationResult has no monthly_holdings to plot.")
    account_labels = {s.account_id: s.label for s in result.summaries}
    rows = [m.model_dump() for m in result.monthly_holdings]
    df = pd.DataFrame(rows)
    if df.empty:
        raise ValueError("monthly_holdings rendered an empty frame.")
    accounts = sorted(
        df["account_id"].unique(), key=lambda p: -result.summaries[0].final_equity_krw if False else 0
    )
    accounts = list(df["account_id"].unique())
    n = len(accounts)
    fig, axes = plt.subplots(n, 1, figsize=(13, 3.0 * n), sharex=True)
    if n == 1:
        axes = [axes]
    for ax, account_id in zip(axes, accounts, strict=True):
        sub = df[df["account_id"] == account_id].copy()
        # Pick the top_k symbols by their FINAL-month weight.
        last_month = sub["month_end"].max()
        last_slice = sub[sub["month_end"] == last_month]
        top_symbols = list(
            last_slice.sort_values("weight_in_portfolio", ascending=False)["symbol"].head(top_k)
        )
        # Pivot to wide: index=month_end, columns=symbol, values=weight.
        wide = sub.pivot_table(
            index="month_end", columns="symbol", values="weight_in_portfolio", aggfunc="sum"
        ).fillna(0.0)
        wide = wide.sort_index()
        if wide.empty:
            continue
        # Group anything not in ``top_symbols`` as "Others".
        others_cols = [c for c in wide.columns if c not in top_symbols]
        if others_cols:
            others_sum = wide[others_cols].sum(axis=1)
            wide = wide.drop(columns=others_cols)
            wide["Others"] = others_sum
        # Re-order so Others is last.
        column_order = [c for c in top_symbols if c in wide.columns]
        if "Others" in wide.columns:
            column_order.append("Others")
        wide = wide[column_order]
        # Use company names as labels where available.
        sym_to_company = {row["symbol"]: row["company"] for row in rows if row["company"]}
        labels = []
        for col in wide.columns:
            if col == "Others":
                labels.append("Others")
            else:
                comp = sym_to_company.get(col, "")
                labels.append(f"{col} {comp[:14]}" if comp else col)
        ax.stackplot(wide.index, wide.values.T, labels=labels, alpha=0.85)
        ax.set_title(account_labels.get(account_id, account_id))
        ax.set_ylim(0, 1)
        ax.set_ylabel("Weight")
        ax.legend(loc="upper left", fontsize=7, ncol=2, framealpha=0.85)
        ax.grid(True, alpha=0.3)
    axes[-1].set_xlabel("Month-end")
    fig.suptitle("Portfolio composition over time (top holdings, weight share of invested book)", y=1.0)
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=140)
    plt.close(fig)
    return out_path


def plot_drawdowns(result: SimulationResult, out_path: Path) -> Path:
    """Drawdown curve (= equity / running peak − 1) per account_id."""
    if not result.equity_points:
        raise ValueError("SimulationResult has no equity points to plot.")
    fig, ax = plt.subplots(figsize=(12, 5))
    by_account: dict[str, list[tuple[date, float]]] = defaultdict(list)
    for ep in result.equity_points:
        by_account[ep.account_id].append((ep.date, ep.equity_krw))
    account_labels = {s.account_id: s.label for s in result.summaries}
    for account_id, points in by_account.items():
        points.sort(key=lambda x: x[0])
        xs, equity = zip(*points, strict=True)
        peak = 0.0
        dd: list[float] = []
        for value in equity:
            peak = max(peak, value)
            if peak <= 0:
                dd.append(0.0)
            else:
                dd.append((value - peak) / peak * 100.0)
        ax.plot(
            xs,
            dd,
            label=account_labels.get(account_id, account_id),
            color=ACCOUNT_COLORS.get(account_id),
            linewidth=1.4,
        )
    ax.set_title("Drawdown (%) by account_id")
    ax.set_ylabel("Drawdown (%)")
    ax.set_xlabel("Date")
    ax.grid(True, alpha=0.3)
    ax.legend(loc="lower left", fontsize=9)
    fig.autofmt_xdate()
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=140)
    plt.close(fig)
    return out_path
