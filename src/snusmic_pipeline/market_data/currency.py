from __future__ import annotations

from collections.abc import Callable
from datetime import datetime

import pandas as pd

FX_SYMBOLS = {
    "USD": "KRW=X",
    "JPY": "JPYKRW=X",
    "HKD": "HKDKRW=X",
    "CNY": "CNYKRW=X",
    "EUR": "EURKRW=X",
    "CHF": "CHFKRW=X",
}

EXCHANGE_CURRENCIES = {
    "KRX": "KRW",
    "KOSDAQ": "KRW",
    "KOSPI": "KRW",
    "NASDAQ": "USD",
    "NYSE": "USD",
    "AMEX": "USD",
    "NYSEAMERICAN": "USD",
    "TYO": "JPY",
    "TSE": "JPY",
    "HKG": "HKD",
    "HKEX": "HKD",
    "SZSE": "CNY",
    "SSE": "CNY",
    "SHE": "CNY",
    "SHA": "CNY",
    "EPA": "EUR",
    "AMS": "EUR",
    "FRA": "EUR",
    "ETR": "EUR",
    "BIT": "EUR",
    "MIL": "EUR",
    "SIX": "CHF",
    "SWX": "CHF",
    "LSE": "GBP",
    "LON": "GBP",
    "TSX": "CAD",
    "ASX": "AUD",
}

# Exchange identifiers that may appear inside a SMIC PDF report. The match is
# case-insensitive and looks at the first ~3,000 characters of the document
# (where the cover-page meta lives). This lets the pipeline auto-classify
# Japan/HK/China/EU listings without maintaining a per-ticker hard-coded list.
EXCHANGE_KEYWORDS = {
    "TYO": ["TYO", "TSE", "TOKYO", "JAPAN EXCHANGE", "JPX", "NIKKEI"],
    "HKG": ["HKEX", "HKG", "HKSE", "HONG KONG"],
    "SZSE": ["SZSE", "SHENZHEN"],
    "SSE": ["SSE", "SHANGHAI STOCK", "SHANGHAI EXCHANGE"],
    "NASDAQ": ["NASDAQ"],
    "NYSE": ["NYSE", "NEW YORK STOCK EXCHANGE"],
    "EPA": ["EURONEXT PARIS", "PARIS BOURSE", " PARIS "],
    "AMS": ["EURONEXT AMSTERDAM", "AMSTERDAM"],
    "FRA": ["FRANKFURT", "DEUTSCHE BORSE", "XETRA"],
    "SIX": ["SWISS EXCHANGE", "SIX SWISS", "SIX EXCHANGE"],
    "LSE": ["LONDON STOCK EXCHANGE", "LSE LISTING"],
    "ASX": ["AUSTRALIAN SECURITIES EXCHANGE", "ASX:"],
    "TSX": ["TORONTO STOCK EXCHANGE", "TSX:"],
    "KRX": ["KOSPI", "KOSDAQ", "KRX:", "KOREA EXCHANGE"],
}

# yfinance ticker suffix per exchange. Used to lift a raw market identifier
# (e.g. KRX "100090") to a yfinance symbol ("100090.KS") so callers can fetch
# prices and FX consistently. KRX is a special case — the suffix depends on
# which segment (KOSPI vs KOSDAQ) the listing belongs to, so the canonical
# resolver lives below.
EXCHANGE_TO_YFINANCE_SUFFIX = {
    "TYO": ".T",
    "TSE": ".T",
    "HKG": ".HK",
    "HKEX": ".HK",
    "SZSE": ".SZ",
    "SHE": ".SZ",
    "SSE": ".SS",
    "SHA": ".SS",
    "EPA": ".PA",
    "AMS": ".AS",
    "FRA": ".F",
    "ETR": ".DE",
    "SIX": ".SW",
    "SWX": ".SW",
    "LSE": ".L",
    "LON": ".L",
    "TSX": ".TO",
    "ASX": ".AX",
}

Downloader = Callable[[str, datetime, datetime], pd.DataFrame]


def normalize_currency(currency: str | None) -> str:
    value = str(currency or "").strip().upper()
    if value in {"원", "KRW", "WON"}:
        return "KRW"
    if value in {"엔", "JPY", "YEN"}:
        return "JPY"
    if value in {"달러", "$", "US$", "USD"}:
        return "USD"
    return value


def currency_for_symbol(symbol: str, exchange: str = "") -> str:
    exchange_currency = EXCHANGE_CURRENCIES.get(str(exchange or "").strip().upper())
    if exchange_currency:
        return exchange_currency
    symbol = str(symbol or "").strip().upper()
    suffix_map = {
        ".KS": "KRW",
        ".KQ": "KRW",
        ".T": "JPY",
        ".HK": "HKD",
        ".SZ": "CNY",
        ".SS": "CNY",
        ".PA": "EUR",
        ".AS": "EUR",
        ".F": "EUR",
        ".DE": "EUR",
        ".SW": "CHF",
        ".L": "GBP",
        ".TO": "CAD",
        ".AX": "AUD",
    }
    for suffix, currency in suffix_map.items():
        if symbol.endswith(suffix):
            return currency
    return "USD" if symbol else ""


def infer_exchange_from_text(text: str | None) -> str:
    """Scan the cover-page text of a SMIC report for a known exchange marker."""

    if not text:
        return ""
    upper = text[:3000].upper()
    for exchange_code, keywords in EXCHANGE_KEYWORDS.items():
        for keyword in keywords:
            if keyword.upper() in upper:
                return exchange_code
    return ""


def yfinance_symbol(ticker: str, exchange: str = "") -> str:
    """Build a yfinance-shaped ticker (e.g. ``100090.KS``) from a raw symbol.

    KRX numeric listings are looked up against the KOSPI/KOSDAQ segment so the
    correct ``.KS`` / ``.KQ`` suffix is used. For every other supported venue
    the suffix comes from ``EXCHANGE_TO_YFINANCE_SUFFIX``. If the ticker
    already carries a suffix or the exchange is not mapped, the input is
    returned unchanged.
    """

    raw = str(ticker or "").strip()
    if not raw:
        return ""
    if "." in raw:
        return raw  # already in yfinance shape
    code = str(exchange or "").strip().upper()
    if code in {"KRX", "KOSPI", "KOSDAQ"} and raw.isdigit() and len(raw) == 6:
        return f"{raw}.{'KS' if code == 'KOSPI' else 'KQ' if code == 'KOSDAQ' else 'KS'}"
    suffix = EXCHANGE_TO_YFINANCE_SUFFIX.get(code, "")
    if suffix:
        return f"{raw}{suffix}"
    return raw


def yfinance_fx_symbol(currency: str) -> str:
    return FX_SYMBOLS.get(normalize_currency(currency), "")


def required_fx_currencies(currencies: list[str] | set[str]) -> set[str]:
    return {
        normalize_currency(currency)
        for currency in currencies
        if normalize_currency(currency) and normalize_currency(currency) != "KRW"
    }


def download_fx_rates(
    currencies: list[str] | set[str], start: datetime, end: datetime, downloader: Downloader
) -> pd.DataFrame:
    rows = []
    for currency in sorted(required_fx_currencies(currencies)):
        fx_symbol = yfinance_fx_symbol(currency)
        if not fx_symbol:
            continue
        frame = downloader(fx_symbol, start, end)
        if frame.empty:
            continue
        normalized = _normalize_history_frame(frame)
        if normalized.empty:
            continue
        normalized["currency"] = currency
        normalized["fx_symbol"] = fx_symbol
        rows.append(normalized[["date", "currency", "fx_symbol", "krw_per_unit"]])
    if not rows:
        return pd.DataFrame(columns=["date", "currency", "fx_symbol", "krw_per_unit"])
    return (
        pd.concat(rows, ignore_index=True)
        .dropna(subset=["krw_per_unit"])
        .drop_duplicates(["date", "currency"], keep="last")
        .sort_values(["currency", "date"])
    )


def convert_ohlcv_to_krw(history: pd.DataFrame, currency: str, fx_rates: pd.DataFrame) -> pd.DataFrame:
    currency = normalize_currency(currency)
    frame = history.copy()
    if frame.empty or currency in {"", "KRW"}:
        return frame
    with_rate = attach_krw_rate(frame[["date"]].copy(), currency, fx_rates)
    if with_rate["krw_per_unit"].isna().all():
        return frame
    rate = with_rate["krw_per_unit"].to_numpy(dtype=float)
    for column in ["open", "high", "low", "close"]:
        if column in frame:
            frame[column] = pd.to_numeric(frame[column], errors="coerce") * rate
    return frame


def convert_value_to_krw(
    value: float | None, currency: str, date: str, fx_rates: pd.DataFrame
) -> float | None:
    if value is None:
        return None
    currency = normalize_currency(currency)
    if currency in {"", "KRW"}:
        return float(value)
    rate = krw_rate_on_or_before(currency, date, fx_rates)
    if rate is None:
        return float(value)
    return float(value) * rate


def attach_krw_rate(rows: pd.DataFrame, currency: str, fx_rates: pd.DataFrame) -> pd.DataFrame:
    out = rows.copy()
    out["date"] = pd.to_datetime(out["date"])
    currency = normalize_currency(currency)
    if currency in {"", "KRW"}:
        out["krw_per_unit"] = 1.0
        return out
    rates = (
        fx_rates[fx_rates["currency"].astype(str).str.upper() == currency].copy()
        if not fx_rates.empty
        else pd.DataFrame()
    )
    if rates.empty:
        out["krw_per_unit"] = pd.NA
        return out
    rates["date"] = pd.to_datetime(rates["date"])
    rates = rates.sort_values("date")
    out = pd.merge_asof(
        out.sort_values("date"), rates[["date", "krw_per_unit"]], on="date", direction="backward"
    )
    if out["krw_per_unit"].isna().any():
        out = pd.merge_asof(
            out.drop(columns=["krw_per_unit"]).sort_values("date"),
            rates[["date", "krw_per_unit"]],
            on="date",
            direction="forward",
        )
    return out


def krw_rate_on_or_before(currency: str, date: str, fx_rates: pd.DataFrame) -> float | None:
    currency = normalize_currency(currency)
    if currency in {"", "KRW"}:
        return 1.0
    if fx_rates.empty:
        return None
    rates = fx_rates[fx_rates["currency"].astype(str).str.upper() == currency].copy()
    if rates.empty:
        return None
    rates["date"] = pd.to_datetime(rates["date"])
    target_date = pd.to_datetime(date)
    before = rates[rates["date"] <= target_date].sort_values("date")
    if not before.empty:
        return float(before.iloc[-1]["krw_per_unit"])
    after = rates[rates["date"] > target_date].sort_values("date")
    if not after.empty:
        return float(after.iloc[0]["krw_per_unit"])
    return None


def _normalize_history_frame(frame: pd.DataFrame) -> pd.DataFrame:
    data = frame.copy()
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)
    if "date" in data.columns and "close" in data.columns:
        return pd.DataFrame(
            {
                "date": pd.to_datetime(data["date"]).dt.date.astype(str),
                "krw_per_unit": pd.to_numeric(data["close"], errors="coerce"),
            }
        )
    if "Close" not in data:
        return pd.DataFrame(columns=["date", "krw_per_unit"])
    index = pd.to_datetime(data.index).tz_localize(None)
    return pd.DataFrame(
        {"date": index.date.astype(str), "krw_per_unit": pd.to_numeric(data["Close"], errors="coerce")}
    )
