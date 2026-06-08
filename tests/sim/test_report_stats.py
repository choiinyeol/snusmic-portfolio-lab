from datetime import date

import pandas as pd
import pytest

from snusmic_pipeline.sim.contracts import VerificationCase
from snusmic_pipeline.sim.market import PriceBoard
from snusmic_pipeline.sim.report_stats import compute_report_performance, promote_alpha_hypotheses


def _case(
    report_id: str,
    symbol: str,
    publication_date: date,
    *,
    quality_score: float = 0.1,
    eligible_for_alpha: bool = True,
) -> VerificationCase:
    veto_reasons = () if eligible_for_alpha else ("drawdown_veto",)
    return VerificationCase(
        case_id=f"{report_id}:target_price",
        report_id=report_id,
        symbol=symbol,
        company=symbol,
        claim_type="target_price",
        publication_date=publication_date,
        entry_price_krw=100.0,
        target_price_krw=120.0,
        target_upside_at_pub=0.2,
        target_hit=False,
        target_hit_date=None,
        days_to_target=None,
        last_close_krw=110.0,
        last_close_date=publication_date,
        current_return=0.1,
        peak_return=0.2,
        trough_return=-0.05,
        max_drawdown=-0.05,
        failure_tail_return=0.1,
        target_gap_pct=-0.1,
        quality_score=quality_score,
        veto_reasons=veto_reasons,
        eligible_for_alpha=eligible_for_alpha,
    )


def test_upside_target_hit_uses_intraday_high_touch():
    board = PriceBoard(
        close=pd.DataFrame({"A": [100.0, 120.0]}, index=pd.to_datetime(["2024-01-02", "2024-01-03"])),
        open=pd.DataFrame({"A": [100.0, 100.0]}, index=pd.to_datetime(["2024-01-02", "2024-01-03"])),
        high=pd.DataFrame({"A": [100.0, 151.0]}, index=pd.to_datetime(["2024-01-02", "2024-01-03"])),
        low=pd.DataFrame({"A": [100.0, 99.0]}, index=pd.to_datetime(["2024-01-02", "2024-01-03"])),
    )
    reports = pd.DataFrame(
        [
            {
                "report_id": "r1",
                "symbol": "A",
                "company": "A",
                "publication_date": "2024-01-02",
                "target_price_krw": 150.0,
            }
        ]
    )

    [perf] = compute_report_performance(reports, board, date(2024, 1, 3))

    assert perf.target_hit is True
    assert perf.target_hit_date == date(2024, 1, 3)


def test_downside_target_hit_uses_intraday_low_touch():
    board = PriceBoard(
        close=pd.DataFrame({"A": [100.0, 90.0]}, index=pd.to_datetime(["2024-01-02", "2024-01-03"])),
        open=pd.DataFrame({"A": [100.0, 100.0]}, index=pd.to_datetime(["2024-01-02", "2024-01-03"])),
        high=pd.DataFrame({"A": [100.0, 101.0]}, index=pd.to_datetime(["2024-01-02", "2024-01-03"])),
        low=pd.DataFrame({"A": [100.0, 79.0]}, index=pd.to_datetime(["2024-01-02", "2024-01-03"])),
    )
    reports = pd.DataFrame(
        [
            {
                "report_id": "r1",
                "symbol": "A",
                "company": "A",
                "publication_date": "2024-01-02",
                "target_price_krw": 80.0,
            }
        ]
    )

    [perf] = compute_report_performance(reports, board, date(2024, 1, 3))

    assert perf.target_hit is True
    assert perf.target_hit_date == date(2024, 1, 3)


def test_current_close_uses_latest_price_while_evaluation_close_keeps_expiry_window():
    board = PriceBoard(
        close=pd.DataFrame(
            {"A": [100.0, 110.0, 200.0]},
            index=pd.to_datetime(["2024-01-02", "2024-01-03", "2024-01-05"]),
        ),
        open=pd.DataFrame(
            {"A": [100.0, 110.0, 200.0]},
            index=pd.to_datetime(["2024-01-02", "2024-01-03", "2024-01-05"]),
        ),
        high=pd.DataFrame(
            {"A": [100.0, 110.0, 200.0]},
            index=pd.to_datetime(["2024-01-02", "2024-01-03", "2024-01-05"]),
        ),
        low=pd.DataFrame(
            {"A": [100.0, 110.0, 200.0]},
            index=pd.to_datetime(["2024-01-02", "2024-01-03", "2024-01-05"]),
        ),
    )
    reports = pd.DataFrame(
        [
            {
                "report_id": "r1",
                "symbol": "A",
                "company": "A",
                "publication_date": "2024-01-02",
                "target_price_krw": 300.0,
            }
        ]
    )

    [perf] = compute_report_performance(reports, board, date(2024, 1, 5), expiry_days=1)

    assert perf.last_close_date == date(2024, 1, 5)
    assert perf.last_close_krw == 200.0
    assert perf.current_return == 1.0
    assert perf.evaluation_close_date == date(2024, 1, 3)
    assert perf.evaluation_close_krw == 110.0
    assert perf.evaluation_return == pytest.approx(0.1)


def test_alpha_promotion_rejects_single_report_rules_with_reasons():
    [hypothesis] = promote_alpha_hypotheses([_case("r1", "AAA", date(2024, 1, 2))])

    assert hypothesis.promotion_status == "rejected"
    assert hypothesis.support_count == 1
    assert "insufficient_support" in hypothesis.rejection_reasons
    assert "insufficient_distinct_symbols" in hypothesis.rejection_reasons
    assert "insufficient_regime_spread" in hypothesis.rejection_reasons


def test_alpha_promotion_promotes_repeated_stable_rules():
    cases = [
        _case("r1", "AAA", date(2023, 1, 2), quality_score=0.03),
        _case("r2", "BBB", date(2023, 2, 2), quality_score=0.04),
        _case("r3", "CCC", date(2024, 1, 2), quality_score=0.05),
        _case("r4", "DDD", date(2024, 2, 2), quality_score=0.06),
        _case("r5", "EEE", date(2024, 3, 2), quality_score=0.07),
        _case("veto", "FFF", date(2024, 4, 2), eligible_for_alpha=False),
    ]

    [hypothesis] = promote_alpha_hypotheses(cases)

    assert hypothesis.selection_rule == "eligible_report_claims_after_downside_veto"
    assert hypothesis.promotion_status == "promoted"
    assert hypothesis.rejection_reasons == ()
    assert hypothesis.support_count == 5
    assert hypothesis.distinct_symbol_count == 5
    assert hypothesis.regime_count == 2
    assert hypothesis.quality_distribution.veto_case_count == 1


def test_alpha_promotion_rejects_unstable_quality_distribution():
    cases = [
        _case("r1", "AAA", date(2023, 1, 2), quality_score=-0.05),
        _case("r2", "BBB", date(2023, 2, 2), quality_score=-0.04),
        _case("r3", "CCC", date(2024, 1, 2), quality_score=-0.03),
        _case("r4", "DDD", date(2024, 2, 2), quality_score=0.06),
        _case("r5", "EEE", date(2024, 3, 2), quality_score=0.07),
    ]

    [hypothesis] = promote_alpha_hypotheses(cases)

    assert hypothesis.promotion_status == "rejected"
    assert hypothesis.rejection_reasons == ("unstable_quality_distribution",)
