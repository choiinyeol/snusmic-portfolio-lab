from __future__ import annotations

import json
import os
import shutil
import subprocess
from datetime import date
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

import snusmic_pipeline.web.artifacts as web_artifacts
from snusmic_pipeline import cli
from snusmic_pipeline.web.artifacts import (
    ExportInputs,
    _validate_price_artifact_cross_references,
    _write_price_artifacts,
    check_web_artifacts,
    export_web_artifacts,
)


def _baseline_export_inputs(out: Path) -> ExportInputs:
    return ExportInputs(
        warehouse=Path("data/warehouse"),
        sim=Path("data/sim"),
        out=out,
        extraction_quality=Path("data/extraction_quality.json"),
    )


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")


def _minimal_price_cross_reference_tree(out: Path) -> None:
    artifacts = [
        "manifest.json",
        "reports.json",
        "missing-symbols.json",
        "prices/AAA.json",
        "prices/MISS.json",
    ]
    _write_json(
        out / "manifest.json",
        {
            "data_quality": {"missing_price_symbols": 1},
            "artifacts": artifacts,
            "price_artifact_count": 2,
        },
    )
    _write_json(out / "reports.json", [{"symbol": "AAA"}])
    _write_json(out / "missing-symbols.json", [{"symbol": "MISS"}])
    _write_json(out / "prices" / "AAA.json", {"symbol": "AAA", "prices": [{"date": "2024-01-02"}]})
    _write_json(out / "prices" / "MISS.json", {"symbol": "MISS", "missing_price": True, "prices": []})


@pytest.fixture(scope="module")
def web_export_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Shared full export for read-only web artifact contract assertions.

    Full web export is intentionally slow. Most tests in this module only read
    generated artifacts, so exporting once keeps the contract suite useful
    without turning every assertion into another full rebuild.
    """

    out = tmp_path_factory.mktemp("web-export") / "web"
    export_web_artifacts(_baseline_export_inputs(out))
    return out


@pytest.mark.slow
@pytest.mark.contract
def test_export_web_artifacts_matches_baseline_counts(web_export_dir: Path) -> None:
    overview = json.loads((web_export_dir / "overview.json").read_text(encoding="utf-8"))
    assert overview["report_counts"] == {
        "excluded_downside_target": 8,
        "excluded_instant_target_hit": 1,
        "excluded_missing_performance": 0,
        "excluded_missing_price": 6,
        "excluded_non_positive_upside": 8,
        "excluded_reports": 23,
        "excluded_sell_opinion": 0,
        "extracted_reports": 240,
        "missing_price_symbols": 6,
        "price_matched_reports": 217,
        "report_stat_rows": 240,
        "web_report_rows": 217,
    }
    manifest = json.loads((web_export_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["data_quality"]["missing_price_symbols"] == 6


@pytest.mark.slow
@pytest.mark.contract
def test_reports_artifact_contains_be_h_symbol_fix(web_export_dir: Path) -> None:
    reports = json.loads((web_export_dir / "reports.json").read_text(encoding="utf-8"))
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
def test_daily_decision_artifacts_expose_checkpoint_metadata(web_export_dir: Path) -> None:
    out = web_export_dir
    index = json.loads((out / "portfolio" / "daily-decisions" / "index.json").read_text(encoding="utf-8"))
    shard_path = out / index["accounts"][0]["path"]
    shard = json.loads(shard_path.read_text(encoding="utf-8"))
    source_metadata = json.loads(Path("data/sim/daily-forward-metadata.json").read_text(encoding="utf-8"))

    assert index["metadata"]["run_mode"] == "full_replay"
    assert index["metadata"]["checkpoint_date"] == source_metadata["checkpoint_date"]
    assert index["metadata"]["checkpoint_schema_version"] == "1.0.0"
    assert index["metadata"]["source_fingerprint"]
    assert shard["metadata"] == index["metadata"]
    assert shard["rows"]


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


def test_price_cross_reference_validator_accepts_consistent_tree(tmp_path: Path) -> None:
    _minimal_price_cross_reference_tree(tmp_path)

    _validate_price_artifact_cross_references(tmp_path)


def test_price_cross_reference_validator_rejects_missing_report_price(tmp_path: Path) -> None:
    _minimal_price_cross_reference_tree(tmp_path)
    (tmp_path / "prices" / "AAA.json").unlink()
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    manifest["artifacts"].remove("prices/AAA.json")
    manifest["price_artifact_count"] = 1
    _write_json(tmp_path / "manifest.json", manifest)

    with pytest.raises(RuntimeError, match="reports reference symbols without price artifacts"):
        _validate_price_artifact_cross_references(tmp_path)


def test_price_cross_reference_validator_rejects_missing_count_mismatch(tmp_path: Path) -> None:
    _minimal_price_cross_reference_tree(tmp_path)
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    manifest["data_quality"]["missing_price_symbols"] = 0
    _write_json(tmp_path / "manifest.json", manifest)

    with pytest.raises(RuntimeError, match="missing price count mismatch"):
        _validate_price_artifact_cross_references(tmp_path)


def test_price_cross_reference_validator_rejects_dual_krx_segment_artifacts(tmp_path: Path) -> None:
    _minimal_price_cross_reference_tree(tmp_path)
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    manifest["artifacts"].extend(["prices/252990.KS.json", "prices/252990.KQ.json"])
    manifest["price_artifact_count"] = 4
    _write_json(tmp_path / "manifest.json", manifest)
    _write_json(tmp_path / "prices" / "252990.KS.json", {"symbol": "252990.KS", "prices": []})
    _write_json(tmp_path / "prices" / "252990.KQ.json", {"symbol": "252990.KQ", "prices": []})

    with pytest.raises(RuntimeError, match="both KOSPI and KOSDAQ"):
        _validate_price_artifact_cross_references(tmp_path)


def test_web_artifact_ci_validator_rejects_dual_krx_segment_artifacts(tmp_path: Path) -> None:
    web_root = tmp_path / "web"
    shutil.copytree(Path("data/web"), web_root)

    source = web_root / "prices" / "090460.KS.json"
    dual = web_root / "prices" / "090460.KQ.json"
    payload = json.loads(source.read_text(encoding="utf-8"))
    payload["symbol"] = "090460.KQ"
    _write_json(dual, payload)

    manifest_path = web_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["price_artifact_count"] += 1
    _write_json(manifest_path, manifest)

    result = subprocess.run(
        ["node", "scripts/validate-artifacts.mjs"],
        cwd=Path("apps/web"),
        env={**os.environ, "SNUSMIC_WEB_ARTIFACT_ROOT": str(web_root.resolve())},
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "both KOSPI and KOSDAQ price artifacts" in result.stderr


def test_web_artifact_ci_validator_rejects_stale_price_range(tmp_path: Path) -> None:
    web_root = tmp_path / "web"
    shutil.copytree(Path("data/web"), web_root)

    result = subprocess.run(
        ["node", "scripts/validate-artifacts.mjs"],
        cwd=Path("apps/web"),
        env={
            **os.environ,
            "SNUSMIC_WEB_ARTIFACT_ROOT": str(web_root.resolve()),
            "SNUSMIC_MAX_PRICE_AGE_DAYS": "0",
        },
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "manifest price_range.end is stale" in result.stderr


def test_refresh_web_artifacts_runs_checked_export(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    warehouse = tmp_path / "warehouse"
    sim = tmp_path / "sim"
    web = tmp_path / "web"
    downloads = tmp_path / "downloads"
    quality = tmp_path / "extraction_quality.json"
    warehouse.mkdir()
    sim.mkdir()
    quality.write_text("{}", encoding="utf-8")
    (warehouse / "daily_prices.csv").write_text("date,symbol,close\n2024-01-02,AAA,1\n", encoding="utf-8")

    def fake_check(inputs: ExportInputs) -> dict[str, int]:
        assert inputs.warehouse == warehouse
        assert inputs.sim == sim
        assert inputs.out == web
        for name in (
            "table-download-reports.csv",
            "table-download-accounts.csv",
            "data-quality-download.csv",
        ):
            (inputs.out / name).parent.mkdir(parents=True, exist_ok=True)
            (inputs.out / name).write_text("id\n", encoding="utf-8")
        return {"artifact_count": 3}

    monkeypatch.setattr(
        cli,
        "run_daily_forward",
        lambda *args, **kwargs: SimpleNamespace(
            latest_date=date(2024, 1, 2),
            full_replay_reason=None,
        ),
    )
    monkeypatch.setattr(cli, "check_web_artifacts", fake_check)
    monkeypatch.setattr(
        cli,
        "export_web_artifacts",
        lambda inputs: pytest.fail("refresh-web-artifacts must run check_web_artifacts"),
    )

    result = cli.run_refresh_web_artifacts(
        SimpleNamespace(
            warehouse=warehouse,
            sim=sim,
            out=web,
            downloads=downloads,
            extraction_quality=quality,
            start="2024-01-01",
            refresh_benchmark=False,
            ignore_account_artifact=False,
        )
    )

    assert result == 0
    assert (downloads / "snusmic-reports.csv").exists()


@pytest.mark.slow
@pytest.mark.contract
def test_extended_web_artifacts_support_insights_and_downloads(web_export_dir: Path) -> None:
    out = web_export_dir

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
    report_board_candidates = json.loads(
        (out / "report-board" / "candidates.json").read_text(encoding="utf-8")
    )

    assert len(insights) >= 6
    assert overview_insights == insights
    assert "6615fd1894ed9c54" in detail_metrics
    assert detail_metrics["6615fd1894ed9c54"]["markers"]
    assert page_detail_metrics == detail_metrics
    assert len(return_windows) == 217
    assert page_return_windows == return_windows
    assert {"return_30d", "return_60d", "return_90d", "return_180d"} <= set(return_windows[0])
    assert target_distribution["summary"]["total_reports"] == 217
    assert page_target_distribution == target_distribution
    data_quality = json.loads((out / "overview" / "data-quality.json").read_text(encoding="utf-8"))
    assert data_quality["report_exclusions"] == {
        "downside_target": 8,
        "excluded_reports": 23,
        "included_reports": 217,
        "instant_target_hit": 1,
        "missing_performance": 0,
        "missing_price": 6,
        "non_positive_upside": 8,
        "sell_opinion": 0,
        "source_reports": 240,
    }
    assert rankings["fastest_hits"]
    assert rankings["best_current_returns"]
    assert page_rankings == rankings
    assert report_board_candidates
    assert (out / "table-download-reports.csv").read_text(encoding="utf-8").startswith("report_id,date")
    assert (out / "table-download-accounts.csv").read_text(encoding="utf-8").startswith("account_id,label")
    assert (out / "data-quality-download.csv").read_text(encoding="utf-8").startswith("section,metric,value")


@pytest.mark.slow
@pytest.mark.contract
def test_manifest_records_snapshot_lineage_counts_and_checksums(web_export_dir: Path) -> None:
    out = web_export_dir

    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    warehouse_prices = pd.read_csv(Path("data/warehouse") / "daily_prices.csv", usecols=["date"])
    assert manifest["schema_version"] == "1.0.0"
    assert manifest["artifact_root"] == "data/web"
    assert manifest["report_range"] == {"start": "2020-06-22", "end": "2026-05-29"}
    assert manifest["price_range"] == {
        "start": warehouse_prices["date"].astype(str).min(),
        "end": warehouse_prices["date"].astype(str).max(),
    }
    assert manifest["row_counts"]["reports"] == 217
    expected_accounts = len(pd.read_csv(Path("data/sim") / "summary.csv"))
    assert manifest["row_counts"]["accounts"] == expected_accounts
    assert manifest["row_counts"]["account_catalog"] == expected_accounts
    assert manifest["row_counts"]["report_board_candidates"] > 0
    assert manifest["data_quality"]["reports_with_prices"] == 217
    assert manifest["data_quality"]["missing_price_symbols"] == 6
    assert "overview/snapshot.json" in manifest["artifacts"]
    assert "portfolio/holdings.json" in manifest["artifacts"]
    assert "reports/table.json" in manifest["artifacts"]
    assert "accounts/catalog.json" in manifest["artifacts"]
    assert "report-board/candidates.json" in manifest["artifacts"]
    assert "reports.json" in manifest["artifacts"]
    assert "prices/QQQ.json" in manifest["artifacts"]
    assert len(manifest["checksums"]["prices/QQQ.json"]) == 64
    assert len(manifest["checksums"]["reports/table.json"]) == 64
    assert len(manifest["checksums"]["reports.json"]) == 64
    health = json.loads((out / "health.json").read_text(encoding="utf-8"))
    assert health["schema_version"] == "1.0.0"
    assert health["status"] == "review"
    assert health["as_of"] == {
        "report_date": manifest["report_range"]["end"],
        "price_date": manifest["price_range"]["end"],
        "simulation_date": manifest["simulation_range"]["end"],
    }
    assert {check["id"] for check in health["checks"]} == {
        "report_price_alignment",
        "simulation_price_alignment",
        "missing_price_symbols",
    }
    checks_by_id = {check["id"]: check for check in health["checks"]}
    assert checks_by_id["missing_price_symbols"]["severity"] == "review"
    assert checks_by_id["missing_price_symbols"]["observed"]["missing_price_symbols"] == 6
    assert checks_by_id["missing_price_symbols"]["action"]
    assert "health.json" in manifest["artifacts"]
    assert len(manifest["checksums"]["health.json"]) == 64


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
def test_account_catalog_matches_committed_account_config(web_export_dir: Path) -> None:
    out = web_export_dir

    catalog = json.loads((out / "accounts" / "catalog.json").read_text(encoding="utf-8"))
    actual_ids = [str(row.get("account_id") or "") for row in catalog]
    actual_kind_by_id = {str(row.get("account_id") or ""): str(row.get("kind") or "") for row in catalog}
    config = json.loads((Path("data/sim") / "account-configs.json").read_text(encoding="utf-8"))
    expected_ids = [str(row["account_id"]) for row in config["accounts"]]
    assert set(actual_ids) == set(expected_ids)
    assert len(actual_ids) == len(expected_ids)
    assert actual_kind_by_id == {
        account_id: "benchmark"
        if account_id == "all_weather" or account_id.startswith("benchmark_")
        else "account"
        for account_id in expected_ids
    }

    csv_rows = pd.read_csv(out / "table-download-accounts.csv")
    csv_ids = list(csv_rows["account_id"].astype(str))
    assert set(csv_ids) == set(expected_ids)
    assert len(csv_ids) == len(expected_ids)


@pytest.mark.slow
@pytest.mark.contract
def test_monthly_holdings_reference_current_account_artifact(web_export_dir: Path) -> None:
    out = web_export_dir

    valid_accounts = set(pd.read_csv(Path("data/sim") / "summary.csv")["account_id"].astype(str))
    monthly = json.loads((out / "portfolio" / "monthly-holdings.json").read_text(encoding="utf-8"))
    columns = monthly["columns"]
    account_index = columns.index("account_id")
    exported_accounts = {str(row[account_index]) for row in monthly["rows"]}
    assert exported_accounts <= valid_accounts


@pytest.mark.slow
@pytest.mark.contract
def test_trade_artifacts_carry_company_names(web_export_dir: Path) -> None:
    out = web_export_dir

    warehouse_reports = pd.read_csv(Path("data/warehouse") / "reports.csv")
    target_company = warehouse_reports.loc[
        warehouse_reports["symbol"].astype(str).eq("278470.KS"), "company"
    ].iloc[0]
    assert target_company and target_company != "278470.KS"

    raw_trades = json.loads((out / "trades.json").read_text(encoding="utf-8"))
    assert any(row["company"] == target_company for row in raw_trades if row["symbol"] == "278470.KS")
    assert all("reason_detail" in row for row in raw_trades)
    assert any(
        "후보" in row["reason_detail"]
        for row in raw_trades
        if row["reason"] == "rebalance_buy" and str(row["account_id"]).startswith("pit_trend_")
    )

    compact_trades = json.loads((out / "portfolio" / "trades.json").read_text(encoding="utf-8"))
    columns = compact_trades["columns"]
    symbol_index = columns.index("symbol")
    company_index = columns.index("company")
    assert "reason_detail" in columns
    assert any(
        row[company_index] == target_company
        for row in compact_trades["rows"]
        if row[symbol_index] == "278470.KS"
    )


@pytest.mark.slow
@pytest.mark.contract
def test_holdings_artifact_exposes_native_currency_for_foreign_positions(web_export_dir: Path) -> None:
    out = web_export_dir

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
def test_price_artifacts_keep_asset_prices_native_and_krw_for_valuation_only(web_export_dir: Path) -> None:
    out = web_export_dir

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
    web_export_dir: Path,
) -> None:
    out = web_export_dir

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
def test_reports_artifact_excludes_target_below_entry_rows(web_export_dir: Path) -> None:
    out = web_export_dir

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    assert all(row["symbol"] != "476830.KQ" for row in reports)


@pytest.mark.slow
@pytest.mark.contract
def test_reports_artifact_infers_native_entry_for_foreign_report_display_ssot(web_export_dir: Path) -> None:
    out = web_export_dir

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
def test_reports_artifact_populates_native_entry_for_krw_rows(web_export_dir: Path) -> None:
    out = web_export_dir

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    krw_rows = [row for row in reports if row["currency"] == "KRW" and row["entry_price_krw"] is not None]
    assert krw_rows
    # KRW reports populate native entry directly (no FX conversion). The
    # exact value comes from the extracted report_current_price when the
    # PDF stated one, falling back to the simulator's publication-day entry.
    assert all(row["entry_price_native"] is not None and row["entry_price_native"] > 0 for row in krw_rows)


@pytest.mark.slow
@pytest.mark.contract
def test_reports_download_csv_carries_display_price_ssot_fields(web_export_dir: Path) -> None:
    out = web_export_dir

    header = (out / "table-download-reports.csv").read_text(encoding="utf-8").splitlines()[0].split(",")
    assert "currency" in header
    assert "display_currency" in header
    assert "entry_price_native" in header
    assert "target_price_native" in header
    assert "target_direction" in header


@pytest.mark.slow
@pytest.mark.contract
def test_reports_artifact_freezes_expired_report_at_pub_plus_730d(web_export_dir: Path) -> None:
    """Expired reports keep both latest close and capped evaluation close.

    Fixture: Novatech (285490.KQ), pub 2021-01-16 -> expiry 2023-01-16.
    """
    out = web_export_dir

    reports = json.loads((out / "reports.json").read_text(encoding="utf-8"))
    novatek = next(row for row in reports if row["symbol"] == "285490.KQ")
    assert novatek["expired"] is True
    assert novatek["expiry_date"] == "2023-01-16"
    assert novatek["target_hit"] is False
    # last_close_date is the latest available close for report detail pages.
    assert novatek["last_close_date"] is not None
    assert novatek["last_close_date"] > "2023-01-16"
    assert novatek["current_return"] is not None
    assert novatek["current_return"] < 0
    expected = (
        novatek["last_close_krw"] / novatek["entry_price_krw"] - 1 if novatek["entry_price_krw"] else None
    )
    assert expected is not None
    assert novatek["current_return"] == pytest.approx(expected, abs=0.01)
    # evaluation_close_date is capped at expiry_date (or the prior trading day
    # if expiry was a holiday). This preserves the two-year evaluation window.
    assert novatek["evaluation_close_date"] is not None
    assert novatek["evaluation_close_date"] <= "2023-01-16"
    evaluation_expected = (
        novatek["evaluation_close_krw"] / novatek["entry_price_krw"] - 1
        if novatek["entry_price_krw"]
        else None
    )
    assert evaluation_expected is not None
    assert novatek["evaluation_return"] == pytest.approx(evaluation_expected, abs=0.01)
