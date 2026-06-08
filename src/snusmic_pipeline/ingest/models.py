from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ReportMeta(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    page: int
    ordinal: int
    date: str
    title: str
    company: str
    slug: str
    post_url: str
    pdf_url: str


class DownloadedPdf(BaseModel):
    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    meta: ReportMeta
    path: Path | None
    sha256: str | None
    status: str
    note: str = ""


class StructuredReportFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    report_current_price: float | None = None
    ticker: str = ""
    exchange: str = ""
    rating: str = ""
    bear_target: float | None = None
    base_target: float | None = None
    bull_target: float | None = None
    target_currency: str = ""
    target_price_detail: str = ""
    investment_points: str = ""
    extraction_status: str = "pending"
    note: str = ""
    raw_matches: dict[str, str] = Field(default_factory=dict)


class ReportArtifact(BaseModel):
    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    meta: ReportMeta
    pdf_path: Path | None
    pdf_sha256: str | None = None
    markdown_path: Path | None = None
    structured_fields: StructuredReportFields


class ExtractedReport(BaseModel):
    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    meta: ReportMeta
    pdf_path: Path | None
    markdown_path: Path | None = None
    report_current_price: float | None = None
    ticker: str = ""
    exchange: str = ""
    rating: str = ""
    bear_target: float | None = None
    base_target: float | None = None
    bull_target: float | None = None
    target_currency: str = ""
    target_price_detail: str = ""
    investment_points: str = ""
    extraction_status: str = "pending"
    note: str = ""
    raw_matches: dict[str, str] = Field(default_factory=dict)

    @property
    def pdf_filename(self) -> str:
        return self.pdf_path.name if self.pdf_path else ""

    @property
    def markdown_filename(self) -> str:
        return self.markdown_path.name if self.markdown_path else ""

    def structured_fields(self) -> StructuredReportFields:
        return StructuredReportFields(
            report_current_price=self.report_current_price,
            ticker=self.ticker,
            exchange=self.exchange,
            rating=self.rating,
            bear_target=self.bear_target,
            base_target=self.base_target,
            bull_target=self.bull_target,
            target_currency=self.target_currency,
            target_price_detail=self.target_price_detail,
            investment_points=self.investment_points,
            extraction_status=self.extraction_status,
            note=self.note,
            raw_matches=self.raw_matches,
        )

    def to_report_artifact(self, *, pdf_sha256: str | None = None) -> ReportArtifact:
        return ReportArtifact(
            meta=self.meta,
            pdf_path=self.pdf_path,
            pdf_sha256=pdf_sha256,
            markdown_path=self.markdown_path,
            structured_fields=self.structured_fields(),
        )


def model_rows(items: list[BaseModel]) -> list[dict[str, Any]]:
    """Serialize a list of Pydantic models to CSV/JSON-friendly row dicts."""
    return [item.model_dump(mode="json") for item in items]
