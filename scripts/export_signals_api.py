"""Export static JSON API files to public/api/v1/ from strategy-backtest.json.

Run this immediately after backtest_momentum.py has written
src/data/strategy-backtest.json.  It produces:

  public/api/v1/signals/latest.json        — today's trading signals
  public/api/v1/signals/{YYYY-MM-DD}.json  — immutable daily snapshot
  public/api/v1/strategies.json            — all strategy IS/OOS metrics
  public/api/v1/trades/{strategy_key}.json — closed-trade log per strategy
  public/api/v1/openapi.json               — OpenAPI 3.1 spec
  public/strategy-marks/{slug}.json        — headline-strategy trade marks per ticker
                                             (slug = "{market}-{ticker}".lower(), e.g. kr-005930)

Usage:
    python scripts/export_signals_api.py
    python scripts/export_signals_api.py --source src/data/strategy-backtest.json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "src" / "data" / "strategy-backtest.json"
API_DIR = ROOT / "public" / "api" / "v1"
MARKS_DIR = ROOT / "public" / "strategy-marks"

SCHEMA_VERSION = "1.0"

DISCLAIMER_EN = (
    "These are backtested signals for research purposes only. "
    "They do NOT constitute investment advice. "
    "Past performance does not guarantee future results. "
    "All trading decisions and their consequences are solely your responsibility."
)
DISCLAIMER_KO = (
    "이 데이터는 백테스트 시뮬레이션 결과이며 연구 목적으로만 제공됩니다. "
    "투자 권유가 아닙니다. 과거 성과가 미래 수익을 보장하지 않습니다. "
    "실매매로 인한 모든 손익의 책임은 전적으로 사용자에게 있습니다."
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# ── helpers ─────────────────────────────────────────────────────────────────

def _load_source(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, obj: dict | list, *, indent: int = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=indent)
    print(f"  wrote {path.relative_to(ROOT).as_posix()}", flush=True)


def _generated_at() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


# ── signals/latest.json ─────────────────────────────────────────────────────

def build_latest_signals(data: dict) -> dict:
    """Map the internal signals block to the public API shape."""
    sig = data.get("signals", {})
    params = data.get("params", {})
    regime_raw = sig.get("regime") or {}

    # open_positions: map internal fields → public fields
    def _map_position(p: dict) -> dict:
        return {
            "ticker": p.get("ticker", ""),
            "market": p.get("market", "KR"),
            "name": p.get("display_name", p.get("ticker", "")),
            "entry_date": p.get("entry_date", ""),
            "entry_price": p.get("entry_price"),
            "current_price": p.get("current_price"),
            "stop_level": p.get("stop_level"),
            "unrealized_pct": p.get("unrealized_pct"),
            "days_held": p.get("days_elapsed"),
            "entry_reason": p.get("entry_reason", ""),
            "trigger_reports": p.get("trigger_reports", []),
        }

    # buy_signals from imminent_buys
    def _map_buy(b: dict) -> dict:
        return {
            "ticker": b.get("ticker", ""),
            "market": b.get("market", "KR"),
            "name": b.get("display_name", b.get("ticker", "")),
            "signal_date": b.get("entry_basis_date", sig.get("as_of", "")),
            "entry_basis_price": b.get("entry_basis_price"),
            "entry_reason": b.get("entry_reason", ""),
            "trigger_reports": b.get("trigger_reports", []),
        }

    # sell_signals from approaching_stop
    def _map_sell(s: dict) -> dict:
        return {
            "ticker": s.get("ticker", ""),
            "market": s.get("market", "KR"),
            "name": s.get("display_name", s.get("ticker", "")),
            "reason": "approaching_stop" if not s.get("stop_hit") else "stop_hit",
            "stop_level": s.get("stop_level"),
            "dist_to_stop_pct": s.get("dist_to_stop_pct"),
        }

    open_positions = [_map_position(p) for p in sig.get("open_positions", [])]
    approaching = sig.get("approaching_stop", [])
    sell_signals = [_map_sell(s) for s in approaching]
    buy_signals = [_map_buy(b) for b in sig.get("imminent_buys", [])]

    # parking note for regime
    regime_state = regime_raw.get("state", "ON")
    parking_label = "allweather" if params.get("headline_key", "").startswith("W_") else "kospi"

    return {
        "schema_version": SCHEMA_VERSION,
        "as_of": sig.get("as_of", ""),
        "generated_at": _generated_at(),
        "headline_strategy": sig.get("headline_strategy", params.get("headline_key", "")),
        "disclaimer": DISCLAIMER_EN,
        "disclaimer_ko": DISCLAIMER_KO,
        "regime": {
            "kospi_above_200ma": regime_raw.get("state", "ON") == "ON",
            "state": regime_state,
            "kospi_close": regime_raw.get("kospi_close"),
            "kospi_ma200": regime_raw.get("kospi_ma200"),
            "parking": parking_label,
            "applies": regime_raw.get("applies", False),
        },
        "slots": sig.get("slots", {}),
        "open_positions": open_positions,
        "buy_signals": buy_signals,
        "sell_signals": sell_signals,
        "counts": {
            "open_positions": len(open_positions),
            "buy_signals": len(buy_signals),
            "sell_signals": len(sell_signals),
        },
    }


# ── strategies.json ──────────────────────────────────────────────────────────

def build_strategies(data: dict) -> dict:
    ms = data.get("multi_strategy", {})
    headline_key = ms.get("headline_key", data.get("params", {}).get("headline_key", ""))
    strategies = []
    for s in ms.get("strategies", []):
        metrics = s.get("metrics", {})
        is_ = s.get("in_sample", {})
        oos = s.get("out_of_sample", {})
        strategies.append({
            "key": s.get("key", ""),
            "label": s.get("label", ""),
            "is_headline": s.get("key", "") == headline_key,
            "trade_count": s.get("trade_count"),
            "metrics": {
                "total_return_pct": metrics.get("total_return_pct"),
                "cagr_pct": metrics.get("cagr_pct"),
                "sharpe": metrics.get("sharpe"),
                "mdd_pct": metrics.get("mdd_pct"),
                "win_rate_pct": metrics.get("win_rate_pct"),
                "avg_hold_days": metrics.get("avg_hold_days"),
            },
            "in_sample": {
                "period": f"{is_.get('start', '')} ~ {is_.get('end', '')}",
                "total_return_pct": is_.get("total_return_pct"),
                "cagr_pct": is_.get("cagr_pct"),
                "sharpe": is_.get("sharpe"),
                "mdd_pct": is_.get("mdd_pct"),
            },
            "out_of_sample": {
                "period": f"{oos.get('start', '')} ~ {oos.get('end', '')}",
                "total_return_pct": oos.get("total_return_pct"),
                "cagr_pct": oos.get("cagr_pct"),
                "sharpe": oos.get("sharpe"),
                "mdd_pct": oos.get("mdd_pct"),
            },
            "kospi_dca_ratio": s.get("kospi_dca_ratio"),
            "kospi_dca_beats": s.get("kospi_dca_beats"),
            "aw_dca_ratio": s.get("aw_dca_ratio"),
            "aw_dca_beats": s.get("aw_dca_beats"),
        })
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": _generated_at(),
        "headline_key": headline_key,
        "disclaimer": DISCLAIMER_EN,
        "disclaimer_ko": DISCLAIMER_KO,
        "strategies": strategies,
    }


# ── trades/{strategy_key}.json ───────────────────────────────────────────────

def build_trades(data: dict) -> dict[str, list[dict]]:
    """Returns {strategy_key: [trade, ...]}."""
    ms = data.get("multi_strategy", {})
    tbs = ms.get("trades_by_strategy", {})
    result: dict[str, list[dict]] = {}
    for key, trades in tbs.items():
        mapped = []
        for t in trades:
            mapped.append({
                "ticker": t.get("ticker", ""),
                "market": t.get("market", "KR"),
                "name": t.get("display_name", t.get("ticker", "")),
                "entry_date": t.get("entry_date", ""),
                "exit_date": t.get("exit_date", ""),
                "entry_price": t.get("entry"),
                "exit_price": t.get("exit"),
                "return_pct": t.get("return_pct"),
                "days": t.get("days"),
                "exit_reason": t.get("exit_reason", ""),
                "entry_reason": t.get("entry_reason", ""),
                "trigger_reports": t.get("trigger_reports", []),
            })
        result[key] = mapped
    return result


# ── strategy-marks/{slug}.json ───────────────────────────────────────────────

def _exit_side(exit_reason: str) -> str:
    """Stop-style exits (chandelier/trailing/stop) → 'stop', everything else → 'sell'."""
    low = (exit_reason or "").lower()
    if "chandelier" in low or "stop" in low or "trail" in low:
        return "stop"
    return "sell"


def build_strategy_marks(data: dict) -> dict[str, dict]:
    """Per-ticker trade marks for the HEADLINE strategy.

    Returns {slug: payload} where slug matches public/prices/{slug}.json
    (\"{market}-{ticker}\".lower()).  Each payload carries the full buy/sell/stop
    mark list from the backtest trade log plus the current trailing-stop level
    for tickers still held.
    """
    ms = data.get("multi_strategy", {})
    sig = data.get("signals", {})
    tbs = ms.get("trades_by_strategy", {})
    # Prefer the key the public signals payload advertises (what users see on
    # latest.json); fall back to multi_strategy.headline_key.
    headline = sig.get("headline_strategy", "")
    if headline not in tbs:
        headline = ms.get("headline_key", data.get("params", {}).get("headline_key", ""))
    trades = tbs.get(headline, [])
    as_of = sig.get("as_of", "")

    per: dict[str, dict] = {}

    def _bucket(market: str, ticker: str, name: str) -> dict:
        slug = f"{market or 'KR'}-{ticker}".lower()
        return per.setdefault(slug, {
            "schema_version": SCHEMA_VERSION,
            "generated_at": _generated_at(),
            "strategy_key": headline,
            "ticker": ticker,
            "market": market or "KR",
            "name": name or ticker,
            "disclaimer_ko": DISCLAIMER_KO,
            "marks": [],
            "open_stop": None,
        })

    # Closed trades → entry (buy) + exit (sell|stop) marks
    for t in trades:
        ticker = t.get("ticker", "")
        if not ticker:
            continue
        entry = _bucket(t.get("market", "KR"), ticker, t.get("display_name", ticker))
        if t.get("entry_date") and t.get("entry") is not None:
            entry["marks"].append({
                "date": t["entry_date"],
                "side": "buy",
                "price": t.get("entry"),
                "reason": t.get("entry_reason", ""),
            })
        if t.get("exit_date") and t.get("exit") is not None:
            ret = t.get("return_pct")
            ret_txt = f" ({ret:+.1f}%)" if isinstance(ret, (int, float)) else ""
            entry["marks"].append({
                "date": t["exit_date"],
                "side": _exit_side(t.get("exit_reason", "")),
                "price": t.get("exit"),
                "reason": f"{t.get('exit_reason', '')}{ret_txt}".strip(),
            })

    # Open positions → entry mark + current trailing-stop level
    for p in sig.get("open_positions", []):
        ticker = p.get("ticker", "")
        if not ticker:
            continue
        entry = _bucket(p.get("market", "KR"), ticker, p.get("display_name", ticker))
        if p.get("entry_date") and p.get("entry_price") is not None:
            entry["marks"].append({
                "date": p["entry_date"],
                "side": "buy",
                "price": p.get("entry_price"),
                "reason": p.get("entry_reason", ""),
            })
        if p.get("stop_level") is not None:
            entry["open_stop"] = {
                "stop_level": p.get("stop_level"),
                "entry_date": p.get("entry_date", ""),
                "as_of": as_of,
            }

    for payload in per.values():
        payload["marks"].sort(key=lambda m: (m["date"], 0 if m["side"] == "buy" else 1))

    return per


# ── openapi.json ─────────────────────────────────────────────────────────────

def build_openapi(as_of: str) -> dict:
    base = "https://smic-easy.vercel.app"
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "SMIC Strategy Signal API",
            "version": SCHEMA_VERSION,
            "description": (
                "Static JSON endpoints exposing backtested trading signals from the "
                "SMIC (Student Managed Investment Club) momentum strategy research pipeline. "
                f"Last updated: {as_of}. "
                + DISCLAIMER_EN
            ),
            "contact": {"url": base},
            "license": {"name": "MIT"},
        },
        "servers": [{"url": f"{base}/api/v1", "description": "Production (Vercel static)"}],
        "paths": {
            "/signals/latest.json": {
                "get": {
                    "operationId": "getLatestSignals",
                    "summary": "Latest trading signals",
                    "description": (
                        "Returns the most recent open positions, buy signals, and sell alerts "
                        "for the headline strategy. Regenerated daily by the CI pipeline."
                    ),
                    "responses": {
                        "200": {
                            "description": "Signal payload",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/SignalsPayload"}}},
                        }
                    },
                }
            },
            "/signals/{date}.json": {
                "get": {
                    "operationId": "getSignalsByDate",
                    "summary": "Daily signal snapshot",
                    "description": "Immutable daily snapshot. Date format: YYYY-MM-DD.",
                    "parameters": [
                        {
                            "name": "date",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string", "format": "date", "example": as_of},
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Signal payload for that date",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/SignalsPayload"}}},
                        },
                        "404": {"description": "Snapshot not yet generated for this date"},
                    },
                }
            },
            "/strategies.json": {
                "get": {
                    "operationId": "getStrategies",
                    "summary": "All strategies with IS/OOS metrics",
                    "responses": {
                        "200": {
                            "description": "Strategy list",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/StrategiesPayload"}}},
                        }
                    },
                }
            },
            "/trades/{strategy_key}.json": {
                "get": {
                    "operationId": "getTradesByStrategy",
                    "summary": "Closed trade log for a strategy",
                    "parameters": [
                        {
                            "name": "strategy_key",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "string", "example": "W_allweather_chandelier"},
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Trade list",
                            "content": {"application/json": {"schema": {"$ref": "#/components/schemas/TradesPayload"}}},
                        }
                    },
                }
            },
            "/openapi.json": {
                "get": {
                    "operationId": "getOpenApiSpec",
                    "summary": "This OpenAPI spec",
                    "responses": {"200": {"description": "OpenAPI 3.1 document"}},
                }
            },
        },
        "components": {
            "schemas": {
                "Position": {
                    "type": "object",
                    "properties": {
                        "ticker": {"type": "string"},
                        "market": {"type": "string", "enum": ["KR", "US"]},
                        "name": {"type": "string"},
                        "entry_date": {"type": "string", "format": "date"},
                        "entry_price": {"type": ["number", "null"]},
                        "current_price": {"type": ["number", "null"]},
                        "stop_level": {"type": ["number", "null"]},
                        "unrealized_pct": {"type": ["number", "null"]},
                        "days_held": {"type": ["integer", "null"]},
                        "entry_reason": {"type": "string"},
                        "trigger_reports": {"type": "array", "items": {"type": "object"}},
                    },
                },
                "BuySignal": {
                    "type": "object",
                    "properties": {
                        "ticker": {"type": "string"},
                        "market": {"type": "string", "enum": ["KR", "US"]},
                        "name": {"type": "string"},
                        "signal_date": {"type": "string", "format": "date"},
                        "entry_basis_price": {"type": ["number", "null"]},
                        "entry_reason": {"type": "string"},
                        "trigger_reports": {"type": "array", "items": {"type": "object"}},
                    },
                },
                "SellSignal": {
                    "type": "object",
                    "properties": {
                        "ticker": {"type": "string"},
                        "market": {"type": "string", "enum": ["KR", "US"]},
                        "name": {"type": "string"},
                        "reason": {"type": "string", "enum": ["approaching_stop", "stop_hit"]},
                        "stop_level": {"type": ["number", "null"]},
                        "dist_to_stop_pct": {"type": ["number", "null"]},
                    },
                },
                "Regime": {
                    "type": "object",
                    "properties": {
                        "kospi_above_200ma": {"type": "boolean"},
                        "state": {"type": "string", "enum": ["ON", "OFF"]},
                        "kospi_close": {"type": ["number", "null"]},
                        "kospi_ma200": {"type": ["number", "null"]},
                        "parking": {"type": "string", "enum": ["allweather", "kospi", "cash"]},
                        "applies": {"type": "boolean"},
                    },
                },
                "SignalsPayload": {
                    "type": "object",
                    "required": ["schema_version", "as_of", "generated_at", "headline_strategy", "disclaimer"],
                    "properties": {
                        "schema_version": {"type": "string"},
                        "as_of": {"type": "string", "format": "date"},
                        "generated_at": {"type": "string", "format": "date-time"},
                        "headline_strategy": {"type": "string"},
                        "disclaimer": {"type": "string"},
                        "disclaimer_ko": {"type": "string"},
                        "regime": {"$ref": "#/components/schemas/Regime"},
                        "slots": {"type": "object"},
                        "open_positions": {"type": "array", "items": {"$ref": "#/components/schemas/Position"}},
                        "buy_signals": {"type": "array", "items": {"$ref": "#/components/schemas/BuySignal"}},
                        "sell_signals": {"type": "array", "items": {"$ref": "#/components/schemas/SellSignal"}},
                        "counts": {"type": "object"},
                    },
                },
                "StrategyEntry": {
                    "type": "object",
                    "properties": {
                        "key": {"type": "string"},
                        "label": {"type": "string"},
                        "is_headline": {"type": "boolean"},
                        "trade_count": {"type": "integer"},
                        "metrics": {"type": "object"},
                        "in_sample": {"type": "object"},
                        "out_of_sample": {"type": "object"},
                        "kospi_dca_ratio": {"type": ["number", "null"]},
                        "kospi_dca_beats": {"type": ["boolean", "null"]},
                        "aw_dca_ratio": {"type": ["number", "null"]},
                        "aw_dca_beats": {"type": ["boolean", "null"]},
                    },
                },
                "StrategiesPayload": {
                    "type": "object",
                    "properties": {
                        "schema_version": {"type": "string"},
                        "generated_at": {"type": "string", "format": "date-time"},
                        "headline_key": {"type": "string"},
                        "disclaimer": {"type": "string"},
                        "strategies": {"type": "array", "items": {"$ref": "#/components/schemas/StrategyEntry"}},
                    },
                },
                "Trade": {
                    "type": "object",
                    "properties": {
                        "ticker": {"type": "string"},
                        "market": {"type": "string", "enum": ["KR", "US"]},
                        "name": {"type": "string"},
                        "entry_date": {"type": "string", "format": "date"},
                        "exit_date": {"type": "string", "format": "date"},
                        "entry_price": {"type": ["number", "null"]},
                        "exit_price": {"type": ["number", "null"]},
                        "return_pct": {"type": ["number", "null"]},
                        "days": {"type": ["integer", "null"]},
                        "exit_reason": {"type": "string"},
                        "entry_reason": {"type": "string"},
                        "trigger_reports": {"type": "array", "items": {"type": "object"}},
                    },
                },
                "TradesPayload": {
                    "type": "object",
                    "properties": {
                        "schema_version": {"type": "string"},
                        "generated_at": {"type": "string", "format": "date-time"},
                        "strategy_key": {"type": "string"},
                        "disclaimer": {"type": "string"},
                        "trades": {"type": "array", "items": {"$ref": "#/components/schemas/Trade"}},
                    },
                },
            }
        },
    }


# ── main ─────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Path to strategy-backtest.json (default: src/data/strategy-backtest.json)",
    )
    args = parser.parse_args(argv)

    source: Path = args.source
    if not source.exists():
        print(f"ERROR: source file not found: {source}", file=sys.stderr)
        return 1

    print(f"Loading {source.relative_to(ROOT).as_posix()} ...", flush=True)
    data = _load_source(source)
    as_of: str = data.get("signals", {}).get("as_of", dt.date.today().isoformat())
    print(f"  as_of: {as_of}", flush=True)

    # 1. signals/latest.json
    latest = build_latest_signals(data)
    _write_json(API_DIR / "signals" / "latest.json", latest)

    # 2. signals/{YYYY-MM-DD}.json  — daily snapshot (append-only; never overwrite)
    daily_path = API_DIR / "signals" / f"{as_of}.json"
    if not daily_path.exists():
        _write_json(daily_path, latest)
    else:
        print(f"  skipped (exists) {daily_path.relative_to(ROOT).as_posix()}", flush=True)

    # 3. strategies.json
    strats = build_strategies(data)
    _write_json(API_DIR / "strategies.json", strats)

    # 4. trades/{strategy_key}.json
    all_trades = build_trades(data)
    for key, trades in all_trades.items():
        payload = {
            "schema_version": SCHEMA_VERSION,
            "generated_at": _generated_at(),
            "strategy_key": key,
            "disclaimer": DISCLAIMER_EN,
            "disclaimer_ko": DISCLAIMER_KO,
            "trades": trades,
        }
        _write_json(API_DIR / "trades" / f"{key}.json", payload)

    # 5. openapi.json
    openapi = build_openapi(as_of)
    _write_json(API_DIR / "openapi.json", openapi)

    # 6. strategy-marks/{slug}.json — headline strategy trade marks per ticker.
    #    Wipe stale files first: the headline strategy (and its traded universe)
    #    can change between runs.
    marks = build_strategy_marks(data)
    if MARKS_DIR.exists():
        for old in MARKS_DIR.glob("*.json"):
            old.unlink()
    for slug, payload in sorted(marks.items()):
        _write_json(MARKS_DIR / f"{slug}.json", payload)
    print(f"  strategy-marks: {len(marks)} tickers", flush=True)

    # Validate all written JSON can be re-parsed
    print("\nValidating written files ...", flush=True)
    for path in sorted(API_DIR.rglob("*.json")) + sorted(MARKS_DIR.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                json.load(f)
            print(f"  OK  {path.relative_to(ROOT).as_posix()}", flush=True)
        except json.JSONDecodeError as exc:
            print(f"  FAIL {path.relative_to(ROOT).as_posix()}: {exc}", file=sys.stderr)
            return 1

    print("\nDone. API files written to public/api/v1/", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
