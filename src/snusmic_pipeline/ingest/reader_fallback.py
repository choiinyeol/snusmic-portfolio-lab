from __future__ import annotations

import json
import time
import urllib.request
from typing import Any

READER_PREFIX = "https://r.jina.ai/http://"
MARKDOWN_CONTENT_MARKER = "Markdown Content:"
DEFAULT_ATTEMPTS = 3
DEFAULT_BACKOFF_SECONDS = 2.0


class ReaderFallbackError(RuntimeError):
    """Raised when r.jina.ai does not return parseable JSON."""


def reader_url(source_url: str) -> str:
    normalized = source_url.removeprefix("http://").removeprefix("https://")
    return f"{READER_PREFIX}{normalized}"


def parse_reader_json(body: str) -> Any:
    _, marker, markdown = body.partition(MARKDOWN_CONTENT_MARKER)
    payload = (markdown if marker else body).strip()
    if not payload:
        raise ReaderFallbackError("Reader fallback returned an empty body.")
    try:
        return json.loads(payload)
    except json.JSONDecodeError as exc:
        snippet = " ".join(payload[:200].split())
        raise ReaderFallbackError(f"Reader fallback did not return JSON: {snippet}") from exc


def fetch_json_via_reader(
    source_url: str,
    *,
    headers: dict[str, str],
    timeout: int,
    attempts: int = DEFAULT_ATTEMPTS,
    backoff_seconds: float = DEFAULT_BACKOFF_SECONDS,
) -> Any:
    last_error: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            request = urllib.request.Request(reader_url(source_url), headers=headers)
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read().decode("utf-8", errors="replace")
            return parse_reader_json(body)
        except (OSError, ReaderFallbackError) as exc:
            last_error = exc
            if attempt >= attempts:
                break
            time.sleep(backoff_seconds * attempt)
    raise ReaderFallbackError(f"Reader fallback failed after {attempts} attempts: {last_error}") from last_error
