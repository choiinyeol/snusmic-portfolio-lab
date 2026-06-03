import json

import pytest

from snusmic_pipeline.cli import build_parser, resolve_sync_pages
from snusmic_pipeline.ingest.fetch_index import clean_html_text, fetch_page, fetch_reports, parse_pages
from snusmic_pipeline.ingest.http_client import SnusmicFetchError


class FakeResponse:
    def __init__(
        self,
        payload,
        *,
        json_error: bool = False,
        status_code: int = 200,
        url: str = "http://snusmic.com/wp-json/wp/v2/posts",
        text: str = "",
        content_type: str = "application/json",
    ):
        self.payload = payload
        self.json_error = json_error
        self.status_code = status_code
        self.url = url
        self.text = text
        self.headers = {"content-type": content_type}

    def raise_for_status(self):
        return None

    def json(self):
        if self.json_error:
            raise ValueError("not json")
        return self.payload


class FakeSession:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


class PayloadSession(FakeSession):
    def __init__(self, payload):
        super().__init__(FakeResponse(payload))


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
    session = PayloadSession(payload)

    reports = fetch_reports([1], session=session)

    assert len(reports) == 1
    assert reports[0].company == "Demo Corp"
    assert reports[0].pdf_url == "http://snusmic.com/file.pdf"
    assert reports[0].page == 1
    assert reports[0].ordinal == 1


def test_fetch_page_reports_non_json_direct_response_with_diagnostics():
    session = FakeSession(
        FakeResponse(
            None,
            json_error=True,
            url="https://hostinfo.cafe24.com/overTraffic/503.html",
            text="<html>temporarily unavailable</html>",
            content_type="text/html",
        )
    )

    with pytest.raises(SnusmicFetchError) as exc_info:
        fetch_page(1, session=session)

    message = str(exc_info.value)
    assert "did not return JSON" in message
    assert "final_url=https://hostinfo.cafe24.com/overTraffic/503.html" in message
    assert "content_type=text/html" in message
    assert "body_prefix=<html>temporarily unavailable</html>" in message


def test_fetch_page_reports_http_status_from_direct_response():
    session = FakeSession(
        FakeResponse(
            {"error": "quota"},
            status_code=503,
            text="traffic exceeded",
            content_type="text/html",
        )
    )

    with pytest.raises(SnusmicFetchError, match="status=503"):
        fetch_page(1, session=session)
