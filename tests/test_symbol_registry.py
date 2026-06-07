from snusmic_pipeline.ingest.extract_pdf import infer_exchange, ticker_from_text
from snusmic_pipeline.market_data.currency import yfinance_symbol
from snusmic_pipeline.market_data.symbols import company_symbol_rule, infer_yfinance_symbol


def test_company_symbol_rules_cover_recent_overseas_reports() -> None:
    expected = {
        "Aixtron SE": ("AIXA", "ETR", "AIXA.DE", "EUR"),
        "Soitec SA": ("SOI", "EPA", "SOI.PA", "EUR"),
        "Global Unichip Corp.": ("3443", "TWSE", "3443.TW", "TWD"),
    }

    for company, values in expected.items():
        rule = company_symbol_rule(company)
        assert rule is not None
        assert (rule.ticker, rule.exchange, rule.yfinance_symbol, rule.currency) == values
        assert ticker_from_text("", company_hint=company) == values[0]
        assert infer_exchange(values[0]) == (values[1], "")


def test_kosdaq_segment_rules_prevent_ks_artifact_for_samcns() -> None:
    rule = company_symbol_rule("샘씨엔에스")
    assert rule is not None
    assert (rule.ticker, rule.exchange, rule.yfinance_symbol, rule.currency) == (
        "252990",
        "KRX",
        "252990.KQ",
        "KRW",
    )
    assert infer_yfinance_symbol("252990", "KRX") == "252990.KQ"
    assert yfinance_symbol("252990", "KRX") == "252990.KQ"


def test_default_krx_segment_stays_kospi_when_not_in_kosdaq_rules() -> None:
    assert infer_yfinance_symbol("306200", "KRX") == "306200.KS"
    assert yfinance_symbol("306200", "KRX") == "306200.KS"
