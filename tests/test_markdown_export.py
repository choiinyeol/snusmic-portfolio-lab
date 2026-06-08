from pathlib import Path

from snusmic_pipeline.ingest.markdown_export import markdown_path_for_pdf
from snusmic_pipeline.ingest.models import ExtractedReport, ReportMeta


def test_markdown_path_for_pdf_uses_pdf_stem(tmp_path: Path):
    assert markdown_path_for_pdf(Path("data/pdfs/report.pdf"), tmp_path) == tmp_path / "report.md"
def test_extracted_report_markdown_filename_uses_exported_path():
    report = ExtractedReport(
        meta=ReportMeta(
            page=1,
            ordinal=1,
            date="2026-01-02",
            title="Demo",
            company="Demo Corp",
            slug="demo",
            post_url="https://example.com/post",
            pdf_url="https://example.com/file.pdf",
        ),
        pdf_path=Path("data/pdfs/report.pdf"),
        markdown_path=Path("data/markdown/report.md"),
    )

    assert report.markdown_filename == "report.md"
