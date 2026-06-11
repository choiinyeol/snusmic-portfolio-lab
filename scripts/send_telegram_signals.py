"""Telegram daily signal digest — 텔레그램 일일 신호 봇.

Reads public/api/v1/signals/latest.json plus the most recent prior daily
snapshot (public/api/v1/signals/{YYYY-MM-DD}.json), composes a Korean digest
with day-over-day diffs (신규 진입 / 청산), and sends it via the Telegram Bot
API.

Behavior contract (CI-safe):
  * TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID unset  → silent no-op, exit 0
    (so the CI step never fails before the user configures secrets).
  * Nothing changed vs the previous snapshot     → no message, exit 0
    (no spam on quiet days; --force overrides).
  * Telegram API failure                          → stderr message, exit 1
    (the CI step uses continue-on-error: true).

Usage:
    python scripts/send_telegram_signals.py             # normal daily run
    python scripts/send_telegram_signals.py --force     # send even if unchanged
    python scripts/send_telegram_signals.py --dry-run   # print digest, send nothing

Secrets setup is documented in docs/API.md (텔레그램 일일 신호 봇 section).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
SIGNALS_DIR = ROOT / "public" / "api" / "v1" / "signals"
TELEGRAM_API = "https://api.telegram.org/bot{token}/sendMessage"
# Telegram hard limit is 4096 chars; leave headroom for the truncation notice.
MAX_LEN = 3900

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


# ── MarkdownV2 ───────────────────────────────────────────────────────────────

_MDV2_SPECIALS = re.compile(r"([_*\[\]()~`>#+\-=|{}.!\\])")


def esc(text: object) -> str:
    """Escape every MarkdownV2 special character in dynamic text."""
    return _MDV2_SPECIALS.sub(r"\\\1", str(text))


# ── formatting helpers ───────────────────────────────────────────────────────

def fmt_price(value: object, market: str) -> str:
    if not isinstance(value, (int, float)):
        return "—"
    if market == "US":
        return f"${value:,.2f}"
    return f"{value:,.0f}원"


def fmt_pct(value: object) -> str:
    if not isinstance(value, (int, float)):
        return "—"
    return f"{value:+.1f}%"


def short_reason(reason: str, limit: int = 80) -> str:
    reason = (reason or "").strip()
    return reason if len(reason) <= limit else reason[: limit - 1] + "…"


# ── snapshot loading ─────────────────────────────────────────────────────────

def load_latest() -> dict | None:
    path = SIGNALS_DIR / "latest.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_previous(as_of: str) -> dict | None:
    """Most recent dated snapshot strictly before as_of (weekend/holiday safe)."""
    dated = re.compile(r"^\d{4}-\d{2}-\d{2}\.json$")
    candidates = sorted(
        p for p in SIGNALS_DIR.glob("*.json")
        if dated.match(p.name) and p.stem < as_of
    )
    if not candidates:
        return None
    with open(candidates[-1], encoding="utf-8") as f:
        return json.load(f)


# ── diff + digest ────────────────────────────────────────────────────────────

def diff_signals(today: dict, prev: dict | None) -> dict:
    t_open = {p["ticker"]: p for p in today.get("open_positions", [])}
    p_open = {p["ticker"]: p for p in (prev or {}).get("open_positions", [])}
    t_buys = {b["ticker"] for b in today.get("buy_signals", [])}
    p_buys = {b["ticker"] for b in (prev or {}).get("buy_signals", [])}
    t_sells = {s["ticker"] for s in today.get("sell_signals", [])}
    p_sells = {s["ticker"] for s in (prev or {}).get("sell_signals", [])}

    entered = [t_open[k] for k in t_open.keys() - p_open.keys()]
    exited = [p_open[k] for k in p_open.keys() - t_open.keys()]
    changed = bool(
        entered or exited or t_buys != p_buys or t_sells != p_sells
    )
    return {
        "entered": sorted(entered, key=lambda p: p.get("ticker", "")),
        "exited": sorted(exited, key=lambda p: p.get("ticker", "")),
        "changed": changed if prev is not None else True,
        "has_prev": prev is not None,
        "prev_as_of": (prev or {}).get("as_of"),
    }


def compose_digest(today: dict, diff: dict) -> str:
    """Korean MarkdownV2 digest. Static markup uses literal *…*; all data is escaped."""
    as_of = today.get("as_of", "")
    strategy = today.get("headline_strategy", "")
    regime = today.get("regime", {})
    opens = today.get("open_positions", [])
    buys = today.get("buy_signals", [])
    sells = today.get("sell_signals", [])

    lines: list[str] = []
    lines.append(f"*📰 오늘의 신호 — {esc(as_of.replace('-', '.'))}*")
    lines.append(
        esc(f"신규 매수 {len(buys)} · 매도 임박 {len(sells)} · 보유 {len(opens)}")
    )
    regime_txt = "장세 ON (KOSPI 200일선 위)" if regime.get("state") == "ON" else "장세 OFF (KOSPI 200일선 아래)"
    lines.append(esc(f"{regime_txt} · 전략 {strategy}"))

    if diff["has_prev"]:
        if diff["entered"]:
            lines.append("")
            lines.append(f"*🟢 신규 진입* {esc(f'(전일 {diff['prev_as_of']} 대비)')}")
            for p in diff["entered"]:
                m = p.get("market", "KR")
                lines.append(esc(
                    f"· {p.get('name', p.get('ticker'))} ({p.get('ticker')}) "
                    f"진입 {fmt_price(p.get('entry_price'), m)} / 스탑 {fmt_price(p.get('stop_level'), m)}"
                ))
                if p.get("entry_reason"):
                    lines.append(esc(f"  └ {short_reason(p['entry_reason'])}"))
        if diff["exited"]:
            lines.append("")
            lines.append("*⚪ 청산* " + esc("(전일 보유 → 오늘 없음)"))
            for p in diff["exited"]:
                m = p.get("market", "KR")
                lines.append(esc(
                    f"· {p.get('name', p.get('ticker'))} ({p.get('ticker')}) "
                    f"진입가 {fmt_price(p.get('entry_price'), m)} → 최종 {fmt_pct(p.get('unrealized_pct'))}"
                ))

    if buys:
        lines.append("")
        lines.append("*📈 신규 매수 신호*")
        for b in buys:
            m = b.get("market", "KR")
            lines.append(esc(
                f"· {b.get('name', b.get('ticker'))} ({b.get('ticker')}) "
                f"기준가 {fmt_price(b.get('entry_basis_price'), m)} · {b.get('signal_date', '')}"
            ))
            if b.get("entry_reason"):
                lines.append(esc(f"  └ {short_reason(b['entry_reason'])}"))

    if sells:
        lines.append("")
        lines.append("*⚠️ 매도 임박 (스탑 접근)*")
        for s in sells:
            m = s.get("market", "KR")
            dist = s.get("dist_to_stop_pct")
            dist_txt = f" · 스탑까지 {dist:.1f}%" if isinstance(dist, (int, float)) else ""
            lines.append(esc(
                f"· {s.get('name', s.get('ticker'))} ({s.get('ticker')}) "
                f"스탑 {fmt_price(s.get('stop_level'), m)}{dist_txt} [{s.get('reason', '')}]"
            ))

    if opens:
        lines.append("")
        lines.append(f"*📂 보유 포지션 {esc(len(opens))}*")
        for p in sorted(opens, key=lambda x: -(x.get("unrealized_pct") or 0)):
            m = p.get("market", "KR")
            lines.append(esc(
                f"· {p.get('name', p.get('ticker'))} {fmt_pct(p.get('unrealized_pct'))} "
                f"(현재 {fmt_price(p.get('current_price'), m)} / 스탑 {fmt_price(p.get('stop_level'), m)} "
                f"/ {p.get('days_held', '—')}일)"
            ))

    lines.append("")
    lines.append(esc("— 백테스트 시뮬레이션 신호입니다. 투자 권유가 아니며, 모든 매매 책임은 사용자에게 있습니다."))

    text = "\n".join(lines)
    if len(text) > MAX_LEN:
        text = text[:MAX_LEN] + esc("\n… (길이 제한으로 잘림)")
    return text


# ── sending ──────────────────────────────────────────────────────────────────

def send_message(token: str, chat_id: str, text: str) -> bool:
    resp = requests.post(
        TELEGRAM_API.format(token=token),
        json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "MarkdownV2",
            "disable_web_page_preview": True,
        },
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"ERROR: Telegram API {resp.status_code}: {resp.text[:300]}", file=sys.stderr)
        return False
    return True


# ── main ─────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="전일 대비 변화가 없어도 전송")
    parser.add_argument("--dry-run", action="store_true", help="전송 없이 다이제스트만 출력")
    args = parser.parse_args(argv)

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not args.dry_run and (not token or not chat_id):
        # Secrets not configured yet — silent no-op so CI stays green.
        print("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping (no-op).")
        return 0

    today = load_latest()
    if today is None:
        print(f"ERROR: {SIGNALS_DIR / 'latest.json'} not found — run export_signals_api.py first.", file=sys.stderr)
        return 1

    prev = load_previous(today.get("as_of", ""))
    diff = diff_signals(today, prev)

    if not diff["changed"] and not args.force:
        print(f"No changes vs previous snapshot ({diff['prev_as_of']}) — nothing to send.")
        return 0

    text = compose_digest(today, diff)

    if args.dry_run:
        print("--- digest (MarkdownV2) ---")
        print(text)
        return 0

    if not send_message(token, chat_id, text):
        return 1
    print(f"Sent daily digest for {today.get('as_of')} ({len(text)} chars).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
