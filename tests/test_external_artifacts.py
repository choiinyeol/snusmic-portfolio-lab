from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from snusmic_pipeline.web.artifacts import ExportInputs, ExternalArtifactManager
from snusmic_pipeline.web.contracts import ArtifactManifest


def test_external_artifact_manager_offloads_eligible_shards(tmp_path: Path) -> None:
    out = tmp_path / "web"
    external_dir = tmp_path / "external"
    manager = ExternalArtifactManager.from_inputs(
        ExportInputs(out=out, external_artifact_dir=external_dir, external_artifact_url_root="https://cdn.example.com/root")
    )

    manager.write_json(
        "portfolio/equity/sample.json",
        {"dates": ["2024-01-01"], "series": [{"account_id": "a", "equity_krw": [1], "cumulative_return": [0.1]}]},
        compact=True,
    )

    assert not (out / "portfolio" / "equity" / "sample.json").exists()
    assert (external_dir / "portfolio" / "equity" / "sample.json").exists()
    pointer = manager.pointers["portfolio/equity/sample.json"]
    assert pointer.public_url == "https://cdn.example.com/root/portfolio/equity/sample.json"
    assert pointer.row_count == 1


def test_external_artifact_manager_requires_public_root_when_enabled(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="external_artifact_url_root"):
        ExternalArtifactManager.from_inputs(ExportInputs(out=tmp_path / "web", external_artifact_dir=tmp_path / "external"))


def test_external_artifact_manager_keeps_noneligible_local(tmp_path: Path) -> None:
    out = tmp_path / "web"
    manager = ExternalArtifactManager.from_inputs(ExportInputs(out=out))

    manager.write_json("overview.json", {"hello": "world"}, compact=False)

    assert (out / "overview.json").exists()
    assert manager.pointers == {}


def test_manifest_allows_external_artifacts_without_local_overlap() -> None:
    manifest = ArtifactManifest.model_validate(
        {
            "schema_version": "1.0.0",
            "generated_at": None,
            "artifact_root": "data/web",
            "report_range": {"start": "2024-01-01", "end": "2024-01-31"},
            "price_range": {"start": "2024-01-01", "end": "2024-01-31"},
            "simulation_range": {"start": "2024-01-01", "end": "2024-01-31"},
            "row_counts": {"equity_daily": 10},
            "data_quality": {"total_reports": 1},
            "artifacts": ["portfolio/equity/index.json", "prices/AAA.json"],
            "external_artifacts": {
                "portfolio/equity/account.json": {
                    "storage_key": "portfolio/equity/account.json",
                    "checksum": "abc",
                    "size_bytes": 123,
                    "row_count": 10,
                    "public_url": "https://cdn.example.com/account.json",
                }
            },
            "price_artifact_count": 1,
            "checksums": {"portfolio/equity/index.json": "def", "prices/AAA.json": "ghi"},
        }
    )

    assert "portfolio/equity/account.json" in manifest.external_artifacts


def test_manifest_rejects_unsafe_external_paths() -> None:
    payload = {
        "schema_version": "1.0.0",
        "generated_at": None,
        "artifact_root": "data/web",
        "report_range": {"start": "2024-01-01", "end": "2024-01-31"},
        "price_range": {"start": "2024-01-01", "end": "2024-01-31"},
        "simulation_range": {"start": "2024-01-01", "end": "2024-01-31"},
        "row_counts": {"equity_daily": 10},
        "data_quality": {"total_reports": 1},
        "artifacts": ["portfolio/equity/index.json", "prices/AAA.json"],
        "external_artifacts": {
            "../escape.json": {
                "storage_key": "../escape.json",
                "checksum": "abc",
                "size_bytes": 123,
                "row_count": 10,
                "public_url": "https://cdn.example.com/escape.json",
            }
        },
        "price_artifact_count": 1,
        "checksums": {"portfolio/equity/index.json": "def", "prices/AAA.json": "ghi"},
    }

    windows_payload = {**payload}
    windows_payload["external_artifacts"] = {
        "portfolio/equity/account.json": {
            "storage_key": "C:\\\\tmp\\\\escape.json",
            "checksum": "abc",
            "size_bytes": 123,
            "row_count": 10,
            "public_url": "https://cdn.example.com/escape.json",
        }
    }

    with pytest.raises(ValidationError):
        ArtifactManifest.model_validate(windows_payload)
    with pytest.raises(ValidationError):
        ArtifactManifest.model_validate(payload)
