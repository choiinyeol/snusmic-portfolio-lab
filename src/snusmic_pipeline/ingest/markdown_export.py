from __future__ import annotations

from pathlib import Path

from .models import ExtractedReport
from .opendataloader_markdown import convert_pdfs_to_markdown


def markdown_path_for_pdf(pdf_path: Path, output_dir: Path) -> Path:
    return output_dir / f"{pdf_path.stem}.md"


def export_markdown(
    reports: list[ExtractedReport],
    output_dir: Path,
    hybrid: str = "",
    force: bool = False,
) -> list[str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    logs: list[str] = []
    pdf_reports = [report for report in reports if report.pdf_path and report.pdf_path.exists()]
    if not pdf_reports:
        logs.append("No PDFs available for markdown export.")
        return logs

    if force:
        for report in pdf_reports:
            assert report.pdf_path is not None
            target = markdown_path_for_pdf(report.pdf_path, output_dir)
            if target.exists():
                target.unlink()

    pdf_paths = [report.pdf_path for report in pdf_reports if report.pdf_path]
    converted = convert_pdfs_to_markdown(pdf_paths, output_dir=output_dir, hybrid=hybrid)

    for report in pdf_reports:
        assert report.pdf_path is not None
        target = markdown_path_for_pdf(report.pdf_path, output_dir)
        if report.pdf_path not in converted:
            raise RuntimeError(f"OpenDataLoader produced no markdown for {report.pdf_path}")
        body = converted[report.pdf_path].rstrip() + "\n"
        if "해당 .md 을 ChatGPT, Claude에게 입력하여 인사이트를 얻으세요." not in body:
            body = "> 해당 .md 을 ChatGPT, Claude에게 입력하여 인사이트를 얻으세요.\n\n" + body
        target.write_text(body, encoding="utf-8")
        report.markdown_path = target
    logs.append(f"Markdown files available: {len(list(output_dir.glob('*.md')))}")
    return logs
