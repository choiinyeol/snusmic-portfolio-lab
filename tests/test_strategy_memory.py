from __future__ import annotations

from snusmic_pipeline.sim.strategy_memory import (
    MemoryRecord,
    SkippedEdge,
    StrategyEdge,
    build_memory_records,
    build_motif_stats,
    changed_fields,
    confidence,
    context_key,
    motif_for_changed_fields,
    render_strategy_memory_report,
)


def test_changed_fields_and_motif_for_redeploy_branch() -> None:
    parent = {
        "account_id": "parent",
        "label": "Parent",
        "redeploy_after_trailing_trim": False,
        "redeploy_after_trailing_trim_min_cash_pct": None,
        "redeploy_after_trailing_trim_buy_fraction": 1.0,
        "trail_trim_weight_cap": 0.2,
    }
    child = {
        "account_id": "child",
        "label": "Child",
        "redeploy_after_trailing_trim": True,
        "redeploy_after_trailing_trim_min_cash_pct": 0.125,
        "redeploy_after_trailing_trim_buy_fraction": 0.75,
        "trail_trim_weight_cap": 0.2,
    }

    fields = changed_fields(parent, child)

    assert fields == (
        "redeploy_after_trailing_trim",
        "redeploy_after_trailing_trim_buy_fraction",
        "redeploy_after_trailing_trim_min_cash_pct",
    )
    assert motif_for_changed_fields(fields) == "change_redeploy_after_trim"
def test_motif_with_known_and_unknown_fields_becomes_mixed() -> None:
    fields = ("score_field", "new_future_knob")

    assert motif_for_changed_fields(fields) == "mixed_config_change"



def test_context_key_buckets_strategy_shape() -> None:
    account = {
        "account_id": "pit_trend_quarterly_fresh540_runwinners_weeklycap45_profit60_mixedentry_trailtrim25cap20_redeploycash125_top5",
        "rebalance": "quarterly",
        "max_report_age_days": 540,
        "allow_rebalance_sell_down": False,
        "trail_trim_weight_cap": 0.2,
        "redeploy_after_trailing_trim": True,
    }
    metrics = {
        "money_weighted_return": 0.78,
        "max_drawdown": 0.27,
        "trade_count": 136.0,
    }

    assert context_key(account, metrics) == "trailtrim_redeploy|very_high|medium_dd|medium_turnover"


def test_build_motif_stats_marks_high_confidence_failure_as_veto() -> None:
    records = [
        MemoryRecord("p1", "c1", "ctx", "change_top_n", "rejected", -0.22, ("top_n",), "top3 failed"),
        MemoryRecord("p2", "c2", "ctx", "change_top_n", "rejected", -0.18, ("top_n",), "top7 failed"),
        MemoryRecord("p3", "c3", "ctx", "change_top_n", "warning", -0.25, ("top_n",), "cost-sensitive warning"),
    ]

    stats = build_motif_stats(records, veto_confidence=0.2, veto_failure_probability=0.6)

    assert len(stats) == 1
    stat = stats[0]
    assert stat.motif == "change_top_n"
    assert stat.failure_probability > 0.6
    assert stat.confidence > 0.2
    assert stat.veto is True


def test_confidence_collapses_with_small_effect_and_high_variance() -> None:
    low_confidence = confidence(2, 0.01, 0.25)
    high_confidence = confidence(5, -0.2, 0.0001)

    assert low_confidence < 0.05
    assert high_confidence > 0.6


def test_build_memory_records_reports_skipped_edges_for_missing_artifacts() -> None:
    accounts = {
        "parent": {"account_id": "parent", "label": "Parent", "top_n": 5},
    }
    summary = {
        "parent": {
            "money_weighted_return": 0.5,
            "sharpe": 1.0,
            "sortino": 1.2,
            "max_drawdown": 0.2,
            "trade_count": 100.0,
            "final_equity_krw": 100.0,
        }
    }
    edges = (StrategyEdge("parent", "child", "rejected", "missing child"),)

    records, skipped = build_memory_records(accounts, summary, edges)

    assert records == []
    assert skipped == [SkippedEdge("parent", "child", "missing child config in sim artifact")]


def test_render_report_surfaces_skipped_coverage_and_evidence() -> None:
    records = [
        MemoryRecord("p1", "c1", "ctx", "change_top_n", "rejected", -0.2, ("top_n",), "Top3 failed twice"),
    ]
    stats = build_motif_stats(records, veto_confidence=0.1, veto_failure_probability=0.5)
    skipped = [SkippedEdge("p2", "c2", "missing child summary row in sim artifact")]

    report = render_strategy_memory_report(records, stats, skipped)

    assert "curated edges: 2" in report
    assert "skipped because the current `data/sim` shortlist lacks required parent/child config or summary rows: 1" in report
    assert "Top3 failed twice" in report
    assert "missing child summary row in sim artifact" in report
def test_mixed_config_edges_render_but_do_not_influence_stats() -> None:
    records = [
        MemoryRecord("p1", "c1", "ctx", "mixed_config_change", "accepted", 0.2, ("top_n", "score_field"), "broad rewrite"),
        MemoryRecord("p2", "c2", "ctx", "switch_score_field", "accepted", -0.1, ("score_field",), "score swap"),
    ]

    stats = build_motif_stats(records, veto_confidence=0.1, veto_failure_probability=0.5)
    report = render_strategy_memory_report(records, stats, [])

    assert [item.motif for item in stats] == ["switch_score_field"]
    assert "mixed_config_change" in report
    assert "extracted single-motif stats rows: 1" in report
