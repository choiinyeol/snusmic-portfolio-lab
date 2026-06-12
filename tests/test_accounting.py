"""회계 코어 단위 테스트 — 틱, 환율, 달력, 체결, Kelly.

여기 있는 함수들이 모든 전략의 손익 숫자를 만든다.
v22 FX 버그(MDD −100%)급 사고는 전부 이 레이어에서 났다.
"""
from __future__ import annotations

import datetime as dt
import math

import pandas as pd
import pytest

import backtest_momentum as bt
import backtest.fx as fx_state


# ── round_to_tick: KRX 호가단위 + US 센트 ─────────────────────────────────────

@pytest.mark.parametrize(
    "price,expected",
    [
        (1_999.9, 1_999),      # <2,000 → 1원
        (2_000.0, 2_000),      # 경계: 2,000은 5원 틱
        (2_003.0, 2_000),
        (4_999.0, 4_995),      # <5,000 → 5원
        (19_994.0, 19_990),    # <20,000 → 10원
        (49_999.0, 49_950),    # <50,000 → 50원
        (199_999.0, 199_900),  # <200,000 → 100원
        (499_999.0, 499_500),  # <500,000 → 500원
        (654_321.0, 654_000),  # ≥500,000 → 1,000원
    ],
)
def test_round_to_tick_krx_table(price: float, expected: float):
    assert bt.round_to_tick(price, "KR") == expected


def test_round_to_tick_us_cent_floor():
    assert bt.round_to_tick(12.349, "US") == pytest.approx(12.34)
    assert bt.round_to_tick(100.0, "US") == pytest.approx(100.0)


@pytest.mark.parametrize("price", [1_500.7, 3_333.0, 25_120.0, 87_654.0, 1_234_567.0])
def test_round_to_tick_never_rounds_up(price: float):
    """스탑 레벨 보수성: 라운딩 결과가 원값을 넘으면 보호 수준을 과장하는 것."""
    assert bt.round_to_tick(price, "KR") <= price


# ── FX 레이어 ─────────────────────────────────────────────────────────────────

def test_fx_kr_is_always_one():
    assert bt._fx("KR", dt.date(2024, 1, 2)) == 1.0


def test_fx_us_fallback_without_series():
    fx_state._USDKRW = None
    assert bt._fx("US", dt.date(2024, 1, 2)) == bt._USDKRW_FALLBACK


def test_fx_us_asof_lookup_and_ffill():
    idx = pd.to_datetime(["2024-01-02", "2024-01-03", "2024-01-08"])
    bt.set_usdkrw(pd.Series([1300.0, 1310.0, 1350.0], index=idx))
    assert bt._fx("US", dt.date(2024, 1, 3)) == 1310.0
    # 주말/휴장: 직전 영업일 ffill
    assert bt._fx("US", dt.date(2024, 1, 5)) == 1310.0
    # 시리즈 시작 전: fallback
    assert bt._fx("US", dt.date(2023, 12, 1)) == bt._USDKRW_FALLBACK


# ── asof 패스트패스 = pandas 시맨틱 ──────────────────────────────────────────

def test_fast_asof_matches_pandas_asof():
    idx = pd.bdate_range("2024-01-02", periods=10)
    vals = [1.0, 2.0, float("nan"), 4.0, 5.0, float("nan"), float("nan"), 8.0, 9.0, 10.0]
    s = pd.Series(vals, index=idx)
    probes = list(idx) + [idx[0] - pd.Timedelta(days=1), idx[4] + pd.Timedelta(hours=1)]
    for ts in probes:
        fast = bt._fast_asof_raw(s, pd.Timestamp(ts))
        ref = s.asof(pd.Timestamp(ts))
        if isinstance(ref, float) and math.isnan(ref):
            assert math.isnan(fast)
        else:
            assert fast == float(ref)


# ── 달력 헬퍼 ─────────────────────────────────────────────────────────────────

def test_months_later_clamps_to_day_28():
    assert bt.months_later(dt.date(2024, 1, 31), 1) == dt.date(2024, 2, 28)
    assert bt.months_later(dt.date(2024, 11, 15), 2) == dt.date(2025, 1, 15)
    assert bt.months_later(dt.date(2024, 12, 31), 12) == dt.date(2025, 12, 28)


def test_first_trading_day_after_is_strict():
    cal = [dt.date(2024, 1, 2), dt.date(2024, 1, 3), dt.date(2024, 1, 4)]
    assert bt.first_trading_day_after(dt.date(2024, 1, 2), cal) == dt.date(2024, 1, 3)
    assert bt.first_trading_day_on_or_after(dt.date(2024, 1, 2), cal) == dt.date(2024, 1, 2)
    assert bt.first_trading_day_after(dt.date(2024, 1, 4), cal) is None


# ── _close_trade: FX 환산 손익 ────────────────────────────────────────────────

def _us_position(shares: float, entry_price: float, cost: float) -> dict:
    return {
        "shares": shares,
        "entry_price": entry_price,
        "entry_date": dt.date(2024, 1, 2),
        "cost": cost,
        "last_close": entry_price,
        "highest": entry_price,
        "source": "TEST",
        "n_clubs": 1,
        "display_name": "테스트US",
        "market": "US",
        "target_price": None,
        "stop": None,
        "entry_reason": "unit-test",
    }


def test_close_trade_us_return_includes_fx_move():
    """$100→$110 (+10%) 이고 환율 1300→1400 (+7.7%)면 KRW 수익률은 둘의 곱이어야 한다."""
    idx = pd.to_datetime(["2024-01-02", "2024-06-03"])
    bt.set_usdkrw(pd.Series([1300.0, 1400.0], index=idx))
    cost = 13_000_000.0  # 100주 × $100 × 1300 (비용 무시한 명목)
    shares = cost * (1 - bt.COST_PER_SIDE) / (100.0 * 1300.0)
    pos = _us_position(shares, 100.0, cost)

    trade = bt._close_trade(
        "US0001", pos, dt.date(2024, 6, 3), 110.0, "unit_exit",
        ticker_reports=None, record_full_trades=False, consensus_window=None,
    )
    proceeds = shares * 110.0 * 1400.0 * (1 - bt.COST_PER_SIDE)
    expected = round((proceeds / cost - 1) * 100, 2)
    assert trade["return_pct"] == expected
    # 환율 상승분이 빠졌다면 (1400 대신 1300) 수익률이 ~8%p 낮았을 것
    assert trade["return_pct"] > 17.0
    assert trade["exit"] == 110.0  # exit는 로컬 통화 표기 유지


def test_close_trade_kr_no_fx():
    pos = _us_position(100.0, 10_000.0, 1_000_000.0)
    pos["market"] = "KR"
    trade = bt._close_trade(
        "KR0001", pos, dt.date(2024, 6, 3), 11_000.0, "unit_exit",
        ticker_reports=None, record_full_trades=False, consensus_window=None,
    )
    proceeds = 100.0 * 11_000.0 * (1 - bt.COST_PER_SIDE)
    assert trade["return_pct"] == round((proceeds / 1_000_000.0 - 1) * 100, 2)


# ── _try_enter: FX 주수 계산 / 예산 가드 ─────────────────────────────────────

def _entry_env(tmp_path, market: str = "US"):
    from conftest import flat_ohlcv, load_via_pipeline, make_report_entry

    df = load_via_pipeline(flat_ohlcv(300, price=100.0, band=1.0), tmp_path, "ENTER")
    day = df.index[250].date()
    tr = {"T1": [make_report_entry(df.index[200].date(), "엔트리테스트", market=market)]}
    return {"T1": df}, day, tr


def test_try_enter_us_shares_divided_by_fx(tmp_path):
    prices, day, tr = _entry_env(tmp_path, market="US")
    idx = pd.to_datetime([day - dt.timedelta(days=10)])
    bt.set_usdkrw(pd.Series([1400.0], index=idx))

    nav = 100_000_000.0
    pos, new_cash = bt._try_enter("T1", "TEST", 1, day, prices, {}, nav, nav, tr)
    assert pos is not None
    budget = nav * bt.POSITION_WEIGHT
    assert pos["shares"] == pytest.approx(budget * (1 - bt.COST_PER_SIDE) / (100.0 * 1400.0))
    assert pos["market"] == "US"
    assert new_cash == pytest.approx(nav - budget)


def test_try_enter_rejects_when_cash_below_half_slot(tmp_path):
    prices, day, tr = _entry_env(tmp_path, market="KR")
    nav = 100_000_000.0
    thin_cash = nav * bt.POSITION_WEIGHT * 0.4  # 슬롯의 40%만 남은 현금
    pos, cash = bt._try_enter("T1", "TEST", 1, day, prices, {}, thin_cash, nav, tr)
    assert pos is None
    assert cash == thin_cash


# ── Kelly 사이징 경계 ─────────────────────────────────────────────────────────

def test_kelly_fallback_when_too_few_trades():
    assert bt._kelly_fraction([5.0] * 9) == bt.R_KELLY_FALLBACK


def test_kelly_clamped_between_floor_and_cap():
    # 전승에 가까운 시퀀스 → cap, 전패에 가까운 시퀀스 → floor
    hot = [10.0] * 30 + [-1.0] * 2
    cold = [-10.0] * 30 + [1.0] * 2
    assert bt._kelly_fraction(hot) == bt.R_KELLY_CAP
    assert bt._kelly_fraction(cold) == bt.R_KELLY_FLOOR


def test_kelly_known_value():
    # p=0.5, b=2 → kelly = 0.5 − 0.5/2 = 0.25 → × safety, clamp [floor, cap]
    rets = ([20.0] * 10 + [-10.0] * 10) * 2  # 40개, 최근 R_KELLY_LOOKBACK 윈도
    expected = max(bt.R_KELLY_FLOOR, min(0.25 * bt.R_KELLY_SAFETY, bt.R_KELLY_CAP))
    assert bt._kelly_fraction(rets) == pytest.approx(expected)
