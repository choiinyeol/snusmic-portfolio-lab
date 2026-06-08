"""Account-agnostic statistics on the SMIC report universe itself.

Answers the questions: how many reports actually hit their target? Which
reports were the biggest winners and losers in raw price terms? Which
reports had the most ambitious targets at publication? Which targets
ended up furthest from the realised price?

This view is independent of any investor account_id — it just asks "what
did the price do after this report came out?". The account_id simulators
trade on top of it.
"""

from __future__ import annotations

import statistics
from collections.abc import Iterable
from datetime import date, timedelta

import pandas as pd

from .contracts import (
    AlphaHypothesis,
    AlphaQualityDistribution,
    ReportPerformance,
    ReportStats,
    VerificationCase,
)
from .market import PriceBoard
from .target_adjustment import adjusted_target_price_krw

# How many reports to include in each ranked list inside ReportStats.
TOP_K = 10


MIN_ALPHA_SUPPORT_COUNT = 5
MIN_ALPHA_DISTINCT_SYMBOLS = 3
MIN_ALPHA_REGIME_COUNT = 2
MIN_ALPHA_MEDIAN_QUALITY_SCORE = 0.0

def compute_report_performance(
    reports: pd.DataFrame,
    board: PriceBoard,
    end_date: date,
    *,
    expiry_days: int | None = 730,
) -> list[ReportPerformance]:
    """One :class:`ReportPerformance` row per (report_id) in ``reports``.

    Rows without a tradable price after publication still produce an entry
    with ``None`` fields. ``expiry_days`` caps the evaluation window at
    ``[pub_date, min(end_date, pub_date + expiry_days)]``; pass ``None``/``0``
    to use the full window.
    """
    if reports.empty:
        return []
    out: list[ReportPerformance] = []
    pubs = pd.to_datetime(reports["publication_date"]).dt.date
    frame = reports.assign(_pub=pubs)
    for record in frame.to_dict("records"):
        symbol = str(record.get("symbol") or "")
        if not symbol:
            continue
        pub_day: date = record["_pub"]
        expiry_day: date | None = (
            pub_day + timedelta(days=expiry_days) if expiry_days and expiry_days > 0 else None
        )
        window_end = min(end_date, expiry_day) if expiry_day is not None else end_date
        target = adjusted_target_price_krw(record, board, pub_day, window_end)
        entry_price = _first_close_on_or_after(board, pub_day, window_end, symbol)
        evaluation_close, evaluation_close_date = _last_close_in_window(board, pub_day, window_end, symbol)
        last_close, last_close_date = _last_close_in_window(board, pub_day, end_date, symbol)
        peak_close = _max_close_after(board, pub_day, end_date, symbol)
        trough_close = _min_close_after(board, pub_day, end_date, symbol)

        target_upside_at_pub = (
            (target / entry_price - 1.0) if (target is not None and entry_price and entry_price > 0) else None
        )
        target_direction = _target_direction(target, entry_price)
        target_hit_date: date | None = None
        days_to_target: int | None = None
        if target_direction == "upside" and target is not None:
            target_hit_date = _first_ohlc_touch_at_or_above(board, pub_day, window_end, symbol, target)
        elif target_direction == "downside" and target is not None:
            target_hit_date = _first_ohlc_touch_at_or_below(board, pub_day, window_end, symbol, target)
        if target_hit_date is not None:
            days_to_target = (target_hit_date - pub_day).days

        current_return = (
            (last_close / entry_price - 1.0) if (last_close and entry_price and entry_price > 0) else None
        )
        evaluation_return = (
            (evaluation_close / entry_price - 1.0)
            if (evaluation_close and entry_price and entry_price > 0)
            else None
        )
        peak_return = (
            (peak_close / entry_price - 1.0) if (peak_close and entry_price and entry_price > 0) else None
        )
        trough_return = (
            (trough_close / entry_price - 1.0) if (trough_close and entry_price and entry_price > 0) else None
        )
        if target_direction == "upside" and last_close and target and target > 0:
            target_gap_pct = last_close / target - 1.0
        elif target_direction == "downside" and last_close and target and target > 0:
            target_gap_pct = target / last_close - 1.0
        else:
            target_gap_pct = None

        # A hit report is "resolved", not "expired" — only never-hit windows expire.
        expired = bool(expiry_day is not None and end_date >= expiry_day and target_hit_date is None)

        out.append(
            ReportPerformance(
                report_id=str(record.get("report_id") or ""),
                symbol=symbol,
                company=str(record.get("company") or ""),
                publication_date=pub_day,
                entry_price_krw=entry_price,
                target_price_krw=target,
                target_upside_at_pub=target_upside_at_pub,
                target_hit=target_hit_date is not None,
                target_hit_date=target_hit_date,
                days_to_target=days_to_target,
                last_close_krw=last_close,
                last_close_date=last_close_date,
                current_return=current_return,
                peak_return=peak_return,
                trough_return=trough_return,
                target_gap_pct=target_gap_pct,
                evaluation_close_krw=evaluation_close,
                evaluation_close_date=evaluation_close_date,
                evaluation_return=evaluation_return,
                expiry_date=expiry_day,
                expired=expired,
            )
        )
    return out
def build_verification_cases(performances: Iterable[ReportPerformance]) -> list[VerificationCase]:
    cases: list[VerificationCase] = []
    for perf in performances:
        max_drawdown = perf.trough_return
        failure_tail_return = perf.evaluation_return if perf.expired else perf.current_return
        veto_reasons: list[str] = []
        if max_drawdown is not None and max_drawdown <= -0.35:
            veto_reasons.append("drawdown_veto")
        if failure_tail_return is not None and failure_tail_return <= -0.2:
            veto_reasons.append("failure_tail_veto")
        quality_score = None
        if perf.current_return is not None:
            downside_penalty = abs(min(0.0, max_drawdown or 0.0))
            quality_score = perf.current_return - downside_penalty
        cases.append(
            VerificationCase(
                case_id=f"{perf.report_id}:target_price",
                report_id=perf.report_id,
                symbol=perf.symbol,
                company=perf.company,
                claim_type="target_price",
                publication_date=perf.publication_date,
                entry_price_krw=perf.entry_price_krw,
                target_price_krw=perf.target_price_krw,
                target_upside_at_pub=perf.target_upside_at_pub,
                target_hit=perf.target_hit,
                target_hit_date=perf.target_hit_date,
                days_to_target=perf.days_to_target,
                last_close_krw=perf.last_close_krw,
                last_close_date=perf.last_close_date,
                current_return=perf.current_return,
                peak_return=perf.peak_return,
                trough_return=perf.trough_return,
                max_drawdown=max_drawdown,
                failure_tail_return=failure_tail_return,
                target_gap_pct=perf.target_gap_pct,
                expiry_date=perf.expiry_date,
                expired=perf.expired,
                quality_score=quality_score,
                veto_reasons=tuple(veto_reasons),
                eligible_for_alpha=not veto_reasons,
            )
        )
    return cases
def _mean(xs: list[float]) -> float | None:
    return float(statistics.fmean(xs)) if xs else None


def _median(xs: list[float]) -> float | None:
    return float(statistics.median(xs)) if xs else None


def promote_alpha_hypotheses(cases: Iterable[VerificationCase]) -> list[AlphaHypothesis]:
    all_cases = list(cases)
    eligible = [case for case in all_cases if case.eligible_for_alpha]
    if not all_cases:
        return []

    quality_scores = [case.quality_score for case in eligible if case.quality_score is not None]
    quality_distribution = AlphaQualityDistribution(
        sample_size=len(eligible),
        mean_quality_score=_mean(quality_scores),
        median_quality_score=_median(quality_scores),
        worst_quality_score=min(quality_scores) if quality_scores else None,
        veto_case_count=sum(1 for case in all_cases if not case.eligible_for_alpha),
    )
    distinct_symbol_count = len({case.symbol for case in eligible})
    regime_count = len({case.publication_date.year for case in eligible})
    rejection_reasons: list[str] = []
    if len(eligible) < MIN_ALPHA_SUPPORT_COUNT:
        rejection_reasons.append("insufficient_support")
    if distinct_symbol_count < MIN_ALPHA_DISTINCT_SYMBOLS:
        rejection_reasons.append("insufficient_distinct_symbols")
    if regime_count < MIN_ALPHA_REGIME_COUNT:
        rejection_reasons.append("insufficient_regime_spread")
    median_quality_score = quality_distribution.median_quality_score
    if median_quality_score is None:
        rejection_reasons.append("missing_quality_distribution")
    elif median_quality_score <= MIN_ALPHA_MEDIAN_QUALITY_SCORE:
        rejection_reasons.append("unstable_quality_distribution")

    return [
        AlphaHypothesis(
            hypothesis_id="report-selection-candidate",
            selection_rule="eligible_report_claims_after_downside_veto",
            evidence_case_ids=tuple(case.case_id for case in eligible),
            distinct_symbol_count=distinct_symbol_count,
            support_count=len(eligible),
            support_start_date=min((case.publication_date for case in eligible), default=None),
            support_end_date=max((case.publication_date for case in eligible), default=None),
            regime_count=regime_count,
            quality_distribution=quality_distribution,
            promotion_status="rejected" if rejection_reasons else "promoted",
            rejection_reasons=tuple(rejection_reasons),
        )
    ]


def aggregate_report_stats(performances: Iterable[ReportPerformance]) -> ReportStats:
    """Aggregate top/bottom/medians across every report's outcome."""
    perfs = list(performances)
    total = len(perfs)
    with_prices = [p for p in perfs if p.entry_price_krw is not None]
    hit = [p for p in perfs if p.target_hit]
    not_hit = [p for p in with_prices if not p.target_hit]
    days_to_hit = [p.days_to_target for p in hit if p.days_to_target is not None]
    current_returns = [p.current_return for p in with_prices if p.current_return is not None]
    upsides = [p.target_upside_at_pub for p in perfs if p.target_upside_at_pub is not None]
    gaps = [p.target_gap_pct for p in not_hit if p.target_gap_pct is not None]

    def _mean(xs: list[float]) -> float | None:
        return float(statistics.fmean(xs)) if xs else None

    def _median(xs: list[float]) -> float | None:
        return float(statistics.median(xs)) if xs else None

    by_current = sorted(
        (p for p in with_prices if p.current_return is not None), key=lambda p: p.current_return
    )
    by_gap_below = sorted(
        (p for p in not_hit if p.target_gap_pct is not None and p.target_gap_pct < 0),
        key=lambda p: p.target_gap_pct,
    )
    by_overshoot = sorted(
        (p for p in perfs if p.target_gap_pct is not None and p.target_gap_pct > 0),
        key=lambda p: p.target_gap_pct,
        reverse=True,
    )
    by_speed = sorted(hit, key=lambda p: p.days_to_target if p.days_to_target is not None else 1_000_000)
    by_aggressive_target = sorted(
        (p for p in perfs if p.target_upside_at_pub is not None),
        key=lambda p: p.target_upside_at_pub,
        reverse=True,
    )

    return ReportStats(
        total_reports=total,
        reports_with_prices=len(with_prices),
        target_hit_count=len(hit),
        target_hit_rate=len(hit) / len(with_prices) if with_prices else 0.0,
        avg_days_to_target=_mean([float(d) for d in days_to_hit]),
        median_days_to_target=_median([float(d) for d in days_to_hit]),
        avg_current_return=_mean(current_returns),
        median_current_return=_median(current_returns),
        avg_target_upside_at_pub=_mean(upsides),
        avg_target_gap_pct=_mean(gaps),
        top_winners=tuple(reversed(by_current[-TOP_K:])),
        top_losers=tuple(by_current[:TOP_K]),
        biggest_target_gaps_below=tuple(by_gap_below[:TOP_K]),
        biggest_target_overshoots=tuple(by_overshoot[:TOP_K]),
        fastest_target_hits=tuple(by_speed[:TOP_K]),
        slowest_target_hits=tuple(reversed(by_speed[-TOP_K:])),
        most_aggressive_targets=tuple(by_aggressive_target[:TOP_K]),
    )


# ---------------------------------------------------------------------------
# Internal helpers — board lookups limited to the [pub_day, end_day] window.
# ---------------------------------------------------------------------------


def _coerce_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if v != v:  # NaN
        return None
    return v


def _first_close_on_or_after(board: PriceBoard, start: date, end: date, symbol: str) -> float | None:
    return board.first_close_on_or_after(start, end, symbol)


def _last_close_in_window(
    board: PriceBoard, start: date, end: date, symbol: str
) -> tuple[float | None, date | None]:
    return board.last_close_in_window(start, end, symbol)


def _max_close_after(board: PriceBoard, start: date, end: date, symbol: str) -> float | None:
    return board.max_close_in_window(start, end, symbol)


def _min_close_after(board: PriceBoard, start: date, end: date, symbol: str) -> float | None:
    return board.min_close_in_window(start, end, symbol)


def _first_ohlc_touch_at_or_above(
    board: PriceBoard, start: date, end: date, symbol: str, threshold: float
) -> date | None:
    return board.first_touch_in_window(start, end, symbol, threshold)


def _target_direction(target: float | None, entry_price: float | None) -> str | None:
    if target is None or entry_price is None or entry_price <= 0:
        return None
    if target > entry_price:
        return "upside"
    if target < entry_price:
        return "downside"
    return None


def _first_ohlc_touch_at_or_below(
    board: PriceBoard, start: date, end: date, symbol: str, threshold: float
) -> date | None:
    return board.first_touch_in_window(start, end, symbol, threshold, direction="downside")
