from __future__ import annotations

import argparse
import csv
import datetime as dt
import math
import re
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import pandas as pd
import yfinance as yf
from pykrx import stock

KOREAN_DATE_RE = re.compile(r"(20\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일")
FILENAME_DATE_RE = re.compile(r"(20\d{2})-(\d{2})-(\d{2})")
MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "sept": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}
ENGLISH_DATE_RE = re.compile(
    r"\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),\s*(20\d{2})\b",
    re.I,
)
TITLE_WITH_CODE_RE = re.compile(r"^\s*#*\s*\|?\s*(?P<name>[^|#\n]*?)\s*\((?P<inside>[^)]{2,80})\)", re.I)
CODE_ONLY_HEADING_RE = re.compile(r"^\s*#*\s*\(?\s*(?P<code>\d{6})\s*\)?\s*$")
US_EXCHANGE_RE = re.compile(r"\b(NASDAQ|NYSE|AMEX|NSDQ)\b", re.I)
US_TICKER_AFTER_EXCHANGE_RE = re.compile(r"\b(?:NASDAQ|NYSE|AMEX|NSDQ)\s*:?\s*([A-Z][A-Z0-9.\-]{0,7})\b", re.I)
US_TICKER_BEFORE_EXCHANGE_RE = re.compile(r"\b([A-Z][A-Z0-9.\-]{0,7})\s*:?\s*(?:NASDAQ|NYSE|AMEX|NSDQ)\b", re.I)
KR_CODE_RE = re.compile(r"\b\d{6}\b")
EXCLUDED_DELISTED_TICKERS = {"VTNR", "NETI"}

TARGET_LABEL_RE = re.compile(r"(?:\d{2,4}E?\s*)?(목표\s*주가|목표주가|적정\s*주가|적정주가|Target\s+Price)", re.I)
CURRENT_LABEL_RE = re.compile(r"(현재\s*주가|현재주가|현재가|Current\s+Price)", re.I)
UPSIDE_RE = re.compile(r"(상승여력|하락여력)\s*[:：]?\s*([+\-]?\d+(?:\.\d+)?)\s*%", re.I)
RATING_RE = re.compile(r"\b(Buy|Sell|Hold|Neutral|Outperform|Underperform)\b", re.I)
PRICE_TOKEN_RE = re.compile(
    r"(?P<prefix>[$₩])?\s*(?P<a>\d[\d,]*(?:\.\d+)?)\s*(?:[~\-–]\s*(?P<prefix2>[$₩])?\s*(?P<b>\d[\d,]*(?:\.\d+)?))?\s*(?P<suffix>원|엔|달러|USD|KRW|[$])?",
    re.I,
)


@dataclass
class ParsedReport:
    source_file: str
    report_date: str | None
    filename_date: str | None
    market: str | None
    company: str | None
    ticker: str | None
    exchange: str | None
    rating: str | None
    target_price: float | None
    target_price_raw: str | None
    report_current_price: float | None
    report_current_price_raw: str | None
    stated_upside_pct: float | None
    parse_issue: str | None = None


@dataclass
class PerformanceRow:
    source_file: str
    report_date: str | None
    filename_date: str | None
    market: str | None
    company: str | None
    ticker: str | None
    exchange: str | None
    rating: str | None
    target_price: float | None
    target_price_raw: str | None
    report_current_price: float | None
    report_current_price_raw: str | None
    stated_upside_pct: float | None
    first_trade_date: str | None
    start_close: float | None
    latest_trade_date: str | None
    latest_close: float | None
    return_latest_pct: float | None
    direction_latest: str | None
    return_30d_pct: float | None
    return_90d_pct: float | None
    return_180d_pct: float | None
    return_365d_pct: float | None
    max_high_until_latest: float | None
    max_high_return_pct: float | None
    target_hit_until_latest: bool | None
    first_target_hit_date: str | None
    days_to_target: int | None
    data_issue: str | None
    parse_issue: str | None


def compact_line(line: str) -> str:
    line = line.replace("<br>", " ").replace("<br/>", " ").replace("<br />", " ")
    line = re.sub(r"\s+", " ", line)
    return line.strip()


def clean_name(value: str | None) -> str | None:
    if not value:
        return None
    value = re.sub(r"^#+", "", value).strip()
    value = value.strip("| ")
    value = re.sub(r"\s+", " ", value)
    if not value or set(value) <= {"-", "|"}:
        return None
    return value


def parse_date(path: Path, lines: list[str]) -> tuple[str | None, str | None]:
    filename_date = None
    fm = FILENAME_DATE_RE.search(path.name)
    if fm:
        filename_date = f"{fm.group(1)}-{fm.group(2)}-{fm.group(3)}"

    head = "\n".join(lines[:120])
    km = KOREAN_DATE_RE.search(head)
    if km:
        return f"{int(km.group(1)):04d}-{int(km.group(2)):02d}-{int(km.group(3)):02d}", filename_date
    em = ENGLISH_DATE_RE.search(head)
    if em:
        month = MONTHS[em.group(1)[:3].lower()]
        return f"{int(em.group(3)):04d}-{month:02d}-{int(em.group(2)):02d}", filename_date
    return filename_date, filename_date


def parse_market_from_inside(inside: str) -> tuple[str | None, str | None, str | None]:
    inside = inside.strip()
    if re.fullmatch(r"\d{6}", inside):
        return "KR", inside, "KRX"

    if US_EXCHANGE_RE.search(inside):
        exchange_match = US_EXCHANGE_RE.search(inside)
        exchange = exchange_match.group(1).upper().replace("NSDQ", "NASDAQ") if exchange_match else "US"
        m = US_TICKER_AFTER_EXCHANGE_RE.search(inside) or US_TICKER_BEFORE_EXCHANGE_RE.search(inside)
        if m:
            return "US", m.group(1).upper().replace(".", "-"), exchange
    return None, None, None


def infer_company_before(lines: list[str], idx: int, path: Path) -> str | None:
    for j in range(idx - 1, max(-1, idx - 8), -1):
        candidate = clean_name(lines[j])
        if not candidate:
            continue
        if "Equity Investment Research" in candidate:
            continue
        if re.search(r"\d{4}\s*년|\d{4}-\d{2}-\d{2}", candidate):
            continue
        if candidate.lower() in {"rating", "buy", "sell", "hold"}:
            continue
        return candidate
    stem = path.stem
    name = re.sub(r"^\d{4}-\d{2}-\d{2}_equity-research-", "", stem)
    name = re.sub(r"-\d+$", "", name).replace("-", " ").strip()
    return name or None


def parse_identity(path: Path, lines: list[str]) -> tuple[str | None, str | None, str | None, str | None]:
    # Prefer explicit header/table identity near the front page.
    for idx, line in enumerate(lines[:140]):
        cl = compact_line(line)
        m = TITLE_WITH_CODE_RE.search(cl)
        if not m:
            continue
        inside = m.group("inside").strip()
        market, ticker, exchange = parse_market_from_inside(inside)
        if not market:
            continue
        name = clean_name(m.group("name"))
        if not name:
            name = infer_company_before(lines, idx, path)
        return market, ticker, exchange, name

    # Common old layout: company appears in a table row, then a code-only heading follows.
    for idx, line in enumerate(lines[:140]):
        cl = compact_line(line)
        code_match = CODE_ONLY_HEADING_RE.search(cl)
        if code_match:
            code = code_match.group("code")
            return "KR", code, "KRX", infer_company_before(lines, idx, path)

    # Fallback for US table rows or non-heading lines.
    head = "\n".join(compact_line(x) for x in lines[:80])
    m = re.search(r"([A-Za-z][A-Za-z0-9 &.,'\-]+?)\s*\((NASDAQ|NYSE|AMEX|NSDQ)\s*:?\s*([A-Z][A-Z0-9.\-]{0,7})\)", head, re.I)
    if m:
        exchange = m.group(2).upper().replace("NSDQ", "NASDAQ")
        return "US", m.group(3).upper().replace(".", "-"), exchange, clean_name(m.group(1))

    return None, None, None, None


def parse_rating(lines: list[str]) -> str | None:
    for idx, line in enumerate(lines[:160]):
        if "Rating" in line:
            window = " ".join(compact_line(x) for x in lines[idx : idx + 8])
            m = RATING_RE.search(window)
            if m:
                return m.group(1).title()
    head = " ".join(compact_line(x) for x in lines[:120])
    m = RATING_RE.search(head)
    return m.group(1).title() if m else None


def number_to_float(value: str, market: str | None = None) -> float:
    normalized = value.replace(",", "")
    if market == "KR" and re.fullmatch(r"\d{1,3}(?:\.\d{3})+", value):
        normalized = value.replace(".", "")
    return float(normalized)


def token_has_expected_currency(window: str, token: re.Match[str], market: str | None) -> bool:
    raw = token.group(0)
    suffix = (token.group("suffix") or "").upper()
    prefix = token.group("prefix") or token.group("prefix2") or ""
    post = window[token.end() : token.end() + 10].upper()
    if market == "KR":
        return suffix == "원" or prefix == "₩"
    if market == "US":
        return prefix == "$" or suffix in {"$", "USD", "달러"} or "USD" in post
    return True


def value_from_price_token(token: re.Match[str], market: str | None = None) -> tuple[float, str]:
    raw = token.group(0).strip()
    a = number_to_float(token.group("a"), market)
    b = number_to_float(token.group("b"), market) if token.group("b") else None
    return ((a + b) / 2 if b is not None else a), raw


def choose_price_after_label(text: str, label_re: re.Pattern[str], market: str | None) -> tuple[float | None, str | None]:
    matches = list(label_re.finditer(text))
    for lm in matches:
        window = text[lm.end() : lm.end() + 120]
        tokens = list(PRICE_TOKEN_RE.finditer(window))
        for tm in tokens[:5]:
            if not token_has_expected_currency(window, tm, market):
                continue
            value, raw = value_from_price_token(tm, market)
            return value, raw
    return None, None


def choose_price_before_label(text: str, label_re: re.Pattern[str], market: str | None) -> tuple[float | None, str | None]:
    matches = list(label_re.finditer(text))
    for lm in matches:
        window = text[max(0, lm.start() - 100) : lm.start()]
        tokens = [tm for tm in PRICE_TOKEN_RE.finditer(window) if token_has_expected_currency(window, tm, market)]
        if not tokens:
            continue
        value, raw = value_from_price_token(tokens[-1], market)
        return value, raw
    return None, None


def parse_prices(lines: list[str], market: str | None) -> tuple[float | None, str | None, float | None, str | None, float | None]:
    # Rating box is usually the cleanest source; prepend first-page prose for reports that state target before Rating.
    first_page = " ".join(compact_line(x) for x in lines[:180])
    rating_pos = first_page.lower().find("rating")
    if rating_pos >= 0:
        text = first_page[rating_pos : rating_pos + 900] + " " + first_page[: rating_pos]
    else:
        text = first_page

    target, target_raw = choose_price_after_label(text, TARGET_LABEL_RE, market)
    current, current_raw = choose_price_after_label(text, CURRENT_LABEL_RE, market)

    # Valuation prose often puts the price before "목표 주가/Target Price".
    if target is None:
        target, target_raw = choose_price_before_label(text, TARGET_LABEL_RE, market)

    upside = None
    um = UPSIDE_RE.search(text)
    if um:
        upside = float(um.group(2))
        if um.group(1).startswith("하락") and upside > 0:
            upside = -upside
    return target, target_raw, current, current_raw, upside


def parse_report(path: Path) -> ParsedReport:
    text = path.read_text(encoding="utf-8", errors="ignore")
    lines = [line.rstrip("\n") for line in text.splitlines()]
    report_date, filename_date = parse_date(path, lines)
    market, ticker, exchange, company = parse_identity(path, lines)
    rating = parse_rating(lines)
    target, target_raw, current, current_raw, upside = parse_prices(lines, market)

    issues: list[str] = []
    if market not in {"KR", "US"}:
        issues.append("non_us_kr_or_unparsed_market")
    if not ticker:
        issues.append("missing_ticker")
    if not report_date:
        issues.append("missing_report_date")
    if target is None:
        issues.append("missing_target_price")
    return ParsedReport(
        source_file=str(path),
        report_date=report_date,
        filename_date=filename_date,
        market=market,
        company=company,
        ticker=ticker,
        exchange=exchange,
        rating=rating,
        target_price=target,
        target_price_raw=target_raw,
        report_current_price=current,
        report_current_price_raw=current_raw,
        stated_upside_pct=upside,
        parse_issue=";".join(issues) if issues else None,
    )


def safe_pct(new: float | None, old: float | None) -> float | None:
    if new is None or old in (None, 0) or pd.isna(new) or pd.isna(old):
        return None
    return (float(new) / float(old) - 1.0) * 100.0


def date_from_string(value: str | None) -> dt.date | None:
    if not value:
        return None
    return dt.date.fromisoformat(value)


def fetch_kr_prices(ticker: str, start: dt.date, end: dt.date) -> pd.DataFrame:
    df = stock.get_market_ohlcv_by_date(start.strftime("%Y%m%d"), end.strftime("%Y%m%d"), ticker)
    if df.empty:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    out = pd.DataFrame(index=pd.to_datetime(df.index))
    out["open"] = pd.to_numeric(df.iloc[:, 0], errors="coerce")
    out["high"] = pd.to_numeric(df.iloc[:, 1], errors="coerce")
    out["low"] = pd.to_numeric(df.iloc[:, 2], errors="coerce")
    out["close"] = pd.to_numeric(df.iloc[:, 3], errors="coerce")
    out["volume"] = pd.to_numeric(df.iloc[:, 4], errors="coerce") if df.shape[1] > 4 else None
    return out.dropna(subset=["close"])


def fetch_us_prices(ticker: str, start: dt.date, end: dt.date) -> pd.DataFrame:
    # yfinance end is exclusive; add one day at call site if an inclusive as-of is desired.
    df = yf.download(ticker, start=start.isoformat(), end=(end + dt.timedelta(days=1)).isoformat(), progress=False, auto_adjust=True, threads=False)
    if df.empty:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0].lower() for c in df.columns]
    else:
        df.columns = [str(c).lower() for c in df.columns]
    out = pd.DataFrame(index=pd.to_datetime(df.index))
    for src, dst in [("open", "open"), ("high", "high"), ("low", "low"), ("close", "close"), ("volume", "volume")]:
        if src in df.columns:
            out[dst] = pd.to_numeric(df[src], errors="coerce")
    return out.dropna(subset=["close"])


def evaluate_report(parsed: ParsedReport, prices: pd.DataFrame, as_of: dt.date) -> PerformanceRow:
    data_issue = None
    report_dt = date_from_string(parsed.report_date)
    if report_dt is None:
        data_issue = "missing_report_date"
        return empty_performance(parsed, data_issue)
    if prices.empty:
        return empty_performance(parsed, "missing_market_prices")

    prices = prices.sort_index()
    start_ts = pd.Timestamp(report_dt)
    available = prices[prices.index >= start_ts]
    if available.empty:
        return empty_performance(parsed, "no_price_on_or_after_report_date")

    start_row = available.iloc[0]
    start_date = available.index[0].date()
    start_close = float(start_row["close"])
    latest_row = prices[prices.index <= pd.Timestamp(as_of)].iloc[-1]
    latest_date = prices[prices.index <= pd.Timestamp(as_of)].index[-1].date()
    latest_close = float(latest_row["close"])

    returns: dict[int, float | None] = {}
    for days in (30, 90, 180, 365):
        horizon = prices[(prices.index >= pd.Timestamp(start_date)) & (prices.index <= pd.Timestamp(report_dt + dt.timedelta(days=days)))]
        returns[days] = safe_pct(float(horizon.iloc[-1]["close"]), start_close) if not horizon.empty else None

    until_latest = prices[(prices.index >= pd.Timestamp(start_date)) & (prices.index <= pd.Timestamp(as_of))]
    max_high = float(until_latest["high"].max()) if not until_latest.empty and "high" in until_latest else None
    max_high_return = safe_pct(max_high, start_close)

    hit = None
    first_hit_date = None
    days_to_target = None
    if parsed.target_price is not None and max_high is not None:
        hit_frame = until_latest[until_latest["high"] >= parsed.target_price]
        hit = not hit_frame.empty
        if hit:
            first_hit_date = hit_frame.index[0].date().isoformat()
            days_to_target = (hit_frame.index[0].date() - start_date).days

    latest_ret = safe_pct(latest_close, start_close)
    direction = None
    if latest_ret is not None:
        direction = "up" if latest_ret > 0 else "down" if latest_ret < 0 else "flat"

    return PerformanceRow(
        source_file=parsed.source_file,
        report_date=parsed.report_date,
        filename_date=parsed.filename_date,
        market=parsed.market,
        company=parsed.company,
        ticker=parsed.ticker,
        exchange=parsed.exchange,
        rating=parsed.rating,
        target_price=parsed.target_price,
        target_price_raw=parsed.target_price_raw,
        report_current_price=parsed.report_current_price,
        report_current_price_raw=parsed.report_current_price_raw,
        stated_upside_pct=parsed.stated_upside_pct,
        first_trade_date=start_date.isoformat(),
        start_close=start_close,
        latest_trade_date=latest_date.isoformat(),
        latest_close=latest_close,
        return_latest_pct=latest_ret,
        direction_latest=direction,
        return_30d_pct=returns[30],
        return_90d_pct=returns[90],
        return_180d_pct=returns[180],
        return_365d_pct=returns[365],
        max_high_until_latest=max_high,
        max_high_return_pct=max_high_return,
        target_hit_until_latest=hit,
        first_target_hit_date=first_hit_date,
        days_to_target=days_to_target,
        data_issue=data_issue,
        parse_issue=parsed.parse_issue,
    )


def empty_performance(parsed: ParsedReport, data_issue: str) -> PerformanceRow:
    return PerformanceRow(
        source_file=parsed.source_file,
        report_date=parsed.report_date,
        filename_date=parsed.filename_date,
        market=parsed.market,
        company=parsed.company,
        ticker=parsed.ticker,
        exchange=parsed.exchange,
        rating=parsed.rating,
        target_price=parsed.target_price,
        target_price_raw=parsed.target_price_raw,
        report_current_price=parsed.report_current_price,
        report_current_price_raw=parsed.report_current_price_raw,
        stated_upside_pct=parsed.stated_upside_pct,
        first_trade_date=None,
        start_close=None,
        latest_trade_date=None,
        latest_close=None,
        return_latest_pct=None,
        direction_latest=None,
        return_30d_pct=None,
        return_90d_pct=None,
        return_180d_pct=None,
        return_365d_pct=None,
        max_high_until_latest=None,
        max_high_return_pct=None,
        target_hit_until_latest=None,
        first_target_hit_date=None,
        days_to_target=None,
        data_issue=data_issue,
        parse_issue=parsed.parse_issue,
    )


def round_floats(row: dict[str, object]) -> dict[str, object]:
    out = {}
    for key, value in row.items():
        if isinstance(value, float):
            if math.isnan(value):
                out[key] = None
            else:
                out[key] = round(value, 6)
        else:
            out[key] = value
    return out


def write_csv(path: Path, rows: Iterable[object]) -> None:
    dict_rows = [round_floats(asdict(row)) for row in rows]
    path.parent.mkdir(parents=True, exist_ok=True)
    if not dict_rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(dict_rows[0].keys()))
        writer.writeheader()
        writer.writerows(dict_rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build point-in-time report target and price-performance dataset from converted Markdown equity reports.")
    parser.add_argument("--markdown-dir", default="data/markdown")
    parser.add_argument("--output", default="data/report_performance.csv")
    parser.add_argument("--parsed-output", default="data/report_parsed.csv")
    parser.add_argument("--issues-output", default="data/report_parse_issues.csv")
    parser.add_argument("--as-of", default=dt.date.today().isoformat())
    parser.add_argument("--markets", nargs="+", default=["KR", "US"], choices=["KR", "US"])
    parser.add_argument("--sleep", type=float, default=0.05, help="Seconds to sleep between market-data calls.")
    args = parser.parse_args()

    as_of = dt.date.fromisoformat(args.as_of)
    md_paths = sorted(Path(args.markdown_dir).glob("*.md"))
    parsed_all_raw = [parse_report(path) for path in md_paths]
    parsed_all = [r for r in parsed_all_raw if (r.ticker or "").upper() not in EXCLUDED_DELISTED_TICKERS]
    parsed = [r for r in parsed_all if r.market in set(args.markets)]

    write_csv(Path(args.parsed_output), parsed_all)
    write_csv(Path(args.issues_output), [r for r in parsed_all if r.parse_issue])

    groups: dict[tuple[str, str], list[ParsedReport]] = {}
    for r in parsed:
        if r.ticker and r.report_date:
            groups.setdefault((r.market or "", r.ticker), []).append(r)

    price_cache: dict[tuple[str, str], pd.DataFrame] = {}
    for (market, ticker), reports in groups.items():
        min_date = min(date_from_string(r.report_date) for r in reports if date_from_string(r.report_date))
        assert min_date is not None
        start = min_date - dt.timedelta(days=10)
        try:
            if market == "KR":
                price_cache[(market, ticker)] = fetch_kr_prices(ticker, start, as_of)
            else:
                price_cache[(market, ticker)] = fetch_us_prices(ticker, start, as_of)
        except Exception as exc:  # keep batch generation usable even when a single quote source fails
            print(f"market-data error {market} {ticker}: {exc}", file=sys.stderr)
            price_cache[(market, ticker)] = pd.DataFrame()
        time.sleep(args.sleep)

    rows: list[PerformanceRow] = []
    for r in parsed:
        prices = price_cache.get((r.market or "", r.ticker or ""), pd.DataFrame())
        rows.append(evaluate_report(r, prices, as_of))

    rows.sort(key=lambda x: (x.report_date or "9999-99-99", x.market or "", x.ticker or "", x.source_file))
    write_csv(Path(args.output), rows)

    ok = sum(1 for row in rows if not row.data_issue)
    print(f"parsed_reports={len(parsed_all)} included_us_kr={len(parsed)} performance_rows={len(rows)} priced_rows={ok} as_of={as_of}")
    print(f"wrote {args.output}")
    print(f"wrote {args.parsed_output}")
    print(f"wrote {args.issues_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
