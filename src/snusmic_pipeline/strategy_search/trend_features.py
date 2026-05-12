"""Publication-date trend features for strategy search filters."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

TREND_FEATURE_COLUMNS = [
    "trend_close",
    "trend_ma50",
    "trend_ma150",
    "trend_ma200",
    "trend_ma200_1m_return",
    "trend_price_vs_52w_low",
    "trend_pct_below_52w_high",
]


def enrich_report_performance_with_trend_features(
    report_performance: pd.DataFrame, warehouse_dir: Path
) -> pd.DataFrame:
    """Attach as-of trend features using only prices available by publication date."""
    prices_path = warehouse_dir / "daily_prices.csv"
    if not prices_path.exists():
        raise FileNotFoundError(f"Missing daily prices for trend features: {prices_path}")
    if report_performance.empty:
        return report_performance.copy()
    for column in ["symbol", "publication_date"]:
        if column not in report_performance.columns:
            raise ValueError(f"report_performance must include {column} for trend features")

    prices = pd.read_csv(prices_path)
    required_price_columns = {"date", "symbol", "close"}
    missing = sorted(required_price_columns - set(prices.columns))
    if missing:
        raise ValueError(f"daily_prices.csv missing required columns: {missing}")
    if prices.empty:
        raise ValueError(f"daily_prices.csv is empty: {prices_path}")

    features = _price_features(prices)
    return _merge_asof_features(report_performance, features)


def _price_features(prices: pd.DataFrame) -> pd.DataFrame:
    frame = prices[["date", "symbol", "close"]].copy()
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame["symbol"] = frame["symbol"].astype(str)
    frame["trend_close"] = pd.to_numeric(frame["close"], errors="coerce")
    frame = frame.dropna(subset=["date", "symbol", "trend_close"]).sort_values(["symbol", "date"])
    if frame.empty:
        raise ValueError("daily_prices.csv has no valid close rows for trend features")

    grouped = frame.groupby("symbol", group_keys=False)
    frame["trend_ma50"] = grouped["trend_close"].transform(
        lambda series: series.rolling(50, min_periods=50).mean()
    )
    frame["trend_ma150"] = grouped["trend_close"].transform(
        lambda series: series.rolling(150, min_periods=150).mean()
    )
    frame["trend_ma200"] = grouped["trend_close"].transform(
        lambda series: series.rolling(200, min_periods=200).mean()
    )
    ma200_prev = grouped["trend_ma200"].shift(21)
    frame["trend_ma200_1m_return"] = frame["trend_ma200"] / ma200_prev - 1.0
    low_52w = grouped["trend_close"].transform(lambda series: series.rolling(252, min_periods=252).min())
    high_52w = grouped["trend_close"].transform(lambda series: series.rolling(252, min_periods=252).max())
    frame["trend_price_vs_52w_low"] = frame["trend_close"] / low_52w - 1.0
    frame["trend_pct_below_52w_high"] = 1.0 - frame["trend_close"] / high_52w
    return frame[["date", "symbol", *TREND_FEATURE_COLUMNS]]


def _merge_asof_features(report_performance: pd.DataFrame, features: pd.DataFrame) -> pd.DataFrame:
    out = report_performance.copy()
    out["_publication_ts"] = pd.to_datetime(out["publication_date"], errors="coerce")
    if out["_publication_ts"].isna().any():
        raise ValueError("report_performance contains invalid publication_date values")
    by_symbol = {symbol: group.reset_index(drop=True) for symbol, group in features.groupby("symbol")}
    values: list[dict[str, Any]] = []
    for record in out[["symbol", "_publication_ts"]].to_dict("records"):
        symbol = str(record["symbol"])
        published_at = record["_publication_ts"]
        symbol_features = by_symbol.get(symbol)
        if symbol_features is None or symbol_features.empty:
            values.append({column: None for column in TREND_FEATURE_COLUMNS})
            continue
        index = symbol_features["date"].searchsorted(published_at, side="right") - 1
        if index < 0:
            values.append({column: None for column in TREND_FEATURE_COLUMNS})
            continue
        row = symbol_features.iloc[int(index)]
        values.append(
            {
                column: (None if pd.isna(row[column]) else float(row[column]))
                for column in TREND_FEATURE_COLUMNS
            }
        )
    feature_frame = pd.DataFrame(values, index=out.index)
    out = pd.concat([out.drop(columns=["_publication_ts"]), feature_frame], axis=1)
    return out
