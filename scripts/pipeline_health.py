"""Pipeline health check — 데이터 파이프라인 헬스 체크 & Telegram 운영 알림.

매일 CI 마지막에 실행한다. 파이프라인 산출물의 핵심 카운트를 집계해
직전 실행(data/health.json, 커밋됨)과 비교하고, 이상 징후가 있으면
Telegram으로 운영 알림을 보낸다. "조용한 데이터 부패" 방지가 목적:
수집기가 죽어도, 파서가 빈 줄만 뱉어도, CI는 green이기 때문이다.

점검 항목:
  * 카운트 감소 — manifest PDF / 전사 markdown / 파싱 행 / 성과 행이 줄면
    데이터 손실 (append-only 파이프라인에서 감소는 버그).
  * 파싱 이슈 급증 — report_parse_issues.csv +15행 이상이면 소스 포맷 변경 의심.
  * 백테스트 신선도 — signals.as_of가 4일(주말 버퍼) 이상 묵으면 갱신 실패.
  * 전략 수 변동 — multi_strategy.strategies 수가 바뀌면 의도 여부 확인 필요.

Behavior contract (send_telegram_signals.py와 동일):
  * TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 → 콘솔 출력만, exit 0.
  * 이상 없음 → 메시지 없음, exit 0 (data/health.json만 갱신).
  * Telegram 전송 실패 → exit 1 (CI 스텝은 continue-on-error).

Usage:
    python scripts/pipeline_health.py            # normal CI run
    python scripts/pipeline_health.py --dry-run  # 전송 없이 리포트만 출력
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEALTH_PATH = ROOT / "data" / "health.json"
MANIFEST_PATH = ROOT / "data" / "sources" / "manifest.json"
MARKDOWN_DIR = ROOT / "data" / "markdown"
BACKTEST_PATH = ROOT / "src" / "data" / "strategy-backtest.json"
SIGNALS_LATEST = ROOT / "public" / "api" / "v1" / "signals" / "latest.json"

PARSE_ISSUE_SPIKE = 15   # 직전 대비 이 행수 이상 증가하면 경고
STALE_DAYS = 4           # as_of가 이보다 묵으면 경고 (주말 버퍼 포함)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def _csv_rows(path: Path) -> int | None:
    if not path.exists():
        return None
    with open(path, encoding="utf-8-sig") as fh:
        return max(sum(1 for _ in fh) - 1, 0)


def collect_metrics() -> dict:
    metrics: dict = {"checked_at": dt.date.today().isoformat()}

    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        metrics["manifest_pdfs"] = len(manifest)
    except Exception:
        metrics["manifest_pdfs"] = None

    metrics["transcripts_md"] = (
        len(list(MARKDOWN_DIR.glob("**/*.md"))) if MARKDOWN_DIR.exists() else None
    )
    metrics["parsed_rows"] = _csv_rows(ROOT / "data" / "report_parsed.csv")
    metrics["parse_issue_rows"] = _csv_rows(ROOT / "data" / "report_parse_issues.csv")
    metrics["performance_rows"] = _csv_rows(ROOT / "data" / "report_performance.csv")

    metrics["backtest_as_of"] = None
    metrics["strategy_count"] = None
    try:
        data = json.loads(BACKTEST_PATH.read_text(encoding="utf-8"))
        metrics["backtest_as_of"] = data.get("signals", {}).get("as_of")
        strategies = data.get("multi_strategy", {}).get("strategies")
        if isinstance(strategies, dict):
            metrics["strategy_count"] = len(strategies)
        elif isinstance(strategies, list):
            metrics["strategy_count"] = len(strategies)
    except Exception:
        pass

    metrics["signals_latest_exists"] = SIGNALS_LATEST.exists()
    return metrics


# 카운트 감소가 곧 데이터 손실인 append-only 지표들
_MONOTONIC = ("manifest_pdfs", "transcripts_md", "parsed_rows", "performance_rows")

_LABELS = {
    "manifest_pdfs": "수집 PDF(manifest)",
    "transcripts_md": "전사 markdown",
    "parsed_rows": "파싱 행",
    "parse_issue_rows": "파싱 이슈 행",
    "performance_rows": "성과 결합 행",
    "strategy_count": "백테스트 전략 수",
}


def diagnose(metrics: dict, prev: dict | None) -> list[str]:
    """이상 징후 목록 (비어 있으면 정상)."""
    issues: list[str] = []

    for key in _MONOTONIC:
        if metrics.get(key) is None:
            issues.append(f"{_LABELS[key]} 집계 실패 — 산출물 누락 또는 포맷 변경")

    if not metrics.get("signals_latest_exists"):
        issues.append("signals/latest.json 없음 — export_signals_api 실패")

    as_of = metrics.get("backtest_as_of")
    if as_of:
        try:
            age = (dt.date.today() - dt.date.fromisoformat(as_of)).days
            if age > STALE_DAYS:
                issues.append(f"백테스트 신호가 {age}일 묵음 (as_of {as_of}) — 갱신 실패 의심")
        except ValueError:
            issues.append(f"backtest as_of 파싱 불가: {as_of!r}")
    else:
        issues.append("backtest as_of 없음 — strategy-backtest.json 점검 필요")

    if prev:
        for key in _MONOTONIC:
            cur, old = metrics.get(key), prev.get(key)
            if cur is not None and old is not None and cur < old:
                issues.append(f"{_LABELS[key]} 감소: {old} → {cur} — append-only 위반(데이터 손실)")

        cur_iss, old_iss = metrics.get("parse_issue_rows"), prev.get("parse_issue_rows")
        if cur_iss is not None and old_iss is not None and cur_iss - old_iss >= PARSE_ISSUE_SPIKE:
            issues.append(f"파싱 이슈 급증: {old_iss} → {cur_iss} (+{cur_iss - old_iss}) — 소스 포맷 변경 의심")

        cur_sc, old_sc = metrics.get("strategy_count"), prev.get("strategy_count")
        if cur_sc is not None and old_sc is not None and cur_sc != old_sc:
            issues.append(f"전략 수 변동: {old_sc} → {cur_sc} — 의도된 변경인지 확인")

    return issues


def compose_message(metrics: dict, issues: list[str]) -> str:
    from send_telegram_signals import esc

    lines = [f"*{esc('⚠️ 판결 아카이브 파이프라인 이상 감지')}*", ""]
    for issue in issues:
        lines.append(esc(f"• {issue}"))
    lines.append("")
    summary = " / ".join(
        f"{_LABELS[k]} {metrics.get(k)}" for k in (*_MONOTONIC, "parse_issue_rows")
        if metrics.get(k) is not None
    )
    lines.append(esc(f"현재 상태: {summary}"))
    lines.append(esc(f"점검일: {metrics['checked_at']}"))
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="전송 없이 리포트만 출력")
    args = parser.parse_args(argv)

    prev: dict | None = None
    if HEALTH_PATH.exists():
        try:
            prev = json.loads(HEALTH_PATH.read_text(encoding="utf-8"))
        except Exception:
            prev = None

    metrics = collect_metrics()
    issues = diagnose(metrics, prev)

    print("pipeline health:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")

    # 상태 파일은 항상 갱신 (다음 실행의 비교 기준)
    HEALTH_PATH.write_text(
        json.dumps(metrics, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    if not issues:
        print("OK — no anomalies.")
        return 0

    print(f"{len(issues)} issue(s):")
    for issue in issues:
        print(f"  ! {issue}")

    if args.dry_run:
        print("--- message (MarkdownV2) ---")
        print(compose_message(metrics, issues))
        return 0

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        print("TELEGRAM secrets not set — console report only (no-op).")
        return 0

    from send_telegram_signals import send_message

    return 0 if send_message(token, chat_id, compose_message(metrics, issues)) else 1


if __name__ == "__main__":
    raise SystemExit(main())
