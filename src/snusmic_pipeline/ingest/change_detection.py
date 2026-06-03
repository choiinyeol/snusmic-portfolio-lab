from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlparse

from .http_client import DEFAULT_HEADERS, DEFAULT_TIMEOUT, SnusmicFetchError, fetch_json_with_diagnostics

POSTS_ENDPOINT = "http://snusmic.com/wp-json/wp/v2/posts"
RESEARCH_PAGE_URL = "http://snusmic.com/research/"
PAGE_ONE_POST_LIMIT = 12

_POST_LINK_RE = re.compile(r'href=["\'](http://snusmic\.com/equity-research-[^"\']+/)["\']')


class SnusmicSiteUnavailable(RuntimeError):
    """Raised when the SNUSMIC site does not return live content.

    The most common trigger is the cafe24 hosting traffic-overage redirect
    (https://hostinfo.cafe24.com/overTraffic/503.html). We raise instead of
    returning an empty list so the scheduled workflow fails loudly rather than
    silently skipping the heavy sync job for weeks.
    """


class _ResponseLike(Protocol):
    url: str
    status_code: int

    def json(self) -> Any: ...


class _SessionLike(Protocol):
    def get(self, url: str, **kwargs: Any) -> _ResponseLike: ...


def fetch_research_page_html(url: str = RESEARCH_PAGE_URL) -> str:
    request = urllib.request.Request(url, headers=DEFAULT_HEADERS)
    with urllib.request.urlopen(request, timeout=DEFAULT_TIMEOUT) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_page_one_post_urls(html: str) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    for match in _POST_LINK_RE.finditer(html):
        url = match.group(1)
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls[:PAGE_ONE_POST_LIMIT]


def manifest_post_urls(path: Path) -> set[str]:
    if not path.exists():
        return set()
    data = json.loads(path.read_text(encoding="utf-8"))
    return {str(item.get("post_url", "")) for item in data if item.get("post_url")}


def _is_snusmic_url(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host == "snusmic.com" or host.endswith(".snusmic.com")


def _fetch_page_one_payload() -> tuple[list[Any], str, int]:
    params = {"per_page": PAGE_ONE_POST_LIMIT, "page": 1, "_fields": "link"}
    try:
        payload, diagnostics = fetch_json_with_diagnostics(
            POSTS_ENDPOINT,
            params=params,
            timeout=DEFAULT_TIMEOUT,
        )
    except SnusmicFetchError as exc:
        raise SnusmicSiteUnavailable(str(exc)) from exc
    return payload, diagnostics.final_url, diagnostics.status_code or 0


def fetch_page_one_post_urls(session: _SessionLike | None = None) -> list[str]:
    """Fetch page-one post links from the WordPress REST API.

    Raises SnusmicSiteUnavailable on any sign that the SNUSMIC site is not
    returning live content (cafe24 503 redirect, non-JSON body, empty list,
    off-domain links).
    """
    params = {"per_page": PAGE_ONE_POST_LIMIT, "page": 1, "_fields": "link"}
    if session is None:
        payload, final_url, status_code = _fetch_page_one_payload()
    else:
        try:
            payload, diagnostics = fetch_json_with_diagnostics(
                POSTS_ENDPOINT,
                params=params,
                session=session,
                timeout=DEFAULT_TIMEOUT,
            )
        except SnusmicFetchError as exc:
            raise SnusmicSiteUnavailable(str(exc)) from exc
        final_url = diagnostics.final_url
        status_code = diagnostics.status_code or 0

    if final_url and not _is_snusmic_url(final_url):
        raise SnusmicSiteUnavailable(
            f"REST API redirected off snusmic.com (final URL: {final_url}). "
            "The hosting account may be over its traffic quota."
        )

    if status_code != 200:
        raise SnusmicSiteUnavailable(f"REST API responded with HTTP {status_code}.")

    if not isinstance(payload, list):
        raise SnusmicSiteUnavailable("REST API returned an unexpected payload (not a JSON list).")
    if not payload:
        raise SnusmicSiteUnavailable(
            "REST API returned zero posts on page one; treating as outage rather "
            "than silently reporting no new reports."
        )

    seen: set[str] = set()
    urls: list[str] = []
    for post in payload:
        link = str(post.get("link", "") or "")
        if link and _is_snusmic_url(link) and link not in seen:
            seen.add(link)
            urls.append(link)

    if not urls:
        raise SnusmicSiteUnavailable("REST API returned posts but none were valid snusmic.com links.")
    return urls


def new_report_urls(
    manifest_path: Path,
    html: str | None = None,
    *,
    session: _SessionLike | None = None,
) -> list[str]:
    if html is not None:
        page_urls = parse_page_one_post_urls(html)
    else:
        page_urls = fetch_page_one_post_urls(session=session)
    known = manifest_post_urls(manifest_path)
    return [url for url in page_urls if url not in known]
