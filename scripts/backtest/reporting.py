# -*- coding: utf-8 -*-
from __future__ import annotations

import csv
import math
from pathlib import Path

from .config import POSITION_WEIGHT



# ──────────────────────────────────────────────────────────────────────────────
# CSV export
# ──────────────────────────────────────────────────────────────────────────────

def export_trades_csv(trades: list[dict], path: Path) -> None:
    """UTF-8 with BOM CSV for Korean Excel."""
    closed = [t for t in trades if not t.get("exit_reason", "").endswith("미청산")]
    closed_sorted = sorted(closed, key=lambda t: t["exit_date"], reverse=True)

    headers = [
        "매수일", "매수가(시가)", "매수사유", "종목명", "티커", "시장", "비중(%)", "커버학회수",
        "트리거학회", "리포트날짜들", "목표가들", "매도일", "매도가", "보유일수",
        "수익률(%)", "매도사유",
    ]

    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for t in closed_sorted:
            trigger_schools = "|".join(t.get("trigger_schools", [t.get("source", "")]))
            trigger_rdates = "|".join(
                r["report_date"] for r in t.get("trigger_reports", [])
            )
            target_prices_str = "|".join(
                str(round(float(tp), 2)) for tp in t.get("trigger_target_prices", []) if tp
            )
            writer.writerow([
                t.get("entry_date", ""),
                t.get("entry", ""),
                t.get("entry_reason", ""),
                t.get("display_name", t.get("ticker", "")),
                t.get("ticker", ""),
                t.get("market", "KR"),
                round(POSITION_WEIGHT * 100, 1),
                t.get("n_clubs", 1),
                trigger_schools,
                trigger_rdates,
                target_prices_str,
                t.get("exit_date", ""),
                t.get("exit", ""),
                t.get("days", ""),
                t.get("return_pct", ""),
                t.get("exit_reason", ""),
            ])
    print(f"  CSV written: {path} ({len(closed_sorted)} rows)", flush=True)


# ──────────────────────────────────────────────────────────────────────────────
# Multi-strategy comparison helpers
# ──────────────────────────────────────────────────────────────────────────────

def build_multi_strategy_summary(
    strategies: dict[str, dict],
    kospi_dca_ratios: dict[str, dict] | None = None,
    verdicts: dict[str, dict[str, str]] | None = None,
    dsr_stats: dict[str, dict] | None = None,
    walkforward: dict[str, dict] | None = None,
) -> list[dict]:
    """Build comparison table rows for all strategies."""
    rows = []
    for key, r in strategies.items():
        closed = [t for t in r.get("trades", []) if not t.get("exit_reason", "").endswith("미청산")]
        max_trade = max((t["return_pct"] for t in closed), default=None)
        max_trade_info = max(closed, key=lambda t: t["return_pct"], default=None)
        # Tail stat: % P&L from top decile
        n = len(closed)
        top10_n = max(1, math.ceil(n * 0.1)) if n > 0 else 0
        top_decile = sorted([t["return_pct"] for t in closed], reverse=True)[:top10_n]
        total_pos = sum(t["return_pct"] for t in closed if t["return_pct"] > 0)
        top_decile_pos = sum(x for x in top_decile if x > 0)
        top_decile_pnl_share = round(top_decile_pos / total_pos * 100, 1) if total_pos > 0 else 0.0

        is_m = r.get("in_sample", {})
        oos_m = r.get("out_of_sample", {})
        ratio_info = (kospi_dca_ratios or {}).get(key, {})
        rows.append({
            "key": key,
            "label": r["label"],
            "metrics": r["metrics"],
            "in_sample": is_m,
            "out_of_sample": oos_m,
            "max_single_return_pct": round(max_trade, 2) if max_trade is not None else None,
            "best_trade_name": max_trade_info.get("display_name", max_trade_info.get("ticker")) if max_trade_info else None,
            "best_trade_ticker": max_trade_info.get("ticker") if max_trade_info else None,
            "top_decile_pnl_share_pct": top_decile_pnl_share,
            "trade_count": n,
            "kospi_dca_ratio": ratio_info.get("full_ratio"),      # strategy_final / kospi_final
            "kospi_dca_beats": (ratio_info.get("full_ratio") or 0.0) > 1.0,
            "aw_dca_ratio": ratio_info.get("aw_ratio"),           # v18: strategy_final / allweather_final
            "aw_dca_beats": (ratio_info.get("aw_ratio") or 0.0) > 1.0,
            # v20: 데이터 주도 판정 — 백테스트 실행 시점의 실제 수치·게이트에서 생성
            "verdict": (verdicts or {}).get(key, {}).get("verdict"),
            "verdict_reason": (verdicts or {}).get(key, {}).get("verdict_reason"),
            # v24: 다중검정 보정 (PSR/DSR) + 워크포워드 일관성 요약
            "dsr": (dsr_stats or {}).get(key),
            "walkforward": (walkforward or {}).get(key, {}).get("consistency"),
            "walkforward_oos": (walkforward or {}).get(key, {}).get("consistency_oos"),
        })
    return rows
