import json

from snusmic_pipeline.cli import build_parser, resolve_sync_pages
from snusmic_pipeline.ingest import fetch_index
from snusmic_pipeline.ingest.fetch_index import clean_html_text, fetch_page, fetch_reports, parse_pages


class FakeResponse:
    def __init__(self, payload, *, json_error=False):
        self.payload = payload
        self.json_error = json_error

    def raise_for_status(self):
        return None

    def json(self):
        if self.json_error:
            raise ValueError("not json")
        return self.payload


class FakeSession:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return FakeResponse(self.payload)


def test_parse_pages_range_and_list():
    assert parse_pages("1-3,5") == [1, 2, 3, 5]


def test_sync_default_pages_is_auto():
    parser = build_parser()
    args = parser.parse_args(["sync"])

    assert args.pages == "auto"


def test_resolve_sync_pages_auto_keeps_existing_archive_plus_one_window(tmp_path):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps([{"post_url": f"http://example.com/{idx}"} for idx in range(216)]))

    assert resolve_sync_pages("auto", manifest) == list(range(1, 20))


def test_clean_html_text_unescapes_entities():
    assert clean_html_text("Equity Research, Levi Strauss &#038; Co") == "Equity Research, Levi Strauss & Co"


def test_fetch_reports_extracts_pdf_url_and_company():
    payload = [
        {
            "date": "2026-04-16T02:37:54",
            "slug": "equity-research-demo",
            "link": "http://snusmic.com/equity-research-demo/",
            "title": {"rendered": "Equity Research, Demo Corp"},
            "content": {"rendered": '<a href="http://snusmic.com/file.pdf">download</a>'},
        }
    ]
    session = FakeSession(payload)

    reports = fetch_reports([1], session=session)

    assert len(reports) == 1
    assert reports[0].company == "Demo Corp"
    assert reports[0].pdf_url == "http://snusmic.com/file.pdf"
    assert reports[0].page == 1
    assert reports[0].ordinal == 1


def test_fetch_page_uses_reader_fallback_when_direct_response_is_not_json(monkeypatch):
    payload = [{"link": "http://snusmic.com/equity-research-demo/"}]

    class DirectSession:
        def get(self, *args, **kwargs):
            return FakeResponse(None, json_error=True)

    monkeypatch.setattr(fetch_index.requests, "Session", DirectSession)
    monkeypatch.setattr(fetch_index, "fetch_json_via_reader", lambda *args, **kwargs: payload)

    assert fetch_page(1) == payload
