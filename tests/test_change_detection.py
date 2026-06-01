import json

import pytest

from snusmic_pipeline.ingest.change_detection import (
    SnusmicSiteUnavailable,
    fetch_page_one_post_urls,
    new_report_urls,
    parse_page_one_post_urls,
)
from snusmic_pipeline.ingest.reader_fallback import parse_reader_json, reader_url

HTML = """
<a href="http://snusmic.com/equity-research-new/">Read More</a>
<a href="http://snusmic.com/equity-research-old/">Read More</a>
<a href="http://snusmic.com/equity-research-new/">Read More</a>
"""


def test_parse_page_one_post_urls_dedupes():
    assert parse_page_one_post_urls(HTML) == [
        "http://snusmic.com/equity-research-new/",
        "http://snusmic.com/equity-research-old/",
    ]


def test_new_report_detector_compares_manifest(tmp_path):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps([{"post_url": "http://snusmic.com/equity-research-old/"}]), encoding="utf-8"
    )

    assert new_report_urls(manifest, HTML) == ["http://snusmic.com/equity-research-new/"]


def test_reader_url_normalizes_snusmic_source_url():
    assert (
        reader_url("http://snusmic.com/wp-json/wp/v2/posts?per_page=12")
        == "https://r.jina.ai/http://r.jina.ai/http://snusmic.com/wp-json/wp/v2/posts?per_page=12"
    )


def test_parse_reader_json_extracts_markdown_content_payload():
    body = """
    Title:

    URL Source: http://snusmic.com/wp-json/wp/v2/posts

    Markdown Content:
    [{"link": "http://snusmic.com/equity-research-new/"}]
    """
    assert parse_reader_json(body) == [{"link": "http://snusmic.com/equity-research-new/"}]


class _FakeResponse:
    def __init__(self, *, payload=None, status_code=200, url="http://snusmic.com/wp-json/wp/v2/posts"):
        self._payload = payload
        self.status_code = status_code
        self.url = url

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


class _FakeSession:
    def __init__(self, response):
        self._response = response
        self.calls: list[tuple] = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self._response


def test_fetch_page_one_post_urls_returns_links():
    response = _FakeResponse(
        payload=[
            {"link": "http://snusmic.com/equity-research-foo/"},
            {"link": "http://snusmic.com/equity-research-bar/"},
            {"link": "http://snusmic.com/equity-research-foo/"},
        ]
    )
    urls = fetch_page_one_post_urls(session=_FakeSession(response))
    assert urls == [
        "http://snusmic.com/equity-research-foo/",
        "http://snusmic.com/equity-research-bar/",
    ]


def test_fetch_page_one_post_urls_raises_on_cafe24_overage_redirect():
    response = _FakeResponse(url="https://hostinfo.cafe24.com/overTraffic/503.html", payload=[])
    with pytest.raises(SnusmicSiteUnavailable):
        fetch_page_one_post_urls(session=_FakeSession(response))


def test_fetch_page_one_post_urls_raises_on_non_json_body():
    response = _FakeResponse(payload=None)
    with pytest.raises(SnusmicSiteUnavailable):
        fetch_page_one_post_urls(session=_FakeSession(response))


def test_fetch_page_one_post_urls_raises_on_empty_list():
    response = _FakeResponse(payload=[])
    with pytest.raises(SnusmicSiteUnavailable):
        fetch_page_one_post_urls(session=_FakeSession(response))


def test_fetch_page_one_post_urls_raises_on_non_200():
    response = _FakeResponse(status_code=503, payload=[{"link": "http://snusmic.com/equity-research-x/"}])
    with pytest.raises(SnusmicSiteUnavailable):
        fetch_page_one_post_urls(session=_FakeSession(response))


def test_fetch_page_one_post_urls_raises_when_no_snusmic_links():
    response = _FakeResponse(
        payload=[{"link": "https://example.com/post/"}],
    )
    with pytest.raises(SnusmicSiteUnavailable):
        fetch_page_one_post_urls(session=_FakeSession(response))
