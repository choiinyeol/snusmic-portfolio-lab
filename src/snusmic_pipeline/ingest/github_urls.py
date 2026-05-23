from __future__ import annotations

from urllib.parse import quote

GITHUB_REPO = "ChoiInYeol/snusmic-portfolio-lab"
GITHUB_RAW_BASE = f"https://raw.githubusercontent.com/{GITHUB_REPO}/main"


def github_raw_url(path: str) -> str:
    return f"{GITHUB_RAW_BASE}/{quote(path, safe='/')}"


def github_pdf_url(pdf_filename: str | None) -> str:
    filename = (pdf_filename or "").strip()
    if not filename:
        return ""
    return github_raw_url(f"data/pdfs/{filename}")
