# -*- coding: utf-8 -*-
from __future__ import annotations

import datetime as dt
import math

import pandas as pd

from .warehouse import _fast_asof_raw



# ── FX layer (v19) ────────────────────────────────────────────────────────────
# _USDKRW: 1 USD → KRW 일별 환율 시리즈. main()에서 set_usdkrw()로 주입.
# KR 자산: fx = 1.0 (원화 기준 그대로).
# US 자산: fx = 해당 거래일 USDKRW 환율. 부재 시 전일 ffill, 최종 fallback 1300.
_USDKRW: pd.Series | None = None
_USDKRW_FALLBACK = 1300.0


def set_usdkrw(series: pd.Series) -> None:
    """main()에서 USDKRW 시리즈를 주입. 전역 ffill 적용."""
    global _USDKRW
    _USDKRW = series.ffill()


def _fx(market: str, day: dt.date) -> float:
    """Return USDKRW rate for US market, 1.0 for KR."""
    if market != "US":
        return 1.0
    if _USDKRW is None:
        return _USDKRW_FALLBACK
    val = _fast_asof_raw(_USDKRW, pd.Timestamp(day))
    if math.isnan(val) or val <= 0:
        return _USDKRW_FALLBACK
    return val
