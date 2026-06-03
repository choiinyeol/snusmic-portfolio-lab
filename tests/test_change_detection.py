import json

import pytest

from snusmic_pipeline.ingest.change_detection import (
    SnusmicSiteUnavailable,
    fetch_page_one_post_urls,
    new_report_urls,
    parse_page_one_post_urls,
)

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


class _FakeResponse:
    def __init__(
        self,
        *,
        payload=None,
        status_code=200,
        url="http://snusmic.com/wp-json/wp/v2/posts",
        text="",
        content_type="application/json",
        json_error=False,
    ):
        self._payload = payload
        self.status_code = status_code
        self.url = url
        self.text = text
        self.headers = {"content-type": content_type}
        self._json_error = json_error

    def json(self):
        if self._payload is None or self._json_error:
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
    with pytest.raises(SnusmicSiteUnavailable, match="redirected off snusmic.com"):
        fetch_page_one_post_urls(session=_FakeSession(response))


def test_fetch_page_one_post_urls_raises_on_non_json_body_with_diagnostics():
    response = _FakeResponse(
        payload=None,
        url="https://hostinfo.cafe24.com/overTraffic/503.html",
        text="<html>temporarily unavailable</html>",
        content_type="text/html",
    )
    with pytest.raises(SnusmicSiteUnavailable) as exc_info:
        fetch_page_one_post_urls(session=_FakeSession(response))

    message = str(exc_info.value)
    assert "did not return JSON" in message
    assert "final_url=https://hostinfo.cafe24.com/overTraffic/503.html" in message
    assert "content_type=text/html" in message
    assert "body_prefix=<html>temporarily unavailable</html>" in message


def test_fetch_page_one_post_urls_raises_on_empty_list():
    response = _FakeResponse(payload=[])
    with pytest.raises(SnusmicSiteUnavailable, match="zero posts"):
        fetch_page_one_post_urls(session=_FakeSession(response))


def test_fetch_page_one_post_urls_raises_on_non_200_with_diagnostics():
    response = _FakeResponse(
        status_code=503,
        payload=[{"link": "http://snusmic.com/equity-research-x/"}],
        text="traffic exceeded",
        content_type="text/html",
    )
    with pytest.raises(SnusmicSiteUnavailable) as exc_info:
        fetch_page_one_post_urls(session=_FakeSession(response))

    message = str(exc_info.value)
    assert "non-200" in message
    assert "status=503" in message
    assert "body_prefix=traffic exceeded" in message


def test_fetch_page_one_post_urls_raises_when_no_snusmic_links():
    response = _FakeResponse(
        payload=[{"link": "https://example.com/post/"}],
    )
    with pytest.raises(SnusmicSiteUnavailable, match="none were valid snusmic.com links"):
        fetch_page_one_post_urls(session=_FakeSession(response))
