from datetime import datetime

import pandas as pd

from snusmic_pipeline.ingest.extract_pdf import infer_currency, infer_exchange
from snusmic_pipeline.market_data.currency import (
    convert_ohlcv_to_krw,
    convert_value_to_krw,
    currency_for_symbol,
    download_fx_rates,
    infer_exchange_from_text,
    yfinance_fx_symbol,
    yfinance_symbol,
)


def fake_downloader(symbol: str, start: datetime, end: datetime) -> pd.DataFrame:
    rates = {
        "KRW=X": [1300.0, 1310.0],
        "JPYKRW=X": [9.0, 9.1],
    }[symbol]
    return pd.DataFrame(
        {
            "date": ["2024-01-02", "2024-01-03"],
            "open": rates,
            "high": rates,
            "low": rates,
            "close": rates,
            "volume": [0, 0],
        }
    )


def test_yfinance_fx_symbols_match_requested_pairs():
    assert yfinance_fx_symbol("USD") == "KRW=X"
    assert yfinance_fx_symbol("JPY") == "JPYKRW=X"


def test_currency_for_symbol_uses_exchange_and_suffix():
    assert currency_for_symbol("306200.KS", "KRX") == "KRW"
    assert currency_for_symbol("6857.T", "TYO") == "JPY"
    assert currency_for_symbol("IRMD", "NASDAQ") == "USD"


def test_infer_exchange_from_text_finds_known_keywords():
    assert infer_exchange_from_text("Listed on Tokyo Stock Exchange (TYO: 5726)") == "TYO"
    assert infer_exchange_from_text("Trading on HKEX, Hong Kong") == "HKG"
    assert infer_exchange_from_text("Listed on Shenzhen / SZSE") == "SZSE"
    assert infer_exchange_from_text("Listed on Euronext Paris") == "EPA"
    assert infer_exchange_from_text("Listed on SIX Swiss Exchange") == "SIX"
    assert infer_exchange_from_text("") == ""
    assert infer_exchange_from_text(None) == ""


def test_yfinance_symbol_lifts_raw_tickers_into_yf_format():
    assert yfinance_symbol("100090", "KOSPI") == "100090.KS"
    assert yfinance_symbol("100090", "KOSDAQ") == "100090.KQ"
    assert yfinance_symbol("002340", "SZSE") == "002340.SZ"
    assert yfinance_symbol("5726", "TYO") == "5726.T"
    assert yfinance_symbol("BESI", "AMS") == "BESI.AS"
    assert yfinance_symbol("AAPL", "NASDAQ") == "AAPL"
    assert yfinance_symbol("100090.KS", "") == "100090.KS"  # already suffixed
    assert yfinance_symbol("", "KRX") == ""


def test_infer_currency_prefers_exchange_mapping_over_pdf_dollar_signs():
    """Regression: SZSE/SIX/AMS/EPA reports were silently classified as USD."""
    text_with_dollar = "Listed on Shenzhen Stock Exchange. Target price: $1,200"
    assert infer_currency(text_with_dollar, "002340", "SZSE") == "CNY"
    assert infer_currency(text_with_dollar, "BESI", "AMS") == "EUR"
    assert infer_currency("Listed on SIX Swiss Exchange", "LONN", "SIX") == "CHF"
    assert infer_currency("Listed on Euronext Paris", "GTT", "EPA") == "EUR"


def test_infer_currency_falls_back_to_text_keywords_when_exchange_missing():
    text = "Listed on Tokyo Stock Exchange (TYO: 5726). Target price ¥4500"
    assert infer_currency(text, "5726", "") == "JPY"


def test_infer_currency_default_paths():
    assert infer_currency("", "100090", "") == "KRW"  # 6-digit numeric → KRX
    assert infer_currency("", "5726", "") == "JPY"  # 4-digit numeric → TYO
    assert infer_currency("Target price: $230", "AAPL", "") == "USD"


def test_infer_exchange_uses_pdf_text_when_ticker_unmapped():
    text = "Common stock listed on the Hong Kong Stock Exchange (HKEX)."
    exchange, _note = infer_exchange("9988", text)
    assert exchange == "HKG"


def test_convert_foreign_prices_to_krw_with_asof_rates():
    fx = download_fx_rates({"USD", "JPY"}, datetime(2024, 1, 1), datetime(2024, 1, 5), fake_downloader)
    history = pd.DataFrame(
        {
            "date": ["2024-01-03"],
            "open": [10.0],
            "high": [11.0],
            "low": [9.0],
            "close": [10.0],
            "volume": [100],
        }
    )

    converted = convert_ohlcv_to_krw(history, "USD", fx)

    assert converted.iloc[0]["close"] == 13100.0
    assert convert_value_to_krw(100.0, "JPY", "2024-01-03", fx) == 910.0
