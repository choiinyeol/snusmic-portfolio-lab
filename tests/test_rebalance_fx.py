"""v22 FX 회계 버그 회귀 테스트.

버그 재현 조건: 월간 리밸런스(run_portfolio_opt)가 보유 중인 US 포지션을
환율 없이(로컬 USD 그대로) 평가 → cur_value가 1/1400로 과소평가 →
delta_value ≈ 목표금액 전체 → 매월 현금에서 전액 재매수하며 기존 보유분은
증발 → NAV가 0으로 수렴 (S 3종·V 패밀리 MDD −100%의 근본 원인).

이 테스트는 가격·환율이 완전히 일정한 US 단일 종목에 매월 동일 비중을
지시한다. 올바른 회계라면 NAV는 거의 평탄해야 하고(최초 진입 비용 제외),
버그가 재발하면 몇 달 안에 NAV가 붕괴한다.
"""
from __future__ import annotations

import datetime as dt

import pandas as pd
import pytest

import backtest_momentum as bt
from conftest import flat_ohlcv, load_via_pipeline, make_report_entry


@pytest.fixture()
def constant_us_world(tmp_path):
    """상수 $100 US 종목 + 상수 1400 환율 + 12개월 캘린더."""
    df = load_via_pipeline(
        flat_ohlcv(420, price=100.0, band=0.5, start=dt.date(2020, 1, 2)),
        tmp_path,
        "USCONST",
    )
    calendar = [ts.date() for ts in df.index]
    bt.set_usdkrw(pd.Series([1400.0] * len(df.index), index=df.index))

    rdate = calendar[5]
    reports = [(rdate, "USX", "TEST", 1)]
    ticker_reports = {"USX": [make_report_entry(rdate, "상수주식회사", market="US")]}

    # 매 월말 → USX 50% 고정 비중 (외부 스케줄 모드)
    cal_s = pd.Series(calendar)
    month_ends = cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).last().tolist()
    schedule = {d: {"USX": 0.5} for d in month_ends}

    return {
        "prices": {"USX": df},
        "calendar": calendar,
        "reports": reports,
        "ticker_reports": ticker_reports,
        "schedule": schedule,
    }


def test_monthly_rebalance_holds_us_position_flat(constant_us_world):
    w = constant_us_world
    result = bt.run_portfolio_opt(
        w["prices"], w["reports"], w["calendar"], "FX회귀",
        variant="hrp",  # schedule 모드에서는 미사용
        ticker_reports=w["ticker_reports"],
        weight_schedule=w["schedule"],
    )
    nav = [v for _, v in [(e["date"], e["nav"]) for e in result["equity"]]]
    start = nav[0]
    final = nav[-1]

    # 가격·환율 불변 + 현금이자 3%/yr → NAV는 평탄하거나 미세 상승.
    # v22 버그면 매월 ~50%씩 증발해 1년 뒤 final/start < 0.01.
    assert final / start > 0.97, f"NAV decayed {start:.4f} → {final:.4f} — FX 리밸런스 회계 회귀"
    assert min(nav) / start > 0.95

    # 유령 매매 금지: 가격 불변이면 트림/재매수 trade가 없어야 한다
    # (허용: 마지막 날 강제 미청산 close 1건)
    rebal_trades = [t for t in result["trades"] if "미청산" not in t["exit_reason"]]
    assert rebal_trades == [], f"가격 불변인데 리밸런스 매매 발생: {rebal_trades[:3]}"


def test_nav_collapse_guard_fires(tmp_path):
    """NAV 최저점이 시작자본의 2% 아래로 붕괴하면 즉시 RuntimeError로 크게 실패해야 한다.

    long-only·비중 캡 구조에서 −98%는 시장 손실이 아니라 회계 버그 신호라는
    v20 가드의 계약을 고정한다 (v22 FX 버그가 조용히 통과하지 못하게).
    """
    n = 420
    df_raw = flat_ohlcv(n, price=10_000.0, band=0.5, start=dt.date(2020, 1, 2))
    # 200일차부터 가격 99.95% 붕괴 → 전량 보유 포트폴리오 NAV가 2% 밑으로
    crash = df_raw.index[200:]
    for col in ("open", "high", "low", "close"):
        df_raw.loc[crash, col] = 5.0
    df = load_via_pipeline(df_raw, tmp_path, "CRASH")

    calendar = [ts.date() for ts in df.index]
    rdate = calendar[5]
    reports = [(rdate, "KRX1", "TEST", 1)]
    ticker_reports = {"KRX1": [make_report_entry(rdate, "붕괴주식회사", market="KR")]}

    cal_s = pd.Series(calendar)
    month_ends = cal_s.groupby(cal_s.apply(lambda d: (d.year, d.month))).last().tolist()
    schedule = {d: {"KRX1": 1.0} for d in month_ends}

    with pytest.raises(RuntimeError, match="NAV"):
        bt.run_portfolio_opt(
            {"KRX1": df}, reports, calendar, "NAV가드",
            variant="hrp",
            ticker_reports=ticker_reports,
            weight_schedule=schedule,
        )
