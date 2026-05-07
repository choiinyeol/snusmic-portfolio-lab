from snusmic_pipeline.download_pdfs import download_pdf, safe_pdf_filename
from snusmic_pipeline.models import ReportMeta


def test_safe_pdf_filename_decodes_korean_slug():
    meta = ReportMeta(
        page=1,
        ordinal=1,
        date="2025-11-11T04:41:17",
        title="Equity Research, 지투지바이오",
        company="지투지바이오",
        slug="equity-research-%ec%a7%80%ed%88%ac%ec%a7%80%eb%b0%94%ec%9d%b4%ec%98%a4",
        post_url="http://snusmic.com/equity-research/",
        pdf_url="http://snusmic.com/file.pdf",
    )

    assert safe_pdf_filename(meta) == "2025-11-11_equity-research-지투지바이오.pdf"


class _RecordingSession:
    def __init__(self):
        self.calls: list[tuple] = []

    def get(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        raise AssertionError("network call should not be issued when local copy exists")


def test_download_pdf_reuses_local_copy_without_network(tmp_path):
    meta = ReportMeta(
        page=1,
        ordinal=1,
        date="2026-04-16T02:37:54",
        title="Equity Research, Demo Corp",
        company="Demo Corp",
        slug="equity-research-demo",
        post_url="http://snusmic.com/equity-research-demo/",
        pdf_url="http://snusmic.com/file.pdf",
    )
    target = tmp_path / safe_pdf_filename(meta)
    target.write_bytes(b"%PDF-archived bytes")
    session = _RecordingSession()

    result = download_pdf(meta, pdf_dir=tmp_path, session=session, force=False)

    assert result.status == "reused"
    assert result.path == target
    assert session.calls == []
