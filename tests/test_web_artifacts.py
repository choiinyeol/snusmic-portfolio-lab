from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

import snusmic_pipeline.web.artifacts as web_artifacts
from snusmic_pipeline.sim.contracts import SimulationConfig
from snusmic_pipeline.sim.forward_runner import run_daily_forward
from snusmic_pipeline.web.artifacts import (
    ExportInputs,
    _write_price_artifacts,
    check_web_artifacts,
    export_web_artifacts,
)


@pytest.mark.slow
@pytest.mark.contract
def test_export_web_artifacts_matches_baseline_counts(tmp_path: Path) -> None:
    out = tmp_path / "web"
    result = export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    overview = json.loads((out / "overview.json").read_text(encoding="utf-8"))
    assert overview["report_counts"] == {
        "excluded_downside_target": 5,
        "excluded_instant_target_hit": 1,
        "excluded_missing_performance": 0,
        "excluded_missing_price": 5,
        "excluded_non_positive_upside": 8,
        "excluded_reports": 19,
        "excluded_sell_opinion": 0,
        "extracted_reports": 221,
        "missing_price_symbols": 5,
        "price_matched_reports": 202,
        "report_stat_rows": 221,
        "web_report_rows": 202,
    }
    assert result["missing_symbols"] == ["003410.KS", "010620.KS", "287410.KQ", "NETI", "VTNR"]


@pytest.mark.slow
@pytest.mark.contract
def test_reports_artifact_contains_be_h_symbol_fix(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    be_h = [row for row in reports if row["company"] == "비에이치"]
    assert len(be_h) == 1
    assert be_h[0]["symbol"] == "090460.KS"
    assert be_h[0]["report_id"] == "6615fd1894ed9c54"


@pytest.mark.slow
@pytest.mark.contract
def test_check_web_artifacts_requires_deterministic_json(tmp_path: Path) -> None:
    out = tmp_path / "web"
    result = check_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    assert (out / "overview.json").exists()
    assert (out / "prices" / "090460.KS.json").exists()
    assert result["artifact_count"] > 8


@pytest.mark.slow
@pytest.mark.contract
def test_daily_decision_artifacts_expose_checkpoint_metadata(tmp_path: Path) -> None:
    sim = tmp_path / "sim"
    out = tmp_path / "web"
    base = SimulationConfig(
        start_date=pd.Timestamp("2021-01-04").date(), end_date=pd.Timestamp("2021-02-10").date()
    )
    accounts = tuple(account_id for account_id in base.accounts if account_id.account_id != "weak_oracle")
    config = base.model_copy(update={"accounts": accounts})
    run_daily_forward(config, Path("data/warehouse"), sim)

    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=sim,
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    raw = json.loads((out / "daily-decisions.json").read_text(encoding="utf-8"))
    compact = json.loads((out / "portfolio" / "daily-decisions.json").read_text(encoding="utf-8"))

    assert raw["metadata"]["run_mode"] == "full_replay"
    assert raw["metadata"]["checkpoint_date"] == "2021-02-10"
    assert raw["metadata"]["checkpoint_schema_version"] == "1.0.0"
    assert raw["metadata"]["source_fingerprint"]
    assert compact["metadata"] == raw["metadata"]
    assert compact["rows"]


def test_price_artifacts_preserve_split_diagnostics(tmp_path: Path) -> None:
    prices_out = tmp_path / "prices"
    prices_out.mkdir()
    prices = pd.DataFrame(
        [
            {
                "date": "2024-01-02",
                "symbol": "SPLT",
                "open": 400.0,
                "high": 420.0,
                "low": 390.0,
                "close": 400.0,
                "volume": 10.0,
                "stock_split": 4.0,
                "split_event_type": "split",
                "split_ratio_text": "4-for-1",
                "split_factor": 4.0,
                "cum_split_factor_to_latest": 4.0,
                "split_adjusted_open": 100.0,
                "split_adjusted_high": 105.0,
                "split_adjusted_low": 97.5,
                "split_adjusted_close": 100.0,
                "split_adjusted_volume": 40.0,
                "source_currency": "KRW",
                "display_currency": "KRW",
                "krw_per_unit": 1.0,
            }
        ]
    )

    _write_price_artifacts(prices, {"SPLT"}, prices_out)

    artifact = json.loads((prices_out / "SPLT.json").read_text(encoding="utf-8"))
    point = artifact["prices"][0]
    assert point["stock_split"] == 4.0
    assert point["split_event_type"] == "split"
    assert point["split_ratio_text"] == "4-for-1"
    assert point["split_factor"] == 4.0
    assert point["cum_split_factor_to_latest"] == 4.0
    assert point["split_adjusted_close"] == 100.0
    assert point["split_adjusted_close_krw"] == 100.0
    assert point["split_adjusted_volume"] == 40.0


@pytest.mark.slow
@pytest.mark.contract
def test_extended_web_artifacts_support_insights_and_downloads(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    insights = json.loads((out / "insights.json").read_text(encoding="utf-8"))
    overview_insights = json.loads((out / "overview" / "research-pulse.json").read_text(encoding="utf-8"))
    detail_metrics = json.loads((out / "report-detail-metrics.json").read_text(encoding="utf-8"))
    page_detail_metrics = json.loads((out / "reports" / "detail-metrics.json").read_text(encoding="utf-8"))
    return_windows = json.loads((out / "return-windows.json").read_text(encoding="utf-8"))
    page_return_windows = json.loads((out / "reports" / "return-windows.json").read_text(encoding="utf-8"))
    target_distribution = json.loads((out / "target-hit-distribution.json").read_text(encoding="utf-8"))
    page_target_distribution = json.loads(
        (out / "reports" / "target-hit-distribution.json").read_text(encoding="utf-8")
    )
    rankings = json.loads((out / "report-rankings.json").read_text(encoding="utf-8"))
    page_rankings = json.loads((out / "reports" / "rankings.json").read_text(encoding="utf-8"))
    screener_candidates = json.loads((out / "screener" / "candidates.json").read_text(encoding="utf-8"))

    assert len(insights) >= 6
    assert overview_insights == insights
    assert "6615fd1894ed9c54" in detail_metrics
    assert detail_metrics["6615fd1894ed9c54"]["markers"]
    assert page_detail_metrics == detail_metrics
    assert len(return_windows) == 202
    assert page_return_windows == return_windows
    assert {"return_30d", "return_60d", "return_90d", "return_180d"} <= set(return_windows[0])
    assert target_distribution["summary"]["total_reports"] == 202
    assert page_target_distribution == target_distribution
    data_quality = json.loads((out / "overview" / "data-quality.json").read_text(encoding="utf-8"))
    assert data_quality["report_exclusions"] == {
        "downside_target": 5,
        "excluded_reports": 19,
        "included_reports": 202,
        "instant_target_hit": 1,
        "missing_performance": 0,
        "missing_price": 5,
        "non_positive_upside": 8,
        "sell_opinion": 0,
        "source_reports": 221,
    }
    assert rankings["fastest_hits"]
    assert rankings["best_current_returns"]
    assert page_rankings == rankings
    assert screener_candidates
    assert (out / "table-download-reports.csv").read_text(encoding="utf-8").startswith("report_id,date")
    assert (out / "table-download-accounts.csv").read_text(encoding="utf-8").startswith("account_id,label")
    assert (out / "data-quality-download.csv").read_text(encoding="utf-8").startswith("section,metric,value")


@pytest.mark.slow
@pytest.mark.contract
def test_manifest_records_snapshot_lineage_counts_and_checksums(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    warehouse_prices = pd.read_csv(Path("data/warehouse") / "daily_prices.csv", usecols=["date"])
    assert manifest["schema_version"] == "1.0.0"
    assert manifest["artifact_root"] == "data/web"
    assert manifest["report_range"] == {"start": "2020-12-05", "end": "2026-05-06"}
    assert manifest["price_range"] == {
        "start": warehouse_prices["date"].astype(str).min(),
        "end": warehouse_prices["date"].astype(str).max(),
    }
    assert manifest["row_counts"]["reports"] == 202
    expected_accounts = len(pd.read_csv(Path("data/sim") / "summary.csv"))
    assert manifest["row_counts"]["accounts"] == expected_accounts
    assert manifest["row_counts"]["account_catalog"] == expected_accounts
    assert manifest["row_counts"]["screener_candidates"] > 0
    assert manifest["data_quality"]["reports_with_prices"] == 202
    assert manifest["data_quality"]["missing_price_symbols"] == 5
    assert "overview/snapshot.json" in manifest["artifacts"]
    assert "portfolio/holdings.json" in manifest["artifacts"]
    assert "reports/table.json" in manifest["artifacts"]
    assert "accounts/catalog.json" in manifest["artifacts"]
    assert "screener/candidates.json" in manifest["artifacts"]
    assert "reports.json" in manifest["artifacts"]
    assert "prices/QQQ.json" in manifest["artifacts"]
    assert len(manifest["checksums"]["prices/QQQ.json"]) == 64
    assert len(manifest["checksums"]["reports/table.json"]) == 64
    assert len(manifest["checksums"]["reports.json"]) == 64


def test_export_web_artifacts_keeps_existing_output_when_staged_validation_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    out = tmp_path / "web"
    out.mkdir()
    sentinel = out / "sentinel.json"
    sentinel.write_text('{"ok": true}\n', encoding="utf-8")

    def broken_export(inputs: ExportInputs) -> dict[str, object]:
        inputs.out.mkdir(parents=True, exist_ok=True)
        (inputs.out / "overview.json").write_text("{}", encoding="utf-8")
        return {"out": str(inputs.out), "artifacts": ["overview.json"]}

    monkeypatch.setattr(web_artifacts, "_export_web_artifacts_unchecked", broken_export)

    with pytest.raises(RuntimeError, match="Missing required web artifacts"):
        export_web_artifacts(ExportInputs(out=out))

    assert sentinel.exists()
    assert json.loads(sentinel.read_text(encoding="utf-8")) == {"ok": True}


@pytest.mark.slow
@pytest.mark.contract
def test_account_catalog_has_no_retired_generated_account_accounts(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    catalog = json.loads((out / "accounts" / "catalog.json").read_text(encoding="utf-8"))
    account_ids = {str(row.get("account_id") or "") for row in catalog}
    assert not {
        item
        for item in account_ids
        if item.startswith(("stock_rule_", "pit_research_board_", "smic_mtt_strategy"))
    }

    csv_text = (out / "table-download-accounts.csv").read_text(encoding="utf-8")
    assert "SMIC MTT Strategy" not in csv_text
    assert "smic_mtt_strategy" not in csv_text
    assert "stock_rule_" not in csv_text
    assert "pit_research_board_" not in csv_text


@pytest.mark.slow
@pytest.mark.contract
def test_optional_monthly_holdings_drop_retired_strategy_accounts(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    valid_accounts = set(pd.read_csv(Path("data/sim") / "summary.csv")["account_id"].astype(str))
    monthly = json.loads((out / "portfolio" / "monthly-holdings.json").read_text(encoding="utf-8"))
    columns = monthly["columns"]
    account_index = columns.index("account_id")
    exported_accounts = {str(row[account_index]) for row in monthly["rows"]}
    assert exported_accounts <= valid_accounts


@pytest.mark.slow
@pytest.mark.contract
def test_holdings_artifact_exposes_native_currency_for_foreign_positions(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    holdings = json.loads((out / "current-holdings.json").read_text(encoding="utf-8"))
    # Daily rebalance + stop-loss rotates specific foreign symbols in and out;
    # the contract is "USD holdings expose native + KRW price", so pick whatever
    # USD holding is currently in the book.
    usd_holdings = [row for row in holdings if row["currency"] == "USD"]
    assert usd_holdings, "expected at least one USD-denominated holding"
    for row in usd_holdings:
        assert row["last_close_native"] is not None and 0 < row["last_close_native"] < 5_000
        assert row["last_close_krw"] is not None and row["last_close_krw"] > 1_000
    qqq = next((row for row in holdings if row["symbol"] == "QQQ"), None)
    assert qqq is not None, "QQQ should always be held by the all_weather account_id"
    assert qqq["currency"] == "USD"
    assert qqq["last_close_native"] < 1_000
    assert qqq["last_close_krw"] > 100_000


@pytest.mark.slow
@pytest.mark.contract
def test_price_artifacts_keep_asset_prices_native_and_krw_for_valuation_only(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    camt_prices = json.loads((out / "prices" / "CAMT.json").read_text(encoding="utf-8"))
    latest = camt_prices["prices"][-1]
    assert camt_prices["currency"] == "USD"
    assert latest["currency"] == "USD"
    assert 100 < latest["close"] < 1_000
    assert latest["close_krw"] > 100_000
    assert latest["close_krw"] / latest["close"] > 1_000

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    camt = next(row for row in reports if row["symbol"] == "CAMT")
    assert camt["currency"] == "USD"
    assert camt["entry_price_native"] == 176.51
    assert 100 < camt["target_price_native"] < 1_000
    assert camt["target_price_krw"] > 100_000
    assert camt["target_hit"] is False
    assert camt["target_hit_date"] is None


@pytest.mark.slow
@pytest.mark.contract
def test_report_performance_scales_weekend_publication_target_to_first_actionable_close(
    tmp_path: Path,
) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    performance = pd.read_csv(Path("data/sim") / "report_performance.csv")
    eb = performance[performance["symbol"].astype(str).eq("353810.KQ")].iloc[0]
    assert eb["report_id"] == "7e687ca6a743eff4"
    assert eb["entry_price_krw"] == pytest.approx(5379.9463)
    assert eb["target_price_krw"] == pytest.approx(7231.4862)
    assert eb["target_upside_at_pub"] == pytest.approx(0.3442)

    csv_text = (out / "table-download-reports.csv").read_text(encoding="utf-8")
    assert "7e687ca6a743eff4" not in csv_text


@pytest.mark.slow
@pytest.mark.contract
def test_reports_artifact_excludes_target_below_entry_rows(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    assert all(row["symbol"] != "476830.KQ" for row in reports)


@pytest.mark.slow
@pytest.mark.contract
def test_reports_artifact_infers_native_entry_for_foreign_report_display_ssot(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    sxt = next(row for row in reports if row["symbol"] == "SXT")
    assert sxt["currency"] == "USD"
    assert sxt["display_currency"] == "USD"
    assert sxt["target_direction"] == "upside"
    assert sxt["target_price_native"] == 238.0
    upside = sxt["target_upside_at_pub"]
    assert upside is not None and upside > 1.0
    assert sxt["entry_price_native"] == pytest.approx(238.0 / (1.0 + upside))
    assert sxt["entry_price_krw"] > 100_000
    assert "entry_price_native_inferred" in sxt["caveat_flags"]


@pytest.mark.slow
@pytest.mark.contract
def test_reports_artifact_populates_native_entry_for_krw_rows(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    krw_rows = [row for row in reports if row["currency"] == "KRW" and row["entry_price_krw"] is not None]
    assert krw_rows
    # KRW reports populate native entry directly (no FX conversion). The
    # exact value comes from the extracted report_current_price when the
    # PDF stated one, falling back to the simulator's publication-day entry.
    assert all(row["entry_price_native"] is not None and row["entry_price_native"] > 0 for row in krw_rows)


@pytest.mark.slow
@pytest.mark.contract
def test_reports_download_csv_carries_display_price_ssot_fields(tmp_path: Path) -> None:
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    header = (out / "table-download-reports.csv").read_text(encoding="utf-8").splitlines()[0].split(",")
    assert "currency" in header
    assert "display_currency" in header
    assert "entry_price_native" in header
    assert "target_price_native" in header
    assert "target_direction" in header


@pytest.mark.slow
@pytest.mark.contract
def test_reports_artifact_freezes_expired_report_at_pub_plus_730d(tmp_path: Path) -> None:
    """A report past its 730-day window must be flagged expired and have its
    current_return frozen at the close on (or just before) expiry — not today.
    Fixture: 노바텍 (285490.KQ), pub 2021-01-16 → expiry 2023-01-16."""
    out = tmp_path / "web"
    export_web_artifacts(
        ExportInputs(
            warehouse=Path("data/warehouse"),
            sim=Path("data/sim"),
            out=out,
            extraction_quality=Path("data/extraction_quality.json"),
        )
    )

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    novatek = next(row for row in reports if row["symbol"] == "285490.KQ")
    assert novatek["expired"] is True
    assert novatek["expiry_date"] == "2023-01-16"
    assert novatek["target_hit"] is False
    # last_close_date is capped at expiry_date (or the prior trading day if
    # the expiry itself was a holiday). In either case, it must not extend
    # past expiry — that would mean the freeze contract is broken.
    assert novatek["last_close_date"] is not None
    assert novatek["last_close_date"] <= "2023-01-16"
    # Frozen current_return should be deterministic (driven by sim CSV) and
    # bounded — sanity-check it lives in the negative half-plane (the report
    # underperformed) and is the same value re-exposed via current_return.
    assert novatek["current_return"] is not None
    assert novatek["current_return"] < 0
    expected = (
        novatek["last_close_krw"] / novatek["entry_price_krw"] - 1 if novatek["entry_price_krw"] else None
    )
    assert expected is not None
    assert novatek["current_return"] == pytest.approx(expected, abs=0.01)
