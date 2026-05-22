from datetime import date

from snusmic_pipeline.sim.contracts import EquityPoint, SimulationConfig, SimulationResult, Trade
from snusmic_pipeline.sim.decision_ledger import build_daily_decision_ledger


def test_daily_decision_ledger_records_hold_days_and_trade_days() -> None:
    result = SimulationResult(
        config=SimulationConfig(start_date=date(2024, 1, 2), end_date=date(2024, 1, 3), accounts=()),
        summaries=(),
        equity_points=(
            EquityPoint(
                account_id="p",
                date=date(2024, 1, 2),
                cash_krw=900_000,
                holdings_value_krw=100_000,
                equity_krw=1_000_000,
                contributed_capital_krw=1_000_000,
                net_profit_krw=0,
                open_positions=1,
            ),
            EquityPoint(
                account_id="p",
                date=date(2024, 1, 3),
                cash_krw=1_100_000,
                holdings_value_krw=0,
                equity_krw=1_100_000,
                contributed_capital_krw=1_000_000,
                net_profit_krw=100_000,
                open_positions=0,
            ),
        ),
        trades=(
            Trade(
                account_id="p",
                date=date(2024, 1, 2),
                symbol="AAA",
                side="buy",
                qty=1,
                fill_price_krw=100_000,
                gross_krw=100_000,
                commission_krw=0,
                tax_krw=0,
                cash_after_krw=900_000,
                reason="deposit_buy",
            ),
            Trade(
                account_id="p",
                date=date(2024, 1, 3),
                symbol="AAA",
                side="sell",
                qty=1,
                fill_price_krw=110_000,
                gross_krw=110_000,
                commission_krw=0,
                tax_krw=0,
                cash_after_krw=1_100_000,
                reason="target_hit",
            ),
        ),
    )

    rows = build_daily_decision_ledger(result).to_dict("records")

    assert [row["decision"] for row in rows] == ["buy", "sell"]
    assert rows[0]["symbols"] == "AAA"
    assert rows[0]["reasons"] == "deposit_buy"
    assert rows[1]["sell_count"] == 1


def test_daily_decision_ledger_makes_no_trade_days_explicit() -> None:
    result = SimulationResult(
        config=SimulationConfig(start_date=date(2024, 1, 2), end_date=date(2024, 1, 3), accounts=()),
        summaries=(),
        equity_points=(
            EquityPoint(
                account_id="p",
                date=date(2024, 1, 2),
                cash_krw=1_000_000,
                holdings_value_krw=0,
                equity_krw=1_000_000,
                contributed_capital_krw=1_000_000,
                net_profit_krw=0,
                open_positions=0,
            ),
        ),
        trades=(),
    )

    rows = build_daily_decision_ledger(result).to_dict("records")

    assert rows[0]["decision"] == "hold"
    assert rows[0]["trade_count"] == 0
