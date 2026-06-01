from __future__ import annotations

import json
import urllib.request
from typing import Any

READER_PREFIX = "https://r.jina.ai/http://r.jina.ai/http://"
MARKDOWN_CONTENT_MARKER = "Markdown Content:"


def reader_url(source_url: str) -> str:
    normalized = source_url.removeprefix("http://").removeprefix("https://")
    return f"{READER_PREFIX}{normalized}"


def parse_reader_json(body: str) -> Any:
    _, marker, markdown = body.partition(MARKDOWN_CONTENT_MARKER)
    payload = markdown if marker else body
    return json.loads(payload.strip())


def fetch_json_via_reader(source_url: str, *, headers: dict[str, str], timeout: int) -> Any:
    request = urllib.request.Request(reader_url(source_url), headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read().decode("utf-8", errors="replace")
    return parse_reader_json(body)
