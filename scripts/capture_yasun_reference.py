#!/usr/bin/env python3
"""Capture public YASUN.GG HTML snapshots for private UI/UX reference.

The script intentionally does not persist cookies, session storage, local
storage, screenshots, or credentials. It saves only public HTML and a small
metadata file under `.omx/reference/yasun` by default.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.request import Request, urlopen

DEFAULT_URLS = ("https://yasun.gg/kospi200", "https://yasun.gg/nasdaq-futures")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("urls", nargs="*", default=list(DEFAULT_URLS))
    parser.add_argument("--out", type=Path, default=Path(".omx/reference/yasun"))
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    manifest = []
    for url in args.urls:
        html, headers = fetch_public_html(url)
        digest = hashlib.sha256(html).hexdigest()
        slug = slug_for_url(url)
        html_path = args.out / f"{slug}.html"
        meta_path = args.out / f"{slug}.metadata.json"
        html_path.write_bytes(html)
        metadata = {
            "url": url,
            "fetched_at": datetime.now(UTC).isoformat(),
            "sha256": digest,
            "content_type": headers.get("content-type"),
            "bytes": len(html),
            "cookie_policy": "cookies/session/local storage are not persisted",
        }
        meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        manifest.append(metadata | {"html": str(html_path), "metadata": str(meta_path)})
    (args.out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"captured {len(manifest)} public HTML snapshot(s) under {args.out}")


def fetch_public_html(url: str) -> tuple[bytes, dict[str, str]]:
    request = Request(
        url,
        headers={
            "User-Agent": "SNUSMIC-Portfolio-Lab-UI-Reference/1.0 (+static-ui-research)",
            "Accept": "text/html,application/xhtml+xml",
        },
        method="GET",
    )
    with urlopen(request, timeout=20) as response:  # noqa: S310 - explicit public URL capture tool.
        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type:
            raise RuntimeError(f"{url} returned non-HTML content-type: {content_type}")
        return response.read(), {key.lower(): value for key, value in response.headers.items()}


def slug_for_url(url: str) -> str:
    cleaned = re.sub(r"^https?://", "", url).strip("/")
    return re.sub(r"[^a-zA-Z0-9._-]+", "-", cleaned) or "yasun"


if __name__ == "__main__":
    main()
