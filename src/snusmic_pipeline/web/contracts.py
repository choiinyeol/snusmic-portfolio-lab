from __future__ import annotations

from pathlib import PurePosixPath
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, model_validator


class _ArtifactModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class WebReportRow(_ArtifactModel):
    report_id: str
    symbol: str
    company: str
    date: str
    currency: str
    display_currency: str
    target_direction: Literal["upside", "downside"] | None
    entry_price_krw: float | None
    entry_price_native: float | None
    target_price_krw: float | None
    target_price_native: float | None
    target_upside_at_pub: float | None
    target_hit: bool
    target_hit_date: str | None
    days_to_target: float | None
    last_close_krw: float | None
    last_close_native: float | None
    last_close_date: str | None
    current_return: float | None
    peak_return: float | None
    trough_return: float | None
    target_gap_pct: float | None
    evaluation_close_krw: float | None = None
    evaluation_close_date: str | None = None
    evaluation_return: float | None = None
    target_remaining_pct: float | None = None
    target_progress_pct: float | None = None
    expiry_date: str | None
    expired: bool
    caveat_flags: list[str] = Field(default_factory=list)


class WebHoldingRow(_ArtifactModel):
    account_id: str
    symbol: str
    company: str | None = None
    qty: float | None
    avg_cost_krw: float | None
    last_close_krw: float | None
    last_close_native: float | None
    currency: str | None = None
    market_value_krw: float | None
    unrealized_pnl_krw: float | None
    unrealized_return: float | None
    holding_days: float | None
    first_buy_date: str | None


class WebTradeRow(_ArtifactModel):
    account_id: str
    date: str
    symbol: str
    company: str
    side: str
    qty: float | None
    fill_price_krw: float | None
    gross_krw: float | None
    realized_pnl_krw: float | None = None
    cash_after_krw: float | None
    reason: str
    reason_detail: str | None = None
    report_id: str | None = None


class WebReportCounts(_ArtifactModel):
    extracted_reports: int | None = None
    web_report_rows: int | None = None
    price_matched_reports: int | None = None
    excluded_reports: int | None = None
    excluded_missing_price: int | None = None
    excluded_missing_performance: int | None = None
    excluded_sell_opinion: int | None = None
    excluded_non_positive_upside: int | None = None
    excluded_downside_target: int | None = None
    excluded_instant_target_hit: int | None = None


class AccountCatalogContext(_ArtifactModel):
    role: str
    category: str
    title: str
    subtitle: str
    comparison_prompt: str
    shortlist_reason: str | None = None


class AccountCatalogMetrics(_ArtifactModel):
    final_equity_krw: float | None
    final_cash_krw: float | None
    final_holdings_value_krw: float | None
    money_weighted_return: float | None
    cagr: float | None
    max_drawdown: float | None
    trade_count: float | None
    open_positions: float | None


class AccountCatalogRow(_ArtifactModel):
    account_id: str
    label: str
    short_label: str
    kind: Literal["benchmark", "account", "oracle"]
    benchmark_group: str | None
    is_selectable: bool
    shortlist_priority: int | None
    is_default_candidate: bool
    objective_passed: bool
    objective_return_excess: float | None
    objective_mdd_slack: float | None
    context: AccountCatalogContext
    metrics: AccountCatalogMetrics


class WebOverview(_ArtifactModel):
    generated_from: dict[str, str] | None = None
    report_counts: WebReportCounts | None = None
    target_stats: dict[str, float | None] | None = None
    baseline_accounts: list[dict[str, Any]]
    simulation_window: dict[str, str | None] | None = None


class ArtifactRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: str | None
    end: str | None


class ExternalArtifactPointer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    storage_key: str
    checksum: str
    size_bytes: int
    row_count: int | None = None
    public_url: str

    @model_validator(mode="after")
    def _check_storage_key(self) -> ExternalArtifactPointer:
        if "\\" in self.storage_key or self.storage_key.startswith("//") or (
            len(self.storage_key) >= 2 and self.storage_key[1] == ":"
        ):
            raise ValueError(f"external storage_key must use safe POSIX separators: {self.storage_key}")
        key = PurePosixPath(self.storage_key)
        if key.is_absolute() or ".." in key.parts:
            raise ValueError(f"external storage_key must be a safe POSIX-relative path: {self.storage_key}")
        return self


class ArtifactManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0.0"]
    generated_at: str | None
    artifact_root: str
    report_range: ArtifactRange
    price_range: ArtifactRange
    simulation_range: ArtifactRange
    row_counts: dict[str, int]
    data_quality: dict[str, int | float | None]
    artifacts: list[str]
    external_artifacts: dict[str, ExternalArtifactPointer] = {}
    price_artifact_count: int
    checksums: dict[str, str]

    @model_validator(mode="after")
    def _check_artifact_integrity(self) -> ArtifactManifest:
        bad_paths = [name for name in self.artifacts if "\\" in name]
        if bad_paths:
            raise ValueError(f"artifact paths must be POSIX-relative; got {bad_paths[:5]}")
        missing_checksums = [name for name in self.artifacts if name not in self.checksums]
        if missing_checksums:
            raise ValueError(f"every manifest artifact must have a checksum; missing {missing_checksums[:5]}")
        bad_external = [name for name in self.external_artifacts if "\\" in name]
        if bad_external:
            raise ValueError(f"external artifact paths must be POSIX-relative; got {bad_external[:5]}")
        unsafe_external = [
            name
            for name in self.external_artifacts
            if name.startswith("//")
            or (len(name) >= 2 and name[1] == ":")
            or PurePosixPath(name).is_absolute()
            or ".." in PurePosixPath(name).parts
        ]
        if unsafe_external:
            raise ValueError(f"external artifact paths must stay under artifact_root; got {unsafe_external[:5]}")
        overlap = sorted(set(self.artifacts) & set(self.external_artifacts))
        if overlap:
            raise ValueError(f"artifact path cannot be both local and external; overlap {overlap[:5]}")
        price_count = sum(1 for name in self.artifacts if name.startswith("prices/"))
        if price_count != self.price_artifact_count:
            raise ValueError(
                f"price_artifact_count must equal prices/* artifact count; "
                f"got {self.price_artifact_count} vs {price_count}"
            )
        return self


REPORT_ROWS = TypeAdapter(list[WebReportRow])
HOLDING_ROWS = TypeAdapter(list[WebHoldingRow])
TRADE_ROWS = TypeAdapter(list[WebTradeRow])
ACCOUNT_CATALOG_ROWS = TypeAdapter(list[AccountCatalogRow])
