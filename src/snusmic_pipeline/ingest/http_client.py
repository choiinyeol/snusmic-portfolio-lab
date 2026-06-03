from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import requests

DEFAULT_TIMEOUT = 30
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 snusmic-portfolio-lab/0.2"
)
DEFAULT_HEADERS = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "application/json,text/html;q=0.9,*/*;q=0.8",
}


@dataclass(frozen=True)
class FetchDiagnostics:
    endpoint: str
    status_code: int | None = None
    final_url: str = ""
    content_type: str = ""
    body_prefix: str = ""

    def format(self) -> str:
        parts = [f"endpoint={self.endpoint}"]
        if self.status_code is not None:
            parts.append(f"status={self.status_code}")
        if self.final_url:
            parts.append(f"final_url={self.final_url}")
        if self.content_type:
            parts.append(f"content_type={self.content_type}")
        if self.body_prefix:
            parts.append(f"body_prefix={self.body_prefix}")
        return "; ".join(parts)


class SnusmicFetchError(RuntimeError):
    def __init__(self, message: str, diagnostics: FetchDiagnostics):
        self.diagnostics = diagnostics
        super().__init__(f"{message}: {diagnostics.format()}")


class _ResponseLike(Protocol):
    url: str
    status_code: int
    headers: Any
    text: str

    def json(self) -> Any: ...


class _SessionLike(Protocol):
    def get(self, url: str, **kwargs: Any) -> _ResponseLike: ...


def _body_prefix(response: Any) -> str:
    text = getattr(response, "text", "")
    if not isinstance(text, str):
        content = getattr(response, "content", b"")
        if isinstance(content, bytes):
            text = content.decode("utf-8", errors="replace")
        else:
            text = str(content or "")
    return " ".join(text[:240].split())


def _diagnostics(endpoint: str, response: Any | None = None) -> FetchDiagnostics:
    if response is None:
        return FetchDiagnostics(endpoint=endpoint)
    headers = getattr(response, "headers", {}) or {}
    content_type = headers.get("content-type", "") if hasattr(headers, "get") else ""
    return FetchDiagnostics(
        endpoint=endpoint,
        status_code=getattr(response, "status_code", None),
        final_url=str(getattr(response, "url", "") or ""),
        content_type=str(content_type or ""),
        body_prefix=_body_prefix(response),
    )


def fetch_json_with_diagnostics(
    url: str,
    *,
    params: dict[str, str | int] | None = None,
    session: _SessionLike | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> tuple[Any, FetchDiagnostics]:
    client = session or requests.Session()
    prepared = requests.Request("GET", url, params=params).prepare()
    endpoint = prepared.url or url
    try:
        response = client.get(
            url,
            params=params,
            headers=DEFAULT_HEADERS,
            timeout=timeout,
            allow_redirects=True,
        )
    except requests.RequestException as exc:
        response = getattr(exc, "response", None)
        raise SnusmicFetchError("SNUSMIC REST API request failed", _diagnostics(endpoint, response)) from exc

    diagnostics = _diagnostics(endpoint, response)
    if diagnostics.status_code is not None and diagnostics.status_code != 200:
        raise SnusmicFetchError("SNUSMIC REST API returned a non-200 response", diagnostics)
    try:
        return response.json(), diagnostics
    except ValueError as exc:
        raise SnusmicFetchError("SNUSMIC REST API did not return JSON", diagnostics) from exc


def fetch_json(
    url: str,
    *,
    params: dict[str, str | int] | None = None,
    session: _SessionLike | None = None,
    timeout: int = DEFAULT_TIMEOUT,
) -> Any:
    payload, _ = fetch_json_with_diagnostics(url, params=params, session=session, timeout=timeout)
    return payload
