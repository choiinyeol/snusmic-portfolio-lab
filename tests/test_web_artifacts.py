from __future__ import annotations

import json
from pathlib import Path

import pytest

from snusmic_pipeline.web_artifacts import ExportInputs, check_web_artifacts, export_web_artifacts


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
        "extracted_reports": 221,
        "missing_price_symbols": 5,
        # 215 = 221 minus the 5 missing-from-warehouse symbols and WOLF, whose
        # 730-day expiry window (2022-11-25 → 2024-11-25) yields no first-close
        # match in the price board after the issuer's late-2024 delisting.
        "price_matched_reports": 215,
        "report_stat_rows": 221,
        "web_report_rows": 221,
    }
    assert result["missing_symbols"] == ["003410.KS", "010620.KS", "287410.KQ", "NETI", "VTNR"]


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
    detail_metrics = json.loads((out / "report-detail-metrics.json").read_text(encoding="utf-8"))
    return_windows = json.loads((out / "return-windows.json").read_text(encoding="utf-8"))
    target_distribution = json.loads((out / "target-hit-distribution.json").read_text(encoding="utf-8"))
    rankings = json.loads((out / "report-rankings.json").read_text(encoding="utf-8"))

    assert len(insights) >= 6
    assert "6615fd1894ed9c54" in detail_metrics
    assert detail_metrics["6615fd1894ed9c54"]["markers"]
    assert len(return_windows) == 221
    assert {"return_30d", "return_60d", "return_90d", "return_180d"} <= set(return_windows[0])
    assert target_distribution["summary"]["total_reports"] == 221
    assert rankings["fastest_hits"]
    assert rankings["best_current_returns"]
    assert (out / "table-download-reports.csv").read_text(encoding="utf-8").startswith("report_id,date")
    assert (out / "table-download-strategies.csv").read_text(encoding="utf-8").startswith("run_id")
    assert (out / "data-quality-download.csv").read_text(encoding="utf-8").startswith("section,metric,value")


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
    camt = next(row for row in holdings if row["symbol"] == "CAMT")
    assert camt["currency"] == "USD"
    assert camt["last_close_native"] < 1_000
    assert camt["last_close_krw"] > 100_000
    qqq = next(row for row in holdings if row["symbol"] == "QQQ")
    assert qqq["currency"] == "USD"
    assert qqq["last_close_native"] < 1_000
    assert qqq["last_close_krw"] > 1_000_000


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


def test_reports_artifact_uses_adjusted_target_price_when_price_scale_changed(tmp_path: Path) -> None:
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
    ezbio = next(row for row in reports if row["symbol"] == "353810.KQ")
    assert ezbio["company"] == "이지바이오"
    assert ezbio["entry_price_krw"] == pytest.approx(5379.95, abs=0.01)
    assert ezbio["target_price_krw"] == pytest.approx(7231.49, abs=0.01)
    assert ezbio["target_price"] == pytest.approx(7231.49, abs=0.01)
    assert ezbio["target_upside_at_pub"] == pytest.approx(0.34, abs=0.005)
    assert "price_scale_adjusted_target" in ezbio["caveat_flags"]

    csv_text = (out / "table-download-reports.csv").read_text(encoding="utf-8")
    assert "7e687ca6a743eff4" in csv_text
    # CSV stores the post-scale-adjustment target. The 4-digit ROUND_NDIGITS
    # leaves the leading "7231.4" intact regardless of whether the trailing
    # digits round to ".49xx" or ".48xx".
    assert "7231.4" in csv_text
    assert "103500" not in next(line for line in csv_text.splitlines() if "7e687ca6a743eff4" in line)


def test_reports_artifact_marks_target_below_entry_as_non_actionable(tmp_path: Path) -> None:
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
    rznomics = next(row for row in reports if row["symbol"] == "476830.KQ")
    assert rznomics["company"] == "알지노믹스"
    upside = rznomics["target_upside_at_pub"]
    assert upside is not None and -0.2 < upside < 0
    assert rznomics["target_hit"] is False
    assert rznomics["target_hit_date"] is None
    assert rznomics["days_to_target"] is None
    assert "target_below_entry_price" in rznomics["caveat_flags"]


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
