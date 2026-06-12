"""v24 DSR(다중검정 보정) + 워크포워드 일관성 단위 테스트."""
from __future__ import annotations

import datetime as dt
import math

import numpy as np
import pandas as pd

import backtest_momentum as bt


def _nav(seed: int, n: int, drift: float, vol: float) -> pd.Series:
    rng = np.random.default_rng(seed)
    idx = pd.bdate_range(dt.date(2020, 1, 2), periods=n)
    return pd.Series(1e8 * np.exp(np.cumsum(rng.normal(drift, vol, n))), index=idx)


def _fake_strategies(n: int = 504) -> dict[str, dict]:
    return {
        "alpha_strong": {"nav_df": _nav(1, n, drift=0.0015, vol=0.005)},   # 고샤프
        "alpha_weak": {"nav_df": _nav(2, n, drift=0.0002, vol=0.015)},
        "noise": {"nav_df": _nav(3, n, drift=0.0, vol=0.02)},
        "loser": {"nav_df": _nav(4, n, drift=-0.0005, vol=0.02)},
    }


def test_dsr_basic_properties():
    stats = bt.compute_dsr_stats(_fake_strategies())
    assert set(stats) == {"alpha_strong", "alpha_weak", "noise", "loser"}
    for key, s in stats.items():
        assert 0.0 <= s["psr"] <= 1.0
        assert 0.0 <= s["dsr"] <= 1.0
        assert s["n_trials"] == 4
        # SR0 > 0 이므로 DSR은 PSR보다 보수적이어야 한다
        assert s["dsr"] <= s["psr"] + 1e-9, key

    # 강한 알파는 보정 후에도 유의, 노이즈/루저는 아님
    assert stats["alpha_strong"]["dsr"] > 0.95
    assert stats["alpha_strong"]["significant_after_deflation"] is True
    assert stats["noise"]["dsr"] < 0.95
    assert stats["loser"]["psr"] < 0.5


def test_dsr_requires_two_trials():
    one = {"only": {"nav_df": _nav(1, 300, 0.001, 0.01)}}
    assert bt.compute_dsr_stats(one) == {}


def test_walkforward_windows_and_consistency():
    # 결정적 단조 상승 NAV — 모든 윈도가 양(+)이고 평탄 KOSPI를 이긴다
    nav_idx = pd.bdate_range(dt.date(2020, 1, 2), periods=504)
    strategies = {
        "s": {"nav_df": pd.Series(1e8 * np.exp(np.linspace(0, 0.4, 504)), index=nav_idx)}
    }
    kospi = pd.Series(1000.0, index=nav_idx)  # 평탄한 KOSPI → 상승 전략이 모두 이겨야 함

    wf = bt.compute_walkforward(strategies, kospi)
    assert "s" in wf
    windows = wf["s"]["windows"]
    # 504 영업일 ≈ 24개월 → 6개월 윈도 4±1개
    assert 3 <= len(windows) <= 5
    for w in windows:
        assert w["start"] < w["end"]
        assert w["mdd_pct"] <= 0
        assert w["kospi_return_pct"] == 0.0

    cons = wf["s"]["consistency"]
    assert cons["n_windows"] == len(windows)
    assert cons["beat_kospi_pct"] == 100.0  # 평탄 KOSPI 대비 상승 전략
    assert cons["worst_window_return_pct"] == min(w["return_pct"] for w in windows)

    # 2020~2021 데이터 → OOS(2024+) 윈도 없음
    assert wf["s"]["consistency_oos"] is None


def test_walkforward_oos_flag():
    idx = pd.bdate_range(dt.date(2023, 7, 3), periods=378)  # 2023-07 ~ 2024-12
    nav = pd.Series(np.linspace(1e8, 1.3e8, len(idx)), index=idx)
    kospi = pd.Series(1000.0, index=idx)
    wf = bt.compute_walkforward({"s": {"nav_df": nav}}, kospi)
    windows = wf["s"]["windows"]
    oos_flags = [w["oos"] for w in windows]
    assert any(oos_flags) and not all(oos_flags)  # IS·OOS 윈도가 섞여 있어야 함
    assert wf["s"]["consistency_oos"]["n_windows"] == sum(oos_flags)
