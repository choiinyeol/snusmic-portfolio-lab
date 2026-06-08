from __future__ import annotations

import csv
import json
import math
import re
import shutil
import statistics
import subprocess
import time
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any, cast
from urllib.parse import urljoin

import pandas as pd

from ..market_data.currency import currency_for_symbol, normalize_currency
from .contracts import (
    ACCOUNT_CATALOG_ROWS,
    HOLDING_ROWS,
    REPORT_ROWS,
    TRADE_ROWS,
    ArtifactManifest,
    ExternalArtifactPointer,
    WebOverview,
)

REQUIRED_ARTIFACTS = [
    "manifest.json",
    "health.json",
    "overview/snapshot.json",
    "overview/research-pulse.json",
    "overview/data-quality.json",
    "portfolio/accounts.json",
    "portfolio/holdings.json",
    "portfolio/monthly-holdings.json",
    "portfolio/trades.json",
    "portfolio/daily-decisions/index.json",
    "portfolio/episodes.json",
    "portfolio/equity/index.json",
    "portfolio/accounting-reconciliation.json",
    "reports/table.json",
    "reports/rankings.json",
    "reports/detail-metrics.json",
    "reports/return-windows.json",
    "reports/target-hit-distribution.json",
    "report-statistics-lab.json",
    "accounts/catalog.json",
    "accounts/leaderboard.json",
    "accounts/curves.json",
    "report-board/candidates.json",
    "research-calendar/calendar.json",
    "pages/report-verification.json",
    "pages/report-board.json",
    "pages/report-statistics.json",
    "pages/portfolio-dashboard.json",
    "pages/research-calendar.json",
    "overview.json",
    "accounts.json",
    "reports.json",
    "report-rankings.json",
    "report-detail-metrics.json",
    "return-windows.json",
    "target-hit-distribution.json",
    "insights.json",
    "current-holdings.json",
    "monthly-holdings.json",
    "missing-symbols.json",
    "report-health.json",
    "data-quality.json",
    "trades.json",
    "position-episodes.json",
    "accounting-reconciliation.json",
    "table-download-reports.csv",
    "table-download-accounts.csv",
    "data-quality-download.csv",
]

WEB_PORTFOLIO_ACCOUNT_IDS = (
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
    "pit_mtt_rs90_top5",
    "pit_mtt_rs80_top5",
    "pit_mtt_rs70_top5",
    "pit_mtt_low100_top5",
    "pit_mtt_low300_top5",
    "pit_momentum_6m12m_top5",
    "pit_momentum_3m6m_top5",
    "pit_momentum_1m3m_top5",
    "pit_trend_top5",
    "pit_score_top5",
    "smic_follower",
)
WEB_PORTFOLIO_BENCHMARK_IDS = (
    "all_weather",
    "benchmark_kodex200",
    "benchmark_qqq",
    "benchmark_spy",
    "benchmark_gld",
)
WEB_PORTFOLIO_ACCOUNT_ORDER = {account_id: index for index, account_id in enumerate(WEB_PORTFOLIO_ACCOUNT_IDS)}
_ACCOUNT_ID_PATTERN = re.compile(r"^[A-Za-z0-9_]+$")
MISSING_PRICE_CLASSIFICATIONS = {
    "003410.KS": {
        "category": "delisted",
        "action": "상장폐지 이력이 있는 KRX 종목입니다. 리포트 표본 제외를 유지하거나 별도 과거 가격 소스를 연결하세요.",
        "decision": "accepted_exclusion",
        "release_status": "accepted",
    },
    "010620.KS": {
        "category": "provider_gap",
        "action": "현재 Yahoo Finance에서 quote가 잡히지 않습니다. 대체 가격 소스 또는 provider mapping을 확인하세요.",
        "decision": "source_gap",
        "release_status": "action_required",
    },
    "287410.KQ": {
        "category": "delisted",
        "action": "상장폐지 이력이 있는 KOSDAQ 종목입니다. 리포트 표본 제외를 유지하거나 별도 과거 가격 소스를 연결하세요.",
        "decision": "accepted_exclusion",
        "release_status": "accepted",
    },
    "NETI": {
        "category": "delisted",
        "action": "상장폐지/거래중단된 해외 종목입니다. 리포트 표본 제외를 유지하거나 별도 과거 가격 소스를 연결하세요.",
        "decision": "accepted_exclusion",
        "release_status": "accepted",
    },
    "SOI.PA": {
        "category": "mapping_fixed_pending_refresh",
        "action": "Soitec Yahoo ticker는 SOI.PA입니다. 다음 가격 refresh 뒤 가격 artifact 편입 여부를 확인하세요.",
        "decision": "refresh_pending",
        "release_status": "action_required",
    },
    "SOIT.PA": {
        "category": "bad_yfinance_symbol",
        "action": "Soitec Yahoo ticker가 SOI.PA로 보정되었습니다. warehouse/web artifact를 재생성하세요.",
        "decision": "mapping_replaced",
        "release_status": "fixed",
    },
    "VTNR": {
        "category": "delisted",
        "action": "상장폐지/거래중단된 해외 종목입니다. 리포트 표본 제외를 유지하거나 별도 과거 가격 소스를 연결하세요.",
        "decision": "accepted_exclusion",
        "release_status": "accepted",
    },
}


def _frame_series(frame: pd.DataFrame, column: str, default: Any = pd.NA) -> pd.Series:
    if column in frame.columns:
        return frame[column]
    return pd.Series(default, index=frame.index)


def _numeric_series(frame: pd.DataFrame, column: str, default: Any = pd.NA) -> pd.Series:
    return pd.to_numeric(_frame_series(frame, column, default), errors="coerce")


def _to_numeric(value: Any) -> Any:
    return pd.to_numeric(cast(Any, value), errors="coerce")


def _to_datetime(value: Any) -> Any:
    return pd.to_datetime(cast(Any, value), errors="coerce")


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
            _to_datetime(out["month_end"]) if "month_end" in out.columns else None,
        )
        return out

    work = prices.dropna(subset=["symbol", "date"]).copy()
    work["date"] = pd.to_datetime(work["date"], errors="coerce")
    work["close"] = _numeric_series(work, "close")
    work["krw_per_unit"] = _numeric_series(work, "krw_per_unit")
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
    prices_by_symbol = {
        str(symbol): group[price_columns].sort_values("date")
        for symbol, group in prices.groupby("symbol", sort=False)
    }
    for symbol, group in out.groupby("symbol", sort=False):
        price_group = prices_by_symbol.get(str(symbol), pd.DataFrame(columns=price_columns))
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
    qty = _numeric_series(holdings, "qty")
    market_value = _numeric_series(holdings, "market_value_krw")
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
        native.loc[~normalized.eq("KRW")] = pd.NA
        return native

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
    external_artifact_dir: Path | None = None
    external_artifact_url_root: str | None = None

EXTERNAL_ELIGIBLE_PREFIXES = (
    "portfolio/equity/",
    "portfolio/daily-decisions/",
)


@dataclass
class ExternalArtifactManager:
    out_root: Path
    external_dir: Path | None
    public_root: str | None
    pointers: dict[str, ExternalArtifactPointer]

    @classmethod
    def from_inputs(cls, inputs: ExportInputs) -> ExternalArtifactManager:
        if inputs.external_artifact_dir is not None and not inputs.external_artifact_url_root:
            raise ValueError("external_artifact_url_root is required when external_artifact_dir is set")
        return cls(
            out_root=inputs.out,
            external_dir=inputs.external_artifact_dir.resolve() if inputs.external_artifact_dir else None,
            public_root=inputs.external_artifact_url_root.rstrip("/") + "/" if inputs.external_artifact_url_root else None,
            pointers={},
        )

    def enabled_for(self, relative_path: str) -> bool:
        if self.external_dir is None:
            return False
        return any(relative_path.startswith(prefix) and not relative_path.endswith("/index.json") for prefix in EXTERNAL_ELIGIBLE_PREFIXES)

    def write_json(self, relative_path: str, data: Any, *, compact: bool) -> None:
        target = self.out_root / relative_path
        if not self.enabled_for(relative_path):
            if compact:
                _write_product_json(target, data)
            else:
                _write_json(target, data)
            return

        payload = (
            json.dumps(_clean(data), ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
            if compact
            else json.dumps(_clean(data), ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        ).encode("utf-8")
        external_dir = self.external_dir
        if external_dir is None:
            raise ValueError("external_dir is required when writing external artifacts")
        external_path = external_dir / relative_path
        external_path.parent.mkdir(parents=True, exist_ok=True)
        external_path.write_bytes(payload)
        pointer = ExternalArtifactPointer(
            storage_key=relative_path,
            checksum=sha256(payload).hexdigest(),
            size_bytes=len(payload),
            row_count=_external_row_count(data),
            public_url=urljoin(self.public_root, relative_path) if self.public_root else None,
        )
        self.pointers[relative_path] = pointer
        if target.exists():
            target.unlink()


def _external_row_count(data: Any) -> int | None:
    if isinstance(data, dict):
        if isinstance(data.get("accounts"), list):
            return len(data["accounts"])
        if isinstance(data.get("rows"), list):
            return len(data["rows"])
        if isinstance(data.get("dates"), list) and isinstance(data.get("series"), list):
            return len(data["dates"]) * len(data["series"])
    if isinstance(data, list):
        return len(data)
    return None

def export_web_artifacts(inputs: ExportInputs) -> dict[str, Any]:
    """Export deterministic JSON artifacts through a guarded atomic swap."""

    out = inputs.out
    _guard_export_destination(inputs)
    with TemporaryDirectory(
        dir=str(out.resolve().parent if out.resolve().parent.exists() else Path.cwd())
    ) as tmpdir:
        staged_out = Path(tmpdir) / out.name
        staged_inputs = ExportInputs(
            warehouse=inputs.warehouse,
            sim=inputs.sim,
            out=staged_out,
            extraction_quality=inputs.extraction_quality,
            external_artifact_dir=inputs.external_artifact_dir,
            external_artifact_url_root=inputs.external_artifact_url_root,
        )
        result = _export_web_artifacts_unchecked(staged_inputs)
        missing = [name for name in REQUIRED_ARTIFACTS if not (staged_out / name).exists()]
        if missing:
            raise RuntimeError(f"Missing required web artifacts in staged export: {', '.join(missing)}")
        manifest = _read_json(staged_out / "manifest.json")
        bad_paths = [name for name in manifest.get("artifacts", []) if "\\" in str(name)]
        if bad_paths:
            raise RuntimeError(f"Manifest contains non-POSIX artifact paths: {bad_paths[:5]}")
        _validate_price_artifact_cross_references(staged_out)
        _validate_report_artifact_cross_references(staged_out)
        _replace_directory(staged_out, out)
    result["out"] = str(out)
    return result


def _export_web_artifacts_unchecked(inputs: ExportInputs) -> dict[str, Any]:
    """Export deterministic JSON artifacts for the static web showcase."""

    stage_seconds: dict[str, float] = {}
    stage_started = time.perf_counter()

    def mark(stage: str) -> None:
        nonlocal stage_started
        now = time.perf_counter()
        stage_seconds[stage] = round(now - stage_started, 4)
        stage_started = now

    external = ExternalArtifactManager.from_inputs(inputs)
    reports = _read_csv(inputs.warehouse / "reports.csv")
    prices = _read_csv(inputs.warehouse / "daily_prices.csv")
    fx_rates = _read_optional_csv(inputs.warehouse / "fx_rates.csv")
    summary = _read_csv(inputs.sim / "summary.csv")
    current_holdings = _read_csv(inputs.sim / "current_holdings.csv")
    monthly_holdings = _read_optional_csv(inputs.sim / "monthly_holdings.csv")
    report_performance = _read_csv(inputs.sim / "report_performance.csv")
    report_stats = _read_json(inputs.sim / "report_stats.json")
    trades = _read_csv(inputs.sim / "trades.csv")
    daily_decisions = _read_optional_csv(inputs.sim / "daily_decisions.csv")
    daily_forward_metadata = (
        _read_json(inputs.sim / "daily-forward-metadata.json")
        if (inputs.sim / "daily-forward-metadata.json").exists()
        else {}
    )
    position_episodes = _read_csv(inputs.sim / "position_episodes.csv")
    equity_daily = _read_csv(inputs.sim / "equity_daily.csv")
    pit_research_board = _read_csv(inputs.sim / "pit-research-board.csv")
    extraction_quality = _read_json(inputs.extraction_quality) if inputs.extraction_quality.exists() else {}
    mark("read_inputs")

    valid_accounts = _summary_accounts(summary)
    current_holdings = _guard_account_frame(current_holdings, valid_accounts, "current_holdings")
    monthly_holdings = _guard_account_frame(
        monthly_holdings, valid_accounts, "monthly_holdings", allow_filter=True
    )
    trades = _guard_account_frame(trades, valid_accounts, "trades")
    daily_decisions = _guard_account_frame(daily_decisions, valid_accounts, "daily_decisions")
    position_episodes = _guard_account_frame(position_episodes, valid_accounts, "position_episodes")
    equity_daily = _guard_account_frame(equity_daily, valid_accounts, "equity_daily")

    out = inputs.out
    prices_out = out / "prices"
    if out.exists():
        shutil.rmtree(out)
    prices_out.mkdir(parents=True, exist_ok=True)
    mark("prepare_output")

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
    missing_symbol_rows = _missing_symbol_rows(missing_symbols, reports)

    priced_prices = _price_frame_with_native(prices)
    price_groups = _price_groups_by_symbol(priced_prices, prices_are_native=True)
    report_rows = _build_report_rows(
        reports,
        report_performance,
        extraction_quality,
        missing_symbols,
        price_groups=price_groups,
    )
    report_exclusions = _build_report_exclusion_counts(reports, report_performance, missing_symbols)
    overview = _build_overview(
        reports, prices, summary, report_stats, missing_symbols, report_rows, report_exclusions
    )
    account_catalog = _build_account_catalog(summary, inputs.sim / "account-configs.json")
    account_labels = {str(row["account_id"]): str(row["label"]) for row in account_catalog}
    _apply_account_labels(overview.get("baseline_accounts", []), account_labels)
    mark("build_overview")

    return_windows = _build_return_windows(report_rows, price_groups=price_groups)
    detail_metrics = _build_detail_metrics(
        report_rows, priced_prices, return_windows, price_groups=price_groups
    )
    target_distribution = _build_target_hit_distribution(report_rows)
    rankings = _build_rankings(report_stats, report_rows)
    data_quality = _build_data_quality(
        extraction_quality, missing_symbol_rows, reports, report_performance, report_exclusions
    )
    insights = _build_insights(overview, rankings, target_distribution, return_windows, data_quality)
    research_calendar = _build_research_calendar(pit_research_board, price_groups, overview)
    mark("build_report_metrics")

    current_holdings = _current_holdings_from_open_episodes(position_episodes, current_holdings)
    account_rows = _enrich_account_rows_with_catalog(_records(summary), account_catalog)
    _apply_account_labels(account_rows, account_labels)
    enriched_current_holdings = _records(_enrich_holdings_with_native(current_holdings, prices, fx_rates))
    enriched_monthly_holdings = _records(
        _enrich_holdings_with_native(monthly_holdings, prices, fx_rates, close_column="month_close_krw")
    )
    trade_rows = _records(
        _enrich_trades_with_company(
            _require_trade_realized_pnl(trades),
            reports=reports,
            current_holdings=current_holdings,
            monthly_holdings=monthly_holdings,
            position_episodes=position_episodes,
        )
    )
    daily_decision_rows = _records(daily_decisions)
    episode_rows = _records(position_episodes)
    equity_rows = _records(equity_daily)
    accounting_rows = _build_accounting_reconciliation(account_rows, enriched_current_holdings)
    report_board_candidates = _build_report_board_candidates(report_rows)
    mark("build_portfolio_rows")

    _validate_boundary_artifacts(
        overview=overview,
        reports=report_rows,
        holdings=enriched_current_holdings,
        trades=trade_rows,
        account_catalog=account_catalog,
    )
    mark("validate_boundary_artifacts")

    _write_page_bundles(
        out,
        overview=overview,
        insights=insights,
        data_quality=data_quality,
        accounts=account_rows,
        holdings=enriched_current_holdings,
        monthly_holdings=enriched_monthly_holdings,
        trades=trade_rows,
        daily_decisions=daily_decision_rows,
        daily_forward_metadata=daily_forward_metadata,
        episodes=episode_rows,
        equity_daily=equity_rows,
        accounting_reconciliation=accounting_rows,
        reports=report_rows,
        rankings=rankings,
        detail_metrics=detail_metrics,
        return_windows=return_windows,
        target_distribution=target_distribution,
        account_catalog=account_catalog,
        report_board_candidates=report_board_candidates,
        research_calendar=research_calendar,
        external=external,
    )
    mark("write_page_bundles")

    _write_json(out / "overview.json", overview)
    _write_json(out / "accounts.json", account_rows)
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
    _write_json(out / "missing-symbols.json", missing_symbol_rows)
    _write_json(out / "data-quality.json", data_quality)
    report_health = _build_report_health(
        reports, report_performance, extraction_quality, missing_symbols, report_rows
    )
    _write_json(out / "report-health.json", report_health)
    _write_json(out / "trades.json", trade_rows)
    _write_json(out / "position-episodes.json", episode_rows)
    _write_json(out / "accounting-reconciliation.json", accounting_rows)
    _write_artifact_health(out, overview, data_quality)
    _write_download_csvs(out, report_rows, data_quality, account_catalog)
    mark("write_tables")

    _write_price_artifacts(priced_prices, artifact_symbols, prices_out, prices_are_native=True)
    mark("write_price_artifacts")

    _write_report_statistics_lab(out)
    statistics_lab = _read_json(out / "report-statistics-lab.json")
    _write_product_json(
        out / "pages" / "report-statistics.json",
        _report_statistics_page_bundle(
            overview,
            rankings,
            target_distribution,
            return_windows,
            statistics_summary=statistics_lab.get("summary") if isinstance(statistics_lab, dict) else None,
        ),
    )
    mark("write_report_statistics_lab")

    write_web_manifest(out, external)
    mark("write_manifest")

    written = sorted(
        _relative_posix(path, out) for path in out.rglob("*") if path.suffix in {".json", ".csv"}
    )
    return {
        "out": str(out),
        "artifact_count": len(written),
        "artifacts": written,
        "overview": overview,
        "missing_symbols": missing_symbols,
        "stage_seconds": stage_seconds,
    }


def check_web_artifacts(inputs: ExportInputs) -> dict[str, Any]:
    """Export and verify required artifacts plus deterministic repeated output."""

    first = export_web_artifacts(inputs)
    missing = [name for name in REQUIRED_ARTIFACTS if not (inputs.out / name).exists()]
    if missing:
        raise RuntimeError(f"Missing required web artifacts: {', '.join(missing)}")
    _validate_price_artifact_cross_references(inputs.out)
    _validate_report_artifact_cross_references(inputs.out)

    first_bytes = _snapshot_json_bytes(inputs.out)
    with TemporaryDirectory() as tmpdir:
        second_inputs = ExportInputs(
            warehouse=inputs.warehouse,
            sim=inputs.sim,
            out=Path(tmpdir) / "web",
            extraction_quality=inputs.extraction_quality,
            external_artifact_dir=inputs.external_artifact_dir,
            external_artifact_url_root=inputs.external_artifact_url_root,
        )
        export_web_artifacts(second_inputs)
        _validate_price_artifact_cross_references(second_inputs.out)
        _validate_report_artifact_cross_references(second_inputs.out)
        second_bytes = _snapshot_json_bytes(second_inputs.out)
    if first_bytes != second_bytes:
        raise RuntimeError("Web artifact export is not deterministic under repeated export")
    return first


def _validate_price_artifact_cross_references(out: Path) -> None:
    """Validate report/price artifact cross-references inside an exported web tree."""

    manifest = _read_json(out / "manifest.json")
    manifest_artifacts = {str(name) for name in manifest.get("artifacts", [])}
    price_paths = sorted((out / "prices").glob("*.json"))
    price_symbols = {path.stem for path in price_paths}

    expected_price_count = manifest.get("price_artifact_count")
    if expected_price_count != len(price_paths):
        raise RuntimeError(
            "Web artifact price count mismatch: "
            f"manifest price_artifact_count={expected_price_count}, actual prices/*.json={len(price_paths)}"
        )

    manifest_price_paths = {name for name in manifest_artifacts if name.startswith("prices/")}
    actual_price_paths = {_relative_posix(path, out) for path in price_paths}
    if manifest_price_paths != actual_price_paths:
        missing = sorted(actual_price_paths - manifest_price_paths)
        stale = sorted(manifest_price_paths - actual_price_paths)
        raise RuntimeError(
            "Web artifact manifest price path mismatch: "
            f"missing_in_manifest={missing[:5]}, stale_in_manifest={stale[:5]}"
        )

    reports = _read_json(out / "reports.json")
    report_symbols = {
        str(row.get("symbol", "")) for row in reports if isinstance(row, dict) and str(row.get("symbol", ""))
    }
    missing_rows = _read_json(out / "missing-symbols.json")
    missing_symbols = {
        str(row.get("symbol", ""))
        for row in missing_rows
        if isinstance(row, dict) and str(row.get("symbol", ""))
    }

    missing_report_prices = sorted(report_symbols - price_symbols)
    if missing_report_prices:
        raise RuntimeError(
            f"Web artifact reports reference symbols without price artifacts: {missing_report_prices[:10]}"
        )

    missing_symbol_artifacts = sorted(missing_symbols - price_symbols)
    if missing_symbol_artifacts:
        raise RuntimeError(
            f"Web artifact missing-symbols entries lack price artifacts: {missing_symbol_artifacts[:10]}"
        )

    manifest_missing = manifest.get("data_quality", {}).get("missing_price_symbols")
    if manifest_missing != len(missing_symbols):
        raise RuntimeError(
            "Web artifact missing price count mismatch: "
            f"manifest={manifest_missing}, missing-symbols.json={len(missing_symbols)}"
        )

    missing_price_flags: set[str] = set()
    for path in price_paths:
        payload = _read_json(path)
        symbol = str(payload.get("symbol", "") if isinstance(payload, dict) else "")
        if symbol != path.stem:
            raise RuntimeError(f"Price artifact symbol mismatch in {_relative_posix(path, out)}: {symbol}")
        if isinstance(payload, dict) and payload.get("missing_price") is True:
            missing_price_flags.add(symbol)
    unexpected_missing_flags = sorted((missing_price_flags & report_symbols) - missing_symbols)
    if unexpected_missing_flags:
        raise RuntimeError(
            "Price artifacts are marked missing_price without missing-symbols entries: "
            f"{unexpected_missing_flags[:10]}"
        )

    suffixes_by_raw: dict[str, set[str]] = {}
    for symbol in price_symbols:
        match = re.fullmatch(r"(\d{6})\.(KS|KQ)", symbol)
        if match:
            suffixes_by_raw.setdefault(match.group(1), set()).add(match.group(2))
    dual_segment_symbols = sorted(
        f"{raw}.KS/.KQ" for raw, suffixes in suffixes_by_raw.items() if {"KS", "KQ"} <= suffixes
    )
    if dual_segment_symbols:
        raise RuntimeError(
            "Web artifact contains both KOSPI and KOSDAQ price artifacts for the same raw ticker: "
            f"{dual_segment_symbols[:10]}"
        )


def _validate_report_artifact_cross_references(out: Path) -> None:
    """Validate visible report rows share one report universe across artifacts."""

    canonical = _report_identity_map(_read_json(out / "reports.json"), "reports.json")
    table = _report_identity_map(_read_json(out / "reports" / "table.json"), "reports/table.json")
    if table != canonical:
        _raise_report_identity_mismatch("reports/table.json", canonical, table)

    detail_metrics = _read_json(out / "report-detail-metrics.json")
    if not isinstance(detail_metrics, dict):
        raise RuntimeError("Web artifact report-detail-metrics.json must be an object keyed by report_id")
    detail = _report_identity_map(detail_metrics.values(), "report-detail-metrics.json")
    detail_keys = {str(key) for key in detail_metrics}
    if detail_keys != set(detail):
        raise RuntimeError(
            "Web artifact report-detail-metrics.json keys do not match embedded report_id values: "
            f"missing_keys={sorted(set(detail) - detail_keys)[:10]}, stale_keys={sorted(detail_keys - set(detail))[:10]}"
        )
    if detail != canonical:
        _raise_report_identity_mismatch("report-detail-metrics.json", canonical, detail)

    page_detail_metrics = _read_json(out / "reports" / "detail-metrics.json")
    if page_detail_metrics != detail_metrics:
        raise RuntimeError(
            "Web artifact reports/detail-metrics.json diverges from report-detail-metrics.json"
        )

    return_windows = _report_identity_map(_read_json(out / "return-windows.json"), "return-windows.json")
    if return_windows != canonical:
        _raise_report_identity_mismatch("return-windows.json", canonical, return_windows)
    page_return_windows = _read_json(out / "reports" / "return-windows.json")
    if page_return_windows != _read_json(out / "return-windows.json"):
        raise RuntimeError("Web artifact reports/return-windows.json diverges from return-windows.json")

    csv_rows = _read_report_download_identities(out / "table-download-reports.csv")
    if csv_rows != canonical:
        _raise_report_identity_mismatch("table-download-reports.csv", canonical, csv_rows)


def _report_identity_map(rows: Any, source: str) -> dict[str, str]:
    if not isinstance(rows, list):
        rows = list(rows) if not isinstance(rows, (str, bytes, dict)) else None
    if not isinstance(rows, list):
        raise RuntimeError(f"Web artifact {source} must be a report row array")
    identities: dict[str, str] = {}
    for index, row in enumerate(rows):
        if not isinstance(row, dict):
            raise RuntimeError(f"Web artifact {source}[{index}] must be an object")
        report_id = str(row.get("report_id") or "")
        symbol = str(row.get("symbol") or "")
        if not report_id:
            raise RuntimeError(f"Web artifact {source}[{index}].report_id is missing")
        if not symbol:
            raise RuntimeError(f"Web artifact {source}[{index}].symbol is missing")
        previous = identities.get(report_id)
        if previous is not None:
            raise RuntimeError(f"Web artifact {source} contains duplicate report_id: {report_id}")
        identities[report_id] = symbol
    return identities


def _read_report_download_identities(path: Path) -> dict[str, str]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    identities: dict[str, str] = {}
    for index, row in enumerate(rows):
        report_id = str(row.get("report_id") or "")
        symbol = str(row.get("symbol") or "")
        if not report_id:
            raise RuntimeError(f"Web artifact table-download-reports.csv[{index}].report_id is missing")
        if not symbol:
            raise RuntimeError(f"Web artifact table-download-reports.csv[{index}].symbol is missing")
        if report_id in identities:
            raise RuntimeError(
                f"Web artifact table-download-reports.csv contains duplicate report_id: {report_id}"
            )
        identities[report_id] = symbol
    return identities


def _raise_report_identity_mismatch(source: str, expected: dict[str, str], actual: dict[str, str]) -> None:
    expected_ids = set(expected)
    actual_ids = set(actual)
    missing = sorted(expected_ids - actual_ids)
    stale = sorted(actual_ids - expected_ids)
    symbol_mismatches = sorted(
        report_id for report_id in expected_ids & actual_ids if expected[report_id] != actual[report_id]
    )
    raise RuntimeError(
        f"Web artifact {source} report cross-reference mismatch: "
        f"missing_report_ids={missing[:10]}, stale_report_ids={stale[:10]}, "
        f"symbol_mismatches={symbol_mismatches[:10]}"
    )


def _guard_export_destination(inputs: ExportInputs) -> None:
    resolved = inputs.out.resolve()
    cwd = Path.cwd().resolve()
    home = Path.home().resolve()
    anchors = {Path(resolved.anchor).resolve(), cwd, home}
    if resolved in anchors:
        raise ValueError(f"Refusing to export web artifacts into protected path: {resolved}")
    if resolved.parent == Path(resolved.anchor).resolve():
        raise ValueError(f"Refusing to export web artifacts into drive/root child: {resolved}")
    if inputs.external_artifact_dir is not None:
        external_resolved = inputs.external_artifact_dir.resolve()
        if resolved == external_resolved or resolved in external_resolved.parents or external_resolved in resolved.parents:
            raise ValueError(
                f"Refusing to overlap web artifact out and external artifact dir: out={resolved}, external={external_resolved}"
            )
    for label, source in {
        "warehouse": inputs.warehouse,
        "simulation": inputs.sim,
        "extraction_quality": inputs.extraction_quality,
    }.items():
        source_resolved = source.resolve()
        if (
            resolved == source_resolved
            or resolved in source_resolved.parents
            or source_resolved in resolved.parents
        ):
            raise ValueError(
                f"Refusing to export web artifacts into overlapping {label} path: "
                f"out={resolved}, {label}={source_resolved}"
            )


def _replace_directory(staged: Path, destination: Path) -> None:
    destination = destination.resolve()
    backup = destination.with_name(f"{destination.name}.previous-export")
    if backup.exists():
        shutil.rmtree(backup)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        destination.rename(backup)
    try:
        shutil.move(str(staged), str(destination))
    except Exception:
        if destination.exists():
            shutil.rmtree(destination)
        if backup.exists():
            backup.rename(destination)
        raise
    if backup.exists():
        shutil.rmtree(backup)


def _summary_accounts(summary: pd.DataFrame) -> set[str]:
    if summary.empty or "account_id" not in summary.columns:
        raise RuntimeError("Simulation summary must contain a account_id column.")
    accounts = {str(value) for value in summary["account_id"].dropna().astype(str) if str(value)}
    if not accounts:
        raise RuntimeError("Simulation summary does not contain any accounts.")
    return accounts


def _guard_account_frame(
    frame: pd.DataFrame,
    valid_accounts: set[str],
    name: str,
    *,
    allow_filter: bool = False,
) -> pd.DataFrame:
    """Keep optional sim artifacts inside the current account contract.

    The summary file is the current simulation contract. Ignored/generated
    companion CSVs can survive from older runs, so every account_id-bearing frame is
    checked against summary before export. Required ledgers fail loudly; the
    optional monthly holding history is filtered because an absent/fresh file is
    acceptable and stale rows should not contaminate the product UI.
    """

    if frame.empty or "account_id" not in frame.columns:
        return frame
    accounts = {str(value) for value in frame["account_id"].dropna().astype(str) if str(value)}
    unknown = sorted(accounts - valid_accounts)
    if not unknown:
        return frame
    if not allow_filter:
        preview = ", ".join(unknown[:5])
        raise RuntimeError(
            f"{name} contains accounts not present in summary.csv: {preview}. "
            "Regenerate simulation artifacts before export-web."
        )
    return frame[frame["account_id"].astype(str).isin(valid_accounts)].copy()


def _read_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing required CSV: {path}")
    return pd.read_csv(path, keep_default_na=False)


def _read_optional_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    try:
        return pd.read_csv(path, keep_default_na=False)
    except pd.errors.EmptyDataError:
        return pd.DataFrame()


def _read_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _current_holdings_from_open_episodes(
    position_episodes: pd.DataFrame, existing_holdings: pd.DataFrame
) -> pd.DataFrame:
    """Rebuild current holdings from open position episodes.

    ``position_episodes.csv`` is reconstructed from the trade ledger and is
    therefore the safest local source of truth for "what is still held now".
    ``current_holdings.csv`` can lag any time a full simulation artifact set is
    regenerated in pieces. Rebuilding here keeps the web app aligned with the
    canonical trade-ledger-derived episodes.
    """

    if position_episodes.empty or "status" not in position_episodes.columns:
        return existing_holdings
    open_rows = position_episodes[position_episodes["status"].astype(str).eq("open")].copy()
    if open_rows.empty:
        return existing_holdings

    qty_bought = _numeric_series(open_rows, "total_qty_bought").fillna(0)
    qty_sold = _numeric_series(open_rows, "total_qty_sold").fillna(0)
    qty = qty_bought - qty_sold
    avg_cost = _numeric_series(open_rows, "avg_entry_price_krw")
    last_close = _numeric_series(open_rows, "last_close_krw").fillna(avg_cost)
    market_value = qty * last_close
    cost_value = qty * avg_cost
    unrealized = _numeric_series(open_rows, "unrealized_pnl_krw")
    unrealized = unrealized.fillna(market_value - cost_value)

    rebuilt = pd.DataFrame(
        {
            "account_id": open_rows.get("account_id"),
            "symbol": open_rows.get("symbol"),
            "company": open_rows.get("company"),
            "qty": qty,
            "avg_cost_krw": avg_cost,
            "last_close_krw": last_close,
            "market_value_krw": market_value,
            "unrealized_pnl_krw": unrealized,
            "unrealized_return": (last_close / avg_cost - 1).where(avg_cost.gt(0)),
            "holding_days": _numeric_series(open_rows, "holding_days"),
            "first_buy_date": open_rows.get("open_date"),
        }
    )
    return rebuilt[rebuilt["qty"].gt(0)].sort_values(
        ["account_id", "market_value_krw"], ascending=[True, False]
    )


def _build_accounting_reconciliation(
    account_rows: list[dict[str, Any]], holdings: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    holdings_by_account: dict[str, list[dict[str, Any]]] = {}
    for row in holdings:
        holdings_by_account.setdefault(str(row.get("account_id") or ""), []).append(row)

    rows: list[dict[str, Any]] = []
    tolerance = 5_000.0
    for account in account_rows:
        account_id = str(account.get("account_id") or "")
        account_holdings = holdings_by_account.get(account_id, [])
        contributed = _number(account.get("total_contributed_krw")) or 0.0
        realized = _number(account.get("realized_pnl_krw")) or 0.0
        cash = _number(account.get("final_cash_krw")) or 0.0
        equity = _number(account.get("final_equity_krw")) or 0.0
        holdings_value = _number(account.get("final_holdings_value_krw")) or 0.0
        net_profit = _number(account.get("net_profit_krw")) or 0.0
        open_cost = sum(
            ((_number(row.get("avg_cost_krw")) or 0.0) * (_number(row.get("qty")) or 0.0))
            for row in account_holdings
        )
        unrealized = sum(_number(row.get("unrealized_pnl_krw")) or 0.0 for row in account_holdings)
        raw_expected_cash = contributed + realized - open_cost
        raw_cash_gap = cash - raw_expected_cash
        raw_profit_gap = net_profit - (realized + unrealized)
        cash_yield = (
            raw_profit_gap if raw_profit_gap >= 0 and abs(raw_cash_gap - raw_profit_gap) <= tolerance else 0.0
        )
        expected_cash = contributed + realized + cash_yield - open_cost
        cash_gap = cash - expected_cash
        equity_gap = equity - (cash + holdings_value)
        profit_gap = net_profit - (realized + unrealized + cash_yield)
        explain_cash = cash < realized and open_cost > 0
        status = "ok" if max(abs(cash_gap), abs(equity_gap), abs(profit_gap)) <= tolerance else "warning"
        rows.append(
            {
                "account_id": account_id,
                "label": account.get("label"),
                "total_contributed_krw": contributed,
                "realized_pnl_krw": realized,
                "final_cash_krw": cash,
                "open_cost_basis_krw": open_cost,
                "open_market_value_krw": holdings_value,
                "unrealized_pnl_krw": unrealized,
                "cash_yield_krw": cash_yield,
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


def _apply_account_labels(rows: list[dict[str, Any]], labels_by_id: dict[str, str]) -> None:
    for row in rows:
        account_id = str(row.get("account_id") or "")
        label = labels_by_id.get(account_id)
        if label:
            row["label"] = label


def _enrich_account_rows_with_catalog(
    accounts: list[dict[str, Any]],
    account_catalog: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Attach account taxonomy fields to portfolio/account_id bundles."""

    catalog_by_id = {str(row.get("account_id") or ""): row for row in account_catalog}
    enriched: list[dict[str, Any]] = []
    for account_id in accounts:
        row = dict(account_id)
        catalog = catalog_by_id.get(str(row.get("account_id") or ""))
        if catalog:
            for key in (
                "short_label",
                "kind",
                "benchmark_group",
                "is_selectable",
                "shortlist_priority",
                "is_default_candidate",
                "objective_passed",
                "objective_return_excess",
                "objective_mdd_slack",
            ):
                row[key] = catalog.get(key)
        enriched.append(row)
    return enriched


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(_clean(data), ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _validate_boundary_artifacts(
    *,
    overview: dict[str, Any],
    reports: list[dict[str, Any]],
    holdings: list[dict[str, Any]],
    trades: list[dict[str, Any]],
    account_catalog: list[dict[str, Any]],
) -> None:
    WebOverview.model_validate(overview)
    REPORT_ROWS.validate_python(reports)
    HOLDING_ROWS.validate_python(holdings)
    TRADE_ROWS.validate_python(trades)
    ACCOUNT_CATALOG_ROWS.validate_python(account_catalog)


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


def _write_machine_json(path: Path, data: Any) -> None:
    """Write large generated data in deterministic compact form.

    Price series dominate the export size and are consumed by code, not read by
    people. The caller builds rows with plain Python values, so this avoids the
    expensive recursive clean pass used for ad-hoc mixed Pandas objects.
    """

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def _write_page_bundles(
    out: Path,
    *,
    overview: dict[str, Any],
    insights: list[dict[str, Any]],
    data_quality: dict[str, Any],
    accounts: list[dict[str, Any]],
    holdings: list[dict[str, Any]],
    monthly_holdings: list[dict[str, Any]],
    trades: list[dict[str, Any]],
    daily_decisions: list[dict[str, Any]],
    daily_forward_metadata: dict[str, Any],
    episodes: list[dict[str, Any]],
    equity_daily: list[dict[str, Any]],
    accounting_reconciliation: list[dict[str, Any]],
    reports: list[dict[str, Any]],
    rankings: dict[str, Any],
    detail_metrics: dict[str, Any],
    return_windows: list[dict[str, Any]],
    target_distribution: dict[str, Any],
    account_catalog: list[dict[str, Any]],
    report_board_candidates: list[dict[str, Any]],
    research_calendar: dict[str, Any],
    external: ExternalArtifactManager,
) -> None:
    """Write page-owned product bundles.

    Top-level JSON artifacts remain exported as raw downloadable/source files,
    but the web app should consume these page bundles so each route has a clear
    data owner and future UI work does not rebuild the same meaning locally.
    """

    _write_product_json(out / "overview" / "snapshot.json", overview)
    _write_product_json(out / "overview" / "research-pulse.json", insights)
    _write_product_json(out / "overview" / "data-quality.json", data_quality)

    _write_product_json(out / "portfolio" / "accounts.json", accounts)
    _write_product_json(out / "portfolio" / "holdings.json", holdings)
    _write_product_json(
        out / "portfolio" / "monthly-holdings.json", _compact_monthly_holdings(monthly_holdings)
    )
    _write_product_json(out / "portfolio" / "trades.json", _compact_trades(trades))
    _write_product_json(out / "portfolio" / "episodes.json", _compact_episodes(episodes))
    _write_product_json(out / "portfolio" / "accounting-reconciliation.json", accounting_reconciliation)
    portfolio_account_ids = _web_portfolio_account_ids(account_catalog, accounts)
    _write_portfolio_equity_shards(out, equity_daily, portfolio_account_ids, external)
    _write_portfolio_daily_decision_shards(
        out,
        daily_decisions,
        daily_forward_metadata,
        portfolio_account_ids,
        external,
    )

    _write_product_json(out / "reports" / "table.json", reports)
    _write_product_json(out / "reports" / "rankings.json", rankings)
    _write_product_json(out / "reports" / "detail-metrics.json", detail_metrics)
    _write_product_json(out / "reports" / "return-windows.json", return_windows)
    _write_product_json(out / "reports" / "target-hit-distribution.json", target_distribution)

    _write_product_json(out / "accounts" / "catalog.json", account_catalog)
    _write_product_json(out / "accounts" / "leaderboard.json", accounts)
    _write_product_json(out / "accounts" / "curves.json", _compact_equity_curves(equity_daily))

    _write_product_json(out / "report-board" / "candidates.json", report_board_candidates)
    _write_product_json(out / "research-calendar" / "calendar.json", research_calendar)

    _write_product_json(
        out / "pages" / "report-verification.json",
        _report_verification_page_bundle(overview, data_quality, reports, report_board_candidates),
    )
    _write_product_json(
        out / "pages" / "report-board.json",
        _report_board_page_bundle(overview, reports, report_board_candidates),
    )
    _write_product_json(
        out / "pages" / "report-statistics.json",
        _report_statistics_page_bundle(overview, rankings, target_distribution, return_windows),
    )
    _write_product_json(
        out / "pages" / "portfolio-dashboard.json",
        _portfolio_dashboard_page_bundle(overview, accounts, holdings, trades),
    )
    _write_product_json(out / "pages" / "research-calendar.json", research_calendar)


def _page_generated_at(overview: dict[str, Any]) -> str | None:
    window = overview.get("simulation_window") if isinstance(overview.get("simulation_window"), dict) else {}
    price_end = window.get("price_end") if isinstance(window, dict) else None
    return f"{price_end}T00:00:00+09:00" if price_end else None


def _page_as_of(overview: dict[str, Any]) -> dict[str, Any]:
    window = overview.get("simulation_window") if isinstance(overview.get("simulation_window"), dict) else {}
    return {
        "report_date": window.get("report_end") if isinstance(window, dict) else None,
        "price_date": window.get("price_end") if isinstance(window, dict) else None,
    }


def _metric(
    id_: str, label: str, value: Any, tone: str = "neutral", helper: str | None = None
) -> dict[str, Any]:
    return {"id": id_, "label": label, "value": _clean(value), "tone": tone, "helper": helper}


def _report_verification_page_bundle(
    overview: dict[str, Any],
    data_quality: dict[str, Any],
    reports: list[dict[str, Any]],
    report_board_candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    counts = overview.get("report_counts", {}) if isinstance(overview, dict) else {}
    stats = overview.get("target_stats", {}) if isinstance(overview, dict) else {}
    excluded = counts.get("excluded_reports", 0)
    warnings = []
    missing = len(data_quality.get("missing_symbols", [])) if isinstance(data_quality, dict) else 0
    if missing:
        warnings.append({"level": "warning", "message": f"missing_price_symbols={missing}"})
    if excluded:
        warnings.append({"level": "info", "message": f"excluded_reports={excluded}"})
    return {
        "schema_version": "1.0.0",
        "generated_at": _page_generated_at(overview),
        "as_of": _page_as_of(overview),
        "title": "report-verification",
        "metrics": [
            _metric("reports", "verified_reports", len(reports)),
            _metric("active", "report_board_candidates", len(report_board_candidates), "positive"),
            _metric("target_hit_rate", "target_hit_rate", stats.get("target_hit_rate"), "positive"),
            _metric("median_current_return", "median_current_return", stats.get("median_current_return")),
            _metric("median_days_to_target", "median_days_to_target", stats.get("median_days_to_target")),
            _metric("excluded", "excluded_reports", excluded, "warning" if excluded else "neutral"),
        ],
        "views": [
            {"id": "recent", "label": "recent", "count": len(reports)},
            {"id": "candidate", "label": "report_board_candidates", "count": len(report_board_candidates)},
            {"id": "target-hit", "label": "target_hit", "count": stats.get("target_hit_count")},
        ],
        "warnings": warnings,
        "table": {"rows": reports},
    }


def _report_board_page_bundle(
    overview: dict[str, Any],
    reports: list[dict[str, Any]],
    report_board_candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    priority = report_board_candidates[:5]
    return {
        "schema_version": "1.0.0",
        "generated_at": _page_generated_at(overview),
        "as_of": _page_as_of(overview),
        "title": "report-board",
        "metrics": [
            _metric("candidates", "candidate_symbols", len(report_board_candidates)),
            _metric("reports", "source_reports", len(reports)),
        ],
        "priority": priority,
        "table": {"rows": report_board_candidates},
    }


def _report_statistics_page_bundle(
    overview: dict[str, Any],
    rankings: dict[str, Any],
    target_distribution: dict[str, Any],
    return_windows: list[dict[str, Any]],
    statistics_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    stats = overview.get("target_stats", {}) if isinstance(overview, dict) else {}
    return {
        "schema_version": "1.0.0",
        "generated_at": _page_generated_at(overview),
        "as_of": _page_as_of(overview),
        "title": "report-statistics",
        "metrics": [
            _metric("target_hit_rate", "target_hit_rate", stats.get("target_hit_rate"), "positive"),
            _metric("median_days_to_target", "median_days_to_target", stats.get("median_days_to_target")),
            _metric("median_current_return", "median_current_return", stats.get("median_current_return")),
        ],
        "rankings": rankings,
        "target_distribution": target_distribution,
        "return_windows": return_windows,
        "summary": statistics_summary or {},
    }


def _portfolio_dashboard_page_bundle(
    overview: dict[str, Any],
    accounts: list[dict[str, Any]],
    holdings: list[dict[str, Any]],
    trades: list[dict[str, Any]],
) -> dict[str, Any]:
    selectable_accounts = [row for row in accounts if row.get("is_selectable")]
    return {
        "schema_version": "1.0.0",
        "generated_at": _page_generated_at(overview),
        "as_of": _page_as_of(overview),
        "title": "portfolio-dashboard",
        "metrics": [
            _metric("accounts", "selectable_accounts", len(selectable_accounts)),
            _metric("holdings", "open_holdings", len(holdings)),
            _metric("trades", "trade_rows", len(trades)),
        ],
        "accounts": selectable_accounts,
        "holdings": holdings,
    }


def _build_research_calendar(
    pit_research_board: pd.DataFrame,
    price_groups: dict[str, pd.DataFrame],
    overview: dict[str, Any],
) -> dict[str, Any]:
    if pit_research_board.empty:
        raise RuntimeError("pit-research-board.csv is empty; run export-pit-board before export-web.")

    required = {
        "as_of_date",
        "price_date",
        "report_id",
        "symbol",
        "company",
        "publication_date",
        "rank",
        "candidate_score",
    }
    missing = sorted(required - set(pit_research_board.columns))
    if missing:
        raise RuntimeError(f"pit-research-board.csv is missing required columns: {', '.join(missing)}")

    frame = pit_research_board.copy()
    for column in (
        "rank",
        "report_age_days",
        "entry_price_krw",
        "entry_price_scale_factor",
        "target_price_krw",
        "last_close_krw",
        "target_upside_at_pub",
        "current_return",
        "target_gap_pct",
        "ytd_return",
        "return_1m",
        "return_3m",
        "return_6m",
        "return_1y",
        "distance_from_52w_high",
        "candidate_score",
        "board_score",
        "ta_momentum_score",
    ):
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")

    for column in ("above_20ma", "above_50ma", "above_200ma", "macd_bullish", "target_hit", "expired"):
        if column in frame.columns:
            frame[column] = frame[column].map(_nullable_bool)

    frame = _attach_research_calendar_forward_returns(frame, price_groups)
    frame = frame.sort_values(["as_of_date", "rank", "candidate_score"], ascending=[False, True, False])

    columns = [
        "as_of_date",
        "price_date",
        "report_id",
        "symbol",
        "company",
        "publication_date",
        "report_age_days",
        "rank",
        "bucket",
        "rank_basis",
        "candidate_score",
        "board_score",
        "ta_momentum_score",
        "entry_price_krw",
        "entry_price_source",
        "entry_price_scale_factor",
        "price_quality_flag",
        "target_price_krw",
        "last_close_krw",
        "target_upside_at_pub",
        "current_return",
        "target_gap_pct",
        "ytd_return",
        "return_1m",
        "return_3m",
        "return_6m",
        "return_1y",
        "distance_from_52w_high",
        "above_20ma",
        "above_50ma",
        "above_200ma",
        "ma_stack",
        "macd_bullish",
        "target_hit",
        "expired",
        "forward_return_21d",
        "forward_return_63d",
        "forward_return_126d",
        "forward_return_252d",
        "forward_return_500d",
        "forward_return_latest",
        "forward_peak_252d",
        "forward_trough_252d",
        "forward_peak_500d",
        "forward_trough_500d",
        "forward_observed_days",
    ]
    rows = _records(frame[[column for column in columns if column in frame.columns]])
    summaries = _research_calendar_date_summaries(frame)
    first_date = frame["as_of_date"].min()
    last_date = frame["as_of_date"].max()
    return {
        "schema_version": "1.0.0",
        "generated_at": _page_generated_at(overview),
        "as_of": _page_as_of(overview),
        "date_range": {"start": first_date, "end": last_date},
        "summary": {
            "date_count": len(summaries),
            "row_count": len(rows),
            "symbol_count": int(frame["symbol"].nunique()),
            "latest_date": last_date,
        },
        "date_summaries": summaries,
        "table": _compact_table(rows, columns),
    }


def _attach_research_calendar_forward_returns(
    frame: pd.DataFrame, price_groups: dict[str, pd.DataFrame]
) -> pd.DataFrame:
    out = frame.copy()
    for column in (
        "forward_return_21d",
        "forward_return_63d",
        "forward_return_126d",
        "forward_return_252d",
        "forward_return_500d",
        "forward_return_latest",
        "forward_peak_252d",
        "forward_trough_252d",
        "forward_peak_500d",
        "forward_trough_500d",
        "forward_observed_days",
    ):
        out[column] = pd.NA

    publication_dates = pd.to_datetime(out["publication_date"], errors="coerce")
    entry_prices = pd.to_numeric(out["entry_price_krw"], errors="coerce")
    horizons = {
        "forward_return_21d": 21,
        "forward_return_63d": 63,
        "forward_return_126d": 126,
        "forward_return_252d": 252,
        "forward_return_500d": 500,
    }
    for symbol, indexes in out.groupby("symbol", sort=False).groups.items():
        prices = price_groups.get(str(symbol))
        if prices is None or prices.empty:
            continue
        price_frame = prices.copy()
        price_frame["date"] = pd.to_datetime(price_frame["date"], errors="coerce")
        price_frame = price_frame.dropna(subset=["date"]).sort_values("date")
        if price_frame.empty:
            continue
        dates = price_frame["date"].reset_index(drop=True)
        closes = pd.to_numeric(price_frame["close_krw"], errors="coerce").reset_index(drop=True)
        highs = pd.to_numeric(
            price_frame.get("high_krw", price_frame["close_krw"]), errors="coerce"
        ).reset_index(drop=True)
        lows = pd.to_numeric(
            price_frame.get("low_krw", price_frame["close_krw"]), errors="coerce"
        ).reset_index(drop=True)
        for row_index in indexes:
            lookup_date = publication_dates.loc[row_index]
            start_close = _number(entry_prices.loc[row_index])
            if pd.isna(lookup_date) or start_close is None or start_close <= 0:
                continue
            start_pos = int(dates.searchsorted(lookup_date, side="left"))
            if start_pos < 0 or start_pos >= len(closes):
                continue
            observed_days = max(0, len(closes) - start_pos - 1)
            out.at[row_index, "forward_observed_days"] = observed_days
            if observed_days > 0:
                latest_close = _number(closes.iloc[-1])
                if latest_close is not None and latest_close > 0:
                    out.at[row_index, "forward_return_latest"] = round(latest_close / start_close - 1, 6)
            for column, horizon in horizons.items():
                target_pos = start_pos + horizon
                if target_pos >= len(closes):
                    continue
                close = _number(closes.iloc[target_pos])
                if close is not None and close > 0:
                    out.at[row_index, column] = round(close / start_close - 1, 6)
            for horizon, peak_column, trough_column in (
                (252, "forward_peak_252d", "forward_trough_252d"),
                (500, "forward_peak_500d", "forward_trough_500d"),
            ):
                end_pos = min(start_pos + horizon, len(closes) - 1)
                if end_pos <= start_pos:
                    continue
                peak = _number(highs.iloc[start_pos + 1 : end_pos + 1].max())
                trough = _number(lows.iloc[start_pos + 1 : end_pos + 1].min())
                if peak is not None and peak > 0:
                    out.at[row_index, peak_column] = round(peak / start_close - 1, 6)
                if trough is not None and trough > 0:
                    out.at[row_index, trough_column] = round(trough / start_close - 1, 6)
    return out


def _research_calendar_date_summaries(frame: pd.DataFrame) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for date, group in frame.groupby("as_of_date", sort=True):
        forward_63 = pd.to_numeric(group["forward_return_63d"], errors="coerce")
        forward_500 = pd.to_numeric(group["forward_return_500d"], errors="coerce")
        forward_latest = pd.to_numeric(group["forward_return_latest"], errors="coerce")
        observed_days = pd.to_numeric(
            cast(pd.Series, group.get("forward_observed_days", pd.Series(pd.NA, index=group.index))),
            errors="coerce",
        )
        valid_forward_63 = forward_63.dropna()
        valid_forward_500 = forward_500.dropna()
        valid_forward_latest = forward_latest.dropna()
        valid_observed_days = observed_days.dropna()
        report_age_days = pd.to_numeric(
            cast(pd.Series, group.get("report_age_days", pd.Series(pd.NA, index=group.index))),
            errors="coerce",
        )
        recent_report_mask = report_age_days.ge(0) & report_age_days.le(365)
        top_rows = group.sort_values(["board_score", "rank"], ascending=[False, True]).head(3)
        summaries.append(
            {
                "date": str(date),
                "candidate_count": int(len(group)),
                "fresh_count": int(recent_report_mask.sum()),
                "target_hit_count": int(group["target_hit"].eq(True).sum()) if "target_hit" in group else 0,
                "momentum_count": int(
                    (
                        group.get("above_20ma", pd.Series(False, index=group.index)).eq(True)
                        & group.get("above_50ma", pd.Series(False, index=group.index)).eq(True)
                        & group.get("above_200ma", pd.Series(False, index=group.index)).eq(True)
                    ).sum()
                ),
                "near_high_count": int(
                    pd.to_numeric(
                        cast(
                            pd.Series,
                            group.get("distance_from_52w_high", pd.Series(pd.NA, index=group.index)),
                        ),
                        errors="coerce",
                    )
                    .ge(-0.1)
                    .sum()
                ),
                "forward_positive_63d_count": int(valid_forward_63.gt(0).sum()),
                "forward_positive_63d_sample": int(valid_forward_63.count()),
                "median_forward_return_63d": _round_number(valid_forward_63.median()),
                "forward_positive_500d_count": int(valid_forward_500.gt(0).sum()),
                "forward_positive_500d_sample": int(valid_forward_500.count()),
                "median_forward_return_500d": _round_number(valid_forward_500.median()),
                "forward_positive_latest_count": int(valid_forward_latest.gt(0).sum()),
                "forward_positive_latest_sample": int(valid_forward_latest.count()),
                "median_forward_return_latest": _round_number(valid_forward_latest.median()),
                "forward_observed_sample": int(valid_observed_days.gt(0).sum()),
                "max_forward_observed_days": int(valid_observed_days.max())
                if not valid_observed_days.empty
                else 0,
                "top_symbols": [
                    {
                        "symbol": str(row.get("symbol")),
                        "company": str(row.get("company")),
                        "score": _round_number(row.get("board_score")),
                    }
                    for row in top_rows.to_dict(orient="records")
                ],
            }
        )
    return summaries


def _nullable_bool(value: Any) -> bool | None:
    if value in {"", None}:
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in {"true", "1", "y", "yes"}:
        return True
    if text in {"false", "0", "n", "no"}:
        return False
    return None


def _compact_monthly_holdings(rows: list[dict[str, Any]]) -> dict[str, Any]:
    columns = [
        "account_id",
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


def _require_trade_realized_pnl(trades: pd.DataFrame) -> pd.DataFrame:
    if "realized_pnl_krw" not in trades.columns:
        raise RuntimeError(
            "data/sim/trades.csv is missing realized_pnl_krw; rerun the account simulation first"
        )
    out = trades.copy()
    out["realized_pnl_krw"] = pd.to_numeric(out["realized_pnl_krw"], errors="coerce")
    return out


def _enrich_trades_with_company(
    trades: pd.DataFrame,
    *,
    reports: pd.DataFrame,
    current_holdings: pd.DataFrame,
    monthly_holdings: pd.DataFrame,
    position_episodes: pd.DataFrame,
) -> pd.DataFrame:
    if trades.empty:
        return trades
    if "symbol" not in trades.columns:
        raise RuntimeError("data/sim/trades.csv is missing symbol; rerun the account simulation first")

    out = trades.copy()
    out["symbol"] = out["symbol"].astype(str).str.strip()

    company_by_report_id = _company_lookup_by_report_id(reports)
    company_by_symbol = _company_lookup_by_symbol(
        reports,
        current_holdings,
        position_episodes,
        monthly_holdings,
    )

    report_company = (
        out["report_id"].astype(str).str.strip().map(company_by_report_id)
        if "report_id" in out.columns
        else pd.Series([None] * len(out), index=out.index)
    )
    symbol_company = out["symbol"].map(company_by_symbol)

    company = report_company.combine_first(symbol_company)
    missing = company.isna() | company.astype(str).str.strip().eq("")
    company.loc[missing] = out.loc[missing, "symbol"]
    out["company"] = company.astype(str)
    out["reason_detail"] = _trade_reason_details(out)
    return out


def _trade_reason_details(trades: pd.DataFrame) -> pd.Series:
    if trades.empty:
        return pd.Series(dtype=str)
    required = {"account_id", "date", "reason"}
    if not required.issubset(trades.columns):
        return pd.Series([""] * len(trades), index=trades.index, dtype=str)

    grouped_reasons = trades.groupby(["account_id", "date"], sort=False)["reason"].apply(
        lambda values: tuple(str(value) for value in values if str(value))
    )

    def detail(row: pd.Series) -> str:
        account_id = str(row.get("account_id") or "")
        reason = str(row.get("reason") or "")
        side = str(row.get("side") or "")
        same_day_reasons = frozenset(grouped_reasons.get((row.get("account_id"), row.get("date")), ()))
        return _trade_reason_detail(account_id, side, reason, same_day_reasons)

    return trades.apply(detail, axis=1).astype(str)


def _trade_reason_detail(
    account_id: str,
    side: str,
    reason: str,
    same_day_reasons: frozenset[str],
) -> str:
    if reason == "rebalance_buy":
        if "trailing_profit_trim" in same_day_reasons:
            fraction = "75%" if "partial75" in account_id else "100%"
            return f"이익 보호 trim 이후 현금 게이트를 통과해 후보 목표비중의 {fraction}만 재투입"
        if _is_pit_signal_account(account_id):
            return "리밸런싱일 후보 조건 통과: 점수 상위 편입 또는 목표비중 증액"
        return "목표 비중 대비 부족분 매수"
    if reason == "rebalance_sell":
        if _is_pit_signal_account(account_id):
            return "보유 유지 조건 이탈: 점수권 이탈 또는 새 후보에서 제외되어 매도"
        return "목표 비중 초과분 매도"
    if reason == "retained_cap_trim":
        return "수익률 +60% 이상 보유 종목이 계좌 45%를 초과해 40% 비중까지 축소"
    if reason == "trailing_profit_trim":
        return "수익률 +100% 이상 이후 보유 고점 대비 25% 이상 하락해 20% 비중까지 축소"
    if reason == "target_hit":
        return "리포트 목표가 도달로 포지션 청산"
    if reason == "stop_loss_price":
        return "가격 손절 조건 충족으로 포지션 청산"
    if reason == "stop_loss_time":
        return "보유 기간 손절 조건 충족으로 포지션 청산"
    if reason == "stop_loss_average_down":
        return "물타기 이후 손실 제한 조건 충족으로 포지션 청산"
    if reason == "stop_loss_report_age":
        return "리포트 발간 후 허용 기간 초과로 포지션 청산"
    if reason == "stop_loss_max_hold":
        return "최대 보유 기간 도달로 포지션 청산"
    if side == "buy":
        return "매수 조건 충족"
    if side == "sell":
        return "매도 조건 충족"
    return reason


def _is_pit_signal_account(account_id: str) -> bool:
    return account_id.startswith("pit_trend_") or account_id.startswith("pit_score_")


def _company_lookup_by_report_id(reports: pd.DataFrame) -> dict[str, str]:
    if reports.empty or not {"report_id", "company"}.issubset(reports.columns):
        return {}
    frame = reports[["report_id", "company"]].copy()
    frame["report_id"] = frame["report_id"].astype(str).str.strip()
    frame["company"] = frame["company"].astype(str).str.strip()
    valid_company = frame["company"].ne("") & ~frame["company"].str.casefold().isin({"nan", "none", "null"})
    frame = frame[frame["report_id"].ne("") & valid_company]
    return dict(zip(frame["report_id"], frame["company"], strict=True))


def _company_lookup_by_symbol(*frames: pd.DataFrame) -> dict[str, str]:
    pairs = []
    for frame in frames:
        if frame.empty or not {"symbol", "company"}.issubset(frame.columns):
            continue
        pair = frame[["symbol", "company"]].copy()
        pair["symbol"] = pair["symbol"].astype(str).str.strip()
        pair["company"] = pair["company"].astype(str).str.strip()
        valid_company = pair["company"].ne("") & ~pair["company"].str.casefold().isin({"nan", "none", "null"})
        pair = pair[pair["symbol"].ne("") & valid_company]
        if not pair.empty:
            pairs.append(pair)
    if not pairs:
        return {}

    merged = pd.concat(pairs, ignore_index=True).drop_duplicates("symbol", keep="first")
    return dict(zip(merged["symbol"], merged["company"], strict=True))


def _compact_trades(rows: list[dict[str, Any]]) -> dict[str, Any]:
    columns = [
        "account_id",
        "date",
        "symbol",
        "company",
        "side",
        "qty",
        "fill_price_krw",
        "gross_krw",
        "realized_pnl_krw",
        "cash_after_krw",
        "reason",
        "reason_detail",
        "report_id",
    ]
    return _compact_table(rows, columns)


def _compact_daily_decisions(
    rows: list[dict[str, Any]], metadata: dict[str, Any] | None = None
) -> dict[str, Any]:
    columns = [
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
        "net_profit_krw",
        "open_positions",
    ]
    table = _compact_table(rows, columns)
    table["metadata"] = _daily_forward_metadata(metadata or {})
    return table


def _web_portfolio_account_ids(
    account_catalog: list[dict[str, Any]], accounts: list[dict[str, Any]]
) -> list[str]:
    available = {str(row.get("account_id")) for row in [*account_catalog, *accounts] if row.get("account_id")}
    wanted = [*WEB_PORTFOLIO_ACCOUNT_IDS, *WEB_PORTFOLIO_BENCHMARK_IDS]
    return [account_id for account_id in dict.fromkeys(wanted) if account_id in available]


def _account_shard_filename(account_id: str) -> str:
    if not _ACCOUNT_ID_PATTERN.fullmatch(account_id):
        raise RuntimeError(f"Unsupported account id for web shard filename: {account_id}")
    return f"{account_id}.json"


def _rows_by_account(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        account_id = str(row.get("account_id", ""))
        if account_id:
            grouped.setdefault(account_id, []).append(row)
    return grouped


def _write_portfolio_equity_shards(
    out: Path, rows: list[dict[str, Any]], account_ids: list[str], external: ExternalArtifactManager
) -> None:
    shard_root = out / "portfolio" / "equity"
    accounts: list[dict[str, Any]] = []
    rows_by_account = _rows_by_account(rows)
    for account_id in account_ids:
        shard = _compact_equity_curves(rows_by_account.get(account_id, []))
        relative_path = f"portfolio/equity/{_account_shard_filename(account_id)}"
        external.write_json(relative_path, shard, compact=True)
        accounts.append(
            {
                "account_id": account_id,
                "path": relative_path,
                "row_count": _compact_equity_row_count(shard),
            }
        )
    _write_product_json(shard_root / "index.json", {"schema_version": "1.0.0", "accounts": accounts})


def _write_portfolio_daily_decision_shards(
    out: Path,
    rows: list[dict[str, Any]],
    metadata: dict[str, Any],
    account_ids: list[str],
    external: ExternalArtifactManager,
) -> None:
    shard_root = out / "portfolio" / "daily-decisions"
    accounts: list[dict[str, Any]] = []
    rows_by_account = _rows_by_account(rows)
    for account_id in account_ids:
        account_rows = rows_by_account.get(account_id, [])
        shard = _compact_daily_decisions(account_rows, metadata)
        relative_path = f"portfolio/daily-decisions/{_account_shard_filename(account_id)}"
        external.write_json(relative_path, shard, compact=True)
        accounts.append(
            {
                "account_id": account_id,
                "path": relative_path,
                "row_count": len(account_rows),
            }
        )
    _write_product_json(
        shard_root / "index.json",
        {
            "schema_version": "1.0.0",
            "metadata": _daily_forward_metadata(metadata),
            "accounts": accounts,
        },
    )


def _daily_forward_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    return {
        "run_mode": metadata.get("run_mode"),
        "checkpoint_date": metadata.get("checkpoint_date"),
        "latest_date": metadata.get("latest_date"),
        "checkpoint_schema_version": metadata.get("checkpoint_schema_version"),
        "source_fingerprint": metadata.get("source_fingerprint") or {},
        "full_replay_reason": metadata.get("full_replay_reason"),
    }


def _compact_episodes(rows: list[dict[str, Any]]) -> dict[str, Any]:
    columns = [
        "account_id",
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
    by_account: dict[str, list[dict[str, Any] | None]] = {}
    for row in rows:
        account_id = str(row.get("account_id", ""))
        date = str(row.get("date", ""))
        if not account_id or date not in date_index:
            continue
        by_account.setdefault(account_id, [None] * len(dates))[date_index[date]] = row

    series = []
    for account_id in sorted(by_account):
        equity_values: list[int | None] = []
        return_values: list[float | None] = []
        for row_data in by_account[account_id]:
            if row_data is None:
                equity_values.append(None)
                return_values.append(None)
                continue
            equity = _numeric_or_none(row_data.get("equity_krw"))
            capital = _numeric_or_none(row_data.get("contributed_capital_krw"))
            equity_values.append(None if equity is None else int(round(equity)))
            if equity is None or capital is None or capital <= 0:
                return_values.append(None)
            else:
                return_values.append(round(equity / capital - 1, 6))
        series.append(
            {"account_id": account_id, "equity_krw": equity_values, "cumulative_return": return_values}
        )
    return {"dates": dates, "series": series}


def _compact_equity_row_count(artifact: dict[str, Any]) -> int:
    dates = artifact.get("dates")
    series = artifact.get("series")
    if not isinstance(dates, list) or not isinstance(series, list):
        return 0
    return len(dates) * len(series)


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
        _relative_posix(path, root): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.suffix in {".json", ".csv"}
    }


def _write_artifact_health(out: Path, overview: dict[str, Any], data_quality: dict[str, Any]) -> None:
    window = overview.get("simulation_window") if isinstance(overview.get("simulation_window"), dict) else {}
    report_end = str(window.get("report_end") or "") if isinstance(window, dict) else ""
    price_end = str(window.get("price_end") or "") if isinstance(window, dict) else ""
    simulation_end = price_end
    raw_missing_symbols = data_quality.get("missing_symbols", []) if isinstance(data_quality, dict) else []
    missing_symbols = raw_missing_symbols if isinstance(raw_missing_symbols, list) else []
    missing_count = len(missing_symbols)
    missing_status_counts = _counts_by_key(missing_symbols, "release_status")
    missing_category_counts = _counts_by_key(missing_symbols, "category")
    action_required_count = missing_status_counts.get("action_required", 0)
    missing_preview = [
        {
            "symbol": str(row.get("symbol", "")),
            "company": str(row.get("company", "")),
            "category": str(row.get("category", "")),
            "release_status": str(row.get("release_status", "")),
            "decision": str(row.get("decision", "")),
            "action": str(row.get("action", "")),
        }
        for row in missing_symbols[:5]
        if isinstance(row, dict) and row.get("symbol")
    ]

    checks = [
        {
            "id": "report_price_alignment",
            "label": "Report and price dates",
            "severity": "ok" if report_end and price_end and price_end >= report_end else "fail",
            "status": "ok" if report_end and price_end and price_end >= report_end else "fail",
            "observed": {"price_end": price_end or None, "report_end": report_end or None},
            "expected": "price_end must be on or after report_end",
            "action": "리포트 동기화 후 refresh-prices와 refresh-web-artifacts를 다시 실행하세요.",
            "detail": f"price_end={price_end or 'unknown'}, report_end={report_end or 'unknown'}",
        },
        {
            "id": "simulation_price_alignment",
            "label": "Simulation and price dates",
            "severity": "ok" if simulation_end and price_end and simulation_end == price_end else "fail",
            "status": "ok" if simulation_end and price_end and simulation_end == price_end else "fail",
            "observed": {"simulation_end": simulation_end or None, "price_end": price_end or None},
            "expected": "simulation_end must match price_end",
            "action": "계좌 artifact를 최신 가격 기준일까지 전진시키도록 refresh-web-artifacts를 다시 실행하세요.",
            "detail": f"simulation_end={simulation_end or 'unknown'}, price_end={price_end or 'unknown'}",
        },
        {
            "id": "missing_price_symbols",
            "label": "Missing price symbols",
            "severity": "ok" if missing_count == 0 else ("review" if action_required_count else "ok"),
            "status": "ok" if missing_count == 0 else ("review" if action_required_count else "ok"),
            "count": missing_count,
            "observed": {
                "missing_price_symbols": missing_count,
                "release_status_counts": missing_status_counts,
                "category_counts": missing_category_counts,
                "preview": missing_preview,
            },
            "expected": "each missing-price symbol must have an explicit release_status and action",
            "action": "action_required symbol은 가격 소스 또는 mapping을 보정하고, accepted symbol은 리포트 표본 제외를 유지하세요.",
            "detail": f"{missing_count} report symbols are tracked as missing price coverage; {action_required_count} require action.",
        },
    ]
    severity_rank = {"ok": 0, "review": 1, "stale": 2, "fail": 3}
    overall = max((str(check["severity"]) for check in checks), key=lambda value: severity_rank[value])
    _write_product_json(
        out / "health.json",
        {
            "schema_version": "1.0.0",
            "generated_at": _page_generated_at(overview),
            "status": overall,
            "as_of": {
                "report_date": report_end or None,
                "price_date": price_end or None,
                "simulation_date": simulation_end or None,
            },
            "checks": checks,
        },
    )


def _relative_posix(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def write_web_manifest(out: Path, external: ExternalArtifactManager) -> Path:
    """Write the deterministic web artifact manifest after all exports finish."""

    overview = _read_json(out / "overview.json")
    _write_json(out / "manifest.json", _build_manifest(out, overview, external))
    return out / "manifest.json"


def _write_report_statistics_lab(out: Path) -> None:
    script = (
        Path(__file__).resolve().parents[3] / "apps" / "web" / "scripts" / "build-report-statistics-lab.mjs"
    )
    if not script.exists():
        raise RuntimeError(f"Missing report statistics generator: {script}")
    subprocess.run(["node", str(script), "--web-root", str(out)], check=True)


def _build_manifest(out: Path, overview: dict[str, Any], external: ExternalArtifactManager) -> dict[str, Any]:
    simulation_window = overview.get("simulation_window", {}) if isinstance(overview, dict) else {}
    price_end = simulation_window.get("price_end") if isinstance(simulation_window, dict) else None
    generated_at = f"{price_end}T00:00:00+09:00" if price_end else None
    artifacts = sorted(
        _relative_posix(path, out)
        for path in out.rglob("*")
        if path.suffix in {".json", ".csv"} and path.name != "manifest.json"
    )
    row_counts = {
        "reports": _json_row_count(out / "reports" / "table.json"),
        "current_holdings": _json_row_count(out / "portfolio" / "holdings.json"),
        "monthly_holdings": _json_row_count(out / "portfolio" / "monthly-holdings.json"),
        "trades": _json_row_count(out / "portfolio" / "trades.json"),
        "daily_decisions": _json_shard_row_count(out, out / "portfolio" / "daily-decisions" / "index.json", external),
        "position_episodes": _json_row_count(out / "portfolio" / "episodes.json"),
        "equity_daily": _json_shard_row_count(out, out / "portfolio" / "equity" / "index.json", external),
        "accounts": _json_row_count(out / "portfolio" / "accounts.json"),
        "account_catalog": _json_row_count(out / "accounts" / "catalog.json"),
        "report_board_candidates": _json_row_count(out / "report-board" / "candidates.json"),
        "report_health_rows": _json_row_count(out / "report-health.json"),
        "research_calendar_rows": _json_row_count(out / "research-calendar" / "calendar.json"),
    }
    report_counts = overview.get("report_counts", {}) if isinstance(overview, dict) else {}
    target_stats = overview.get("target_stats", {}) if isinstance(overview, dict) else {}
    manifest = {
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
        "artifacts": artifacts,
        "external_artifacts": {
            name: pointer.model_dump(mode="json") for name, pointer in sorted(external.pointers.items())
        },
        "price_artifact_count": sum(1 for name in artifacts if name.startswith("prices/")),
        "checksums": {
            name: sha256((out / name).read_bytes()).hexdigest()
            for name in artifacts
            if (out / name).is_file()
        },
    }
    return ArtifactManifest.model_validate(manifest).model_dump(mode="json")


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
    if isinstance(data, dict):
        rows = data.get("rows")
        if isinstance(rows, list):
            return len(rows)
        table = data.get("table")
        if isinstance(table, dict) and isinstance(table.get("rows"), list):
            return len(table["rows"])
    return 1


def _json_shard_row_count(out: Path, index_path: Path, external: ExternalArtifactManager | None = None) -> int:
    if not index_path.exists():
        return 0
    index = _read_json(index_path)
    accounts = index.get("accounts") if isinstance(index, dict) else None
    if not isinstance(accounts, list):
        return 0
    external_pointers = external.pointers if external is not None else {}
    total = 0
    for account in accounts:
        if not isinstance(account, dict):
            continue
        shard_path_text = account.get("path")
        if not isinstance(shard_path_text, str):
            continue
        shard_path = out / shard_path_text
        if shard_path.exists():
            shard = _read_json(shard_path)
            if (
                isinstance(shard, dict)
                and isinstance(shard.get("dates"), list)
                and isinstance(shard.get("series"), list)
            ):
                total += len(shard["dates"]) * len(shard["series"])
            else:
                total += _json_row_count(shard_path)
            continue
        pointer = external_pointers.get(shard_path_text)
        if pointer is not None and pointer.row_count is not None:
            total += pointer.row_count
    return total


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


def _mean(values: list[float | None]) -> float | None:
    finite = [value for value in values if value is not None]
    return sum(finite) / len(finite) if finite else None


def _median(values: list[float | None]) -> float | None:
    finite = [value for value in values if value is not None]
    return float(statistics.median(finite)) if finite else None


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
    source_currency = _frame_series(out, "source_currency", "KRW")
    display_currency = _frame_series(out, "display_currency", source_currency)
    out["_source_currency_norm"] = (
        pd.Series(source_currency, index=out.index).astype(str).map(normalize_currency)
    )
    out["_display_currency_norm"] = (
        pd.Series(display_currency, index=out.index).astype(str).map(normalize_currency)
    )
    out["_krw_per_unit_num"] = _numeric_series(out, "krw_per_unit", 1.0)
    for column in ("open", "high", "low", "close"):
        values = _numeric_series(out, column)
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
    for column in (
        "split_adjusted_open",
        "split_adjusted_high",
        "split_adjusted_low",
        "split_adjusted_close",
    ):
        if column not in out:
            continue
        values = _numeric_series(out, column)
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


def _price_groups_by_symbol(
    prices: pd.DataFrame,
    *,
    prices_are_native: bool = False,
) -> dict[str, pd.DataFrame]:
    if prices.empty:
        return {}
    priced = prices.copy() if prices_are_native else _price_frame_with_native(prices)
    priced["date"] = pd.to_datetime(priced["date"], errors="coerce")
    priced = priced.dropna(subset=["date", "symbol"])
    return {str(symbol): group.sort_values("date") for symbol, group in priced.groupby("symbol", sort=True)}


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
    price_groups: dict[str, pd.DataFrame] | None = None,
) -> list[dict[str, Any]]:
    performance_by_id = {str(row["report_id"]): row for row in report_performance.to_dict(orient="records")}
    review_reasons = _review_reasons_by_report(reports, extraction_quality)
    missing = set(missing_symbols)
    price_groups = price_groups or {}
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
        context = _report_price_context(cast(dict[str, Any], row), cast(dict[str, Any], perf), symbol)
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
        report = {
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
            "last_close_native": None,
            "last_close_date": perf.get("last_close_date") or None,
            "current_return": _number(perf.get("current_return")),
            "peak_return": _number(perf.get("peak_return")),
            "trough_return": _number(perf.get("trough_return")),
            "target_gap_pct": _number(perf.get("target_gap_pct")),
            "evaluation_close_krw": _number(perf.get("evaluation_close_krw")),
            "evaluation_close_date": perf.get("evaluation_close_date") or None,
            "evaluation_return": _number(perf.get("evaluation_return")),
            "target_remaining_pct": None,
            "target_progress_pct": None,
            "expiry_date": perf.get("expiry_date") or None,
            "expired": _bool(perf.get("expired")),
            "caveat_flags": sorted(set(caveats)),
        }
        rows.append(_enrich_report_row_with_price_series(report, price_groups.get(symbol)))
    return rows


def _enrich_report_row_with_price_series(
    report: dict[str, Any],
    price_group: pd.DataFrame | None,
) -> dict[str, Any]:
    if price_group is None or price_group.empty:
        return _with_report_target_metrics(report)

    group = price_group.copy()
    group["date"] = pd.to_datetime(group["date"], errors="coerce")
    group = group.dropna(subset=["date"]).sort_values("date")
    if group.empty:
        return _with_report_target_metrics(report)

    publication_ts = pd.to_datetime(
        cast(str | float | int | pd.Timestamp, report.get("date")), errors="coerce"
    )
    last_close_ts = pd.to_datetime(
        cast(str | float | int | pd.Timestamp, report.get("last_close_date")),
        errors="coerce",
    )
    if pd.isna(last_close_ts):
        last_close_ts = group["date"].max()

    bounded = group[group["date"].le(last_close_ts)]
    last_row = bounded.iloc[-1] if not bounded.empty else group.iloc[-1]
    last_close_native = _number(last_row.get("close_native"))
    last_close_krw = _number(last_row.get("close_krw"))
    entry_native = _number(report.get("entry_price_native"))
    entry_krw = _number(report.get("entry_price_krw"))
    target_native = _number(report.get("target_price_native"))
    target_krw = _number(report.get("target_price_krw"))
    caveats = list(report.get("caveat_flags") or [])

    if not pd.isna(publication_ts) and entry_native is not None and entry_native > 0:
        pub_candidates = group[group["date"].ge(publication_ts)]
        if not pub_candidates.empty:
            pub_close = _number(pub_candidates.iloc[0].get("close_native"))
            if pub_close is not None and pub_close > 0:
                ratio = entry_native / pub_close
                if ratio > 5 or ratio < 0.2:
                    if target_native is not None:
                        target_native = target_native / ratio
                    if target_krw is not None:
                        target_krw = target_krw / ratio
                    if entry_krw is not None:
                        entry_krw = entry_krw / ratio
                    entry_native = pub_close
                    caveats.append("price_scale_adjusted_entry")

    report.update(
        {
            "entry_price_native": _round_number(entry_native),
            "entry_price_krw": _round_number(entry_krw),
            "target_price_native": _round_number(target_native),
            "target_price_krw": _round_number(target_krw),
            "target_price": _round_number(target_native if target_native is not None else target_krw),
            "target_direction": _target_direction(target_native, entry_native),
            "last_close_native": _round_number(last_close_native),
            "last_close_krw": _round_number(
                last_close_krw if last_close_krw is not None else report.get("last_close_krw")
            ),
            "last_close_date": _date_string(last_row.get("date")) or report.get("last_close_date"),
            "caveat_flags": sorted(set(caveats)),
        }
    )

    return _with_report_target_metrics(report)


def _with_report_target_metrics(report: dict[str, Any]) -> dict[str, Any]:
    current = _number(report.get("last_close_krw")) or _number(report.get("last_close_native"))
    target = _number(report.get("target_price_krw")) or _number(report.get("target_price_native"))
    entry = _number(report.get("entry_price_krw")) or _number(report.get("entry_price_native"))
    if current is None or target is None or entry is None or current <= 0 or target <= 0 or entry <= 0:
        report["target_remaining_pct"] = None
        report["target_progress_pct"] = None
        return report

    target_move = target - entry
    progress = (current - entry) / target_move if target_move else None
    report["target_progress_pct"] = (
        _round_number(min(max(progress, 0.0), 1.0)) if progress is not None else None
    )
    if _bool(report.get("target_hit")):
        report["target_remaining_pct"] = 0
        return report

    direction = report.get("target_direction")
    if direction == "upside":
        report["target_remaining_pct"] = _round_number(max(0.0, target / current - 1))
    elif direction == "downside":
        report["target_remaining_pct"] = _round_number(max(0.0, 1 - target / current))
    else:
        report["target_remaining_pct"] = None
    return report


def _date_string(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    try:
        return pd.Timestamp(value).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return None


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

        context = _report_price_context(cast(dict[str, Any], row), cast(dict[str, Any], perf), symbol)
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


def _build_report_health(
    reports: pd.DataFrame,
    report_performance: pd.DataFrame,
    extraction_quality: dict[str, Any],
    missing_symbols: list[str],
    report_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    visible_ids = {str(row.get("report_id", "")) for row in report_rows}
    performance_by_id = {str(row["report_id"]): row for row in report_performance.to_dict(orient="records")}
    missing = set(missing_symbols)
    extraction_reviews = _extraction_review_details_by_report(reports, extraction_quality)
    rows: list[dict[str, Any]] = []
    summary = {
        "source_reports": 0,
        "web_visible": 0,
        "web_excluded": 0,
        "extraction_review": 0,
        "needs_review": 0,
    }
    exclusion_counts: dict[str, int] = {}

    for row in reports.sort_values(["publication_date", "page", "ordinal", "report_id"]).to_dict(
        orient="records"
    ):
        report_id = str(row["report_id"])
        review = extraction_reviews.get(report_id, {})
        extraction_reasons = (
            list(review.get("reasons", [])) if isinstance(review.get("reasons"), list) else []
        )
        extraction_status = str(review.get("status") or ("review" if extraction_reasons else "ok"))
        perf = performance_by_id.get(report_id, {})
        exclusion_reason = None if report_id in visible_ids else _report_exclusion_reason(row, perf, missing)
        web_status = "visible" if report_id in visible_ids else "excluded"

        summary["source_reports"] += 1
        if web_status == "visible":
            summary["web_visible"] += 1
        else:
            summary["web_excluded"] += 1
            reason = exclusion_reason or "unknown"
            exclusion_counts[reason] = exclusion_counts.get(reason, 0) + 1
        if extraction_reasons:
            summary["extraction_review"] += 1
        if extraction_status == "needs_review":
            summary["needs_review"] += 1

        rows.append(
            _clean(
                {
                    "report_id": report_id,
                    "date": row.get("publication_date"),
                    "page": row.get("page"),
                    "ordinal": row.get("ordinal"),
                    "company": row.get("company"),
                    "ticker": row.get("ticker"),
                    "symbol": row.get("symbol"),
                    "title": row.get("title"),
                    "markdown_filename": row.get("markdown_filename"),
                    "pdf_url": row.get("pdf_url"),
                    "extraction_status": extraction_status,
                    "extraction_reasons": extraction_reasons,
                    "web_status": web_status,
                    "web_exclusion_reason": exclusion_reason,
                    "action": _report_health_action(extraction_status, extraction_reasons, exclusion_reason),
                }
            )
        )

    return {
        "schema_version": "1.0.0",
        "summary": {**summary, "exclusion_reasons": dict(sorted(exclusion_counts.items()))},
        "rows": rows,
    }


def _report_exclusion_reason(row: dict[str, Any], perf: dict[str, Any], missing: set[str]) -> str | None:
    symbol = str(row.get("symbol", ""))
    if symbol in missing:
        return "missing_price"
    if not perf:
        return "missing_performance"
    if _is_sell_opinion(row.get("rating")):
        return "sell_opinion"
    context = _report_price_context(cast(dict[str, Any], row), cast(dict[str, Any], perf), symbol)
    target_upside_at_pub = context["target_upside_at_pub"]
    if target_upside_at_pub is not None and target_upside_at_pub <= 0:
        return "non_positive_upside"
    if _target_direction(context["target_price_native"], context["entry_price_native"]) != "upside":
        return "downside_target"
    target_hit = _bool(perf.get("target_hit"))
    days_to_target = _number(perf.get("days_to_target"))
    if target_hit and days_to_target is not None and days_to_target <= 1:
        return "instant_target_hit"
    return None


def _report_health_action(
    extraction_status: str, extraction_reasons: list[str], exclusion_reason: str | None
) -> str:
    if extraction_status == "needs_review" or "missing_base_target" in extraction_reasons:
        return "원문 Markdown/PDF에서 목표가 문장을 재확인하고 extraction rule을 보정하세요."
    if "missing_rating" in extraction_reasons:
        return "원문에서 투자의견 표기를 확인하고 rating 추출 rule 또는 수동 보정 여부를 결정하세요."
    if exclusion_reason == "missing_price":
        return "symbol mapping과 yfinance 가격 coverage를 확인하세요."
    if exclusion_reason in {"non_positive_upside", "downside_target"}:
        return "발간가와 목표가 방향을 확인하세요. 하락/무상승 리포트면 웹 검증 표본 제외가 정상입니다."
    if exclusion_reason == "instant_target_hit":
        return "발간 직후 목표가 도달 케이스입니다. 성과 표본 제외가 의도한 정책인지 확인하세요."
    return "웹 검증 표본에 정상 포함됩니다."


def _extraction_review_details_by_report(
    reports: pd.DataFrame, extraction_quality: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    if not extraction_quality.get("review_rows"):
        return {}
    ids_by_key = {
        (str(row.get("publication_date", ""))[:10], str(row.get("company", ""))): str(
            row.get("report_id", "")
        )
        for row in reports.to_dict(orient="records")
    }
    details: dict[str, dict[str, Any]] = {}
    for review in extraction_quality.get("review_rows", []):
        key = (str(review.get("date", ""))[:10], str(review.get("company", "")))
        report_id = ids_by_key.get(key)
        if not report_id:
            continue
        details[report_id] = {
            "status": str(review.get("status") or "review"),
            "reasons": [str(reason) for reason in review.get("reasons", [])],
        }
    return details


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
        "baseline_accounts": _records(summary),
        "simulation_window": {
            "report_start": min(dates) if dates else None,
            "report_end": max(dates) if dates else None,
            "price_start": min(price_dates) if price_dates else None,
            "price_end": max(price_dates) if price_dates else None,
        },
    }


BENCHMARK_ACCOUNT_IDS = {
    "all_weather",
    "benchmark_kodex200",
    "benchmark_qqq",
    "benchmark_spy",
    "benchmark_gld",
}

PRODUCT_ACCOUNT_IDS = {
    "smic_follower",
    "smic_follower_v2",
    "pit_score_top3",
    "pit_score_top5",
    "pit_score_top10",
    "pit_momentum_top5",
    "pit_trend_top5",
    "pit_fresh_top5",
    "pit_trend_top7",
    "pit_trend_stop_top5",
    "pit_trend_stop_top7",
    "pit_trend_rotate_top5",
    "pit_trend_rotate_fast_top5",
    "pit_trend_rotate_stop_top5",
    "pit_trend_persist20_top5",
    "pit_trend_persist30_top5",
    "pit_trend_persist20_hold90_top5",
    "pit_trend_persist20_top3",
    "pit_trend_persist20_top7",
    "pit_trend_persist20_52w10_top5",
    "pit_trend_persist20_domestic_top5",
    "pit_trend_persist20_score_top5",
    "pit_trend_persist20_scorecap_top5",
    "pit_trend_persist20_invvol_top5",
    "pit_trend_persist20_invvolcap_top5",
    "pit_trend_persist20_semimonthly_top5",
    "pit_trend_persist20_quarterly_top5",
    "pit_trend_persist30_quarterly_top5",
    "pit_trend_persist20_quarterly_risk_top5",
    "pit_trend_persist30_quarterly_risk_top5",
    "pit_trend_persist20_quarterly_hold120_top5",
    "pit_trend_quarterly_ret3_top5",
    "pit_trend_quarterly_ret6_top5",
    "pit_trend_quarterly_ret36_top5",
    "pit_trend_quarterly_fresh365_top5",
    "pit_trend_quarterly_fresh540_top5",
    "pit_trend_persist20_fresh540_top5",
    "pit_trend_persist20_fresh540_top3",
    "pit_trend_persist20_fresh540_top7",
    "pit_trend_quarterly_fresh540_top3",
    "pit_trend_quarterly_fresh540_top7",
    "pit_trend_quarterly_fresh540_gross_top5",
    "pit_trend_quarterly_fresh540_slip25_top5",
    "pit_trend_quarterly_fresh540_slip50_top5",
    "pit_trend_quarterly_fresh540_feb_top5",
    "pit_trend_quarterly_fresh540_mar_top5",
    "pit_trend_quarterly_fresh540_cash90_top5",
    "pit_trend_quarterly_fresh540_cash80_top5",
    "pit_trend_quarterly_fresh540_vol35_top5",
    "pit_trend_quarterly_fresh540_vol40_top5",
    "pit_trend_quarterly_fresh540_vol45_top5",
    "pit_trend_quarterly_fresh540_vol50_top5",
    "pit_trend_quarterly_fresh540_vol55_top5",
    "pit_trend_quarterly_fresh540_mar_vol45_top5",
    "pit_trend_quarterly_fresh540_entry270_top5",
    "pit_trend_quarterly_fresh540_entry270_vol50_top5",
    "pit_trend_quarterly_fresh540_entry270_mar_top5",
    "pit_trend_quarterly_fresh540_entry365_top5",
    "pit_trend_quarterly_fresh540_entry450_top5",
    "pit_trend_quarterly_fresh540_entry365_vol50_top5",
    "pit_trend_quarterly_fresh540_rank15_top5",
    "pit_trend_quarterly_fresh540_rank25_top5",
    "pit_trend_quarterly_fresh540_runwinners_top5",
    "pit_trend_quarterly_fresh540_runwinners_vol50_top5",
    "pit_trend_quarterly_fresh540_runwinners_top3",
    "pit_trend_quarterly_fresh540_runwinners_top7",
    "pit_trend_quarterly_fresh540_runwinners_feb_top5",
    "pit_trend_quarterly_fresh540_runwinners_mar_top5",
    "pit_trend_quarterly_fresh540_runwinners_slip25_top5",
    "pit_trend_quarterly_fresh540_runwinners_slip50_top5",
    "pit_trend_quarterly_fresh540_runwinners_cap40_top5",
    "pit_trend_quarterly_fresh540_runwinners_cap35_top5",
    "pit_trend_quarterly_fresh540_runwinners_soft45_top5",
    "pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5",
    "pit_trend_quarterly_fresh540_runwinners_dailycap45_top5",
    "pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5",
    "pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5",
    "pit_trend_quarterly_fresh540_confirm5_top5",
    "pit_trend_quarterly_fresh540_confirm10_top5",
    "pit_trend_quarterly_fresh540_confirm10_vol50_top5",
    "pit_trend_persist20_kodex50_top5",
    "pit_trend_persist20_kodex200_top5",
}

TARGET_BENCHMARK_ID = "benchmark_kodex200"
OBJECTIVE_MAX_DRAWDOWN = 0.15


def _account_config_by_id(path: Path) -> dict[str, dict[str, Any]]:
    if not path.exists():
        raise RuntimeError(f"Required simulation config artifact is missing: {path}")
    data = _read_json(path)
    accounts = data.get("accounts") if isinstance(data, dict) else None
    if not isinstance(accounts, list):
        raise RuntimeError(f"{path} must contain accounts for account catalog export.")
    out: dict[str, dict[str, Any]] = {}
    for item in accounts:
        if not isinstance(item, dict):
            continue
        account_id = item.get("account_id")
        if account_id:
            out[str(account_id)] = _clean(item)
    return out


def _account_kind(account_id: str) -> str:
    if account_id in BENCHMARK_ACCOUNT_IDS:
        return "benchmark"
    if account_id in PRODUCT_ACCOUNT_IDS:
        return "account"
    return "account"

_PORTFOLIO_ACCOUNT_CONTEXT: dict[str, dict[str, str]] = {
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5": {
        "role": "candidate",
        "category": "experimental",
        "title": "Partial 75",
        "subtitle": "현재 연구 후보",
        "comparison_prompt": "부분 재투입 후보가 수익률, 낙폭, 체결 수를 함께 개선했는지 봅니다.",
        "shortlist_reason": "현재 검토 후보라서 다른 대표 원장보다 먼저 봅니다.",
    },
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5": {
        "role": "robustness",
        "category": "control",
        "title": "Cash Gate 12.5",
        "subtitle": "현금 게이트 기준선",
        "comparison_prompt": "현금 전액 재투입 대비 부분 재투입이 과열 재진입과 낙폭을 줄였는지 봅니다.",
        "shortlist_reason": "후보와 같은 trim 구조에서 현금 재투입 강도만 비교하는 견고성 점검입니다.",
    },
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5": {
        "role": "baseline",
        "category": "control",
        "title": "Trail Trim 20",
        "subtitle": "이익 보호 기준선",
        "comparison_prompt": "후보의 보유 유지, trim, 현금 재투입 규칙이 기준선 대비 무엇을 더했는지 봅니다.",
        "shortlist_reason": "후보 전략에서 현금 재투입만 뺀 기준선이라 먼저 비교합니다.",
    },
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5": {
        "role": "entry_gate",
        "category": "ladder",
        "title": "Candidate Gate",
        "subtitle": "신규 진입 점수 기준선",
        "comparison_prompt": "candidate_score 신규 진입만으로도 후보 전략의 초과성과가 유지되는지 봅니다.",
        "shortlist_reason": "보유 승자 유지와 trim 규칙 없이 진입 점수만 남긴 비교군입니다.",
    },
    "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5": {
        "role": "hold_winner",
        "category": "ladder",
        "title": "Profit 60 Hold",
        "subtitle": "보유 승자 유지 기준선",
        "comparison_prompt": "trim과 현금 재투입 없이 보유 유지 규칙만으로 성과가 남는지 봅니다.",
        "shortlist_reason": "후보 전략에서 trim·재투입을 떼고 보유 유지까지 남긴 비교군입니다.",
    },
    "pit_mtt_rs90_top5": {
        "role": "mtt_filter",
        "category": "template",
        "title": "MTT RS90",
        "subtitle": "민네르비니 상대강도 상위 10%",
        "comparison_prompt": "강한 템플릿 필터가 분기 Top5보다 더 안정적인지 봅니다.",
        "shortlist_reason": "민네르비니 필터 강도를 높였을 때 후보 전략 대안이 되는지 보는 비교군입니다.",
    },
    "pit_mtt_rs80_top5": {
        "role": "mtt_filter",
        "category": "template",
        "title": "MTT RS80",
        "subtitle": "민네르비니 상대강도 상위 20%",
        "comparison_prompt": "강한 템플릿 필터가 분기 Top5보다 더 안정적인지 봅니다.",
        "shortlist_reason": "민네르비니 필터 강도를 높였을 때 후보 전략 대안이 되는지 보는 비교군입니다.",
    },
    "pit_mtt_rs70_top5": {
        "role": "mtt_filter",
        "category": "template",
        "title": "MTT RS70",
        "subtitle": "민네르비니 상대강도 상위 30%",
        "comparison_prompt": "강한 템플릿 필터가 분기 Top5보다 더 안정적인지 봅니다.",
        "shortlist_reason": "민네르비니 필터 강도를 높였을 때 후보 전략 대안이 되는지 보는 비교군입니다.",
    },
    "pit_mtt_low100_top5": {
        "role": "mtt_filter",
        "category": "template",
        "title": "MTT Low100",
        "subtitle": "민네르비니 저점 거리 100%",
        "comparison_prompt": "저점 이격도 필터만으로 손익비가 개선되는지 봅니다.",
        "shortlist_reason": "저점 이격도 필터가 후보 전략의 진입 규칙을 대체할 수 있는지 보는 비교군입니다.",
    },
    "pit_mtt_low300_top5": {
        "role": "mtt_filter",
        "category": "template",
        "title": "MTT Low300",
        "subtitle": "민네르비니 저점 거리 300%",
        "comparison_prompt": "저점 이격도 필터만으로 손익비가 개선되는지 봅니다.",
        "shortlist_reason": "저점 이격도 필터가 후보 전략의 진입 규칙을 대체할 수 있는지 보는 비교군입니다.",
    },
    "pit_momentum_6m12m_top5": {
        "role": "momentum",
        "category": "factor",
        "title": "Momentum 6M/12M",
        "subtitle": "장기 모멘텀 기준선",
        "comparison_prompt": "긴 모멘텀 창이 분기 리포트 기반 후보보다 더 단단한지 봅니다.",
        "shortlist_reason": "가격 모멘텀만으로도 후보 전략을 대체할 수 있는지 보는 비교군입니다.",
    },
    "pit_momentum_3m6m_top5": {
        "role": "momentum",
        "category": "factor",
        "title": "Momentum 3M/6M",
        "subtitle": "중기 모멘텀 기준선",
        "comparison_prompt": "중기 모멘텀 창이 분기 리포트 기반 후보보다 더 단단한지 봅니다.",
        "shortlist_reason": "가격 모멘텀만으로도 후보 전략을 대체할 수 있는지 보는 비교군입니다.",
    },
    "pit_momentum_1m3m_top5": {
        "role": "momentum",
        "category": "factor",
        "title": "Momentum 1M/3M",
        "subtitle": "단기 모멘텀 기준선",
        "comparison_prompt": "짧은 모멘텀 창이 분기 리포트 기반 후보보다 더 단단한지 봅니다.",
        "shortlist_reason": "가격 모멘텀만으로도 후보 전략을 대체할 수 있는지 보는 비교군입니다.",
    },
    "pit_trend_top5": {
        "role": "simple_pit",
        "category": "baseline",
        "title": "Trend Top5",
        "subtitle": "단순 추세 기준",
        "comparison_prompt": "보유 승자 유지·부분 trim·현금 재투입 규칙이 성과에 얼마나 더해졌는지 봅니다.",
        "shortlist_reason": "보유 승자 유지와 trim 없이 단순 추세 점수만 남긴 출발점입니다.",
    },
    "pit_score_top5": {
        "role": "score_baseline",
        "category": "baseline",
        "title": "Score Top5",
        "subtitle": "점수-only 기준",
        "comparison_prompt": "추세·보유 유지·trailing trim 규칙 없이 점수 정렬만으로도 성과가 유지되는지 봅니다.",
        "shortlist_reason": "추세·보유 유지·trim 없이 점수 정렬만 남긴 가장 단순한 비교군입니다.",
    },
    "smic_follower": {
        "role": "report_follower",
        "category": "baseline",
        "title": "SMIC Follower",
        "subtitle": "리포트 추종 기준선",
        "comparison_prompt": "TopN 점수 전략이 단순 리포트 추종보다 충분한 초과성과를 냈는지 봅니다.",
        "shortlist_reason": "점수 전략 없이 리포트 추종만 했을 때의 현실적인 기준선입니다.",
    },
}


def _account_catalog_context(
    account_id: str,
    *,
    kind: str,
    short_label: str,
    selectable: bool,
) -> dict[str, Any]:
    context = _PORTFOLIO_ACCOUNT_CONTEXT.get(account_id)
    if context:
        return dict(context)
    if kind == "benchmark":
        subtitle = "올웨더 배분 기준선" if account_id == "all_weather" else "시장 보유 기준선"
        comparison_prompt = (
            "대표 계좌가 정적 자산배분보다 얼마나 나은지 봅니다."
            if account_id == "all_weather"
            else "선택 계좌가 이 시장 기준선 대비 얼마나 초과성과를 냈는지 봅니다."
        )
        return {
            "role": "allocation_benchmark" if account_id == "all_weather" else "market_benchmark",
            "category": "benchmark",
            "title": short_label,
            "subtitle": subtitle,
            "comparison_prompt": comparison_prompt,
            "shortlist_reason": None,
        }
    return {
        "role": "portfolio" if selectable else "research",
        "category": "portfolio" if selectable else "archive",
        "title": short_label,
        "subtitle": "대표 비교 계좌" if selectable else "연구 보관 계좌",
        "comparison_prompt": (
            "후보 전략과 이 대표 계좌의 수익률, 낙폭, 체결 수를 함께 비교합니다."
            if selectable
            else "대표 계좌 편입 전 참고용 실험 결과입니다."
        ),
        "shortlist_reason": "현재 대표 비교 계좌입니다." if selectable else None,
    }

def _build_account_catalog(summary: pd.DataFrame, sim_config_path: Path) -> list[dict[str, Any]]:
    """Build the frontend account taxonomy contract.

    The UI must not infer benchmark/account meaning from fragile string
    prefixes. This catalog is the product boundary: labels, short labels,
    benchmark groups, and objective gate are exported together with the
    simulation output.
    """

    config_by_id = _account_config_by_id(sim_config_path)
    summary_rows = _records(summary)
    summary_by_id = {str(row.get("account_id")): row for row in summary_rows if row.get("account_id")}
    benchmark_return = _number(summary_by_id.get(TARGET_BENCHMARK_ID, {}).get("money_weighted_return"))
    rows: list[dict[str, Any]] = []

    for row in summary_rows:
        account_id = str(row.get("account_id") or "")
        if not account_id:
            continue
        config = config_by_id.get(account_id, {})
        kind = _account_kind(account_id)
        return_pct = _number(row.get("money_weighted_return"))
        max_drawdown = _number(row.get("max_drawdown"))
        return_excess = (
            return_pct - benchmark_return
            if return_pct is not None and benchmark_return is not None and account_id != TARGET_BENCHMARK_ID
            else None
        )
        mdd_slack = OBJECTIVE_MAX_DRAWDOWN - max_drawdown if max_drawdown is not None else None
        selectable = kind == "account" and account_id in WEB_PORTFOLIO_ACCOUNT_ORDER
        objective_passed = (
            selectable
            and return_excess is not None
            and return_excess > 0
            and mdd_slack is not None
            and mdd_slack >= 0
        )
        shortlist_priority = WEB_PORTFOLIO_ACCOUNT_ORDER.get(account_id)
        raw_label = str(row.get("label") or config.get("label") or account_id)
        label = _account_display_label(account_id, config, raw_label)
        short_label = _account_short_label(account_id, label)
        rows.append(
            {
                "account_id": account_id,
                "label": label,
                "short_label": short_label,
                "kind": kind,
                "benchmark_group": _benchmark_group(account_id),
                "is_selectable": selectable,
                "shortlist_priority": shortlist_priority,
                "is_default_candidate": objective_passed,
                "objective_passed": objective_passed,
                "objective_return_excess": return_excess,
                "objective_mdd_slack": mdd_slack,
                "context": _account_catalog_context(
                    account_id,
                    kind=kind,
                    short_label=short_label,
                    selectable=selectable,
                ),
                "metrics": {
                    "final_equity_krw": _number(row.get("final_equity_krw")),
                    "final_cash_krw": _number(row.get("final_cash_krw")),
                    "final_holdings_value_krw": _number(row.get("final_holdings_value_krw")),
                    "money_weighted_return": return_pct,
                    "sharpe": _number(row.get("sharpe")),
                    "sortino": _number(row.get("sortino")),
                    "cagr": _number(row.get("cagr")),
                    "max_drawdown": max_drawdown,
                    "trade_count": _number(row.get("trade_count")),
                    "open_positions": _number(row.get("open_positions")),
                },
            }
        )

    return sorted(rows, key=_account_catalog_sort_key)


def _benchmark_group(account_id: str) -> str | None:
    if account_id == "all_weather":
        return "allocation"
    if account_id in {"smic_follower", "smic_follower_v2"}:
        return "report_follower"
    if account_id in {
        "pit_score_top3",
        "pit_score_top5",
        "pit_score_top10",
        "pit_momentum_top5",
        "pit_trend_top5",
        "pit_fresh_top5",
        "pit_trend_top7",
        "pit_trend_stop_top5",
        "pit_trend_stop_top7",
        "pit_trend_rotate_top5",
        "pit_trend_rotate_fast_top5",
        "pit_trend_rotate_stop_top5",
        "pit_trend_persist20_top5",
        "pit_trend_persist30_top5",
        "pit_trend_persist20_hold90_top5",
        "pit_trend_persist20_top3",
        "pit_trend_persist20_top7",
        "pit_trend_persist20_52w10_top5",
        "pit_trend_persist20_domestic_top5",
        "pit_trend_persist20_score_top5",
        "pit_trend_persist20_scorecap_top5",
        "pit_trend_persist20_invvol_top5",
        "pit_trend_persist20_invvolcap_top5",
        "pit_trend_persist20_semimonthly_top5",
        "pit_trend_persist20_quarterly_top5",
        "pit_trend_persist30_quarterly_top5",
        "pit_trend_persist20_quarterly_risk_top5",
        "pit_trend_persist30_quarterly_risk_top5",
        "pit_trend_persist20_quarterly_hold120_top5",
        "pit_trend_quarterly_ret3_top5",
        "pit_trend_quarterly_ret6_top5",
        "pit_trend_quarterly_ret36_top5",
        "pit_trend_quarterly_fresh365_top5",
        "pit_trend_quarterly_fresh540_top5",
        "pit_trend_persist20_fresh540_top5",
        "pit_trend_persist20_fresh540_top3",
        "pit_trend_persist20_fresh540_top7",
        "pit_trend_quarterly_fresh540_top3",
        "pit_trend_quarterly_fresh540_top7",
        "pit_trend_quarterly_fresh540_gross_top5",
        "pit_trend_quarterly_fresh540_slip25_top5",
        "pit_trend_quarterly_fresh540_slip50_top5",
        "pit_trend_quarterly_fresh540_feb_top5",
        "pit_trend_quarterly_fresh540_mar_top5",
        "pit_trend_quarterly_fresh540_cash90_top5",
        "pit_trend_quarterly_fresh540_cash80_top5",
        "pit_trend_quarterly_fresh540_vol35_top5",
        "pit_trend_quarterly_fresh540_vol40_top5",
        "pit_trend_quarterly_fresh540_vol45_top5",
        "pit_trend_quarterly_fresh540_vol50_top5",
        "pit_trend_quarterly_fresh540_vol55_top5",
        "pit_trend_quarterly_fresh540_mar_vol45_top5",
        "pit_trend_quarterly_fresh540_entry270_top5",
        "pit_trend_quarterly_fresh540_entry270_vol50_top5",
        "pit_trend_quarterly_fresh540_entry270_mar_top5",
        "pit_trend_quarterly_fresh540_entry365_top5",
        "pit_trend_quarterly_fresh540_entry450_top5",
        "pit_trend_quarterly_fresh540_entry365_vol50_top5",
        "pit_trend_quarterly_fresh540_rank15_top5",
        "pit_trend_quarterly_fresh540_rank25_top5",
        "pit_trend_quarterly_fresh540_runwinners_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_top5",
        "pit_trend_quarterly_fresh540_runwinners_top3",
        "pit_trend_quarterly_fresh540_runwinners_top7",
        "pit_trend_quarterly_fresh540_runwinners_feb_top5",
        "pit_trend_quarterly_fresh540_runwinners_mar_top5",
        "pit_trend_quarterly_fresh540_runwinners_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_cap40_top5",
        "pit_trend_quarterly_fresh540_runwinners_cap35_top5",
        "pit_trend_quarterly_fresh540_runwinners_soft45_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5",
        "pit_trend_quarterly_fresh540_confirm5_top5",
        "pit_trend_quarterly_fresh540_confirm10_top5",
        "pit_trend_quarterly_fresh540_confirm10_vol50_top5",
        "pit_trend_persist20_kodex50_top5",
        "pit_trend_persist20_kodex200_top5",
    }:
        return "pit_score"
    if account_id in {"benchmark_kodex200", "benchmark_qqq", "benchmark_spy", "benchmark_gld"}:
        return "market"
    return None


def _account_short_label(account_id: str, label: str) -> str:
    labels = {
        "all_weather": "All Weather",
        "smic_follower": "SMIC Follower v1",
        "smic_follower_v2": "SMIC Follower v2",
        "pit_score_top3": "PIT Top 3",
        "pit_score_top5": "PIT Top 5",
        "pit_score_top10": "PIT Top 10",
        "pit_momentum_top5": "PIT Momentum",
        "pit_trend_top5": "PIT Trend",
        "pit_fresh_top5": "PIT Fresh",
        "pit_trend_top7": "PIT Trend 7",
        "pit_trend_stop_top5": "PIT Trend Stop 5",
        "pit_trend_stop_top7": "PIT Trend Stop 7",
        "pit_trend_rotate_top5": "PIT Trend Rotate",
        "pit_trend_rotate_fast_top5": "PIT Trend Rotate 2x",
        "pit_trend_rotate_stop_top5": "PIT Trend Stop Rotate",
        "pit_trend_persist20_top5": "PIT Persist 20",
        "pit_trend_persist30_top5": "PIT Persist 30",
        "pit_trend_persist20_hold90_top5": "PIT Persist 20/90",
        "pit_trend_persist20_top3": "PIT Persist 20 Top3",
        "pit_trend_persist20_top7": "PIT Persist 20 Top7",
        "pit_trend_persist20_52w10_top5": "PIT Persist 52W",
        "pit_trend_persist20_domestic_top5": "PIT Persist Korea",
        "pit_trend_persist20_score_top5": "PIT Persist Score",
        "pit_trend_persist20_scorecap_top5": "PIT Persist Score Cap",
        "pit_trend_persist20_invvol_top5": "PIT Persist InvVol",
        "pit_trend_persist20_invvolcap_top5": "PIT Persist InvVol Cap",
        "pit_trend_persist20_semimonthly_top5": "PIT Persist 2x",
        "pit_trend_persist20_quarterly_top5": "PIT Persist Quarterly",
        "pit_trend_persist30_quarterly_top5": "PIT Quarterly Top30",
        "pit_trend_persist20_quarterly_risk_top5": "PIT Quarterly Risk",
        "pit_trend_persist30_quarterly_risk_top5": "PIT Quarterly Top30 Risk",
        "pit_trend_persist20_quarterly_hold120_top5": "PIT Quarterly Hold120",
        "pit_trend_quarterly_ret3_top5": "PIT Quarterly 3M",
        "pit_trend_quarterly_ret6_top5": "PIT Quarterly 6M",
        "pit_trend_quarterly_ret36_top5": "PIT Quarterly 3M+6M",
        "pit_trend_quarterly_fresh365_top5": "PIT Quarterly Fresh365",
        "pit_trend_quarterly_fresh540_top5": "PIT Quarterly Fresh540",
        "pit_trend_persist20_fresh540_top5": "PIT Monthly Fresh540",
        "pit_trend_persist20_fresh540_top3": "PIT Monthly Fresh540 Top3",
        "pit_trend_persist20_fresh540_top7": "PIT Monthly Fresh540 Top7",
        "pit_trend_quarterly_fresh540_top3": "PIT Quarterly Fresh540 Top3",
        "pit_trend_quarterly_fresh540_top7": "PIT Quarterly Fresh540 Top7",
        "pit_trend_quarterly_fresh540_gross_top5": "PIT Quarterly Fresh540 Gross",
        "pit_trend_quarterly_fresh540_slip25_top5": "PIT Quarterly Fresh540 Slip25",
        "pit_trend_quarterly_fresh540_slip50_top5": "PIT Quarterly Fresh540 Slip50",
        "pit_trend_quarterly_fresh540_feb_top5": "PIT Quarterly Fresh540 Feb",
        "pit_trend_quarterly_fresh540_mar_top5": "PIT Quarterly Fresh540 Mar",
        "pit_trend_quarterly_fresh540_cash90_top5": "PIT Quarterly Fresh540 Cash10",
        "pit_trend_quarterly_fresh540_cash80_top5": "PIT Quarterly Fresh540 Cash20",
        "pit_trend_quarterly_fresh540_vol35_top5": "PIT Quarterly Fresh540 Vol35",
        "pit_trend_quarterly_fresh540_vol40_top5": "PIT Quarterly Fresh540 Vol40",
        "pit_trend_quarterly_fresh540_vol45_top5": "PIT Quarterly Fresh540 Vol45",
        "pit_trend_quarterly_fresh540_vol50_top5": "PIT Quarterly Fresh540 Vol50",
        "pit_trend_quarterly_fresh540_vol55_top5": "PIT Quarterly Fresh540 Vol55",
        "pit_trend_quarterly_fresh540_mar_vol45_top5": "PIT Quarterly Fresh540 Mar Vol45",
        "pit_trend_quarterly_fresh540_entry270_top5": "PIT Quarterly Fresh540 Entry270",
        "pit_trend_quarterly_fresh540_entry270_vol50_top5": "PIT Quarterly Fresh540 Entry270 Vol50",
        "pit_trend_quarterly_fresh540_entry270_mar_top5": "PIT Quarterly Fresh540 Entry270 Mar",
        "pit_trend_quarterly_fresh540_entry365_top5": "PIT Quarterly Fresh540 Entry365",
        "pit_trend_quarterly_fresh540_entry450_top5": "PIT Quarterly Fresh540 Entry450",
        "pit_trend_quarterly_fresh540_entry365_vol50_top5": "PIT Quarterly Fresh540 Entry365 Vol50",
        "pit_trend_quarterly_fresh540_rank15_top5": "PIT Quarterly Fresh540 Rank15",
        "pit_trend_quarterly_fresh540_rank25_top5": "PIT Quarterly Fresh540 Rank25",
        "pit_trend_quarterly_fresh540_runwinners_top5": "PIT Quarterly Fresh540 Run Winners",
        "pit_trend_quarterly_fresh540_runwinners_vol50_top5": "PIT Quarterly Fresh540 Run Winners Vol50",
        "pit_trend_quarterly_fresh540_runwinners_top3": "PIT Quarterly Fresh540 Run Winners Top3",
        "pit_trend_quarterly_fresh540_runwinners_top7": "PIT Quarterly Fresh540 Run Winners Top7",
        "pit_trend_quarterly_fresh540_runwinners_feb_top5": "PIT Quarterly Fresh540 Run Winners Feb",
        "pit_trend_quarterly_fresh540_runwinners_mar_top5": "PIT Quarterly Fresh540 Run Winners Mar",
        "pit_trend_quarterly_fresh540_runwinners_slip25_top5": "PIT Quarterly Fresh540 Run Winners Slip25",
        "pit_trend_quarterly_fresh540_runwinners_slip50_top5": "PIT Quarterly Fresh540 Run Winners Slip50",
        "pit_trend_quarterly_fresh540_runwinners_cap40_top5": "PIT Quarterly Fresh540 Run Winners Cap40",
        "pit_trend_quarterly_fresh540_runwinners_cap35_top5": "PIT Quarterly Fresh540 Run Winners Cap35",
        "pit_trend_quarterly_fresh540_runwinners_soft45_top5": "PIT Quarterly Fresh540 Run Winners Soft45",
        "pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5": "PIT Quarterly Fresh540 Run Winners Vol50 Cap40",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5": "PIT Quarterly Fresh540 Run Winners WeeklyCap45",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_top5": "PIT Quarterly Fresh540 Run Winners DailyCap45",
        "pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5": "PIT Quarterly Fresh540 Run Winners Vol50 WeeklyCap45",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5": "PIT Quarterly Fresh540 Run Winners WeeklyCap50",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5": "PIT Quarterly Fresh540 Run Winners WeeklyCap45 Profit10",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5": "PIT Quarterly Fresh540 Run Winners WeeklyCap45 Profit25",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5": "PIT Quarterly Fresh540 Run Winners WeeklyCap45 Profit40",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5": "PIT Quarterly Fresh540 Run Winners WeeklyCap45 Profit60",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5": "PIT Quarterly Fresh540 Run Winners Profit60 Candidate Score",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5": "TrailTrim 20",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5": "CashGate 12.5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5": "Partial 75",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3": "PIT Quarterly Fresh540 Run Winners Profit60 Candidate Top3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7": "PIT Quarterly Fresh540 Run Winners Profit60 Candidate Top7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5": "PIT Quarterly Fresh540 Run Winners Profit60 Candidate Slip25",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5": "PIT Quarterly Fresh540 Run Winners Profit60 Candidate Slip50",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5": "PIT Quarterly Fresh540 Run Winners Profit60 Candidate Mid-Contribution",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5": "PIT Quarterly Fresh540 Run Winners Profit60 Candidate Last-Contribution",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5": "PIT Quarterly Fresh540 Run Winners Profit60 Momentum Score",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5": "PIT Quarterly Fresh540 Run Winners Profit60 Mid-Contribution",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5": "PIT Quarterly Fresh540 Run Winners Profit60 Last-Contribution",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5": "PIT Quarterly Fresh540 Run Winners DailyCap45 Profit25",
        "pit_trend_quarterly_fresh540_confirm5_top5": "PIT Quarterly Fresh540 Confirm5",
        "pit_trend_quarterly_fresh540_confirm10_top5": "PIT Quarterly Fresh540 Confirm10",
        "pit_trend_quarterly_fresh540_confirm10_vol50_top5": "PIT Quarterly Fresh540 Confirm10 Vol50",
        "pit_trend_persist20_kodex50_top5": "PIT Persist KODEX 50",
        "pit_trend_persist20_kodex200_top5": "PIT Persist KODEX 200",
        "benchmark_kodex200": "KODEX200",
        "benchmark_qqq": "QQQ",
        "benchmark_spy": "SPY",
        "benchmark_gld": "GLD",
    }
    return labels.get(account_id, label)


def _account_display_label(account_id: str, config: dict[str, Any], default_label: str) -> str:
    labels = {
        "all_weather": "All Weather",
        "smic_follower": "SMIC Report Follower",
        "smic_follower_v2": "SMIC Report Follower with Stops",
        "pit_score_top3": "PIT Score Top 3 Equal Weight",
        "pit_score_top5": "PIT Score Top 5 Equal Weight",
        "pit_score_top10": "PIT Score Top 10 Equal Weight",
        "pit_momentum_top5": "PIT Momentum Top 5",
        "pit_trend_top5": "PIT Trend Top 5",
        "pit_fresh_top5": "PIT Fresh Top 5",
        "pit_trend_top7": "PIT Trend Top 7",
        "pit_trend_stop_top5": "PIT Trend Stop Top 5",
        "pit_trend_stop_top7": "PIT Trend Stop Top 7",
        "pit_trend_rotate_top5": "PIT Trend Rotate Top 5",
        "pit_trend_rotate_fast_top5": "PIT Trend Rotate Top 5 Twice Monthly",
        "pit_trend_rotate_stop_top5": "PIT Trend Stop Rotate Top 5",
        "pit_trend_persist20_top5": "PIT Trend Persist Top 20 Band",
        "pit_trend_persist30_top5": "PIT Trend Persist Top 30 Band",
        "pit_trend_persist20_hold90_top5": "PIT Trend Persist Top 20 Hold 90",
        "pit_trend_persist20_top3": "PIT Trend Persist Top 20 Band Top 3",
        "pit_trend_persist20_top7": "PIT Trend Persist Top 20 Band Top 7",
        "pit_trend_persist20_52w10_top5": "PIT Trend Persist Top 20 Near High",
        "pit_trend_persist20_domestic_top5": "PIT Trend Persist Top 20 Domestic",
        "pit_trend_persist20_score_top5": "PIT Trend Persist Score Weight",
        "pit_trend_persist20_scorecap_top5": "PIT Trend Persist Score Cap",
        "pit_trend_persist20_invvol_top5": "PIT Trend Persist Inverse Vol",
        "pit_trend_persist20_invvolcap_top5": "PIT Trend Persist Inverse Vol Cap",
        "pit_trend_persist20_semimonthly_top5": "PIT Trend Persist Twice Monthly",
        "pit_trend_persist20_quarterly_top5": "PIT Trend Persist Quarterly",
        "pit_trend_persist30_quarterly_top5": "PIT Trend Persist Quarterly Top 30 Band",
        "pit_trend_persist20_quarterly_risk_top5": "PIT Trend Persist Quarterly 50MA Risk Review",
        "pit_trend_persist30_quarterly_risk_top5": "PIT Trend Persist Quarterly Top 30 50MA Risk Review",
        "pit_trend_persist20_quarterly_hold120_top5": "PIT Trend Persist Quarterly Hold 120",
        "pit_trend_quarterly_ret3_top5": "PIT Trend Quarterly 3M Return Gate",
        "pit_trend_quarterly_ret6_top5": "PIT Trend Quarterly 6M Return Gate",
        "pit_trend_quarterly_ret36_top5": "PIT Trend Quarterly 3M+6M Return Gate",
        "pit_trend_quarterly_fresh365_top5": "PIT Trend Quarterly Fresh 365",
        "pit_trend_quarterly_fresh540_top5": "PIT Trend Quarterly Fresh 540",
        "pit_trend_persist20_fresh540_top5": "PIT Trend Monthly Fresh 540",
        "pit_trend_persist20_fresh540_top3": "PIT Trend Monthly Fresh 540 Top 3",
        "pit_trend_persist20_fresh540_top7": "PIT Trend Monthly Fresh 540 Top 7",
        "pit_trend_quarterly_fresh540_top3": "PIT Trend Quarterly Fresh 540 Top 3",
        "pit_trend_quarterly_fresh540_top7": "PIT Trend Quarterly Fresh 540 Top 7",
        "pit_trend_quarterly_fresh540_gross_top5": "PIT Trend Quarterly Fresh 540 Gross",
        "pit_trend_quarterly_fresh540_slip25_top5": "PIT Trend Quarterly Fresh 540 Slip 25",
        "pit_trend_quarterly_fresh540_slip50_top5": "PIT Trend Quarterly Fresh 540 Slip 50",
        "pit_trend_quarterly_fresh540_feb_top5": "PIT Trend Quarterly Fresh 540 Feb Cycle",
        "pit_trend_quarterly_fresh540_mar_top5": "PIT Trend Quarterly Fresh 540 Mar Cycle",
        "pit_trend_quarterly_fresh540_cash90_top5": "PIT Trend Quarterly Fresh 540 90% Invested",
        "pit_trend_quarterly_fresh540_cash80_top5": "PIT Trend Quarterly Fresh 540 80% Invested",
        "pit_trend_quarterly_fresh540_vol35_top5": "PIT Trend Quarterly Fresh 540 35% Vol Cap",
        "pit_trend_quarterly_fresh540_vol40_top5": "PIT Trend Quarterly Fresh 540 40% Vol Cap",
        "pit_trend_quarterly_fresh540_vol45_top5": "PIT Trend Quarterly Fresh 540 45% Vol Cap",
        "pit_trend_quarterly_fresh540_vol50_top5": "PIT Trend Quarterly Fresh 540 50% Vol Cap",
        "pit_trend_quarterly_fresh540_vol55_top5": "PIT Trend Quarterly Fresh 540 55% Vol Cap",
        "pit_trend_quarterly_fresh540_mar_vol45_top5": "PIT Trend Quarterly Fresh 540 Mar Cycle 45% Vol Cap",
        "pit_trend_quarterly_fresh540_entry270_top5": "PIT Trend Quarterly Fresh 540 Entry 270",
        "pit_trend_quarterly_fresh540_entry270_vol50_top5": "PIT Trend Quarterly Fresh 540 Entry 270 50% Vol Cap",
        "pit_trend_quarterly_fresh540_entry270_mar_top5": "PIT Trend Quarterly Fresh 540 Entry 270 Mar Cycle",
        "pit_trend_quarterly_fresh540_entry365_top5": "PIT Trend Quarterly Fresh 540 Entry 365",
        "pit_trend_quarterly_fresh540_entry450_top5": "PIT Trend Quarterly Fresh 540 Entry 450",
        "pit_trend_quarterly_fresh540_entry365_vol50_top5": "PIT Trend Quarterly Fresh 540 Entry 365 50% Vol Cap",
        "pit_trend_quarterly_fresh540_rank15_top5": "PIT Trend Quarterly Fresh 540 Rank 15",
        "pit_trend_quarterly_fresh540_rank25_top5": "PIT Trend Quarterly Fresh 540 Rank 25",
        "pit_trend_quarterly_fresh540_runwinners_top5": "PIT Trend Quarterly Fresh 540 Run Winners",
        "pit_trend_quarterly_fresh540_runwinners_vol50_top5": "PIT Trend Quarterly Fresh 540 Run Winners 50% Vol Cap",
        "pit_trend_quarterly_fresh540_runwinners_top3": "PIT Trend Quarterly Fresh 540 Run Winners Top 3",
        "pit_trend_quarterly_fresh540_runwinners_top7": "PIT Trend Quarterly Fresh 540 Run Winners Top 7",
        "pit_trend_quarterly_fresh540_runwinners_feb_top5": "PIT Trend Quarterly Fresh 540 Run Winners Feb Cycle",
        "pit_trend_quarterly_fresh540_runwinners_mar_top5": "PIT Trend Quarterly Fresh 540 Run Winners Mar Cycle",
        "pit_trend_quarterly_fresh540_runwinners_slip25_top5": "PIT Trend Quarterly Fresh 540 Run Winners Slip 25",
        "pit_trend_quarterly_fresh540_runwinners_slip50_top5": "PIT Trend Quarterly Fresh 540 Run Winners Slip 50",
        "pit_trend_quarterly_fresh540_runwinners_cap40_top5": "PIT Trend Quarterly Fresh 540 Run Winners 40% Cap",
        "pit_trend_quarterly_fresh540_runwinners_cap35_top5": "PIT Trend Quarterly Fresh 540 Run Winners 35% Cap",
        "pit_trend_quarterly_fresh540_runwinners_soft45_top5": "PIT Trend Quarterly Fresh 540 Run Winners Soft 45% Cap",
        "pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5": "PIT Trend Quarterly Fresh 540 Run Winners 50% Vol + 40% Cap",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5": "PIT Trend Quarterly Fresh 540 Run Winners Weekly 45% Cap",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_top5": "PIT Trend Quarterly Fresh 540 Run Winners Daily 45% Cap",
        "pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5": "PIT Trend Quarterly Fresh 540 Run Winners 50% Vol + Weekly 45% Cap",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5": "PIT Trend Quarterly Fresh 540 Run Winners Weekly 50% Cap",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5": "PIT Trend Quarterly Fresh 540 Run Winners Weekly 45% Cap Profit 10%",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5": "PIT Trend Quarterly Fresh 540 Run Winners Weekly 45% Cap Profit 25%",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5": "PIT Trend Quarterly Fresh 540 Run Winners Weekly 45% Cap Profit 40%",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5": "PIT Trend Quarterly Fresh 540 Run Winners Weekly 45% Cap Profit 60%",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Candidate Score",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_top5": "PIT Trend Quarterly Fresh 540 Run Winners Mixed Entry TrailTrim 20",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5": "PIT Trend Quarterly Fresh 540 Run Winners CashGate 12.5",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_partial75_top5": "PIT Trend Quarterly Fresh 540 Run Winners Partial 75",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Candidate Score Top 3",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Candidate Score Top 7",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Candidate Score Slip 25",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Candidate Score Slip 50",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Candidate Score Mid-Month Contribution",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Candidate Score Month-End Contribution",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Momentum Score",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Mid-Month Contribution",
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5": "PIT Trend Quarterly Fresh 540 Run Winners Profit 60% Month-End Contribution",
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5": "PIT Trend Quarterly Fresh 540 Run Winners Daily 45% Cap Profit 25%",
        "pit_trend_quarterly_fresh540_confirm5_top5": "PIT Trend Quarterly Fresh 540 Confirm Top 5",
        "pit_trend_quarterly_fresh540_confirm10_top5": "PIT Trend Quarterly Fresh 540 Confirm Top 10",
        "pit_trend_quarterly_fresh540_confirm10_vol50_top5": "PIT Trend Quarterly Fresh 540 Confirm Top 10 50% Vol Cap",
        "pit_trend_persist20_kodex50_top5": "PIT Trend Persist KODEX 50MA Gate",
        "pit_trend_persist20_kodex200_top5": "PIT Trend Persist KODEX 200MA Gate",
    }
    return labels.get(account_id, default_label)


def _account_catalog_sort_key(row: dict[str, Any]) -> tuple[int, float, str]:
    account_id = str(row.get("account_id") or "")
    order = {
        "all_weather": 0,
        "smic_follower": 1,
        "smic_follower_v2": 2,
        "pit_score_top3": 3,
        "pit_score_top5": 4,
        "pit_score_top10": 5,
        "pit_momentum_top5": 6,
        "pit_trend_top5": 7,
        "pit_fresh_top5": 8,
        "pit_trend_top7": 9,
        "pit_trend_stop_top5": 10,
        "pit_trend_stop_top7": 11,
        "pit_trend_rotate_top5": 12,
        "pit_trend_rotate_fast_top5": 13,
        "pit_trend_rotate_stop_top5": 14,
        "pit_trend_persist20_top5": 15,
        "pit_trend_persist30_top5": 16,
        "pit_trend_persist20_hold90_top5": 17,
        "pit_trend_persist20_top3": 18,
        "pit_trend_persist20_top7": 19,
        "pit_trend_persist20_52w10_top5": 20,
        "pit_trend_persist20_domestic_top5": 21,
        "pit_trend_persist20_score_top5": 22,
        "pit_trend_persist20_scorecap_top5": 23,
        "pit_trend_persist20_invvol_top5": 24,
        "pit_trend_persist20_invvolcap_top5": 25,
        "pit_trend_persist20_semimonthly_top5": 26,
        "pit_trend_persist20_quarterly_top5": 27,
        "pit_trend_persist30_quarterly_top5": 28,
        "pit_trend_persist20_quarterly_risk_top5": 29,
        "pit_trend_persist30_quarterly_risk_top5": 30,
        "pit_trend_persist20_quarterly_hold120_top5": 31,
        "pit_trend_quarterly_ret3_top5": 32,
        "pit_trend_quarterly_ret6_top5": 33,
        "pit_trend_quarterly_ret36_top5": 34,
        "pit_trend_quarterly_fresh365_top5": 35,
        "pit_trend_quarterly_fresh540_top5": 36,
        "pit_trend_persist20_fresh540_top5": 37,
        "pit_trend_persist20_fresh540_top3": 38,
        "pit_trend_persist20_fresh540_top7": 39,
        "pit_trend_quarterly_fresh540_top3": 40,
        "pit_trend_quarterly_fresh540_top7": 41,
        "pit_trend_quarterly_fresh540_gross_top5": 42,
        "pit_trend_quarterly_fresh540_slip25_top5": 43,
        "pit_trend_quarterly_fresh540_slip50_top5": 44,
        "pit_trend_quarterly_fresh540_feb_top5": 45,
        "pit_trend_quarterly_fresh540_mar_top5": 46,
        "pit_trend_quarterly_fresh540_cash90_top5": 47,
        "pit_trend_quarterly_fresh540_cash80_top5": 48,
        "pit_trend_quarterly_fresh540_vol35_top5": 49,
        "pit_trend_quarterly_fresh540_vol40_top5": 50,
        "pit_trend_quarterly_fresh540_vol45_top5": 51,
        "pit_trend_quarterly_fresh540_vol50_top5": 52,
        "pit_trend_quarterly_fresh540_vol55_top5": 53,
        "pit_trend_quarterly_fresh540_mar_vol45_top5": 54,
        "pit_trend_quarterly_fresh540_entry270_top5": 55,
        "pit_trend_quarterly_fresh540_entry270_vol50_top5": 56,
        "pit_trend_quarterly_fresh540_entry270_mar_top5": 57,
        "pit_trend_quarterly_fresh540_entry365_top5": 58,
        "pit_trend_quarterly_fresh540_entry450_top5": 59,
        "pit_trend_quarterly_fresh540_entry365_vol50_top5": 60,
        "pit_trend_quarterly_fresh540_rank15_top5": 61,
        "pit_trend_quarterly_fresh540_rank25_top5": 62,
        "pit_trend_quarterly_fresh540_runwinners_top5": 63,
        "pit_trend_quarterly_fresh540_runwinners_vol50_top5": 64,
        "pit_trend_quarterly_fresh540_runwinners_top3": 65,
        "pit_trend_quarterly_fresh540_runwinners_top7": 66,
        "pit_trend_quarterly_fresh540_runwinners_feb_top5": 67,
        "pit_trend_quarterly_fresh540_runwinners_mar_top5": 68,
        "pit_trend_quarterly_fresh540_runwinners_slip25_top5": 69,
        "pit_trend_quarterly_fresh540_runwinners_slip50_top5": 70,
        "pit_trend_quarterly_fresh540_runwinners_cap40_top5": 71,
        "pit_trend_quarterly_fresh540_runwinners_cap35_top5": 72,
        "pit_trend_quarterly_fresh540_runwinners_soft45_top5": 73,
        "pit_trend_quarterly_fresh540_runwinners_vol50_cap40_top5": 74,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_top5": 75,
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_top5": 76,
        "pit_trend_quarterly_fresh540_runwinners_vol50_weeklycap45_top5": 77,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap50_top5": 78,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit10_top5": 79,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit25_top5": 80,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit40_top5": 81,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_top5": 82,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top5": 83,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top3": 84,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_top7": 85,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip25_top5": 86,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_slip50_top5": 87,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_midcontrib_top5": 88,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_candidate_lastcontrib_top5": 89,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_momentum_top5": 90,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_midcontrib_top5": 91,
        "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_lastcontrib_top5": 92,
        "pit_trend_quarterly_fresh540_runwinners_dailycap45_profit25_top5": 93,
        "pit_trend_quarterly_fresh540_confirm5_top5": 94,
        "pit_trend_quarterly_fresh540_confirm10_top5": 95,
        "pit_trend_quarterly_fresh540_confirm10_vol50_top5": 96,
        "pit_trend_persist20_kodex50_top5": 97,
        "pit_trend_persist20_kodex200_top5": 98,
        "benchmark_kodex200": 99,
        "benchmark_qqq": 100,
        "benchmark_spy": 101,
        "benchmark_gld": 102,
    }
    if account_id in order:
        return (order[account_id], 0.0, account_id)
    metrics = row.get("metrics") if isinstance(row.get("metrics"), dict) else {}
    ret = _number(metrics.get("money_weighted_return")) if isinstance(metrics, dict) else None
    return (100, -(ret if ret is not None else -999.0), account_id)


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
    report_rows: list[dict[str, Any]],
    prices: pd.DataFrame | None = None,
    windows: tuple[int, ...] = (30, 60, 90, 180),
    *,
    prices_are_native: bool = False,
    price_groups: dict[str, pd.DataFrame] | None = None,
) -> list[dict[str, Any]]:
    if price_groups is None:
        if prices is None or prices.empty:
            return []
        price_groups = _price_groups_by_symbol(prices, prices_are_native=prices_are_native)
    if not price_groups:
        return []
    results: list[dict[str, Any]] = []
    for report in sorted(report_rows, key=lambda row: str(row.get("report_id"))):
        symbol = str(report.get("symbol") or "")
        group = price_groups.get(symbol)
        entry_price = _number(report.get("entry_price_krw")) or _number(report.get("publication_price_krw"))
        publication_date = _to_datetime(report.get("date"))
        window_values: dict[str, Any]
        if group is None or entry_price is None or entry_price == 0 or pd.isna(publication_date):
            window_values = {f"return_{days}d": None for days in windows}
            window_values.update({f"price_{days}d_krw": None for days in windows})
            window_values.update({f"date_{days}d": None for days in windows})
        else:
            entry_price_value = float(entry_price)
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
                window_values[f"return_{days}d"] = (
                    round((price / entry_price_value) - 1, 6) if price else None
                )
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
    *,
    prices_are_native: bool = False,
    price_groups: dict[str, pd.DataFrame] | None = None,
) -> dict[str, dict[str, Any]]:
    windows_by_id = {str(row.get("report_id")): row for row in return_windows}
    if price_groups is None:
        if prices.empty:
            return {
                str(row["report_id"]): _detail_without_prices(
                    row, windows_by_id.get(str(row["report_id"]), {})
                )
                for row in report_rows
            }
        price_groups = _price_groups_by_symbol(prices, prices_are_native=prices_are_native)
    if not price_groups:
        return {
            str(row["report_id"]): _detail_without_prices(row, windows_by_id.get(str(row["report_id"]), {}))
            for row in report_rows
        }
    details: dict[str, dict[str, Any]] = {}
    for report in sorted(report_rows, key=lambda row: str(row.get("report_id"))):
        report_id = str(report["report_id"])
        publication_date = _to_datetime(report.get("date"))
        history = price_groups.get(str(report.get("symbol") or ""))
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
            peak_row = cast(pd.Series, after_publication.loc[after_publication["close_krw"].idxmax()])
            trough_row = cast(pd.Series, after_publication.loc[after_publication["close_krw"].idxmin()])
            last_row = cast(pd.Series, after_publication.iloc[-1])
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
    bins: list[tuple[str, float, float | None]] = [
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
    upside_bins: list[tuple[str, float, float | None]] = [
        ("0-25%", 0, 0.25),
        ("25-50%", 0.25, 0.5),
        ("50-100%", 0.5, 1.0),
        ("100-200%", 1.0, 2.0),
        ("200%+", 2.0, None),
    ]
    for label, lower, upper in upside_bins:
        bucket_rows = [
            row
            for row in report_rows
            if (upside := _number(row.get("target_upside_at_pub"))) is not None
            and upside >= lower
            and (upper is None or upside < upper)
        ]
        hit_count = sum(1 for row in bucket_rows if row.get("target_hit"))
        returns = [value for row in bucket_rows if (value := _number(row.get("current_return"))) is not None]
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


def _build_report_board_candidates(report_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
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
        raw_score = (target_upside * 1.4) + max(0.0, current_return) - max(0.0, target_gap * 0.25)
        quality = _report_candidate_quality(row)
        score = raw_score - quality["penalty"]
        candidates.append(
            {
                "report_id": row.get("report_id"),
                "symbol": row.get("symbol"),
                "company": row.get("company"),
                "date": row.get("date"),
                "bucket": bucket,
                "rank_basis": rank_basis,
                "score": round(score, 6),
                "raw_score": round(raw_score, 6),
                "quality_status": quality["status"],
                "quality_basis": quality["basis"],
                "quality_penalty": quality["penalty"],
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


def _report_candidate_quality(row: dict[str, Any]) -> dict[str, Any]:
    raw_flags = row.get("caveat_flags")
    flags = [str(flag) for flag in raw_flags if flag] if isinstance(raw_flags, list) else []
    penalty = 0.0
    basis: list[str] = []
    if any(flag.startswith("extraction_review:") for flag in flags):
        penalty += 0.35
        basis.append("원문 확인 필요")
    if any(flag.startswith("price_scale_adjusted") for flag in flags):
        penalty += 0.25
        basis.append("가격 스케일 보정")
    if "entry_price_native_inferred" in flags:
        penalty += 0.15
        basis.append("발간가 추정")
    status = "review" if penalty else "verified"
    return {
        "status": status,
        "basis": basis or ["검증됨"],
        "penalty": round(penalty, 6),
    }


def _date_diff_days(start: str, end: str) -> int | None:
    if not start or not end:
        return None
    try:
        return (pd.Timestamp(end).date() - pd.Timestamp(start).date()).days
    except (TypeError, ValueError):
        return None


def _counts_by_key(rows: list[Any], key: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        value = str(row.get(key) or "unclassified")
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))


def _missing_symbol_rows(missing_symbols: list[str], reports: pd.DataFrame) -> list[dict[str, Any]]:
    if reports.empty or "symbol" not in reports.columns:
        report_lookup: dict[str, dict[str, Any]] = {}
    else:
        report_lookup = {
            str(row.get("symbol", "")): row for row in reports.to_dict(orient="records") if row.get("symbol")
        }

    rows: list[dict[str, Any]] = []
    for symbol in missing_symbols:
        report = report_lookup.get(symbol, {})
        classification = MISSING_PRICE_CLASSIFICATIONS.get(
            symbol,
            {
                "category": "unclassified",
                "action": "가격 소스, symbol mapping, 리포트 제외 여부를 수동 검토하세요.",
                "decision": "manual_review",
                "release_status": "action_required",
            },
        )
        rows.append(
            {
                "symbol": symbol,
                "company": _clean(report.get("company")) if report else "",
                "report_id": _clean(report.get("report_id")) if report else "",
                "category": classification["category"],
                "decision": classification["decision"],
                "release_status": classification["release_status"],
                "action": classification["action"],
            }
        )
    return rows


def _build_data_quality(
    extraction_quality: dict[str, Any],
    missing_symbols: list[dict[str, Any]],
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
        "missing_symbols": missing_symbols,
        "coverage": {
            "warehouse_reports": len(report_ids),
            "report_performance_rows": len(performance_ids),
            "reports_without_performance": len(report_ids - performance_ids),
        },
    }


def _write_download_csvs(
    out: Path,
    report_rows: list[dict[str, Any]],
    data_quality: dict[str, Any],
    account_catalog: list[dict[str, Any]],
) -> None:
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
        "last_close_native",
        "last_close_date",
        "current_return",
        "peak_return",
        "trough_return",
        "target_gap_pct",
        "target_remaining_pct",
        "target_progress_pct",
        "caveat_flags",
        "pdf_url",
    ]
    report_download_rows = []
    for row in report_rows:
        csv_row = {column: row.get(column) for column in report_columns}
        csv_row["caveat_flags"] = "|".join(row.get("caveat_flags", []))
        report_download_rows.append(csv_row)
    _write_csv(out / "table-download-reports.csv", report_download_rows, report_columns)

    account_rows = _account_download_rows(account_catalog)
    account_columns = sorted({key for row in account_rows for key in row}) if account_rows else ["account_id"]
    preferred_account_columns = [
        "account_id",
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
    account_columns = [
        *[column for column in preferred_account_columns if column in account_columns],
        *[column for column in account_columns if column not in preferred_account_columns],
    ]
    _write_csv(out / "table-download-accounts.csv", account_rows, account_columns)

    quality_rows = [
        {"section": "coverage", "metric": metric, "value": value}
        for metric, value in data_quality.get("coverage", {}).items()
    ]
    quality_rows.extend(
        {
            "section": "missing_symbol",
            "metric": row.get("symbol"),
            "value": f"{row.get('release_status')}:{row.get('decision')}:{row.get('category')}",
        }
        for row in data_quality.get("missing_symbols", [])
    )
    _write_csv(out / "data-quality-download.csv", quality_rows, ["section", "metric", "value"])


def _account_download_rows(account_catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "account_id": row.get("account_id"),
            "label": row.get("label"),
            "kind": row.get("kind"),
            "final_equity_krw": (row.get("metrics") or {}).get("final_equity_krw"),
            "final_cash_krw": (row.get("metrics") or {}).get("final_cash_krw"),
            "final_holdings_value_krw": (row.get("metrics") or {}).get("final_holdings_value_krw"),
            "money_weighted_return": (row.get("metrics") or {}).get("money_weighted_return"),
            "sharpe": (row.get("metrics") or {}).get("sharpe"),
            "sortino": (row.get("metrics") or {}).get("sortino"),
            "cagr": (row.get("metrics") or {}).get("cagr"),
            "max_drawdown": (row.get("metrics") or {}).get("max_drawdown"),
            "trade_count": (row.get("metrics") or {}).get("trade_count"),
            "open_positions": (row.get("metrics") or {}).get("open_positions"),
        }
        for row in account_catalog
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


def _write_price_artifacts(
    prices: pd.DataFrame,
    symbols: set[str],
    prices_out: Path,
    *,
    prices_are_native: bool = False,
) -> None:
    if prices.empty:
        for symbol in sorted(str(symbol) for symbol in symbols):
            _write_machine_json(
                prices_out / f"{symbol}.json",
                {"symbol": symbol, "currency": "KRW", "missing_price": True, "prices": []},
            )
        return
    filtered = prices if prices_are_native else _price_frame_with_native(prices)
    filtered = filtered[filtered["symbol"].astype(str).isin(symbols)].copy()
    filtered.sort_values(["symbol", "date"], inplace=True)
    written: set[str] = set()
    for symbol_key, group in filtered.groupby("symbol", sort=True):
        symbol = str(symbol_key)
        written.add(symbol)
        split_series = (
            pd.to_numeric(group["stock_split"], errors="coerce").fillna(0)
            if "stock_split" in group
            else pd.Series(0, index=group.index)
        )
        has_split_history = split_series.ne(0).any()
        rows = []
        for row in group.to_dict(orient="records"):
            price_row = {
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
            if has_split_history:
                optional_fields = {
                    "stock_split": _number(row.get("stock_split")),
                    "split_event_type": row.get("split_event_type")
                    if row.get("split_event_type") != "none"
                    else None,
                    "split_ratio_text": row.get("split_ratio_text")
                    if row.get("split_ratio_text") != "none"
                    else None,
                    "split_factor": _number(row.get("split_factor")),
                    "cum_split_factor_to_latest": _number(row.get("cum_split_factor_to_latest")),
                    "split_adjusted_open": _number(row.get("split_adjusted_open_native")),
                    "split_adjusted_high": _number(row.get("split_adjusted_high_native")),
                    "split_adjusted_low": _number(row.get("split_adjusted_low_native")),
                    "split_adjusted_close": _number(row.get("split_adjusted_close_native")),
                    "split_adjusted_close_krw": _round_number(row.get("split_adjusted_close_krw")),
                    "split_adjusted_volume": _number(row.get("split_adjusted_volume")),
                }
                price_row.update({key: value for key, value in optional_fields.items() if value is not None})
            rows.append(price_row)
        currency = str(group.iloc[-1].get("currency") or "KRW")
        _write_machine_json(
            prices_out / f"{symbol}.json", {"symbol": symbol, "currency": currency, "prices": rows}
        )
    for symbol in sorted(str(symbol) for symbol in {str(symbol) for symbol in symbols} - written):
        _write_machine_json(
            prices_out / f"{symbol}.json",
            {"symbol": symbol, "currency": "KRW", "missing_price": True, "prices": []},
        )
