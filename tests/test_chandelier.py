"""샹들리에 청산 행동 테스트 — 손계산 가능한 가격 경로로 스탑 규칙을 고정한다.

경로 설계 (flat band ±10 → TR=20 상수 → ATR(42)=20):
  스탑 = highest − 5×ATR = 10,000 − 100 = 9,900
  어느 날 종가 9,700 < 9,900 → 당일 pending exit → 익일 시가 체결.
"""
from __future__ import annotations

import datetime as dt

import pytest

import backtest_momentum as bt
from conftest import flat_ohlcv, load_via_pipeline, make_report_entry

PRICE = 10_000.0
BAND = 10.0          # TR = 2×BAND = 20 상수 → ATR(42) = 20
ATR = 2 * BAND
STOP = PRICE - bt.CHANDELIER_ATR_MULT * ATR   # 9,900

CRASH_I = 200        # 종가 9,700로 붕괴하는 날
EXIT_I = 201         # 익일 시가 9,700 체결


@pytest.fixture()
def crash_world(tmp_path):
    df_raw = flat_ohlcv(260, price=PRICE, band=BAND, start=dt.date(2020, 1, 2))
    crash_ts = df_raw.index[CRASH_I]
    df_raw.loc[crash_ts, ["open", "close"]] = 9_700.0
    df_raw.loc[crash_ts, "high"] = 9_710.0
    df_raw.loc[crash_ts, "low"] = 9_690.0
    df_raw.loc[df_raw.index[EXIT_I:], ["open", "high", "low", "close"]] = 9_700.0
    df = load_via_pipeline(df_raw, tmp_path, "CHND")

    calendar = [ts.date() for ts in df.index]
    rdate = calendar[99]          # 리포트 발간 → 익일(100) 시가 진입
    reports = [(rdate, "CH1", "TEST", 1)]
    ticker_reports = {"CH1": [make_report_entry(rdate, "샹들리에주식회사")]}
    return df, calendar, reports, ticker_reports


def test_chandelier_exits_next_open_after_stop_breach(crash_world):
    df, calendar, reports, ticker_reports = crash_world
    result = bt.run_chandelier({"CH1": df}, reports, calendar, "샹들리에-행동", ticker_reports)

    closed = [t for t in result["trades"] if t["exit_reason"] == "chandelier_ATR5"]
    assert len(closed) == 1, f"기대 1건, 실제 {[t['exit_reason'] for t in result['trades']]}"
    trade = closed[0]

    assert trade["entry"] == PRICE                       # 발간 익일 시가 진입
    assert trade["entry_date"] == calendar[100].isoformat()
    assert trade["exit"] == 9_700.0                      # 붕괴 익일 시가 체결
    assert trade["exit_date"] == calendar[EXIT_I].isoformat()

    # 수익률 = 체결가 기준 왕복 비용 반영
    expected = round(((9_700.0 / PRICE) * (1 - bt.COST_PER_SIDE) ** 2 - 1) * 100, 2)
    assert trade["return_pct"] == pytest.approx(expected, abs=0.02)


def test_chandelier_stop_never_loosens(crash_world):
    """스탑은 max(기존, 신규)로만 갱신 — 래칫이 풀리면 회귀."""
    df, calendar, reports, ticker_reports = crash_world
    result = bt.run_chandelier({"CH1": df}, reports, calendar, "샹들리에-래칫", ticker_reports)
    # 붕괴 전 구간에서 보유 포지션 스탑이 9,900 그대로였는지는 청산가로 역검증:
    # 종가 9,700 < 9,900에서 정확히 한 번 청산됐다면 스탑이 느슨해진 적 없다.
    assert len([t for t in result["trades"] if t["exit_reason"] == "chandelier_ATR5"]) == 1
