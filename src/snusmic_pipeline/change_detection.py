from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

import requests

from .fetch_index import POSTS_ENDPOINT

RESEARCH_PAGE_URL = "http://snusmic.com/research/"
PAGE_ONE_POST_LIMIT = 12
DEFAULT_TIMEOUT = 30
DEFAULT_USER_AGENT = "Mozilla/5.0 snusmic-quant-terminal/0.2"

_POST_LINK_RE = re.compile(r'href=["\'](http://snusmic\.com/equity-research-[^"\']+/)["\']')


class SnusmicSiteUnavailable(RuntimeError):
    """Raised when the SNUSMIC site does not return live content.

    The most common trigger is the cafe24 hosting traffic-overage redirect
    (https://hostinfo.cafe24.com/overTraffic/503.html). We raise instead of
    returning an empty list so the scheduled workflow fails loudly rather than
    silently skipping the heavy sync job for weeks.
    """


def fetch_research_page_html(url: str = RESEARCH_PAGE_URL) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": DEFAULT_USER_AGENT})
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


def fetch_page_one_post_urls(session: requests.Session | None = None) -> list[str]:
    """Fetch page-one post links from the WordPress REST API.

    Raises SnusmicSiteUnavailable on any sign that the SNUSMIC site is not
    returning live content (cafe24 503 redirect, non-JSON body, empty list,
    off-domain links).
    """
    client = session or requests.Session()
    response = client.get(
        POSTS_ENDPOINT,
        params={"per_page": PAGE_ONE_POST_LIMIT, "page": 1, "_fields": "link"},
        headers={"User-Agent": DEFAULT_USER_AGENT},
        timeout=DEFAULT_TIMEOUT,
        allow_redirects=True,
    )

    final_url = getattr(response, "url", "") or ""
    if final_url and not _is_snusmic_url(final_url):
        raise SnusmicSiteUnavailable(
            f"REST API redirected off snusmic.com (final URL: {final_url}). "
            "The hosting account may be over its traffic quota."
        )

    status_code = getattr(response, "status_code", 0)
    if status_code != 200:
        raise SnusmicSiteUnavailable(f"REST API responded with HTTP {status_code}.")

    try:
        payload = response.json()
    except ValueError as exc:
        raise SnusmicSiteUnavailable(
            "REST API did not return JSON; the site may be down or rate-limited."
        ) from exc

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
    session: requests.Session | None = None,
) -> list[str]:
    if html is not None:
        page_urls = parse_page_one_post_urls(html)
    else:
        page_urls = fetch_page_one_post_urls(session=session)
    known = manifest_post_urls(manifest_path)
    return [url for url in page_urls if url not in known]
