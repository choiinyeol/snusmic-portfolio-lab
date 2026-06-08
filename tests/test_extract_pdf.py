from pathlib import Path

from snusmic_pipeline.ingest.extract_pdf import parse_money, parse_report_text
from snusmic_pipeline.ingest.models import ExtractedReport, ReportMeta


def test_parse_money_handles_commas_and_currency():
    assert parse_money("₩ 41,600") == 41600
    assert parse_money("$52.66") == 52.66


def test_parse_report_text_extracts_single_target_for_korean_report():
    text = """
    SK오션플랜트 (100090)
    Buy
    현재주가: 23,300 원
    목표주가: 41,600 원
    """

    parsed = parse_report_text(text)

    assert parsed["ticker"] == "100090"
    assert parsed["exchange"] == "KRX"
    assert parsed["rating"] == "Buy"
    assert parsed["report_current_price"] == 23300
    assert parsed["base_target"] == 41600
    assert parsed["target_currency"] == "KRW"
    assert parsed["status"] == "ok"


def test_parse_report_text_uses_fair_value_range_midpoint():
    text = """
    교촌에프앤비
    ## (075580)
    Rating
    Buy
    적정주가: 27,500 ~ 36,300원 현재주가: 상승여력: -
    """

    parsed = parse_report_text(text, company_hint="교촌에프앤비")

    assert parsed["ticker"] == "075580"
    assert parsed["base_target"] == 31900
    assert parsed["status"] == "ok"


def test_parse_report_text_uses_approval_price_as_target():
    text = """
    지트리비앤티 (115450)
    승인시주가: 82,550 원 현재주가: 27,450 원 상승여력: 200.7%
    """

    parsed = parse_report_text(text, company_hint="지트리비앤티")

    assert parsed["ticker"] == "115450"
    assert parsed["report_current_price"] == 27450
    assert parsed["base_target"] == 82550
    assert parsed["status"] == "ok"


def test_parse_report_text_skips_implausible_target_heading_noise():
    text = """
    교촌에프앤비 (075580)
    본문에서는 목표주가 band를 제시하겠다.
    - 5.1. Earning Table
    적정주가: 27,500 ~ 36,300원 현재주가: 상승여력: -
    """

    parsed = parse_report_text(text, company_hint="교촌에프앤비")

    assert parsed["base_target"] == 31900
    assert "implausible" in parsed["note"]


def test_parse_report_text_extracts_non_buy_rating_without_failing_target_parse():
    text = """
    Chewy (CHWY)
    Rating: Attention
    Current Price: $42
    Target Price: $36
    """

    parsed = parse_report_text(text)

    assert parsed["ticker"] == "CHWY"
    assert parsed["rating"] == "Attention"
    assert parsed["base_target"] == 36
    assert parsed["status"] == "ok"
    assert "Non-buy rating" in parsed["note"]


def test_parse_report_text_extracts_markdown_heading_rating():
    parsed = parse_report_text("##### Rating\n## Strong Buy\n목표주가: 12,000원\nSample (123456)")

    assert parsed["rating"] == "Strong Buy"
    assert parsed["base_target"] == 12000


def test_parse_report_text_extracts_bear_base_bull():
    text = """
    Robotis (108490)
    Bear Case 250,900
    Base Case 355,800
    Bull Case 646,500
    """

    parsed = parse_report_text(text)

    assert parsed["ticker"] == "108490"
    assert parsed["bear_target"] == 250900
    assert parsed["base_target"] == 355800
    assert parsed["bull_target"] == 646500


def test_known_overseas_company_mapping_beats_noisy_parentheses():
    parsed = parse_report_text("JILPT (27E) noisy valuation text", company_hint="JAC recruitment Co. Ltd")

    assert parsed["ticker"] == "2124"
    assert parsed["exchange"] == "TYO"
    assert parsed["target_currency"] == "JPY"


def test_known_overseas_company_mapping_beats_page_number_parentheses():
    parsed = parse_report_text(
        "Bilibili(NASDAQ: BILI)\n# (075580)\n목표주가: 72.95(USD) 현재주가: 45.90(USD)",
        company_hint="Bili bili",
    )

    assert parsed["ticker"] == "BILI"
    assert parsed["exchange"] == "NASDAQ"
    assert parsed["target_currency"] == "USD"
    assert parsed["base_target"] == 72.95


def test_known_japanese_company_mapping_sets_jpy_currency():
    parsed = parse_report_text(
        "CyberAgent Inc. (4751.T)\n# (075580)\n목표주가(Bull): 3610엔 현재주가: 2,099엔",
        company_hint="Cyber Agent",
    )

    assert parsed["ticker"] == "4751"
    assert parsed["exchange"] == "TYO"
    assert parsed["target_currency"] == "JPY"


def test_known_z_holdings_mapping_sets_jpy_currency():
    parsed = parse_report_text("Z Holdings (4689)\n목표주가: 1,210 JPY", company_hint="Z-holdings")

    assert parsed["ticker"] == "4689"
    assert parsed["exchange"] == "TYO"
    assert parsed["target_currency"] == "JPY"


def test_known_korean_company_mapping_beats_bad_pdf_ticker():
    parsed = parse_report_text(
        "쿠쿠홈시스(003410)\n## (075580)\n목표주가: 66,500 원", company_hint="쿠쿠홈시스"
    )

    assert parsed["ticker"] == "284740"
    assert parsed["exchange"] == "KRX"


def test_known_hanwha_solutions_mapping_beats_bad_pdf_ticker():
    parsed = parse_report_text(
        "|한화솔루션 (009380) 2020년 11월 28일|\n현재주가: 49,000 원\n목표주가: 75,000 원",
        company_hint="한화솔루션",
    )

    assert parsed["ticker"] == "009830"
    assert parsed["exchange"] == "KRX"
    assert parsed["base_target"] == 75000


def test_korean_dot_thousands_target_is_not_decimal_price():
    text = """
    카카오게임즈 (293490)
    목표주가:
    Bull 151.300 원/ Bear 120,700 원
    현재주가: 97,900 원 상승여력: 55% / 23%
    """

    parsed = parse_report_text(text)

    assert parsed["ticker"] == "293490"
    assert parsed["bull_target"] == 151300
    assert parsed["base_target"] == 151300
    assert parsed["base_target"] != 151.3


def test_base_case_eps_is_not_used_as_target_price():
    text = """
    글로벌텍스프리 (204620)
    현재주가: 3,800 원 Bull Case: 6,780 원
    Base Case: 4,925 원
    2023E Bull Case EPS 302원, Base Case EPS 219원에 Target PER 22.46배를 적용
    """

    parsed = parse_report_text(text)

    assert parsed["base_target"] == 4925
    assert parsed["bull_target"] == 6780
    assert parsed["base_target"] != 219


def test_target_price_before_korean_label_beats_following_year_noise():
    text = "8,100원을 Base case 목표주가로 제시한다. 동사는 22년 코스닥으로 이전 상장했다."

    parsed = parse_report_text(text, company_hint="인카금융서비스")

    assert parsed["base_target"] == 8100


def test_current_price_before_target_label_does_not_become_target():
    text = "현재주가: 23,300 원 목표주가: 41,600 원 상승여력: 78.5%"

    parsed = parse_report_text(text, company_hint="SK오션플랜트")

    assert parsed["report_current_price"] == 23300
    assert parsed["base_target"] == 41600

def test_extracted_report_builds_dual_output_report_artifact():
    report = ExtractedReport(
        meta=ReportMeta(
            page=1,
            ordinal=1,
            date="2026-01-02",
            title="Demo",
            company="Demo Corp",
            slug="demo",
            post_url="https://example.com/post",
            pdf_url="https://example.com/file.pdf",
        ),
        pdf_path=Path("data/pdfs/demo.pdf"),
        markdown_path=Path("data/markdown/demo.md"),
        ticker="DEMO",
        exchange="NASDAQ",
        rating="Buy",
        base_target=123.0,
        target_currency="USD",
        investment_points="quality, margin",
        extraction_status="ok",
    )

    artifact = report.to_report_artifact(pdf_sha256="abc123")

    assert artifact.pdf_path == Path("data/pdfs/demo.pdf")
    assert artifact.markdown_path == Path("data/markdown/demo.md")
    assert artifact.pdf_sha256 == "abc123"
    assert artifact.structured_fields.ticker == "DEMO"
    assert artifact.structured_fields.base_target == 123.0
    assert artifact.structured_fields.investment_points == "quality, margin"

def test_current_target_pair_with_korean_suffix_keeps_full_current_price():
    text = """
    비츠로셀 (082920)
    Rating

    #### Buy

    현재주가: 목표주가:

    45,250원 78,450원 73.4%
    """

    parsed = parse_report_text(text, company_hint="비츠로셀")

    assert parsed["report_current_price"] == 45250
    assert parsed["base_target"] == 78450


def test_parse_report_text_marks_extreme_target_current_ratio_for_review():
    text = """
    비츠로셀 (082920)
    Buy
    현재주가: 45,250 원
    목표주가: 979,541 원
    """

    parsed = parse_report_text(text, company_hint="비츠로셀")

    assert parsed["base_target"] == 979541
    assert parsed["status"] == "needs_review"
    assert "Target/current ratio looks too high" in parsed["note"]


def test_szse_six_digit_ticker_allows_cny_decimal_target():
    text = """
    GEM Co., Ltd.GEM (格林美, 002340.SZ)
    목표주가: 11.35 위안 현재주가: 7.63 위안 상승여력: 49%
    """

    parsed = parse_report_text(text, company_hint="GEM Co., Ltd.")

    assert parsed["ticker"] == "002340"
    assert parsed["exchange"] == "SZSE"
    assert parsed["target_currency"] == "CNY"
    assert parsed["report_current_price"] == 7.63
    assert parsed["base_target"] == 11.35
    assert parsed["status"] == "ok"


def test_target_price_label_with_preferred_stock_market_cap_noise():
    text = """
    S-Oil (010950)
    Buy
    0 7 B (원) 86,067 Target PBR Multiple 1.5x ROE(%) 20.8%
    (-) 우선주 시가총액(십억 원) 190 목표주가(원) 128,400 현재주가(원) 80,500 상승여력(%) 59.5%
    """

    parsed = parse_report_text(text)

    assert parsed["report_current_price"] == 80500
    assert parsed["base_target"] == 128400
    assert parsed["base_target"] != 190


def test_equal_current_and_target_candidate_uses_next_target_candidate():
    text = (
        "현재주가 : 238.30 위안 목표주가 238.30\n현재주가 : 238.30 위안 목표주가 : 331.70 위안 상승여력: 39%"
    )

    parsed = parse_report_text(text, company_hint="BYD")

    assert parsed["report_current_price"] == 238.30
    assert parsed["base_target"] == 331.70
    assert "selected next target" in parsed["note"]


def test_case_price_table_sets_median_base_and_marks_ambiguity():
    text = """
    Example Corp (123456)
    투자의견: Sell
    Case 1 가격 8,000원
    Case 2 가격 10,000원
    Case 3 가격 15,000원
    """

    parsed = parse_report_text(text)

    assert parsed["rating"] == "Sell"
    assert parsed["base_target"] == 10000
    assert "case_1=8000" in parsed["target_price_detail"]
    assert "case_3=15000" in parsed["target_price_detail"]
    assert "median case value" in parsed["note"]


def test_base_case_number_is_not_misread_as_target_price():
    text = """
    Doximity (DOCS)
    Rating: Buy
    Base Case 1: slower penetration
    Case 1 target price $75.40
    Case 2 target price $131.16
    """

    parsed = parse_report_text(text)

    assert parsed["base_target"] == 103.28
    assert parsed["base_target"] != 1


def test_bear_bull_without_base_uses_median_scenario_value():
    text = """
    Chewy (CHWY)
    Rating: Sell
    Bear Case $25.05
    Bull Case $51.60
    """

    parsed = parse_report_text(text)

    assert parsed["ticker"] == "CHWY"
    assert parsed["exchange"] == "NYSE"
    assert parsed["base_target"] == 38.325
    assert "No explicit Base target" in parsed["note"]
