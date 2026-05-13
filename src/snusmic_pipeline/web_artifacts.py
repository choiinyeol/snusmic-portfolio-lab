from __future__ import annotations

import json
import math
import shutil
import statistics
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

import pandas as pd

from .currency import currency_for_symbol, normalize_currency

REQUIRED_ARTIFACTS = [
    "manifest.json",
    "overview/snapshot.json",
    "overview/research-pulse.json",
    "overview/data-quality.json",
    "portfolio/personas.json",
    "portfolio/holdings.json",
    "portfolio/monthly-holdings.json",
    "portfolio/trades.json",
    "portfolio/episodes.json",
    "portfolio/equity-daily.json",
    "portfolio/accounting-reconciliation.json",
    "reports/table.json",
    "reports/rankings.json",
    "reports/detail-metrics.json",
    "reports/return-windows.json",
    "reports/target-hit-distribution.json",
    "strategies/catalog.json",
    "strategies/leaderboard.json",
    "strategies/curves.json",
    "screener/candidates.json",
    "overview.json",
    "personas.json",
    "reports.json",
    "report-rankings.json",
    "report-detail-metrics.json",
    "return-windows.json",
    "target-hit-distribution.json",
    "insights.json",
    "current-holdings.json",
    "monthly-holdings.json",
    "missing-symbols.json",
    "data-quality.json",
    "trades.json",
    "position-episodes.json",
    "equity-daily.json",
    "accounting-reconciliation.json",
    "table-download-reports.csv",
    "table-download-strategies.csv",
    "data-quality-download.csv",
]


def _enrich_holdings_with_native(
    holdings: pd.DataFrame,
    prices: pd.DataFrame,
    fx_rates: pd.DataFrame | None = None,
    close_column: str = "last_close_krw",
) -> pd.DataFrame:
    """Attach (currency, last_close_native) for every row.

    The simulator stores positions in KRW only, so the static dashboard could
    not show users the native quote of a foreign holding without re-fetching
    prices in the browser. The warehouse OHLC columns are KRW-normalized for
    cross-market simulation, while source_currency + krw_per_unit preserve the
    market currency. Convert KRW close back to the native quote for display.
    """

    if holdings.empty:
        return holdings
    fx_rates = fx_rates if fx_rates is not None else pd.DataFrame()
    if prices.empty or "symbol" not in prices.columns:
        out = holdings.copy()
        out["currency"] = out["symbol"].map(currency_for_symbol).fillna("KRW")
        out["last_close_native"] = _infer_native_from_krw(
            _holding_close_krw(out, close_column),
            out["currency"],
            fx_rates,
            pd.to_datetime(out.get("month_end"), errors="coerce") if "month_end" in out.columns else None,
        )
        return out

    work = prices.dropna(subset=["symbol", "date"]).copy()
    work["date"] = pd.to_datetime(work["date"], errors="coerce")
    work["close"] = pd.to_numeric(work.get("close"), errors="coerce")
    work["krw_per_unit"] = pd.to_numeric(work.get("krw_per_unit"), errors="coerce")
    work = work.dropna(subset=["date"]).sort_values(["symbol", "date"])
    out = holdings.copy()
    if "month_end" in out.columns:
        out = _attach_monthly_native_close(out, work, fx_rates)
    else:
        latest_by_symbol = work.groupby("symbol", as_index=False).tail(1)
        latest_by_symbol = latest_by_symbol[["symbol", "source_currency", "close", "krw_per_unit"]]
        latest_by_symbol["last_close_native"] = _native_close(
            latest_by_symbol["close"],
            latest_by_symbol["krw_per_unit"],
            latest_by_symbol["source_currency"],
        )
        sym_to_currency = dict(
            zip(latest_by_symbol["symbol"], latest_by_symbol["source_currency"], strict=True)
        )
        sym_to_native_close = dict(
            zip(latest_by_symbol["symbol"], latest_by_symbol["last_close_native"], strict=True)
        )
        out["currency"] = (
            out["symbol"].map(sym_to_currency).fillna(out["symbol"].map(currency_for_symbol)).fillna("KRW")
        )
        out["last_close_native"] = out["symbol"].map(sym_to_native_close)
        missing_native = out["last_close_native"].isna()
        out.loc[missing_native, "last_close_native"] = _infer_native_from_krw(
            pd.to_numeric(out.loc[missing_native, close_column], errors="coerce"),
            out.loc[missing_native, "currency"],
            fx_rates,
        )
    out["currency"] = out["currency"].fillna("KRW")
    out["last_close_native"] = pd.to_numeric(out["last_close_native"], errors="coerce")
    return out


def _attach_monthly_native_close(
    holdings: pd.DataFrame, prices: pd.DataFrame, fx_rates: pd.DataFrame
) -> pd.DataFrame:
    """Attach native month-end closes using the nearest known price at/before each month."""

    out = holdings.copy()
    out["_row_order"] = range(len(out))
    out["month_end_dt"] = pd.to_datetime(out["month_end"], errors="coerce")
    chunks: list[pd.DataFrame] = []
    price_columns = ["date", "source_currency", "close", "krw_per_unit"]
    for symbol, group in out.groupby("symbol", sort=False):
        price_group = prices[prices["symbol"] == symbol][price_columns].sort_values("date")
        if price_group.empty:
            missing = group.copy()
            missing["currency"] = missing["symbol"].map(currency_for_symbol).fillna("KRW")
            missing["last_close_native"] = _infer_native_from_krw(
                _holding_close_krw(missing, "month_close_krw"),
                missing["currency"],
                fx_rates,
                missing["month_end_dt"],
            )
            chunks.append(missing)
            continue
        merged = pd.merge_asof(
            group.sort_values("month_end_dt"),
            price_group,
            left_on="month_end_dt",
            right_on="date",
            direction="backward",
        )
        merged["currency"] = merged["source_currency"].fillna("KRW")
        merged["last_close_native"] = _native_close(
            merged["close"],
            merged["krw_per_unit"],
            merged["currency"],
        )
        chunks.append(merged)
    enriched = pd.concat(chunks, ignore_index=True).sort_values("_row_order")
    return enriched.drop(
        columns=["_row_order", "month_end_dt", "date", "source_currency", "close", "krw_per_unit"],
        errors="ignore",
    )


def _holding_close_krw(holdings: pd.DataFrame, close_column: str) -> pd.Series:
    if close_column in holdings.columns:
        return pd.to_numeric(holdings[close_column], errors="coerce")
    qty = pd.to_numeric(holdings.get("qty"), errors="coerce")
    market_value = pd.to_numeric(holdings.get("market_value_krw"), errors="coerce")
    return market_value / qty.where(qty.ne(0))


def _native_close(close_krw: pd.Series, krw_per_unit: pd.Series, currency: pd.Series) -> pd.Series:
    native = pd.to_numeric(close_krw, errors="coerce").copy()
    rate = pd.to_numeric(krw_per_unit, errors="coerce")
    is_foreign = currency.fillna("KRW").astype(str).str.upper().ne("KRW")
    can_convert = is_foreign & rate.notna() & rate.gt(0)
    native.loc[can_convert] = native.loc[can_convert] / rate.loc[can_convert]
    return native


def _infer_native_from_krw(
    close_krw: pd.Series,
    currency: pd.Series,
    fx_rates: pd.DataFrame,
    dates: pd.Series | None = None,
) -> pd.Series:
    """Infer native quotes from KRW simulator values using explicit FX rates."""

    native = pd.to_numeric(close_krw, errors="coerce").copy()
    normalized = currency.fillna("KRW").astype(str).map(normalize_currency)
    if fx_rates.empty:
        return native.where(normalized.eq("KRW"), pd.NA)

    rates = fx_rates.copy()
    rates["date"] = pd.to_datetime(rates["date"], errors="coerce")
    rates["currency"] = rates["currency"].astype(str).map(normalize_currency)
    rates["krw_per_unit"] = pd.to_numeric(rates["krw_per_unit"], errors="coerce")
    rates = rates.dropna(subset=["date", "krw_per_unit"]).sort_values(["currency", "date"])
    for code in sorted(set(normalized) - {"", "KRW"}):
        mask = normalized.eq(code)
        currency_rates = rates[rates["currency"].eq(code)][["date", "krw_per_unit"]]
        if currency_rates.empty:
            native.loc[mask] = pd.NA
            continue
        if dates is None:
            rate = currency_rates.iloc[-1]["krw_per_unit"]
            native.loc[mask] = native.loc[mask] / rate
            continue
        lookups = pd.DataFrame(
            {"_order": range(mask.sum()), "date": dates.loc[mask], "value": native.loc[mask]}
        )
        merged = pd.merge_asof(
            lookups.sort_values("date"),
            currency_rates.sort_values("date"),
            on="date",
            direction="backward",
        ).sort_values("_order")
        converted = merged["value"] / merged["krw_per_unit"]
        native.loc[mask] = converted.to_numpy()
    return native


@dataclass(frozen=True)
class ExportInputs:
    warehouse: Path = Path("data/warehouse")
    sim: Path = Path("data/sim")
    out: Path = Path("data/web")
    extraction_quality: Path = Path("data/extraction_quality.json")


def export_web_artifacts(inputs: ExportInputs) -> dict[str, Any]:
    """Export deterministic JSON artifacts for the static web showcase."""

    reports = _read_csv(inputs.warehouse / "reports.csv")
    prices = _read_csv(inputs.warehouse / "daily_prices.csv")
    fx_rates = _read_optional_csv(inputs.warehouse / "fx_rates.csv")
    summary = _read_csv(inputs.sim / "summary.csv")
    current_holdings = _read_csv(inputs.sim / "current_holdings.csv")
    monthly_holdings = _read_optional_csv(inputs.sim / "monthly_holdings.csv")
    report_performance = _read_csv(inputs.sim / "report_performance.csv")
    report_stats = _read_json(inputs.sim / "report_stats.json")
    trades = _read_csv(inputs.sim / "trades.csv")
    position_episodes = _read_csv(inputs.sim / "position_episodes.csv")
    equity_daily = _read_csv(inputs.sim / "equity_daily.csv")
    extraction_quality = _read_json(inputs.extraction_quality) if inputs.extraction_quality.exists() else {}

    _assert_no_stale_strategy_personas(
        {
            "summary": summary,
            "current_holdings": current_holdings,
            "monthly_holdings": monthly_holdings,
            "trades": trades,
            "position_episodes": position_episodes,
            "equity_daily": equity_daily,
        }
    )

    out = inputs.out
    prices_out = out / "prices"
    if out.exists():
        shutil.rmtree(out)
    prices_out.mkdir(parents=True, exist_ok=True)

    price_symbols = set(prices["symbol"].dropna().astype(str)) if not prices.empty else set()
    report_symbols = set(reports["symbol"].dropna().astype(str)) if not reports.empty else set()
    report_symbols.discard("")
    artifact_symbols = set(report_symbols)
    for frame in (current_holdings, monthly_holdings, trades, position_episodes):
        if not frame.empty and "symbol" in frame.columns:
            artifact_symbols.update(
                str(symbol) for symbol in frame["symbol"].dropna().astype(str) if str(symbol)
            )
    missing_symbols = sorted(report_symbols - price_symbols)

    report_rows = _build_report_rows(reports, report_performance, extraction_quality, missing_symbols)
    report_exclusions = _build_report_exclusion_counts(reports, report_performance, missing_symbols)
    overview = _build_overview(
        reports, prices, summary, report_stats, missing_symbols, report_rows, report_exclusions
    )
    strategy_catalog = _build_strategy_catalog(summary, inputs.sim / "persona-configs.json")
    return_windows = _build_return_windows(report_rows, prices)
    detail_metrics = _build_detail_metrics(report_rows, prices, return_windows)
    target_distribution = _build_target_hit_distribution(report_rows)
    rankings = _build_rankings(report_stats, report_rows)
    data_quality = _build_data_quality(
        extraction_quality, missing_symbols, reports, report_performance, report_exclusions
    )
    insights = _build_insights(overview, rankings, target_distribution, return_windows, data_quality)

    current_holdings = _current_holdings_from_open_episodes(position_episodes, current_holdings)
    persona_rows = _records(summary)
    enriched_current_holdings = _records(_enrich_holdings_with_native(current_holdings, prices, fx_rates))
    enriched_monthly_holdings = _records(
        _enrich_holdings_with_native(monthly_holdings, prices, fx_rates, close_column="month_close_krw")
    )
    trade_rows = _records(trades)
    episode_rows = _records(position_episodes)
    equity_rows = _records(equity_daily)
    accounting_rows = _build_accounting_reconciliation(persona_rows, enriched_current_holdings)
    screener_candidates = _build_screener_candidates(report_rows)

    _write_page_bundles(
        out,
        overview=overview,
        insights=insights,
        data_quality=data_quality,
        personas=persona_rows,
        holdings=enriched_current_holdings,
        monthly_holdings=enriched_monthly_holdings,
        trades=trade_rows,
        episodes=episode_rows,
        equity_daily=equity_rows,
        accounting_reconciliation=accounting_rows,
        reports=report_rows,
        rankings=rankings,
        detail_metrics=detail_metrics,
        return_windows=return_windows,
        target_distribution=target_distribution,
        strategy_catalog=strategy_catalog,
        screener_candidates=screener_candidates,
    )

    _write_json(out / "overview.json", overview)
    _write_json(out / "personas.json", persona_rows)
    _write_json(out / "reports.json", report_rows)
    _write_json(out / "report-rankings.json", rankings)
    _write_json(out / "report-detail-metrics.json", detail_metrics)
    _write_json(out / "return-windows.json", return_windows)
    _write_json(out / "target-hit-distribution.json", target_distribution)
    _write_json(out / "insights.json", insights)
    _write_json(
        out / "current-holdings.json",
        enriched_current_holdings,
    )
    _write_json(
        out / "monthly-holdings.json",
        enriched_monthly_holdings,
    )
    _write_json(out / "missing-symbols.json", [{"symbol": symbol} for symbol in missing_symbols])
    _write_json(out / "data-quality.json", data_quality)
    _write_json(out / "trades.json", trade_rows)
    _write_json(out / "position-episodes.json", episode_rows)
    _write_json(out / "equity-daily.json", equity_rows)
    _write_json(out / "accounting-reconciliation.json", accounting_rows)
    _write_download_csvs(out, report_rows, data_quality)
    _write_price_artifacts(prices, artifact_symbols, prices_out)
    write_web_manifest(out)

    written = sorted(
        str(path.relative_to(out)) for path in out.rglob("*") if path.suffix in {".json", ".csv"}
    )
    return {
        "out": str(out),
        "artifact_count": len(written),
        "artifacts": written,
        "overview": overview,
        "missing_symbols": missing_symbols,
    }


def check_web_artifacts(inputs: ExportInputs) -> dict[str, Any]:
    """Export and verify required artifacts plus deterministic repeated output."""

    first = export_web_artifacts(inputs)
    missing = [name for name in REQUIRED_ARTIFACTS if not (inputs.out / name).exists()]
    if missing:
        raise RuntimeError(f"Missing required web artifacts: {', '.join(missing)}")

    first_bytes = _snapshot_json_bytes(inputs.out)
    with TemporaryDirectory() as tmpdir:
        second_inputs = ExportInputs(
            warehouse=inputs.warehouse,
            sim=inputs.sim,
            out=Path(tmpdir) / "web",
            extraction_quality=inputs.extraction_quality,
        )
        export_web_artifacts(second_inputs)
        second_bytes = _snapshot_json_bytes(second_inputs.out)
    if first_bytes != second_bytes:
        raise RuntimeError("Web artifact export is not deterministic under repeated export")
    return first


def _assert_no_stale_strategy_personas(frames: dict[str, pd.DataFrame]) -> None:
    stale_markers = ("smic_mtt_strategy_optuna_top", "SMIC MTT Optuna #")
    for name, frame in frames.items():
        if frame.empty:
            continue
        for column in ("persona", "label"):
            if column not in frame.columns:
                continue
            values = frame[column].astype(str)
            if values.str.contains("|".join(stale_markers), regex=True).any():
                raise RuntimeError(
                    f"{name}.{column} contains stale strategy persona labels; "
                    "rerun `uv run python -m snusmic_pipeline run-sim` before export-web."
                )


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing required CSV: {path}")
    return pd.read_csv(path, keep_default_na=False)


def _read_optional_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, keep_default_na=False)


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _current_holdings_from_open_episodes(
    position_episodes: pd.DataFrame, existing_holdings: pd.DataFrame
) -> pd.DataFrame:
    """Rebuild current holdings from open position episodes.

    ``position_episodes.csv`` is reconstructed from the trade ledger and is
    therefore the safest local source of truth for "what is still held now".
    ``current_holdings.csv`` can lag when a strategy-search export adds more
    promoted MTT personas after the first simulation pass. Rebuilding here
    prevents the web app from showing those personas as 100% cash while their
    summary row still reports open positions and non-zero holdings value.
    """

    if position_episodes.empty or "status" not in position_episodes.columns:
        return existing_holdings
    open_rows = position_episodes[position_episodes["status"].astype(str).eq("open")].copy()
    if open_rows.empty:
        return existing_holdings

    qty_bought = pd.to_numeric(open_rows.get("total_qty_bought"), errors="coerce").fillna(0)
    qty_sold = pd.to_numeric(open_rows.get("total_qty_sold"), errors="coerce").fillna(0)
    qty = qty_bought - qty_sold
    avg_cost = pd.to_numeric(open_rows.get("avg_entry_price_krw"), errors="coerce")
    last_close = pd.to_numeric(open_rows.get("last_close_krw"), errors="coerce").fillna(avg_cost)
    market_value = qty * last_close
    cost_value = qty * avg_cost
    unrealized = pd.to_numeric(open_rows.get("unrealized_pnl_krw"), errors="coerce")
    unrealized = unrealized.fillna(market_value - cost_value)

    rebuilt = pd.DataFrame(
        {
            "persona": open_rows.get("persona"),
            "symbol": open_rows.get("symbol"),
            "company": open_rows.get("company"),
            "qty": qty,
            "avg_cost_krw": avg_cost,
            "last_close_krw": last_close,
            "market_value_krw": market_value,
            "unrealized_pnl_krw": unrealized,
            "unrealized_return": (last_close / avg_cost - 1).where(avg_cost.gt(0)),
            "holding_days": pd.to_numeric(open_rows.get("holding_days"), errors="coerce"),
            "first_buy_date": open_rows.get("open_date"),
        }
    )
    return rebuilt[rebuilt["qty"].gt(0)].sort_values(["persona", "market_value_krw"], ascending=[True, False])


def _build_accounting_reconciliation(
    persona_rows: list[dict[str, Any]], holdings: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    holdings_by_persona: dict[str, list[dict[str, Any]]] = {}
    for row in holdings:
        holdings_by_persona.setdefault(str(row.get("persona") or ""), []).append(row)

    rows: list[dict[str, Any]] = []
    tolerance = 5_000.0
    for persona in persona_rows:
        persona_id = str(persona.get("persona") or "")
        persona_holdings = holdings_by_persona.get(persona_id, [])
        contributed = _number(persona.get("total_contributed_krw")) or 0.0
        realized = _number(persona.get("realized_pnl_krw")) or 0.0
        cash = _number(persona.get("final_cash_krw")) or 0.0
        equity = _number(persona.get("final_equity_krw")) or 0.0
        holdings_value = _number(persona.get("final_holdings_value_krw")) or 0.0
        net_profit = _number(persona.get("net_profit_krw")) or 0.0
        open_cost = sum(
            ((_number(row.get("avg_cost_krw")) or 0.0) * (_number(row.get("qty")) or 0.0))
            for row in persona_holdings
        )
        unrealized = sum(_number(row.get("unrealized_pnl_krw")) or 0.0 for row in persona_holdings)
        expected_cash = contributed + realized - open_cost
        cash_gap = cash - expected_cash
        equity_gap = equity - (cash + holdings_value)
        profit_gap = net_profit - (realized + unrealized)
        explain_cash = cash < realized and open_cost > 0
        status = "ok" if max(abs(cash_gap), abs(equity_gap), abs(profit_gap)) <= tolerance else "warning"
        rows.append(
            {
                "persona": persona_id,
                "label": persona.get("label"),
                "total_contributed_krw": contributed,
                "realized_pnl_krw": realized,
                "final_cash_krw": cash,
                "open_cost_basis_krw": open_cost,
                "open_market_value_krw": holdings_value,
                "unrealized_pnl_krw": unrealized,
                "final_equity_krw": equity,
                "net_profit_krw": net_profit,
                "expected_cash_krw": expected_cash,
                "cash_gap_krw": cash_gap,
                "equity_gap_krw": equity_gap,
                "profit_gap_krw": profit_gap,
                "status": status,
                "explanation_ko": (
                    "확정 손익이 현금보다 커 보이는 이유는 현재 보유 중인 포지션의 매입 원가가 현금에서 빠져 있기 때문입니다. "
                    "현금은 출자금과 청산손익의 누계가 아니라, 그 금액에서 아직 들고 있는 주식의 원가를 차감한 잔액입니다."
                    if explain_cash
                    else "현금, 보유 평가액, 확정·미실현 손익의 관계가 허용 오차 안에서 맞습니다."
                ),
            }
        )
    return rows


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(_clean(data), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _write_product_json(path: Path, data: Any) -> None:
    """Write route-owned product data without duplicating raw artifact bulk.

    Top-level artifacts are intentionally readable snapshots. Page bundles are
    build/runtime product contracts, so they are compact and field-scoped to
    keep the committed web surface small enough for normal Git workflows.
    """

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(_clean(data), ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _write_page_bundles(
    out: Path,
    *,
    overview: dict[str, Any],
    insights: list[dict[str, Any]],
    data_quality: dict[str, Any],
    personas: list[dict[str, Any]],
    holdings: list[dict[str, Any]],
    monthly_holdings: list[dict[str, Any]],
    trades: list[dict[str, Any]],
    episodes: list[dict[str, Any]],
    equity_daily: list[dict[str, Any]],
    accounting_reconciliation: list[dict[str, Any]],
    reports: list[dict[str, Any]],
    rankings: dict[str, Any],
    detail_metrics: dict[str, Any],
    return_windows: list[dict[str, Any]],
    target_distribution: dict[str, Any],
    strategy_catalog: list[dict[str, Any]],
    screener_candidates: list[dict[str, Any]],
) -> None:
    """Write page-owned product bundles.

    Top-level JSON artifacts remain exported as raw downloadable/source files,
    but the web app should consume these page bundles so each route has a clear
    data owner and future UI work does not rebuild the same meaning locally.
    """

    _write_product_json(out / "overview" / "snapshot.json", overview)
    _write_product_json(out / "overview" / "research-pulse.json", insights)
    _write_product_json(out / "overview" / "data-quality.json", data_quality)

    _write_product_json(out / "portfolio" / "personas.json", personas)
    _write_product_json(out / "portfolio" / "holdings.json", holdings)
    _write_product_json(
        out / "portfolio" / "monthly-holdings.json", _compact_monthly_holdings(monthly_holdings)
    )
    _write_product_json(out / "portfolio" / "trades.json", _compact_trades(trades))
    _write_product_json(out / "portfolio" / "episodes.json", _compact_episodes(episodes))
    _write_product_json(out / "portfolio" / "equity-daily.json", _compact_equity_curves(equity_daily))
    _write_product_json(out / "portfolio" / "accounting-reconciliation.json", accounting_reconciliation)

    _write_product_json(out / "reports" / "table.json", reports)
    _write_product_json(out / "reports" / "rankings.json", rankings)
    _write_product_json(out / "reports" / "detail-metrics.json", detail_metrics)
    _write_product_json(out / "reports" / "return-windows.json", return_windows)
    _write_product_json(out / "reports" / "target-hit-distribution.json", target_distribution)

    _write_product_json(out / "strategies" / "catalog.json", strategy_catalog)
    _write_product_json(out / "strategies" / "leaderboard.json", personas)
    _write_product_json(out / "strategies" / "curves.json", _compact_equity_curves(equity_daily))

    _write_product_json(out / "screener" / "candidates.json", screener_candidates)


def _compact_monthly_holdings(rows: list[dict[str, Any]]) -> dict[str, Any]:
    columns = [
        "persona",
        "month_end",
        "symbol",
        "company",
        "qty",
        "market_value_krw",
        "last_close_native",
        "currency",
        "weight_in_portfolio",
    ]
    return _compact_table(rows, columns)


def _compact_trades(rows: list[dict[str, Any]]) -> dict[str, Any]:
    columns = [
        "persona",
        "date",
        "symbol",
        "side",
        "qty",
        "fill_price_krw",
        "gross_krw",
        "cash_after_krw",
        "reason",
        "report_id",
    ]
    return _compact_table(rows, columns)


def _compact_episodes(rows: list[dict[str, Any]]) -> dict[str, Any]:
    columns = [
        "persona",
        "symbol",
        "company",
        "open_date",
        "close_date",
        "holding_days",
        "buy_fills",
        "sell_fills",
        "total_qty_bought",
        "total_qty_sold",
        "avg_entry_price_krw",
        "avg_exit_price_krw",
        "realized_pnl_krw",
        "unrealized_pnl_krw",
        "last_close_krw",
        "status",
        "exit_reasons",
    ]
    return _compact_table(rows, columns)


def _compact_table(rows: list[dict[str, Any]], columns: list[str]) -> dict[str, Any]:
    return {
        "columns": columns,
        "rows": [[_compact_cell(row.get(column)) for column in columns] for row in rows],
    }


def _compact_equity_curves(rows: list[dict[str, Any]]) -> dict[str, Any]:
    dates = sorted({str(row.get("date", "")) for row in rows if row.get("date")})
    date_index = {date: index for index, date in enumerate(dates)}
    by_persona: dict[str, list[dict[str, Any] | None]] = {}
    for row in rows:
        persona = str(row.get("persona", ""))
        date = str(row.get("date", ""))
        if not persona or date not in date_index:
            continue
        by_persona.setdefault(persona, [None] * len(dates))[date_index[date]] = row

    series = []
    for persona in sorted(by_persona):
        equity_values: list[int | None] = []
        return_values: list[float | None] = []
        for row in by_persona[persona]:
            if row is None:
                equity_values.append(None)
                return_values.append(None)
                continue
            equity = _numeric_or_none(row.get("equity_krw"))
            capital = _numeric_or_none(row.get("contributed_capital_krw"))
            equity_values.append(None if equity is None else int(round(equity)))
            if equity is None or capital is None or capital <= 0:
                return_values.append(None)
            else:
                return_values.append(round(equity / capital - 1, 6))
        series.append({"persona": persona, "equity_krw": equity_values, "cumulative_return": return_values})
    return {"dates": dates, "series": series}


def _compact_cell(value: Any) -> Any:
    if value in {"", None}:
        return None
    if isinstance(value, float):
        if not math.isfinite(value):
            return None
        return round(value, 4)
    if isinstance(value, int):
        return value
    return value


def _numeric_or_none(value: Any) -> float | None:
    if value in {"", None}:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return number


def _snapshot_json_bytes(root: Path) -> dict[str, bytes]:
    return {
        str(path.relative_to(root)): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.suffix in {".json", ".csv"}
    }


def write_web_manifest(out: Path) -> Path:
    """Write the deterministic web artifact manifest after all exports finish."""

    overview = _read_json(out / "overview.json")
    _write_json(out / "manifest.json", _build_manifest(out, overview))
    return out / "manifest.json"


def _build_manifest(out: Path, overview: dict[str, Any]) -> dict[str, Any]:
    simulation_window = overview.get("simulation_window", {}) if isinstance(overview, dict) else {}
    price_end = simulation_window.get("price_end") if isinstance(simulation_window, dict) else None
    generated_at = f"{price_end}T00:00:00+09:00" if price_end else None
    artifacts = sorted(
        str(path.relative_to(out))
        for path in out.rglob("*")
        if path.suffix in {".json", ".csv"} and path.name != "manifest.json"
    )
    top_level_artifacts = [name for name in artifacts if not name.startswith("prices/")]
    row_counts = {
        "reports": _json_row_count(out / "reports" / "table.json"),
        "current_holdings": _json_row_count(out / "portfolio" / "holdings.json"),
        "monthly_holdings": _json_row_count(out / "portfolio" / "monthly-holdings.json"),
        "trades": _json_row_count(out / "portfolio" / "trades.json"),
        "position_episodes": _json_row_count(out / "portfolio" / "episodes.json"),
        "equity_daily": _json_row_count(out / "portfolio" / "equity-daily.json"),
        "personas": _json_row_count(out / "portfolio" / "personas.json"),
        "strategy_catalog": _json_row_count(out / "strategies" / "catalog.json"),
        "screener_candidates": _json_row_count(out / "screener" / "candidates.json"),
    }
    report_counts = overview.get("report_counts", {}) if isinstance(overview, dict) else {}
    target_stats = overview.get("target_stats", {}) if isinstance(overview, dict) else {}
    return {
        "schema_version": "1.0.0",
        "generated_at": generated_at,
        "artifact_root": "data/web",
        "report_range": _range(simulation_window, "report_start", "report_end"),
        "price_range": _range(simulation_window, "price_start", "price_end"),
        "simulation_range": _range(simulation_window, "report_start", "price_end"),
        "row_counts": row_counts,
        "data_quality": {
            "total_reports": report_counts.get("web_report_rows"),
            "reports_with_prices": report_counts.get("price_matched_reports"),
            "missing_price_symbols": report_counts.get("missing_price_symbols"),
            "target_hit_count": target_stats.get("target_hit_count"),
        },
        "artifacts": top_level_artifacts,
        "price_artifact_count": sum(1 for name in artifacts if name.startswith("prices/")),
        "checksums": {
            name: sha256((out / name).read_bytes()).hexdigest()
            for name in top_level_artifacts
            if (out / name).is_file()
        },
    }


def _range(mapping: Any, start_key: str, end_key: str) -> dict[str, Any]:
    if not isinstance(mapping, dict):
        return {"start": None, "end": None}
    return {"start": mapping.get(start_key), "end": mapping.get(end_key)}


def _json_row_count(path: Path) -> int:
    if not path.exists():
        return 0
    data = _read_json(path)
    if isinstance(data, list):
        return len(data)
    return 1


def _records(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df.empty:
        return []
    return [_clean(record) for record in df.to_dict(orient="records")]


def _clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _clean(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_clean(item) for item in value]
    if isinstance(value, tuple):
        return [_clean(item) for item in value]
    if pd.isna(value):
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if hasattr(value, "item"):
        return _clean(value.item())
    return value


def _number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(parsed) or math.isinf(parsed):
        return None
    return parsed


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _median(values: list[float]) -> float | None:
    return float(statistics.median(values)) if values else None


def _round_number(value: Any, digits: int = 4) -> float | None:
    parsed = _number(value)
    return round(parsed, digits) if parsed is not None else None


def _price_frame_with_native(prices: pd.DataFrame) -> pd.DataFrame:
    """Return prices with explicit native and KRW OHLC columns.

    Warehouse prices are simulation-ready: cross-market OHLC values are often
    KRW-normalized while source_currency and krw_per_unit preserve the market
    quote. Web artifacts should expose native prices as the asset-price SSOT
    and keep KRW only as a valuation/aggregation companion.
    """

    if prices.empty:
        return prices.copy()
    out = prices.copy()
    source_currency = out.get("source_currency", "KRW")
    display_currency = out.get("display_currency", source_currency)
    out["_source_currency_norm"] = (
        pd.Series(source_currency, index=out.index).astype(str).map(normalize_currency)
    )
    out["_display_currency_norm"] = (
        pd.Series(display_currency, index=out.index).astype(str).map(normalize_currency)
    )
    out["_krw_per_unit_num"] = pd.to_numeric(out.get("krw_per_unit", 1.0), errors="coerce")
    for column in ("open", "high", "low", "close"):
        values = pd.to_numeric(out.get(column), errors="coerce")
        out[f"{column}_native"] = _native_from_display_prices(
            values,
            out["_source_currency_norm"],
            out["_display_currency_norm"],
            out["_krw_per_unit_num"],
        )
        out[f"{column}_krw"] = _krw_from_display_prices(
            values,
            out["_display_currency_norm"],
            out["_krw_per_unit_num"],
        )
    out["currency"] = out["_source_currency_norm"].replace("", "KRW")
    return out


def _native_from_display_prices(
    values: pd.Series,
    source_currency: pd.Series,
    display_currency: pd.Series,
    krw_per_unit: pd.Series,
) -> pd.Series:
    native = pd.to_numeric(values, errors="coerce").copy()
    is_foreign_source = source_currency.ne("KRW")
    is_krw_display = display_currency.eq("KRW")
    can_convert = is_foreign_source & is_krw_display & krw_per_unit.gt(0)
    native.loc[can_convert] = native.loc[can_convert] / krw_per_unit.loc[can_convert]
    return native


def _krw_from_display_prices(
    values: pd.Series,
    display_currency: pd.Series,
    krw_per_unit: pd.Series,
) -> pd.Series:
    krw = pd.to_numeric(values, errors="coerce").copy()
    needs_conversion = display_currency.ne("KRW") & krw_per_unit.gt(0)
    krw.loc[needs_conversion] = krw.loc[needs_conversion] * krw_per_unit.loc[needs_conversion]
    return krw


def _bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if value in ("True", "true", "1", 1):
        return True
    if value in ("False", "false", "0", 0):
        return False
    return None


def _target_direction(target: float | None, entry: float | None) -> str | None:
    if target is None or entry is None or entry <= 0:
        return None
    if target > entry:
        return "upside"
    if target < entry:
        return "downside"
    return None


def _infer_native_entry_from_target(
    target_price_native: float | None,
    target_upside_at_pub: float | None,
) -> float | None:
    """Infer native entry from target/upside when extraction missed it.

    ``report_performance.csv`` is KRW-oriented, while the web report artifact is
    the display SSOT. For overseas reports, the frontend should not have to
    guess a native entry price from the target. When the extracted target is
    native and the realised upside is available, target / (1 + upside) is the
    same deterministic relationship used by the simulation for KRW values.
    """

    if target_price_native is None or target_upside_at_pub is None:
        return None
    divisor = 1.0 + target_upside_at_pub
    if divisor <= 0:
        return None
    return target_price_native / divisor


def _is_sell_opinion(value: Any) -> bool:
    return str(value or "").strip().casefold() in {"sell", "매도"}


def _report_price_context(row: dict[str, Any], perf: dict[str, Any], symbol: str) -> dict[str, Any]:
    raw_target_price_krw = _number(row.get("target_price_krw"))
    perf_target_price_krw = _number(perf.get("target_price_krw"))
    target_price_krw = perf_target_price_krw if perf_target_price_krw is not None else raw_target_price_krw
    price_currency = normalize_currency(
        row.get("price_currency") or row.get("target_currency") or currency_for_symbol(symbol) or "KRW"
    )
    target_currency = normalize_currency(row.get("target_currency") or price_currency)
    raw_target_price = _number(row.get("target_price_local")) or _number(row.get("target_price"))
    entry_price_native = _number(row.get("report_current_price"))
    inferred_entry_price_native = False
    entry_price_krw = _number(perf.get("entry_price_krw")) or _number(row.get("report_current_price_krw"))
    if price_currency == "KRW":
        target_price_native = target_price_krw
    elif raw_target_price is not None and target_currency == price_currency:
        target_price_native = raw_target_price
    elif entry_price_native is not None and entry_price_krw and target_price_krw:
        target_price_native = entry_price_native * target_price_krw / entry_price_krw
    else:
        target_price_native = raw_target_price
    target_upside_at_pub = _number(perf.get("target_upside_at_pub"))
    if price_currency == "KRW":
        entry_price_native = (
            entry_price_native or _number(row.get("report_current_price_krw")) or entry_price_krw
        )
    elif entry_price_native is None:
        entry_price_native = _infer_native_entry_from_target(target_price_native, target_upside_at_pub)
        inferred_entry_price_native = entry_price_native is not None
    return {
        "raw_target_price_krw": raw_target_price_krw,
        "target_price_krw": target_price_krw,
        "target_price_native": target_price_native,
        "target_price": target_price_native if target_price_native is not None else target_price_krw,
        "price_currency": price_currency,
        "target_currency": target_currency,
        "entry_price_krw": entry_price_krw,
        "entry_price_native": entry_price_native,
        "entry_price_native_inferred": inferred_entry_price_native,
        "target_upside_at_pub": target_upside_at_pub,
    }


def _build_report_rows(
    reports: pd.DataFrame,
    report_performance: pd.DataFrame,
    extraction_quality: dict[str, Any],
    missing_symbols: list[str],
) -> list[dict[str, Any]]:
    performance_by_id = {str(row["report_id"]): row for row in report_performance.to_dict(orient="records")}
    review_reasons = _review_reasons_by_report(reports, extraction_quality)
    missing = set(missing_symbols)
    rows: list[dict[str, Any]] = []
    for row in reports.sort_values(["publication_date", "page", "ordinal", "report_id"]).to_dict(
        orient="records"
    ):
        report_id = str(row["report_id"])
        perf = performance_by_id.get(report_id, {})
        symbol = str(row.get("symbol", ""))
        if symbol in missing or not perf:
            continue
        if _is_sell_opinion(row.get("rating")):
            continue
        caveats = []
        caveats.extend(review_reasons.get(report_id, []))
        context = _report_price_context(row, perf, symbol)
        raw_target_price_krw = context["raw_target_price_krw"]
        target_price_krw = context["target_price_krw"]
        target_price_native = context["target_price_native"]
        target_price = context["target_price"]
        price_currency = context["price_currency"]
        target_currency = context["target_currency"]
        entry_price_krw = context["entry_price_krw"]
        entry_price_native = context["entry_price_native"]
        target_upside_at_pub = context["target_upside_at_pub"]
        if (
            raw_target_price_krw is not None
            and target_price_krw is not None
            and not math.isclose(raw_target_price_krw, target_price_krw, rel_tol=1e-9, abs_tol=0.01)
        ):
            caveats.append("price_scale_adjusted_target")
        if context["entry_price_native_inferred"]:
            caveats.append("entry_price_native_inferred")
        if target_upside_at_pub is not None and target_upside_at_pub <= 0:
            continue
        target_direction = _target_direction(target_price_native, entry_price_native)
        if target_direction != "upside":
            continue
        target_hit = _bool(perf.get("target_hit"))
        days_to_target = _number(perf.get("days_to_target"))
        if target_hit and days_to_target is not None and days_to_target <= 1:
            continue
        rows.append(
            {
                "report_id": report_id,
                "date": row.get("publication_date"),
                "company": row.get("company"),
                "ticker": row.get("ticker"),
                "exchange": row.get("exchange"),
                "symbol": symbol,
                "title": row.get("title"),
                "rating": row.get("rating"),
                "pdf_url": row.get("pdf_url"),
                "markdown_filename": row.get("markdown_filename"),
                "target_price": target_price,
                "target_price_krw": target_price_krw,
                "target_price_native": target_price_native,
                "currency": price_currency,
                "display_currency": price_currency,
                "price_currency": price_currency,
                "target_currency": target_currency,
                "target_direction": target_direction,
                "publication_price_krw": _number(row.get("report_current_price_krw")),
                "entry_price_krw": entry_price_krw,
                "entry_price_native": entry_price_native,
                "target_upside_at_pub": target_upside_at_pub,
                "target_hit": target_hit,
                "target_hit_date": perf.get("target_hit_date") or None,
                "days_to_target": days_to_target,
                "last_close_krw": _number(perf.get("last_close_krw")),
                "last_close_date": perf.get("last_close_date") or None,
                "current_return": _number(perf.get("current_return")),
                "peak_return": _number(perf.get("peak_return")),
                "trough_return": _number(perf.get("trough_return")),
                "target_gap_pct": _number(perf.get("target_gap_pct")),
                "expiry_date": perf.get("expiry_date") or None,
                "expired": _bool(perf.get("expired")),
                "caveat_flags": sorted(set(caveats)),
            }
        )
    return rows


def _build_report_exclusion_counts(
    reports: pd.DataFrame, report_performance: pd.DataFrame, missing_symbols: list[str]
) -> dict[str, int]:
    performance_by_id = {str(row["report_id"]): row for row in report_performance.to_dict(orient="records")}
    missing = set(missing_symbols)
    counts = {
        "missing_price": 0,
        "missing_performance": 0,
        "sell_opinion": 0,
        "non_positive_upside": 0,
        "downside_target": 0,
        "instant_target_hit": 0,
    }
    included = 0
    for row in reports.sort_values(["publication_date", "page", "ordinal", "report_id"]).to_dict(
        orient="records"
    ):
        report_id = str(row["report_id"])
        perf = performance_by_id.get(report_id, {})
        symbol = str(row.get("symbol", ""))
        if symbol in missing:
            counts["missing_price"] += 1
            continue
        if not perf:
            counts["missing_performance"] += 1
            continue
        if _is_sell_opinion(row.get("rating")):
            counts["sell_opinion"] += 1
            continue

        context = _report_price_context(row, perf, symbol)
        target_upside_at_pub = context["target_upside_at_pub"]
        if target_upside_at_pub is not None and target_upside_at_pub <= 0:
            counts["non_positive_upside"] += 1
            continue
        if _target_direction(context["target_price_native"], context["entry_price_native"]) != "upside":
            counts["downside_target"] += 1
            continue
        target_hit = _bool(perf.get("target_hit"))
        days_to_target = _number(perf.get("days_to_target"))
        if target_hit and days_to_target is not None and days_to_target <= 1:
            counts["instant_target_hit"] += 1
            continue
        included += 1
    excluded_total = sum(counts.values())
    return {
        **counts,
        "included_reports": included,
        "excluded_reports": excluded_total,
        "source_reports": included + excluded_total,
    }


def _review_reasons_by_report(
    reports: pd.DataFrame, extraction_quality: dict[str, Any]
) -> dict[str, list[str]]:
    if not extraction_quality.get("review_rows"):
        return {}
    ids_by_key = {
        (str(row.get("publication_date", ""))[:10], str(row.get("company", ""))): str(
            row.get("report_id", "")
        )
        for row in reports.to_dict(orient="records")
    }
    reasons: dict[str, list[str]] = {}
    for review in extraction_quality.get("review_rows", []):
        key = (str(review.get("date", ""))[:10], str(review.get("company", "")))
        report_id = ids_by_key.get(key)
        if not report_id:
            continue
        reasons[report_id] = [f"extraction_review:{reason}" for reason in review.get("reasons", [])]
    return reasons


def _build_overview(
    reports: pd.DataFrame,
    prices: pd.DataFrame,
    summary: pd.DataFrame,
    report_stats: dict[str, Any],
    missing_symbols: list[str],
    report_rows: list[dict[str, Any]],
    report_exclusions: dict[str, int],
) -> dict[str, Any]:
    dates = [str(row["date"]) for row in report_rows if row.get("date")]
    price_dates = prices["date"].tolist() if "date" in prices else []
    target_hits = [row for row in report_rows if row.get("target_hit") is True]
    days_to_target = [_number(row.get("days_to_target")) for row in target_hits]
    days_to_target = [value for value in days_to_target if value is not None]
    current_returns = [_number(row.get("current_return")) for row in report_rows]
    current_returns = [value for value in current_returns if value is not None]
    return {
        "generated_from": {
            "warehouse_reports": "data/warehouse/reports.csv",
            "warehouse_daily_prices": "data/warehouse/daily_prices.csv",
            "sim_summary": "data/sim/summary.csv",
            "sim_report_stats": "data/sim/report_stats.json",
        },
        "report_counts": {
            "extracted_reports": int(len(reports)),
            "report_stat_rows": int(report_stats.get("total_reports", 0)),
            "price_matched_reports": len(report_rows),
            "missing_price_symbols": len(missing_symbols),
            "web_report_rows": len(report_rows),
            "excluded_reports": report_exclusions["excluded_reports"],
            "excluded_missing_price": report_exclusions["missing_price"],
            "excluded_missing_performance": report_exclusions["missing_performance"],
            "excluded_sell_opinion": report_exclusions["sell_opinion"],
            "excluded_non_positive_upside": report_exclusions["non_positive_upside"],
            "excluded_downside_target": report_exclusions["downside_target"],
            "excluded_instant_target_hit": report_exclusions["instant_target_hit"],
        },
        "target_stats": {
            "target_hit_count": len(target_hits),
            "target_hit_rate": len(target_hits) / max(1, len(report_rows)),
            "avg_days_to_target": _mean(days_to_target),
            "median_days_to_target": _median(days_to_target),
            "avg_current_return": _mean(current_returns),
            "median_current_return": _median(current_returns),
        },
        "baseline_personas": _records(summary),
        "simulation_window": {
            "report_start": min(dates) if dates else None,
            "report_end": max(dates) if dates else None,
            "price_start": min(price_dates) if price_dates else None,
            "price_end": max(price_dates) if price_dates else None,
        },
    }


BENCHMARK_PERSONA_IDS = {
    "all_weather",
    "smic_follower",
    "smic_follower_v2",
    "benchmark_kodex200",
    "benchmark_qqq",
    "benchmark_spy",
    "benchmark_gld",
    "weak_oracle",
}

TARGET_BENCHMARK_ID = "benchmark_kodex200"
OBJECTIVE_MAX_DRAWDOWN = 0.15


def _build_strategy_catalog(summary: pd.DataFrame, sim_config_path: Path) -> list[dict[str, Any]]:
    """Build the frontend strategy taxonomy and methodology contract.

    The UI must not infer benchmark/strategy meaning from fragile string
    prefixes. This catalog is the product boundary: labels, short labels,
    benchmark groups, strategy rules, objective gate, and searchable params are
    exported together with the simulation output.
    """

    config_by_id = _persona_config_by_id(sim_config_path)
    summary_rows = _records(summary)
    summary_by_id = {str(row.get("persona")): row for row in summary_rows if row.get("persona")}
    benchmark_return = _number(summary_by_id.get(TARGET_BENCHMARK_ID, {}).get("money_weighted_return"))
    rows: list[dict[str, Any]] = []

    for row in summary_rows:
        strategy_id = str(row.get("persona") or "")
        if not strategy_id:
            continue
        config = config_by_id.get(strategy_id, {})
        kind = _strategy_kind(strategy_id)
        return_pct = _number(row.get("money_weighted_return"))
        max_drawdown = _number(row.get("max_drawdown"))
        return_excess = (
            return_pct - benchmark_return
            if return_pct is not None and benchmark_return is not None and strategy_id != TARGET_BENCHMARK_ID
            else None
        )
        mdd_slack = OBJECTIVE_MAX_DRAWDOWN - max_drawdown if max_drawdown is not None else None
        objective_passed = (
            kind == "strategy"
            and return_excess is not None
            and return_excess > 0
            and mdd_slack is not None
            and mdd_slack >= 0
        )
        label = str(row.get("label") or config.get("label") or strategy_id)
        rows.append(
            {
                "strategy_id": strategy_id,
                "label": label,
                "short_label": _strategy_short_label(strategy_id, label),
                "kind": kind,
                "benchmark_group": _benchmark_group(strategy_id),
                "is_selectable": kind == "strategy",
                "is_default_candidate": kind == "strategy",
                "objective_passed": objective_passed,
                "objective_return_excess": return_excess,
                "objective_mdd_slack": mdd_slack,
                "methodology_summary": _methodology_summary(strategy_id, config),
                "buy_rules": _buy_rules(strategy_id, config),
                "sell_rules": _sell_rules(strategy_id, config),
                "risk_controls": _risk_controls(strategy_id, config),
                "params": _strategy_params(config),
                "metrics": {
                    "final_equity_krw": _number(row.get("final_equity_krw")),
                    "final_cash_krw": _number(row.get("final_cash_krw")),
                    "final_holdings_value_krw": _number(row.get("final_holdings_value_krw")),
                    "money_weighted_return": return_pct,
                    "cagr": _number(row.get("cagr")),
                    "max_drawdown": max_drawdown,
                    "trade_count": _number(row.get("trade_count")),
                    "open_positions": _number(row.get("open_positions")),
                },
            }
        )

    return sorted(rows, key=_strategy_catalog_sort_key)


def _persona_config_by_id(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        raise RuntimeError(f"Required simulation config artifact is missing: {path}")
    data = _read_json(path)
    personas = data.get("personas") if isinstance(data, dict) else None
    if not isinstance(personas, list):
        raise RuntimeError(f"{path} must contain personas for strategy catalog export.")
    out: dict[str, dict[str, Any]] = {}
    for item in personas:
        if not isinstance(item, dict):
            continue
        strategy_id = item.get("persona_name")
        if strategy_id:
            out[str(strategy_id)] = _clean(item)
    return out


def _strategy_kind(strategy_id: str) -> str:
    if strategy_id == "weak_oracle":
        return "oracle"
    if strategy_id in BENCHMARK_PERSONA_IDS:
        return "benchmark"
    return "strategy"


def _benchmark_group(strategy_id: str) -> str | None:
    if strategy_id == "all_weather":
        return "allocation"
    if strategy_id in {"smic_follower", "smic_follower_v2"}:
        return "follower"
    if strategy_id in {"benchmark_kodex200", "benchmark_qqq", "benchmark_spy", "benchmark_gld"}:
        return "market"
    if strategy_id == "weak_oracle":
        return "oracle"
    return None


def _strategy_short_label(strategy_id: str, label: str) -> str:
    labels = {
        "all_weather": "All-Weather",
        "smic_follower": "Follower v1",
        "smic_follower_v2": "Follower SL",
        "benchmark_kodex200": "KODEX200",
        "benchmark_qqq": "QQQ",
        "benchmark_spy": "SPY",
        "benchmark_gld": "GLD",
        "weak_oracle": "Weak Prophet",
    }
    if strategy_id in labels:
        return labels[strategy_id]
    prefix = "smic_mtt_strategy_top"
    if strategy_id.startswith(prefix):
        return f"MTT #{strategy_id.removeprefix(prefix)}"
    return label.replace("SMIC MTT Strategy #", "MTT #")


def _methodology_summary(strategy_id: str, config: dict[str, Any]) -> str:
    if strategy_id == "all_weather":
        return "GLD, QQQ, SPY, KODEX200을 같은 비중으로 보유하며 월 단위로 리밸런싱하는 분산 기준선입니다."
    if strategy_id.startswith("benchmark_"):
        assets = config.get("assets") if isinstance(config.get("assets"), list) else []
        name = assets[0].get("name") if assets and isinstance(assets[0], dict) else strategy_id
        return f"{name} 단일 자산을 추적하는 시장 기준선입니다."
    if strategy_id == "smic_follower":
        return "가격 매칭된 상승 리포트를 1/N으로 추종하는 단순 기준선입니다."
    if strategy_id == "smic_follower_v2":
        return "SMIC Follower에 시간 손실, 물타기 손실, 리포트 만료 손절 규칙을 추가한 기준선입니다."
    if strategy_id == "weak_oracle":
        return (
            "미래 가격 정보를 일부 사용하는 강한 상한선 기준입니다. 투자 가능한 전략으로 해석하지 않습니다."
        )
    if strategy_id.startswith("smic_mtt_strategy"):
        return "리포트 업사이드와 가격 추세 조건을 통과한 종목만 실제 주식 수량 단위로 매수·보유·매도하는 포트폴리오 전략입니다."
    return "시뮬레이션에 포함된 전략입니다."


def _buy_rules(strategy_id: str, config: dict[str, Any]) -> list[str]:
    if strategy_id.startswith("smic_mtt_strategy"):
        if not config:
            return ["세부 조건 artifact 없음", "성과·보유·매매내역만 검증 가능"]
        rules = [
            f"발간 시 목표 업사이드 {_pct(config.get('min_target_upside_at_pub'))} 이상",
            f"목표 업사이드 {_pct(config.get('max_target_upside_at_pub'))} 이하",
            f"최대 보유 {int(config.get('max_positions') or 0)}개 슬롯",
            f"투자 유니버스: {config.get('universe', 'all')}",
        ]
        if config.get("require_mtt"):
            rules.extend(
                [
                    f"52주 저점 대비 {_pct(config.get('min_price_vs_52w_low'))} 이상",
                    f"52주 고점 대비 {_pct(config.get('max_pct_below_52w_high'))} 이내",
                    f"200일선 1개월 변화율 {_pct(config.get('min_ma200_1m_return'))} 이상",
                ]
            )
        return rules
    if strategy_id == "smic_follower":
        return ["상승 목표가가 있는 가격 매칭 리포트를 1/N으로 편입"]
    if strategy_id == "smic_follower_v2":
        return [
            "상승 목표가가 있는 가격 매칭 리포트를 1/N으로 편입",
            "리포트/가격 조건에 따라 일별로 매수 판단",
        ]
    if strategy_id == "weak_oracle":
        return [f"{int(config.get('lookahead_months') or 0)}개월 앞 수익률 정보를 사용해 월간 비중 산정"]
    if strategy_id in BENCHMARK_PERSONA_IDS:
        return ["정해진 기준 자산을 월간 리밸런싱"]
    return []


def _sell_rules(strategy_id: str, config: dict[str, Any]) -> list[str]:
    if strategy_id.startswith("smic_mtt_strategy"):
        if not config:
            return ["세부 조건 artifact 없음", "매도 사유는 매매내역과 포지션 기록에서 확인"]
        return [
            f"손절 {_pct(config.get('stop_loss_pct'))}",
            f"익절 {_pct(config.get('take_profit_pct'))}",
            f"리포트 발간 후 {int(config.get('report_age_stop_days') or 0)}일 경과",
            f"목표가 도달 배수 {float(config.get('target_hit_multiplier') or 1):.2f}x",
        ]
    if strategy_id == "smic_follower_v2":
        return [
            f"{int(config.get('time_loss_days') or 0)}일 보유 후 손실이면 정리",
            f"물타기 포지션 손실 {_pct(config.get('averaged_down_stop_pct'))} 초과 시 정리",
            f"리포트 발간 후 {int(config.get('report_age_stop_days') or 0)}일 경과",
        ]
    if strategy_id == "smic_follower":
        return ["목표가 도달 또는 리포트 만료 기준으로 정리"]
    if strategy_id in BENCHMARK_PERSONA_IDS:
        return ["월간 리밸런싱으로 비중 조정"]
    return []


def _risk_controls(strategy_id: str, config: dict[str, Any]) -> list[str]:
    if strategy_id.startswith("smic_mtt_strategy"):
        if not config:
            return ["정수 주식 수량 기반 체결", "수수료·세금 반영", "누락된 조건은 데이터 품질 항목으로 표시"]
        cadence = config.get("top_up_cadence", "monthly")
        return [
            f"추가 매수 주기: {cadence}",
            "정수 주식 수량 기반 체결",
            "수수료·세금 반영",
            "미충족 후보가 없으면 현금 보유",
        ]
    if strategy_id == "weak_oracle":
        return [
            f"개별 자산 최대 비중 {_pct(config.get('max_weight'))}",
            "미래정보 사용 기준선",
        ]
    return ["벤치마크 비교용 기준선"] if strategy_id in BENCHMARK_PERSONA_IDS else []


def _strategy_params(config: dict[str, Any]) -> dict[str, Any]:
    excluded = {"persona_name", "label", "assets"}
    return {key: value for key, value in config.items() if key not in excluded}


def _strategy_catalog_sort_key(row: dict[str, Any]) -> tuple[int, float, str]:
    strategy_id = str(row.get("strategy_id") or "")
    order = {
        "all_weather": 0,
        "smic_follower": 1,
        "smic_follower_v2": 2,
        "benchmark_kodex200": 3,
        "benchmark_qqq": 4,
        "benchmark_spy": 5,
        "benchmark_gld": 6,
        "weak_oracle": 7,
    }
    if strategy_id in order:
        return (order[strategy_id], 0.0, strategy_id)
    metrics = row.get("metrics") if isinstance(row.get("metrics"), dict) else {}
    ret = _number(metrics.get("money_weighted_return")) if isinstance(metrics, dict) else None
    return (100, -(ret if ret is not None else -999.0), strategy_id)


def _pct(value: Any) -> str:
    number = _number(value)
    if number is None:
        return "—"
    return f"{number * 100:.0f}%"


def _build_rankings(report_stats: dict[str, Any], report_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Build table-ready rankings from the canonical web report rows.

    ``report_stats`` is still required as an upstream-contract check, but the
    public ranking artifact must share the same filtered universe as
    ``reports.json``. That keeps price-missing rows, sell opinions, and
    same/next-day target hits out of every report view.
    """

    for key in (
        "top_winners",
        "top_losers",
        "fastest_target_hits",
        "slowest_target_hits",
        "biggest_target_gaps_below",
        "biggest_target_overshoots",
        "most_aggressive_targets",
    ):
        _required_ranking(report_stats, key)
    rows_with_current = [row for row in report_rows if row.get("current_return") is not None]
    hit_rows = [
        row
        for row in report_rows
        if row.get("target_hit") is True and _number(row.get("days_to_target")) is not None
    ]
    open_gap_rows = [
        row
        for row in report_rows
        if row.get("target_hit") is not True
        and _number(row.get("target_gap_pct")) is not None
        and (_number(row.get("target_gap_pct")) or 0) < 0
    ]
    overshoot_rows = [
        row
        for row in report_rows
        if _number(row.get("target_gap_pct")) is not None and (_number(row.get("target_gap_pct")) or 0) > 0
    ]
    aggressive_rows = [row for row in report_rows if _number(row.get("target_upside_at_pub")) is not None]
    return {
        "top_winners": _rank(rows_with_current, "current_return", True),
        "top_losers": _rank(rows_with_current, "current_return", False),
        "fastest_hits": _rank(hit_rows, "days_to_target", False),
        "slowest_hits": _rank(hit_rows, "days_to_target", True),
        "biggest_open_target_gaps": _rank(open_gap_rows, "target_gap_pct", False),
        "biggest_target_overshoots": _rank(overshoot_rows, "target_gap_pct", True),
        "most_aggressive_targets": _rank(aggressive_rows, "target_upside_at_pub", True),
        "best_current_returns": _rank(rows_with_current, "current_return", True),
        "worst_current_returns": _rank(rows_with_current, "current_return", False),
    }


def _required_ranking(report_stats: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = report_stats.get(key)
    if not isinstance(value, list):
        raise KeyError(f"report_stats.{key} must be present as a list")
    return value


def _rank(rows: list[dict[str, Any]], metric: str, descending: bool, limit: int = 10) -> list[dict[str, Any]]:
    ranked = sorted(rows, key=lambda row: _number(row.get(metric)) or 0, reverse=descending)
    return [
        {
            "report_id": row.get("report_id"),
            "date": row.get("date"),
            "publication_date": row.get("date"),
            "company": row.get("company"),
            "symbol": row.get("symbol"),
            "metric": metric,
            "value": _number(row.get(metric)),
            "entry_price_krw": _number(row.get("entry_price_krw")),
            "target_price_krw": _number(row.get("target_price_krw")),
            "target_upside_at_pub": _number(row.get("target_upside_at_pub")),
            "current_return": _number(row.get("current_return")),
            "target_hit": _bool(row.get("target_hit")),
            "target_hit_date": row.get("target_hit_date"),
            "days_to_target": _number(row.get("days_to_target")),
            "last_close_krw": _number(row.get("last_close_krw")),
            "last_close_date": row.get("last_close_date"),
            "peak_return": _number(row.get("peak_return")),
            "trough_return": _number(row.get("trough_return")),
            "target_gap_pct": _number(row.get("target_gap_pct")),
        }
        for row in ranked[:limit]
    ]


def _build_return_windows(
    report_rows: list[dict[str, Any]], prices: pd.DataFrame, windows: tuple[int, ...] = (30, 60, 90, 180)
) -> list[dict[str, Any]]:
    if prices.empty:
        return []
    priced = _price_frame_with_native(prices)
    priced["date"] = pd.to_datetime(priced["date"], errors="coerce")
    by_symbol = {
        str(symbol): group.sort_values("date") for symbol, group in priced.groupby("symbol", sort=True)
    }
    results: list[dict[str, Any]] = []
    for report in sorted(report_rows, key=lambda row: str(row.get("report_id"))):
        symbol = str(report.get("symbol") or "")
        group = by_symbol.get(symbol)
        entry_price = _number(report.get("entry_price_krw")) or _number(report.get("publication_price_krw"))
        publication_date = pd.to_datetime(report.get("date"), errors="coerce")
        if group is None or entry_price in (None, 0) or pd.isna(publication_date):
            window_values = {f"return_{days}d": None for days in windows}
            window_values.update({f"price_{days}d_krw": None for days in windows})
            window_values.update({f"date_{days}d": None for days in windows})
        else:
            window_values = {}
            for days in windows:
                target_date = publication_date + pd.Timedelta(days=days)
                candidates = group[group["date"] >= target_date]
                if candidates.empty:
                    window_values[f"return_{days}d"] = None
                    window_values[f"price_{days}d_krw"] = None
                    window_values[f"date_{days}d"] = None
                    continue
                price_row = candidates.iloc[0]
                price = _number(price_row.get("close_krw"))
                window_values[f"return_{days}d"] = round((price / entry_price) - 1, 6) if price else None
                window_values[f"price_{days}d_krw"] = round(price, 4) if price is not None else None
                window_values[f"date_{days}d"] = price_row["date"].date().isoformat()
        results.append(
            {
                "report_id": report.get("report_id"),
                "company": report.get("company"),
                "symbol": symbol,
                "date": report.get("date"),
                "entry_price_krw": entry_price,
                **window_values,
            }
        )
    return results


def _build_detail_metrics(
    report_rows: list[dict[str, Any]],
    prices: pd.DataFrame,
    return_windows: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    windows_by_id = {str(row.get("report_id")): row for row in return_windows}
    if prices.empty:
        return {
            str(row["report_id"]): _detail_without_prices(row, windows_by_id.get(str(row["report_id"]), {}))
            for row in report_rows
        }
    priced = _price_frame_with_native(prices)
    priced["date"] = pd.to_datetime(priced["date"], errors="coerce")
    by_symbol = {
        str(symbol): group.sort_values("date") for symbol, group in priced.groupby("symbol", sort=True)
    }
    details: dict[str, dict[str, Any]] = {}
    for report in sorted(report_rows, key=lambda row: str(row.get("report_id"))):
        report_id = str(report["report_id"])
        publication_date = pd.to_datetime(report.get("date"), errors="coerce")
        history = by_symbol.get(str(report.get("symbol") or ""))
        after_publication = (
            history[history["date"] >= publication_date].copy()
            if history is not None and not pd.isna(publication_date)
            else pd.DataFrame()
        )
        entry_price = _number(report.get("entry_price_krw")) or _number(report.get("publication_price_krw"))
        target_price = _number(report.get("target_price_krw"))
        markers = [
            {
                "date": report.get("date"),
                "type": "publication",
                "label": "리포트 발간",
                "price_krw": entry_price,
            }
        ]
        peak = trough = None
        if not after_publication.empty:
            peak_row = after_publication.loc[after_publication["close_krw"].idxmax()]
            trough_row = after_publication.loc[after_publication["close_krw"].idxmin()]
            last_row = after_publication.iloc[-1]
            peak = _price_marker(peak_row, "peak", "발간 후 고점")
            trough = _price_marker(trough_row, "trough", "발간 후 저점")
            markers.extend([peak, trough, _price_marker(last_row, "latest", "최근 종가")])
        if report.get("target_hit_date"):
            markers.append(
                {
                    "date": report.get("target_hit_date"),
                    "type": "target_hit",
                    "label": "목표가 도달",
                    "price_krw": target_price,
                }
            )
        details[report_id] = {
            "report_id": report_id,
            "company": report.get("company"),
            "symbol": report.get("symbol"),
            "target_price_krw": target_price,
            "entry_price_krw": entry_price,
            "current_return": _number(report.get("current_return")),
            "peak_return": _number(report.get("peak_return")),
            "trough_return": _number(report.get("trough_return")),
            "target_gap_pct": _number(report.get("target_gap_pct")),
            "target_hit": _bool(report.get("target_hit")),
            "days_to_target": _number(report.get("days_to_target")),
            "return_windows": windows_by_id.get(report_id, {}),
            "markers": sorted(
                [marker for marker in markers if marker.get("date")], key=lambda marker: str(marker["date"])
            ),
            "price_extremes": {"peak": peak, "trough": trough},
        }
    return details


def _detail_without_prices(report: dict[str, Any], windows: dict[str, Any]) -> dict[str, Any]:
    return {
        "report_id": report.get("report_id"),
        "company": report.get("company"),
        "symbol": report.get("symbol"),
        "return_windows": windows,
        "markers": [{"date": report.get("date"), "type": "publication", "label": "리포트 발간"}],
        "price_extremes": {"peak": None, "trough": None},
    }


def _price_marker(row: pd.Series, marker_type: str, label: str) -> dict[str, Any]:
    price = _number(row.get("close_krw"))
    return {
        "date": row["date"].date().isoformat(),
        "type": marker_type,
        "label": label,
        "price_krw": round(price, 4) if price is not None else None,
    }


def _build_target_hit_distribution(report_rows: list[dict[str, Any]]) -> dict[str, Any]:
    bins = [
        ("0-30일", 0, 30),
        ("31-60일", 31, 60),
        ("61-90일", 61, 90),
        ("91-180일", 91, 180),
        ("181-365일", 181, 365),
        ("365일+", 366, None),
    ]
    hit_rows = [
        row for row in report_rows if row.get("target_hit") and _number(row.get("days_to_target")) is not None
    ]
    day_buckets = []
    for label, lower, upper in bins:
        count = sum(
            1
            for row in hit_rows
            if (days := _number(row.get("days_to_target"))) is not None
            and days >= lower
            and (upper is None or days <= upper)
        )
        day_buckets.append({"bucket": label, "count": count})

    upside_buckets = []
    for label, lower, upper in [
        ("0-25%", 0, 0.25),
        ("25-50%", 0.25, 0.5),
        ("50-100%", 0.5, 1.0),
        ("100-200%", 1.0, 2.0),
        ("200%+", 2.0, None),
    ]:
        bucket_rows = [
            row
            for row in report_rows
            if (upside := _number(row.get("target_upside_at_pub"))) is not None
            and upside >= lower
            and (upper is None or upside < upper)
        ]
        hit_count = sum(1 for row in bucket_rows if row.get("target_hit"))
        returns = [
            _number(row.get("current_return"))
            for row in bucket_rows
            if _number(row.get("current_return")) is not None
        ]
        upside_buckets.append(
            {
                "bucket": label,
                "count": len(bucket_rows),
                "target_hit_count": hit_count,
                "target_hit_rate": round(hit_count / len(bucket_rows), 6) if bucket_rows else None,
                "avg_current_return": round(sum(returns) / len(returns), 6) if returns else None,
            }
        )

    return {
        "summary": {
            "total_reports": len(report_rows),
            "target_hit_count": len(hit_rows),
            "target_hit_rate": round(len(hit_rows) / len(report_rows), 6) if report_rows else None,
        },
        "days_to_target_buckets": day_buckets,
        "target_upside_buckets": upside_buckets,
    }


def _build_insights(
    overview: dict[str, Any],
    rankings: dict[str, Any],
    target_distribution: dict[str, Any],
    return_windows: list[dict[str, Any]],
    data_quality: dict[str, Any],
) -> list[dict[str, Any]]:
    counts = overview["report_counts"]
    stats = overview["target_stats"]
    hit_summary = target_distribution["summary"]
    valid_90d = [row for row in return_windows if _number(row.get("return_90d")) is not None]
    avg_90d = (
        round(sum(_number(row["return_90d"]) or 0 for row in valid_90d) / len(valid_90d), 6)
        if valid_90d
        else None
    )
    best = (rankings.get("best_current_returns") or [{}])[0]
    worst = (rankings.get("worst_current_returns") or [{}])[0]
    fastest = (rankings.get("fastest_hits") or [{}])[0]
    quality = data_quality["coverage"]
    return [
        {
            "id": "target-hit-rate",
            "title": "목표가 도달률",
            "sentence": f"가격 매칭 리포트 기준 목표가 도달률은 {hit_summary.get('target_hit_rate')}입니다.",
            "metric": hit_summary.get("target_hit_rate"),
            "related_report_ids": [],
        },
        {
            "id": "average-days-to-target",
            "title": "목표가 도달 속도",
            "sentence": f"목표가에 도달한 리포트의 평균 소요 기간은 {stats.get('avg_days_to_target')}일입니다.",
            "metric": stats.get("avg_days_to_target"),
            "related_report_ids": [fastest.get("report_id")] if fastest.get("report_id") else [],
        },
        {
            "id": "average-90d-return",
            "title": "발간 후 90일 성과",
            "sentence": f"90일 가격 데이터가 있는 리포트의 평균 90일 수익률은 {avg_90d}입니다.",
            "metric": avg_90d,
            "related_report_ids": [],
        },
        {
            "id": "best-current-return",
            "title": "현재 수익률 상위 리포트",
            "sentence": f"현재 수익률 최상위 리포트는 {best.get('company')} ({best.get('symbol')})입니다.",
            "metric": best.get("current_return"),
            "related_report_ids": [best.get("report_id")] if best.get("report_id") else [],
        },
        {
            "id": "worst-current-return",
            "title": "하방 리스크 리포트",
            "sentence": f"현재 수익률 최하위 리포트는 {worst.get('company')} ({worst.get('symbol')})입니다.",
            "metric": worst.get("current_return"),
            "related_report_ids": [worst.get("report_id")] if worst.get("report_id") else [],
        },
        {
            "id": "missing-price-coverage",
            "title": "가격 데이터 커버리지",
            "sentence": f"전체 {counts['extracted_reports']}개 리포트 중 가격 누락 심볼은 {counts['missing_price_symbols']}개입니다.",
            "metric": counts["missing_price_symbols"],
            "related_report_ids": [],
        },
        {
            "id": "performance-coverage",
            "title": "성과 산출 커버리지",
            "sentence": f"성과 산출 누락 리포트는 {quality['reports_without_performance']}개입니다.",
            "metric": quality["reports_without_performance"],
            "related_report_ids": [],
        },
    ]


def _build_screener_candidates(report_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    latest_date = max((str(row.get("date") or "") for row in report_rows), default="")
    for row in report_rows:
        if row.get("target_direction") != "upside":
            continue
        if _bool(row.get("target_hit")) or _bool(row.get("expired")):
            continue
        target_upside = _number(row.get("target_upside_at_pub"))
        current_return = _number(row.get("current_return"))
        target_gap = _number(row.get("target_gap_pct"))
        if target_upside is None or target_upside <= 0 or current_return is None or target_gap is None:
            continue
        age_days = _date_diff_days(str(row.get("date") or ""), latest_date)
        if age_days is not None and age_days <= 120:
            bucket = "fresh"
            rank_basis = f"최근 {age_days}일 리포트"
        elif target_upside >= 0.5:
            bucket = "large-upside"
            rank_basis = "목표 업사이드 50% 이상"
        elif target_gap <= 0.2:
            bucket = "near-target"
            rank_basis = "목표가 20% 이내"
        else:
            bucket = "active"
            rank_basis = "미도달·미만료 활성 리포트"
        score = (target_upside * 1.4) + max(0.0, current_return) - max(0.0, target_gap * 0.25)
        candidates.append(
            {
                "report_id": row.get("report_id"),
                "symbol": row.get("symbol"),
                "company": row.get("company"),
                "date": row.get("date"),
                "bucket": bucket,
                "rank_basis": rank_basis,
                "score": round(score, 6),
                "target_upside_at_pub": target_upside,
                "current_return": current_return,
                "target_gap_pct": target_gap,
            }
        )
    return sorted(
        candidates,
        key=lambda item: (
            -(_number(item.get("score")) or 0),
            str(item.get("date") or ""),
            str(item.get("symbol") or ""),
        ),
    )


def _date_diff_days(start: str, end: str) -> int | None:
    if not start or not end:
        return None
    try:
        return (pd.Timestamp(end).date() - pd.Timestamp(start).date()).days
    except (TypeError, ValueError):
        return None


def _build_data_quality(
    extraction_quality: dict[str, Any],
    missing_symbols: list[str],
    reports: pd.DataFrame,
    report_performance: pd.DataFrame,
    report_exclusions: dict[str, int],
) -> dict[str, Any]:
    performance_ids = (
        set(report_performance["report_id"].astype(str)) if not report_performance.empty else set()
    )
    report_ids = set(reports["report_id"].astype(str)) if not reports.empty else set()
    return {
        "extraction_quality": extraction_quality,
        "report_exclusions": report_exclusions,
        "missing_symbols": [{"symbol": symbol} for symbol in missing_symbols],
        "coverage": {
            "warehouse_reports": len(report_ids),
            "report_performance_rows": len(performance_ids),
            "reports_without_performance": len(report_ids - performance_ids),
        },
    }


def _write_download_csvs(out: Path, report_rows: list[dict[str, Any]], data_quality: dict[str, Any]) -> None:
    report_columns = [
        "report_id",
        "date",
        "company",
        "ticker",
        "exchange",
        "symbol",
        "title",
        "rating",
        "target_price_krw",
        "target_price_native",
        "currency",
        "display_currency",
        "target_direction",
        "publication_price_krw",
        "entry_price_krw",
        "entry_price_native",
        "target_upside_at_pub",
        "target_hit",
        "target_hit_date",
        "days_to_target",
        "last_close_krw",
        "last_close_date",
        "current_return",
        "peak_return",
        "trough_return",
        "target_gap_pct",
        "caveat_flags",
        "pdf_url",
    ]
    report_download_rows = []
    for row in report_rows:
        csv_row = {column: row.get(column) for column in report_columns}
        csv_row["caveat_flags"] = "|".join(row.get("caveat_flags", []))
        report_download_rows.append(csv_row)
    _write_csv(out / "table-download-reports.csv", report_download_rows, report_columns)

    strategy_rows = _strategy_download_rows()
    strategy_columns = (
        sorted({key for row in strategy_rows for key in row}) if strategy_rows else ["strategy_id"]
    )
    preferred_strategy_columns = [
        "strategy_id",
        "label",
        "kind",
        "final_equity_krw",
        "final_cash_krw",
        "final_holdings_value_krw",
        "money_weighted_return",
        "cagr",
        "max_drawdown",
        "trade_count",
        "open_positions",
    ]
    strategy_columns = [
        *[column for column in preferred_strategy_columns if column in strategy_columns],
        *[column for column in strategy_columns if column not in preferred_strategy_columns],
    ]
    _write_csv(out / "table-download-strategies.csv", strategy_rows, strategy_columns)

    quality_rows = [
        {"section": "coverage", "metric": metric, "value": value}
        for metric, value in data_quality.get("coverage", {}).items()
    ]
    quality_rows.extend(
        {"section": "missing_symbol", "metric": row.get("symbol"), "value": row.get("symbol")}
        for row in data_quality.get("missing_symbols", [])
    )
    _write_csv(out / "data-quality-download.csv", quality_rows, ["section", "metric", "value"])


def _strategy_download_rows() -> list[dict[str, Any]]:
    summary_path = Path("data/sim/summary.csv")
    if not summary_path.exists():
        return []
    rows = _records(pd.read_csv(summary_path, keep_default_na=False))
    benchmark_ids = {
        "all_weather",
        "smic_follower",
        "smic_follower_v2",
        "benchmark_kodex200",
        "benchmark_qqq",
        "benchmark_spy",
        "benchmark_gld",
        "weak_oracle",
    }
    return [
        {
            "strategy_id": row.get("persona"),
            "label": row.get("label"),
            "kind": (
                "oracle"
                if row.get("persona") == "weak_oracle"
                else "benchmark"
                if row.get("persona") in benchmark_ids
                else "strategy"
            ),
            "final_equity_krw": row.get("final_equity_krw"),
            "final_cash_krw": row.get("final_cash_krw"),
            "final_holdings_value_krw": row.get("final_holdings_value_krw"),
            "money_weighted_return": row.get("money_weighted_return"),
            "cagr": row.get("cagr"),
            "max_drawdown": row.get("max_drawdown"),
            "trade_count": row.get("trade_count"),
            "open_positions": row.get("open_positions"),
        }
        for row in rows
    ]


def _write_csv(path: Path, rows: list[dict[str, Any]], columns: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(rows, columns=columns)
    frame = frame.map(_csv_cell) if not frame.empty else frame
    frame.to_csv(path, index=False, encoding="utf-8")


def _csv_cell(value: Any) -> Any:
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(_clean(value), ensure_ascii=False, sort_keys=True)
    return _clean(value)


def _write_price_artifacts(prices: pd.DataFrame, symbols: set[str], prices_out: Path) -> None:
    if prices.empty:
        for symbol in sorted(str(symbol) for symbol in symbols):
            _write_json(
                prices_out / f"{symbol}.json",
                {"symbol": symbol, "currency": "KRW", "missing_price": True, "prices": []},
            )
        return
    filtered = _price_frame_with_native(prices)
    filtered = filtered[filtered["symbol"].astype(str).isin(symbols)].copy()
    filtered.sort_values(["symbol", "date"], inplace=True)
    written: set[str] = set()
    for symbol, group in filtered.groupby("symbol", sort=True):
        written.add(str(symbol))
        rows = []
        for row in group.to_dict(orient="records"):
            rows.append(
                {
                    "date": row.get("date"),
                    "open": _number(row.get("open_native")),
                    "high": _number(row.get("high_native")),
                    "low": _number(row.get("low_native")),
                    "close": _number(row.get("close_native")),
                    "close_krw": _round_number(row.get("close_krw")),
                    "volume": _number(row.get("volume")),
                    "currency": row.get("currency"),
                    "source_currency": row.get("currency"),
                    "display_currency": row.get("currency"),
                    "krw_per_unit": _number(row.get("krw_per_unit")),
                }
            )
        currency = str(group.iloc[-1].get("currency") or "KRW")
        _write_json(prices_out / f"{symbol}.json", {"symbol": symbol, "currency": currency, "prices": rows})
    for symbol in sorted(str(symbol) for symbol in {str(symbol) for symbol in symbols} - written):
        _write_json(
            prices_out / f"{symbol}.json",
            {"symbol": symbol, "currency": "KRW", "missing_price": True, "prices": []},
        )
