from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urlparse

POSTS_ENDPOINT = "http://snusmic.com/wp-json/wp/v2/posts"
RESEARCH_PAGE_URL = "http://snusmic.com/research/"
PAGE_ONE_POST_LIMIT = 12
DEFAULT_TIMEOUT = 30
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 snusmic-portfolio-lab/0.2"
)
DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
}

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
    query = urllib.parse.urlencode({"per_page": PAGE_ONE_POST_LIMIT, "page": 1, "_fields": "link"})
    request = urllib.request.Request(
        f"{POSTS_ENDPOINT}?{query}",
        headers=DEFAULT_HEADERS,
    )
    try:
        with urllib.request.urlopen(request, timeout=DEFAULT_TIMEOUT) as response:
            body = response.read().decode("utf-8", errors="replace")
            payload = json.loads(body)
            return payload, response.url, response.status
    except json.JSONDecodeError as exc:
        raise SnusmicSiteUnavailable(
            "REST API did not return JSON; the site may be down or rate-limited."
        ) from exc
    except OSError as exc:
        raise SnusmicSiteUnavailable(f"REST API request failed: {exc}") from exc


def fetch_page_one_post_urls(session: _SessionLike | None = None) -> list[str]:
    """Fetch page-one post links from the WordPress REST API.

    Raises SnusmicSiteUnavailable on any sign that the SNUSMIC site is not
    returning live content (cafe24 503 redirect, non-JSON body, empty list,
    off-domain links).
    """
    if session is None:
        payload, final_url, status_code = _fetch_page_one_payload()
    else:
        response = session.get(
            POSTS_ENDPOINT,
            params={"per_page": PAGE_ONE_POST_LIMIT, "page": 1, "_fields": "link"},
            headers=DEFAULT_HEADERS,
            timeout=DEFAULT_TIMEOUT,
            allow_redirects=True,
        )
        final_url = getattr(response, "url", "") or ""
        status_code = getattr(response, "status_code", 0)
        try:
            payload = response.json()
        except ValueError as exc:
            raise SnusmicSiteUnavailable(
                "REST API did not return JSON; the site may be down or rate-limited."
            ) from exc

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
