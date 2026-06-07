from __future__ import annotations

import re
from pathlib import Path

from ..market_data.currency import EXCHANGE_CURRENCIES, infer_exchange_from_text
from ..market_data.symbols import company_ticker, exchange_for_ticker
from .models import DownloadedPdf, ExtractedReport

_TICKER_RE = re.compile(r"\(([A-Z0-9]{1,10})\)")
_EXCHANGE_TICKER_RE = re.compile(
    r"\b(?:NASDAQ|NYSE|AMEX|NYSEAMERICAN|TYO|TSE|TWSE|TPE|EPA|XETRA|ETR|AMS|SIX|HKG|HKEX|SZSE|SSE|KRX|KOSDAQ|KOSPI)\s*:\s*([A-Z0-9]{1,10})",
    re.IGNORECASE,
)
_TITLE_TICKER_RE = re.compile(r"([A-Z]{1,6})\s*(?:US\s*)?(?:Equity|NASDAQ|NYSE|TSE|TYO)", re.IGNORECASE)
_CURRENT_PRICE_RE = re.compile(
    r"현재\s*주가\s*(?:\([^)]{0,20}\))?\s*[:：]?\s*([$₩¥]?\s*[0-9][0-9,]*(?:\.[0-9]+)?)",
    re.IGNORECASE,
)
_TARGET_PRICE_RE = re.compile(
    r"목표\s*주가\s*(?:\([^)]{0,20}\))?\s*[:：]?\s*([$₩¥]?\s*[0-9][0-9,]*(?:\.[0-9]+)?)",
    re.IGNORECASE,
)
_FAIR_VALUE_RANGE_RE = re.compile(
    r"(?:적정\s*주가|승인시\s*주가)\s*[:：]?\s*([$₩¥]?\s*[0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:~|-|–|—|에서|부터)\s*([$₩¥]?\s*[0-9][0-9,]*(?:\.[0-9]+)?)",
    re.IGNORECASE,
)
_FAIR_VALUE_RE = re.compile(
    r"(?:적정\s*주가|승인시\s*주가)\s*[:：]?\s*([$₩¥]?\s*[0-9][0-9,]*(?:\.[0-9]+)?)",
    re.IGNORECASE,
)
_PRE_TARGET_PRICE_RE = re.compile(
    r"([$₩¥]?\s*[0-9][0-9,]*(?:\.[0-9]+)?)[ \t]*원?[을를]?[ \t]*(?:[A-Za-z]+[ \t]+case[ \t]+)?목표[ \t]*주가",
    re.IGNORECASE,
)
_EN_TARGET_PRICE_RE = re.compile(
    r"(?:target\s+price|price\s+target|fair\s+value|목표\s*주가)[^0-9$₩¥€]{0,80}((?:[$₩¥€]\s*|(?:USD|KRW|JPY|EUR|TWD|HKD|CNY|CHF)\s*)?[0-9][0-9,]*(?:\.[0-9]+)?)",
    re.IGNORECASE,
)
_CURRENT_TARGET_PAIR_RE = re.compile(
    r"현재\s*주가\s*[:：]\s*목표\s*주가\s*[:：]\s*((?:[$₩¥€]\s*|(?:USD|KRW|JPY|EUR|TWD|HKD|CNY|CHF)\s*)?[0-9][0-9,]*(?:\.[0-9]+)?)(?:\s*(?:원|엔|위안|달러))?\s+((?:[$₩¥€]\s*|(?:USD|KRW|JPY|EUR|TWD|HKD|CNY|CHF)\s*)?[0-9][0-9,]*(?:\.[0-9]+)?)(?:\s*(?:원|엔|위안|달러))?",
    re.IGNORECASE,
)
_SCENARIO_RE = re.compile(
    r"\b(Bear|Base|Bull)(?:\s*Case)?\b[^0-9$₩¥]{0,80}([$₩¥]?\s*[0-9][0-9,]*(?:\.[0-9]+)?)",
    re.IGNORECASE,
)
_CASE_PRICE_RE = re.compile(
    r"(?:(?<!Base )(?<!Bear )(?<!Bull )\bcase\s*([0-9]+)\b|케이스\s*([0-9]+)|시나리오\s*([0-9]+))[^0-9$₩¥]{0,80}([$₩¥]?\s*[0-9][0-9,]*(?:\.[0-9]+)?)",
    re.IGNORECASE,
)
_RATING_LABEL_RE = re.compile(
    r"(?:투자\s*의견|의견|Rating|Recommendation)[^A-Za-z가-힣]{0,80}(Strong\s*Buy|Buy|Attention|Sell|Hold|Neutral|강력\s*매수|매수|관심|주의|매도|중립)",
    re.IGNORECASE,
)
_RATING_LINE_RE = re.compile(
    r"^(Strong\s*Buy|Buy|Attention|Sell|Hold|Neutral|강력\s*매수|매수|관심|주의|매도|중립)$", re.IGNORECASE
)
_INVESTMENT_SECTION_RE = re.compile(
    r"(투자포인트|Investment\s+Point|Investment\s+points|Key\s+Points|Why\s+invest|Valuation)\s*[:：]?\s*(.{80,900})",
    re.IGNORECASE | re.DOTALL,
)


def parse_money(value: str | None) -> float | None:
    if not value:
        return None
    cleaned = (
        re.sub(r"\b(?:USD|KRW|JPY|EUR|TWD|HKD|CNY|CHF)\b", "", value, flags=re.IGNORECASE)
        .replace("$", "")
        .replace("₩", "")
        .replace("¥", "")
        .replace("€", "")
        .replace(",", "")
        .strip()
    )
    try:
        return float(cleaned)
    except ValueError:
        return None


def rescale_thousand_decimal_if_needed(
    value: float | None, raw: str, current_price: float | None, ticker: str
) -> float | None:
    """Handle Korean reports that use dots as thousand separators.

    Example: ``151.300 원`` means 151,300 KRW, not 151.3 KRW. Keep normal
    decimal prices such as USD 97.8 untouched by requiring a Korean numeric
    ticker, a three-digit decimal group, and a value implausibly below the
    current price.
    """
    if value is None or current_price is None:
        return value
    if not (ticker.isdigit() and len(ticker) == 6):
        return value
    if current_price <= 1000 or value >= current_price * 0.1:
        return value
    if re.search(r"\d+\.\d{3}\b", raw):
        return value * 1000
    return value


def normalize_rating(value: str | None) -> str:
    if not value:
        return ""
    compact = re.sub(r"\s+", " ", value).strip()
    lowered = compact.lower()
    if lowered in {"strong buy", "강력 매수"}:
        return "Strong Buy"
    if lowered in {"buy", "매수"}:
        return "Buy"
    if lowered in {"attention", "관심", "주의"}:
        return "Attention"
    if lowered in {"sell", "매도"}:
        return "Sell"
    if lowered in {"hold", "neutral", "중립"}:
        return "Hold"
    return compact


def compact_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_investment_points(text: str) -> str:
    search_area = text[:12000]
    match = _INVESTMENT_SECTION_RE.search(search_area)
    if match:
        snippet = compact_text(match.group(2))
    else:
        paragraphs = [
            compact_text(part) for part in re.split(r"\n\s*\n", text[:5000]) if len(compact_text(part)) >= 80
        ]
        snippet = paragraphs[1] if len(paragraphs) > 1 else (paragraphs[0] if paragraphs else "")
    if len(snippet) > 420:
        snippet = snippet[:417].rstrip() + "..."
    return snippet


def extract_pdf_markdown(path: Path, output_dir: Path | None = None) -> str:
    """Convert PDF to markdown via OpenDataLoader. Raises if conversion fails."""
    from .opendataloader_markdown import convert_pdfs_to_markdown

    target_dir = output_dir or (path.parent.parent / "markdown")
    converted = convert_pdfs_to_markdown([path], target_dir)
    if path not in converted:
        raise RuntimeError(f"OpenDataLoader produced no markdown for {path}")
    return converted[path]


def target_price_candidates(text: str) -> list[tuple[float, str]]:
    candidates: list[tuple[float, str]] = []
    for pattern in [_TARGET_PRICE_RE, _EN_TARGET_PRICE_RE, _PRE_TARGET_PRICE_RE]:
        for match in pattern.finditer(text):
            if pattern is _PRE_TARGET_PRICE_RE:
                before = text[max(0, match.start() - 50) : match.start()]
                after = text[match.end() : match.end() + 30]
                if "현재" in before:
                    continue
                if any(
                    noise in before
                    for noise in ["시가총액", "매출", "영업이익", "순이익", "ROE", "PBR", "PER"]
                ):
                    continue
                if re.match(r"\s*(?:\([^)]{0,20}\))?\s*[:：]?\s*[$₩¥]?\s*[0-9]", after):
                    continue
            if pattern is _EN_TARGET_PRICE_RE:
                raw = match.group(0)
                lowered = raw.lower()
                if re.search(r"목표\s*주가\s*[로를]", raw) and not re.search(
                    r"[$₩¥]|[0-9]\s*(?:원|엔|위안|달러|usd|jpy|krw)", lowered
                ):
                    continue
            value = parse_money(match.group(1))
            if value is not None:
                candidates.append((value, match.group(0)))

    range_match = _FAIR_VALUE_RANGE_RE.search(text[:4000])
    if range_match:
        low = parse_money(range_match.group(1))
        high = parse_money(range_match.group(2))
        if low is not None and high is not None:
            candidates.append(((low + high) / 2, range_match.group(0)))

    fair_value_match = _FAIR_VALUE_RE.search(text[:4000])
    if fair_value_match:
        value = parse_money(fair_value_match.group(1))
        if value is not None:
            candidates.append((value, fair_value_match.group(0)))

    return candidates


def target_price_from_text(text: str) -> tuple[float | None, str]:
    candidates = target_price_candidates(text)
    if candidates:
        return candidates[0]
    return None, ""


def rating_from_text(text: str) -> str:
    first_pages = text[:6000]
    match = _RATING_LABEL_RE.search(first_pages)
    if match:
        return normalize_rating(match.group(1))
    for line in first_pages.splitlines()[:100]:
        cleaned = re.sub(r"^[#>*\-\s]+", "", line).strip()
        line_match = _RATING_LINE_RE.match(cleaned)
        if line_match:
            return normalize_rating(line_match.group(1))
    return ""


def case_targets_from_text(text: str) -> dict[str, float]:
    values: dict[str, float] = {}
    for match in _CASE_PRICE_RE.finditer(text[:20000]):
        case_number = next((group for group in match.groups()[:3] if group), "")
        value = parse_money(match.group(4))
        if case_number and value is not None:
            values.setdefault(f"case_{case_number}", value)
    return values


def median_price(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    midpoint = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[midpoint]
    return (ordered[midpoint - 1] + ordered[midpoint]) / 2


def is_plausible_target_price(value: float, ticker: str, exchange: str = "") -> bool:
    code = str(exchange or "").strip().upper()
    if ticker.isdigit() and len(ticker) == 6 and code in {"", "KRX", "KOSPI", "KOSDAQ"}:
        return value >= 100
    return value >= 1


def target_sanity_notes(
    current_price: float | None, base_target: float | None, ticker: str, exchange: str
) -> list[str]:
    if current_price is None or base_target is None or current_price <= 0 or base_target <= 0:
        return []
    notes: list[str] = []
    ratio = base_target / current_price
    code = str(exchange or "").strip().upper()
    is_krx = ticker.isdigit() and len(ticker) == 6 and code in {"", "KRX", "KOSPI", "KOSDAQ"}
    high_ratio_limit = 10 if is_krx else 8
    low_ratio_limit = 0.05
    if ratio >= high_ratio_limit:
        notes.append(f"Target/current ratio looks too high ({ratio:.2f}x); review target unit or OCR split")
    if ratio <= low_ratio_limit:
        notes.append(f"Target/current ratio looks too low ({ratio:.2f}x); review target unit or OCR split")
    return notes


def target_detail_text(
    scenario_values: dict[str, float], case_values: dict[str, float], rating: str, base_target: float | None
) -> str:
    items: list[str] = []
    if rating:
        items.append(f"rating={rating}")
    for key in ["bear", "base", "bull"]:
        if key in scenario_values:
            items.append(f"{key}={scenario_values[key]:g}")
    if base_target is not None and "base" not in scenario_values:
        items.append(f"base={base_target:g}")
    for key in sorted(case_values):
        items.append(f"{key}={case_values[key]:g}")
    return "; ".join(items)


def ticker_from_text(text: str, company_hint: str = "") -> str:
    known = company_ticker(company_hint)
    if known:
        return known
    exchange_match = _EXCHANGE_TICKER_RE.search(text[:3000])
    if exchange_match:
        return exchange_match.group(1).upper()
    title_match = _TITLE_TICKER_RE.search(text[:2000])
    if title_match:
        return title_match.group(1).upper()
    candidates = [match.group(1) for match in _TICKER_RE.finditer(text)]
    for candidate in candidates:
        if candidate.isdigit() and len(candidate) == 6:
            return candidate
    for candidate in candidates:
        if re.fullmatch(r"[A-Z]{1,6}", candidate):
            return candidate
    return ""


def infer_exchange(ticker: str, text: str = "") -> tuple[str, str]:
    if not ticker:
        return "", "Ticker not found"
    exchange = exchange_for_ticker(ticker)
    if exchange:
        return exchange, ""
    if ticker.isdigit() and len(ticker) == 6:
        return "KRX", "Korean numeric ticker; exchange prefix inferred as KRX"
    text_exchange = infer_exchange_from_text(text)
    if text_exchange:
        return text_exchange, ""
    if ticker.isdigit() and len(ticker) == 4:
        return "TYO", "4-digit numeric ticker; exchange inferred as TYO"
    return "", "Exchange not mapped; verify ticker/exchange"


def infer_currency(text: str, ticker: str, exchange: str = "") -> str:
    """Resolve a SMIC report's quoted currency.

    Order of evidence:

    1. The report's exchange (resolved upstream via ``infer_exchange``) — the
       single source of truth, mapped through ``EXCHANGE_CURRENCIES``.
    2. The PDF cover page's exchange keywords — covers reports where the
       ticker mapping has not been hard-coded yet.
    3. KRX-style 6-digit numeric tickers default to KRW.
    4. Tokyo-style 4-digit numeric tickers default to JPY.
    5. Final inference: USD when the cover page mentions ``USD`` / ``$``,
       otherwise USD as a last resort.
    """

    code = (exchange or "").strip().upper()
    if code in EXCHANGE_CURRENCIES:
        return EXCHANGE_CURRENCIES[code]
    text_exchange = infer_exchange_from_text(text)
    if text_exchange in EXCHANGE_CURRENCIES:
        return EXCHANGE_CURRENCIES[text_exchange]
    digits = (ticker or "").strip()
    if digits.isdigit() and len(digits) == 6:
        return "KRW"
    if digits.isdigit() and len(digits) == 4:
        return "JPY"
    first_page = text[:3000].upper() if text else ""
    if "USD" in first_page or "$" in (text[:3000] if text else ""):
        return "USD"
    return "USD"


def parse_report_text(text: str, company_hint: str = "") -> dict[str, object]:
    ticker = ticker_from_text(text, company_hint=company_hint)
    exchange, exchange_note = infer_exchange(ticker, text)
    rating = rating_from_text(text)
    current_match = _CURRENT_PRICE_RE.search(text)
    single_target, target_raw = target_price_from_text(text)
    notes: list[str] = []
    current_price = parse_money(current_match.group(1)) if current_match else None
    current_target_pair = _CURRENT_TARGET_PAIR_RE.search(text[:4000])
    if current_target_pair:
        current_price = parse_money(current_target_pair.group(1))
        single_target = parse_money(current_target_pair.group(2))
        target_raw = current_target_pair.group(2)
    if current_price is not None and single_target == current_price:
        for candidate, raw in target_price_candidates(text):
            if candidate != current_price:
                single_target, target_raw = candidate, raw
                notes.append("Initial target candidate equaled current price; selected next target candidate")
                break
    if single_target is not None and not is_plausible_target_price(single_target, ticker, exchange):
        for candidate, raw in target_price_candidates(text):
            candidate = rescale_thousand_decimal_if_needed(candidate, raw, current_price, ticker)
            if is_plausible_target_price(candidate, ticker, exchange):
                single_target, target_raw = candidate, raw
                notes.append(
                    "Initial target candidate was implausible; selected next plausible target candidate"
                )
                break
        else:
            single_target = None
    single_target = rescale_thousand_decimal_if_needed(single_target, target_raw, current_price, ticker)

    scenario_values: dict[str, float] = {}
    for match in _SCENARIO_RE.finditer(text[:15000]):
        scenario = match.group(1).lower()
        if scenario not in scenario_values:
            if "eps" in match.group(0).lower():
                continue
            value = parse_money(match.group(2))
            raw_value = match.group(2)
            looks_like_case_number = (
                "case" in match.group(0).lower()
                and not any(symbol in raw_value for symbol in "$₩¥")
                and value is not None
                and value <= 5
            )
            value = rescale_thousand_decimal_if_needed(value, raw_value, current_price, ticker)
            if (
                value is not None
                and not looks_like_case_number
                and is_plausible_target_price(value, ticker, exchange)
            ):
                scenario_values[scenario] = value

    case_values = {
        key: value
        for key, value in case_targets_from_text(text).items()
        if key.split("_", 1)[-1].isdigit()
        and 1 <= int(key.split("_", 1)[-1]) <= 5
        and is_plausible_target_price(value, ticker, exchange)
    }
    base_target = (
        single_target if current_target_pair is not None else scenario_values.get("base", single_target)
    )
    if base_target is None and scenario_values:
        base_target = median_price(list(scenario_values.values()))
        notes.append("No explicit Base target; base target uses median scenario value")
    case_prices = sorted(case_values.values())
    if current_target_pair is None and (
        base_target is None
        and case_prices
        or case_prices
        and len(case_prices) > 1
        and "base" not in target_raw.lower()
        and base_target in case_prices
    ):
        base_target = median_price(case_prices)
    if single_target is not None and ("base" in target_raw.lower() or base_target is None):
        base_target = single_target
    if exchange_note:
        notes.append(exchange_note)
    if base_target is None:
        notes.append("Target price not found")
    if not ticker:
        notes.append("Ticker not found")
    if case_values and "base" not in scenario_values:
        notes.append(
            "Case target prices parsed; base target uses median case value; review scenario semantics"
        )
    if rating and rating not in {"Buy", "Strong Buy"}:
        notes.append(f"Non-buy rating: {rating}")
    sanity_notes = target_sanity_notes(current_price, base_target, ticker, exchange)
    notes.extend(sanity_notes)

    return {
        "ticker": ticker,
        "exchange": exchange,
        "rating": rating,
        "report_current_price": current_price,
        "bear_target": scenario_values.get("bear"),
        "base_target": base_target,
        "bull_target": scenario_values.get("bull"),
        "target_currency": infer_currency(text, ticker, exchange),
        "target_price_detail": target_detail_text(scenario_values, case_values, rating, base_target),
        "investment_points": extract_investment_points(text),
        "status": "ok" if ticker and base_target is not None and not sanity_notes else "needs_review",
        "note": "; ".join(notes),
        "raw_matches": {
            "company": company_hint,
            "current_price": current_match.group(0) if current_match else "",
            "target_price": target_raw,
        },
    }


def extract_report(download: DownloadedPdf, max_pages: int = 4) -> ExtractedReport:
    report = ExtractedReport(meta=download.meta, pdf_path=download.path)
    if not download.path:
        report.extraction_status = download.status
        report.note = download.note
        return report
    try:
        text = extract_pdf_markdown(download.path)
    except Exception as exc:  # noqa: BLE001 - keep one bad PDF from stopping the batch
        report.extraction_status = "text_extract_failed"
        report.note = str(exc)
        return report

    parsed = parse_report_text(text, company_hint=download.meta.company)
    report.ticker = str(parsed["ticker"])
    report.exchange = str(parsed["exchange"])
    report.rating = str(parsed["rating"])
    report.report_current_price = parsed["report_current_price"]  # type: ignore[assignment]
    report.bear_target = parsed["bear_target"]  # type: ignore[assignment]
    report.base_target = parsed["base_target"]  # type: ignore[assignment]
    report.bull_target = parsed["bull_target"]  # type: ignore[assignment]
    report.target_currency = str(parsed["target_currency"])
    report.target_price_detail = str(parsed["target_price_detail"])
    report.investment_points = str(parsed["investment_points"])
    report.extraction_status = str(parsed["status"])
    report.note = str(parsed["note"])
    report.raw_matches = parsed["raw_matches"]  # type: ignore[assignment]
    return report
