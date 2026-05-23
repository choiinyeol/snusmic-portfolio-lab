from __future__ import annotations

import argparse
import csv
import json
import math
import os
import shutil
from datetime import date
from pathlib import Path
from typing import Any

from .ingest.change_detection import PAGE_ONE_POST_LIMIT, new_report_urls
from .ingest.download_pdfs import download_all
from .ingest.extract_pdf import extract_report, parse_report_text
from .ingest.extraction_quality import analyze_extraction_quality
from .ingest.fetch_index import fetch_reports, parse_pages
from .ingest.github_urls import github_pdf_url
from .ingest.markdown_export import export_markdown
from .ingest.models import DownloadedPdf, ExtractedReport, ReportMeta
from .sim.account_sim import main as run_account_simulation_command
from .sim.contracts import SimulationConfig
from .sim.forward_runner import load_config_from_account_artifact, run_daily_forward
from .sim.pit_board_export import main as run_pit_board_export_command
from .sim.warehouse import build_warehouse, refresh_price_history
from .web.artifacts import ExportInputs, check_web_artifacts, export_web_artifacts

REPORT_HEADERS = [
    "페이지",
    "순번",
    "게시일",
    "리포트명",
    "종목명",
    "티커",
    "거래소",
    "투자의견",
    "PDF URL",
    "PDF 파일명",
    "리포트 현재주가",
    "Bear 목표가",
    "Base 목표가",
    "Bull 목표가",
    "목표가 통화",
    "목표가 세부",
    "투자포인트",
    "추출 상태",
    "비고",
]

REPO_ROOT = Path(__file__).resolve().parents[2]


def _json_default(value: Any) -> Any:
    if isinstance(value, Path):
        return str(value)
    return value


def write_manifest(downloads: list[DownloadedPdf], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = []
    for download in downloads:
        item = download.meta.model_dump(mode="json")
        item.update(
            {
                "pdf_path": str(download.path) if download.path else "",
                "sha256": download.sha256,
                "download_status": download.status,
                "download_note": download.note,
            }
        )
        data.append(item)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, default=_json_default) + "\n", encoding="utf-8"
    )


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2, default=_json_default) + "\n", encoding="utf-8"
    )


def resolve_sync_pages(value: str, manifest_path: Path) -> list[int]:
    """Resolve an explicit page range or the safe default archive window.

    ``sync`` rewrites the manifest/CSV from the fetched page window. A fixed
    low default can therefore drop older committed reports as soon as new
    reports arrive. ``auto`` keeps at least the current manifest size plus one
    page-one window so scheduled syncs can add new reports without shrinking
    the local archive.
    """
    if value.strip().lower() != "auto":
        return parse_pages(value)

    current_count = 0
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(manifest, list):
                current_count = len(manifest)
        except json.JSONDecodeError:
            current_count = 0

    minimum_rows = max(PAGE_ONE_POST_LIMIT, current_count + PAGE_ONE_POST_LIMIT)
    page_count = max(1, math.ceil(minimum_rows / PAGE_ONE_POST_LIMIT))
    return list(range(1, page_count + 1))


def _number_or_blank(value: float | None) -> float | str:
    return "" if value is None else value


def build_report_rows(reports: list[ExtractedReport]) -> list[list[Any]]:
    rows: list[list[Any]] = [REPORT_HEADERS]
    for report in reports:
        rows.append(
            [
                report.meta.page,
                report.meta.ordinal,
                report.meta.date,
                report.meta.title,
                report.meta.company,
                report.ticker,
                report.exchange,
                report.rating,
                github_pdf_url(report.pdf_filename),
                report.pdf_filename,
                _number_or_blank(report.report_current_price),
                _number_or_blank(report.bear_target),
                _number_or_blank(report.base_target),
                _number_or_blank(report.bull_target),
                report.target_currency,
                report.target_price_detail,
                report.investment_points,
                report.extraction_status,
                report.note,
            ]
        )
    return rows


def write_csv(reports: list[ExtractedReport], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = build_report_rows(reports)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerows(rows)


def read_extracted_reports_csv(path: Path) -> list[ExtractedReport]:
    if not path.exists():
        raise FileNotFoundError(f"Missing extracted reports CSV: {path}")
    reports: list[ExtractedReport] = []
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            meta = ReportMeta(
                page=int(row.get("페이지") or 0),
                ordinal=int(row.get("순번") or 0),
                date=row.get("게시일", ""),
                title=row.get("리포트명", ""),
                company=row.get("종목명", ""),
                slug="",
                post_url="",
                pdf_url=row.get("PDF URL", ""),
            )
            pdf_name = row.get("PDF 파일명", "")
            report = ExtractedReport(
                meta=meta,
                pdf_path=Path("data/pdfs") / pdf_name if pdf_name else None,
                report_current_price=_float_or_none(row.get("리포트 현재주가")),
                ticker=row.get("티커", ""),
                exchange=row.get("거래소", ""),
                rating=row.get("투자의견", ""),
                bear_target=_float_or_none(row.get("Bear 목표가")),
                base_target=_float_or_none(row.get("Base 목표가")),
                bull_target=_float_or_none(row.get("Bull 목표가")),
                target_currency=row.get("목표가 통화", ""),
                target_price_detail=row.get("목표가 세부", ""),
                investment_points=row.get("투자포인트", ""),
                extraction_status=row.get("추출 상태", ""),
                note=row.get("비고", ""),
            )
            reports.append(report)
    return reports


def _float_or_none(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def apply_parsed_report(report: ExtractedReport, parsed: dict[str, object], source: str = "") -> None:
    report.ticker = str(parsed["ticker"])
    report.exchange = str(parsed["exchange"])
    report.rating = str(parsed.get("rating", ""))
    report.report_current_price = parsed["report_current_price"]  # type: ignore[assignment]
    report.bear_target = parsed["bear_target"]  # type: ignore[assignment]
    report.base_target = parsed["base_target"]  # type: ignore[assignment]
    report.bull_target = parsed["bull_target"]  # type: ignore[assignment]
    report.target_currency = str(parsed["target_currency"])
    report.target_price_detail = str(parsed.get("target_price_detail", ""))
    report.investment_points = str(parsed["investment_points"])
    report.extraction_status = str(parsed["status"])
    note = str(parsed["note"])
    report.note = f"{source}; {note}".strip("; ") if source else note
    report.raw_matches = parsed["raw_matches"]  # type: ignore[assignment]


def run_sync(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    pdf_dir = data_dir / "pdfs"
    pages = resolve_sync_pages(args.pages, data_dir / "manifest.json")
    logs: list[str] = []

    metas = fetch_reports(pages)
    downloads = download_all(metas, pdf_dir=pdf_dir, force=args.force)
    extracted = [extract_report(download, max_pages=args.max_pages) for download in downloads]

    write_manifest(downloads, data_dir / "manifest.json")
    write_csv(extracted, data_dir / "extracted_reports.csv")
    if args.markdown:
        logs.extend(
            export_markdown(
                extracted,
                data_dir / "markdown",
                hybrid=args.opendataloader_hybrid,
                force=args.force_markdown,
            )
        )

    print(f"Reports fetched: {len(metas)}")
    print(f"PDFs available: {sum(1 for item in downloads if item.path)}")
    print(f"Extracted OK: {sum(1 for item in extracted if item.extraction_status == 'ok')}")
    print(f"Needs review: {sum(1 for item in extracted if item.extraction_status != 'ok')}")
    for message in logs:
        print(message)
    return 0


def run_ocr_reextract(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    markdown_dir = data_dir / "markdown"
    reports = read_extracted_reports_csv(data_dir / "extracted_reports.csv")
    logs: list[str] = []
    if args.force_opendataloader:
        logs.extend(
            export_markdown(
                reports,
                markdown_dir,
                hybrid=args.opendataloader_hybrid,
                force=True,
            )
        )

    updated = 0
    missing_markdown = 0
    for report in reports:
        previous = {
            "ticker": report.ticker,
            "exchange": report.exchange,
            "report_current_price": report.report_current_price,
            "bear_target": report.bear_target,
            "base_target": report.base_target,
            "bull_target": report.bull_target,
            "target_currency": report.target_currency,
            "target_price_detail": report.target_price_detail,
            "status": report.extraction_status,
            "note": report.note,
        }
        markdown_path = markdown_dir / f"{report.pdf_path.stem}.md" if report.pdf_path else None
        source = "markdown reextract"
        if not (markdown_path and markdown_path.exists()):
            missing_markdown += 1
            continue
        text = markdown_path.read_text(encoding="utf-8", errors="replace")
        parsed = parse_report_text(text, company_hint=report.meta.company)
        apply_parsed_report(report, parsed, source=source)
        if (
            args.preserve_existing_targets
            and report.base_target is None
            and previous["base_target"] is not None
        ):
            report.report_current_price = previous["report_current_price"]  # type: ignore[assignment]
            report.bear_target = previous["bear_target"]  # type: ignore[assignment]
            report.base_target = previous["base_target"]  # type: ignore[assignment]
            report.bull_target = previous["bull_target"]  # type: ignore[assignment]
            report.target_currency = str(previous["target_currency"])
            existing_detail = str(previous["target_price_detail"])
            report.target_price_detail = existing_detail or f"base={report.base_target:g}"
            if not report.ticker and previous["ticker"]:
                report.ticker = str(previous["ticker"])
                report.exchange = str(previous["exchange"])
            if report.ticker:
                report.extraction_status = "ok"
            preserved_note = "OpenDataLoader target missing; preserved previous target fields"
            report.note = f"{report.note}; {preserved_note}".strip("; ")
        updated += 1

    write_csv(reports, data_dir / "extracted_reports.csv")
    if args.audit:
        audit = analyze_extraction_quality(reports)
        write_json(Path(args.audit_output), audit)
        print_quality_summary(audit)
    print(f"Reports loaded: {len(reports)}")
    print(f"Reports re-extracted: {updated}")
    print(f"Missing markdown/text: {missing_markdown}")
    for message in logs:
        print(message)
    return 0


def print_quality_summary(audit: dict[str, Any]) -> None:
    summary = audit.get("summary", {})
    print("Extraction quality summary")
    for key in [
        "ok",
        "status_needs_review",
        "review_flagged_rows",
        "missing_base_target",
        "current_equals_base_target",
        "missing_rating",
        "non_buy_rating",
        "case_target_without_explicit_base",
    ]:
        print(f"{key}: {summary.get(key, 0)}")


def run_audit_extraction(args: argparse.Namespace) -> int:
    reports = read_extracted_reports_csv(Path(args.data_dir) / "extracted_reports.csv")
    audit = analyze_extraction_quality(reports)
    if args.output:
        write_json(Path(args.output), audit)
    print_quality_summary(audit)
    if args.show_rows:
        for row in audit["review_rows"][: args.show_rows]:
            reasons = ", ".join(row["reasons"])
            print(f"{row['date']} | p{row['page']} #{row['ordinal']} | {row['company']} | {reasons}")
    return 0


def run_check_new(args: argparse.Namespace) -> int:
    urls = new_report_urls(Path(args.manifest))
    has_new = bool(urls)
    print("has_new=true" if has_new else "has_new=false")
    for url in urls:
        print(url)
    if args.github_output:
        with Path(args.github_output).open("a", encoding="utf-8") as handle:
            handle.write(f"has_new={'true' if has_new else 'false'}\n")
    return 0


def run_refresh_market(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    warehouse_dir = Path(args.warehouse_dir)
    counts = build_warehouse(data_dir, warehouse_dir)
    prices = refresh_price_history(data_dir, warehouse_dir)
    print(f"Reports loaded: {counts.get('reports', 0)}")
    print(f"Daily price rows: {len(prices)}")
    print(f"Symbols: {prices['symbol'].nunique() if not prices.empty else 0}")
    return 0


def run_export_markdown(args: argparse.Namespace) -> int:
    data_dir = Path(args.data_dir)
    reports = read_extracted_reports_csv(data_dir / "extracted_reports.csv")
    logs = export_markdown(
        reports,
        data_dir / "markdown",
        hybrid=args.opendataloader_hybrid,
        force=args.force,
    )
    for message in logs:
        print(message)
    return 0


def run_build_warehouse(args: argparse.Namespace) -> int:
    counts = build_warehouse(Path(args.data_dir), Path(args.warehouse_dir))
    for table, count in sorted(counts.items()):
        print(f"{table}: {count}")
    return 0


def run_refresh_prices(args: argparse.Namespace) -> int:
    symbols = [item.strip() for item in args.symbols.split(",") if item.strip()] if args.symbols else None
    prices = refresh_price_history(
        Path(args.data_dir), Path(args.warehouse_dir), symbols=symbols, force_full=args.force_full
    )
    print(f"Daily price rows: {len(prices)}")
    print(f"Symbols: {prices['symbol'].nunique() if not prices.empty else 0}")
    return 0


def run_export_web(args: argparse.Namespace) -> int:
    inputs = ExportInputs(
        warehouse=Path(args.warehouse),
        sim=Path(args.sim),
        out=Path(args.out),
        extraction_quality=Path(args.extraction_quality),
    )
    result = check_web_artifacts(inputs) if args.check else export_web_artifacts(inputs)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


def daily_forward_config(
    start: date, end: date, out_dir: Path, *, ignore_account_artifact: bool
) -> SimulationConfig:
    config = (
        None
        if ignore_account_artifact
        else load_config_from_account_artifact(
            out_dir / "account-configs.json",
            start=start,
            end=end,
        )
    )
    if config is None:
        base = SimulationConfig(start_date=start, end_date=end)
        accounts = tuple(account_id for account_id in base.accounts if account_id.account_id != "weak_oracle")
        config = base.model_copy(update={"accounts": accounts})
    return config


def run_daily_forward_cli(args: argparse.Namespace) -> int:
    start = date.fromisoformat(args.start)
    end = date.fromisoformat(args.end)
    out_dir = Path(args.out)
    config = daily_forward_config(
        start,
        end,
        out_dir,
        ignore_account_artifact=args.ignore_account_artifact,
    )
    report = run_daily_forward(
        config,
        Path(args.warehouse),
        out_dir,
        refresh_benchmark=args.refresh_benchmark,
    )
    payload = {
        "mode": report.mode,
        "latest_date": report.latest_date.isoformat(),
        "checkpoint_path": str(report.checkpoint_path),
        "metadata_path": str(report.metadata_path),
        "full_replay_reason": report.full_replay_reason,
        "accounts": [summary.account_id for summary in report.result.summaries],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


def latest_warehouse_price_date(warehouse_dir: Path) -> date:
    path = warehouse_dir / "daily_prices.csv"
    if not path.exists():
        raise SystemExit(f"{path} does not exist; run build-warehouse and refresh-prices first")
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        latest = max((row["date"] for row in reader if row.get("date")), default="")
    if not latest:
        raise SystemExit(f"{path} is empty")
    return date.fromisoformat(latest)


def copy_web_downloads(web_dir: Path, downloads_dir: Path) -> None:
    downloads_dir.mkdir(parents=True, exist_ok=True)
    sources = {
        "table-download-reports.csv": "snusmic-reports.csv",
        "table-download-accounts.csv": "snusmic-accounts.csv",
        "data-quality-download.csv": "snusmic-data-quality.csv",
    }
    for source_name, dest_name in sources.items():
        source = web_dir / source_name
        if not source.exists():
            raise SystemExit(f"{source} does not exist; export-web did not produce the expected download")
        shutil.copyfile(source, downloads_dir / dest_name)


def run_refresh_web_artifacts(args: argparse.Namespace) -> int:
    warehouse_dir = Path(args.warehouse)
    sim_dir = Path(args.sim)
    web_dir = Path(args.out)
    price_end = latest_warehouse_price_date(warehouse_dir)
    start = date.fromisoformat(args.start)

    report = run_daily_forward(
        daily_forward_config(
            start,
            price_end,
            sim_dir,
            ignore_account_artifact=args.ignore_account_artifact,
        ),
        warehouse_dir,
        sim_dir,
        refresh_benchmark=args.refresh_benchmark,
    )
    result = export_web_artifacts(
        ExportInputs(
            warehouse=warehouse_dir,
            sim=sim_dir,
            out=web_dir,
            extraction_quality=Path(args.extraction_quality),
        )
    )
    copy_web_downloads(web_dir, Path(args.downloads))
    payload = {
        "mode": "daily-forward",
        "latest_date": report.latest_date.isoformat(),
        "full_replay_reason": report.full_replay_reason,
        "artifact_count": result.get("artifact_count"),
        "web_out": str(web_dir),
        "downloads": str(Path(args.downloads)),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


def run_rebuild_web_artifacts(args: argparse.Namespace) -> int:
    warehouse_dir = Path(args.warehouse)
    sim_dir = Path(args.sim)
    web_dir = Path(args.out)
    price_end = latest_warehouse_price_date(warehouse_dir)
    start = date.fromisoformat(args.start)

    account_result = run_account_simulation_command(
        [
            "--start",
            start.isoformat(),
            "--end",
            price_end.isoformat(),
            "--warehouse",
            str(warehouse_dir),
            "--out",
            str(sim_dir),
        ]
    )
    if account_result != 0:
        return account_result
    pit_result = run_pit_board_export_command(
        [
            "--start",
            start.isoformat(),
            "--end",
            price_end.isoformat(),
            "--warehouse",
            str(warehouse_dir),
            "--out",
            str(sim_dir / "pit-research-board.csv"),
            "--cadence",
            args.cadence,
        ]
    )
    if pit_result != 0:
        return pit_result
    result = export_web_artifacts(
        ExportInputs(
            warehouse=warehouse_dir,
            sim=sim_dir,
            out=web_dir,
            extraction_quality=Path(args.extraction_quality),
        )
    )
    copy_web_downloads(web_dir, Path(args.downloads))
    payload = {
        "mode": "full-rebuild",
        "latest_date": price_end.isoformat(),
        "artifact_count": result.get("artifact_count"),
        "pit_board": str(sim_dir / "pit-research-board.csv"),
        "web_out": str(web_dir),
        "downloads": str(Path(args.downloads)),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


def run_account_sim(args: argparse.Namespace) -> int:
    """Run the account simulation through the package-owned command module."""

    forwarded: list[str] = [
        "--start",
        args.start,
        "--end",
        args.end,
        "--warehouse",
        str(args.warehouse),
        "--out",
        str(args.out),
    ]
    if args.refresh_benchmark:
        forwarded.append("--refresh-benchmark")
    return run_account_simulation_command(forwarded)


def run_export_pit_board(args: argparse.Namespace) -> int:
    forwarded = [
        "--start",
        args.start,
        "--end",
        args.end,
        "--warehouse",
        str(args.warehouse),
        "--out",
        str(args.out),
        "--cadence",
        args.cadence,
        "--max-report-age-days",
        str(args.max_report_age_days),
        "--universe",
        args.universe,
    ]
    return run_pit_board_export_command(forwarded)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Collect SNUSMIC PDFs, extract target prices, and export PIT research data."
    )
    subparsers = parser.add_subparsers(dest="command")

    sync = subparsers.add_parser("sync", help="Fetch reports, download PDFs, and extract local archive rows.")
    sync.add_argument(
        "--pages",
        default="auto",
        help=(
            "Page range/list, for example 1-7 or 1,3,5. Use 'auto' to keep "
            "the current archive size plus one page-one window."
        ),
    )
    sync.add_argument("--data-dir", default="data", help="Output data directory.")
    sync.add_argument("--force", action="store_true", help="Re-download PDFs even when a local copy exists.")
    sync.add_argument(
        "--max-pages", type=int, default=4, help="Maximum PDF pages to parse for target-price extraction."
    )
    sync.add_argument(
        "--opendataloader-hybrid",
        default=os.environ.get("OPENDATALOADER_HYBRID", ""),
        help="Optional OpenDataLoader hybrid mode, for example docling-fast.",
    )
    sync.add_argument(
        "--markdown",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Export one markdown file per PDF.",
    )
    sync.add_argument(
        "--force-markdown", action="store_true", help="Overwrite existing markdown during markdown export."
    )
    sync.set_defaults(func=run_sync)

    check_new = subparsers.add_parser(
        "check-new", help="Check page one for new reports before running a heavy sync."
    )
    check_new.add_argument("--manifest", default="data/manifest.json")
    check_new.add_argument("--github-output", default="")
    check_new.set_defaults(func=run_check_new)

    refresh_market = subparsers.add_parser(
        "refresh-market",
        help="Build the warehouse and refresh yfinance OHLCV market data.",
    )
    refresh_market.add_argument("--data-dir", default="data")
    refresh_market.add_argument("--warehouse-dir", default="data/warehouse")
    refresh_market.set_defaults(func=run_refresh_market)

    export_md = subparsers.add_parser(
        "export-markdown", help="Export one markdown file per committed PDF/report row."
    )
    export_md.add_argument("--data-dir", default="data")
    export_md.add_argument("--opendataloader-hybrid", default=os.environ.get("OPENDATALOADER_HYBRID", ""))
    export_md.add_argument("--force", action="store_true", help="Overwrite existing markdown files.")
    export_md.set_defaults(func=run_export_markdown)

    ocr = subparsers.add_parser(
        "ocr-reextract", help="Force OpenDataLoader markdown export and re-extract committed report rows."
    )
    ocr.add_argument("--data-dir", default="data")
    ocr.add_argument(
        "--force-opendataloader",
        action="store_true",
        help="Regenerate markdown for every PDF with OpenDataLoader before parsing.",
    )
    ocr.add_argument("--opendataloader-hybrid", default=os.environ.get("OPENDATALOADER_HYBRID", ""))
    ocr.add_argument("--preserve-existing-targets", action=argparse.BooleanOptionalAction, default=True)
    ocr.add_argument("--max-pages", type=int, default=4)
    ocr.add_argument("--audit", action=argparse.BooleanOptionalAction, default=True)
    ocr.add_argument("--audit-output", default="data/extraction_quality.json")
    ocr.set_defaults(func=run_ocr_reextract)

    audit = subparsers.add_parser(
        "audit-extraction", help="Create extraction quality statistics from extracted_reports.csv."
    )
    audit.add_argument("--data-dir", default="data")
    audit.add_argument("--output", default="data/extraction_quality.json")
    audit.add_argument("--show-rows", type=int, default=20)
    audit.set_defaults(func=run_audit_extraction)

    warehouse = subparsers.add_parser(
        "build-warehouse", help="Normalize report metadata into the sim warehouse."
    )
    warehouse.add_argument("--data-dir", default="data")
    warehouse.add_argument("--warehouse-dir", default="data/warehouse")
    warehouse.set_defaults(func=run_build_warehouse)

    refresh_prices = subparsers.add_parser(
        "refresh-prices", help="Download yfinance OHLCV history into the sim warehouse."
    )
    refresh_prices.add_argument("--data-dir", default="data")
    refresh_prices.add_argument("--warehouse-dir", default="data/warehouse")
    refresh_prices.add_argument(
        "--symbols", default="", help="Optional comma-separated yfinance symbols for a partial refresh."
    )
    refresh_prices.add_argument(
        "--force-full",
        action="store_true",
        help="Re-fetch the full available history for selected symbols instead of only new bars.",
    )
    refresh_prices.set_defaults(func=run_refresh_prices)

    export_web = subparsers.add_parser(
        "export-web", help="Export static JSON artifacts for the Next.js web showcase."
    )
    export_web.add_argument("--warehouse", default=str(REPO_ROOT / "data" / "warehouse"))
    export_web.add_argument("--sim", default=str(REPO_ROOT / "data" / "sim"))
    export_web.add_argument("--out", default=str(REPO_ROOT / "data" / "web"))
    export_web.add_argument(
        "--extraction-quality", default=str(REPO_ROOT / "data" / "extraction_quality.json")
    )
    export_web.add_argument("--check", action="store_true", help="Verify deterministic artifact output.")
    export_web.set_defaults(func=run_export_web)

    pit_board = subparsers.add_parser(
        "export-pit-board",
        help="Export point-in-time research-board rows for manual PIT review.",
    )
    pit_board.add_argument("--start", default="2021-01-04")
    pit_board.add_argument("--end", default=date.today().isoformat())
    pit_board.add_argument("--warehouse", default=str(REPO_ROOT / "data" / "warehouse"))
    pit_board.add_argument("--out", default=str(REPO_ROOT / "data" / "sim" / "pit-research-board.csv"))
    pit_board.add_argument("--cadence", choices=("D", "W", "M"), default="M")
    pit_board.add_argument("--max-report-age-days", type=int, default=730)
    pit_board.add_argument("--universe", choices=("all", "domestic", "overseas"), default="all")
    pit_board.set_defaults(func=run_export_pit_board)

    daily_forward = subparsers.add_parser(
        "daily-forward",
        help="Advance core benchmark/follower simulations from the latest checkpoint and write sim artifacts.",
    )
    daily_forward.add_argument("--start", default="2021-01-04")
    daily_forward.add_argument("--end", default=date.today().isoformat())
    daily_forward.add_argument("--warehouse", default=str(REPO_ROOT / "data" / "warehouse"))
    daily_forward.add_argument("--out", default=str(REPO_ROOT / "data" / "sim"))
    daily_forward.add_argument("--refresh-benchmark", action="store_true")
    daily_forward.add_argument(
        "--ignore-account-artifact",
        action="store_true",
        help="Ignore data/sim/account-configs.json and use the built-in benchmark/follower set.",
    )
    daily_forward.set_defaults(func=run_daily_forward_cli)

    refresh_web = subparsers.add_parser(
        "refresh-web-artifacts",
        help="Advance checkpointed account artifacts to the latest warehouse price date and export web data.",
    )
    refresh_web.add_argument("--start", default="2021-01-04")
    refresh_web.add_argument("--warehouse", default=str(REPO_ROOT / "data" / "warehouse"))
    refresh_web.add_argument("--sim", default=str(REPO_ROOT / "data" / "sim"))
    refresh_web.add_argument("--out", default=str(REPO_ROOT / "data" / "web"))
    refresh_web.add_argument("--downloads", default=str(REPO_ROOT / "apps" / "web" / "public" / "downloads"))
    refresh_web.add_argument(
        "--extraction-quality", default=str(REPO_ROOT / "data" / "extraction_quality.json")
    )
    refresh_web.add_argument("--refresh-benchmark", action="store_true")
    refresh_web.add_argument(
        "--ignore-account-artifact",
        action="store_true",
        help="Ignore data/sim/account-configs.json and use the built-in benchmark/follower set.",
    )
    refresh_web.set_defaults(func=run_refresh_web_artifacts)

    rebuild_web = subparsers.add_parser(
        "rebuild-web-artifacts",
        help="Rebuild fixed account artifacts, PIT board, web data, and public downloads from committed inputs.",
    )
    rebuild_web.add_argument("--start", default="2021-01-04")
    rebuild_web.add_argument("--warehouse", default=str(REPO_ROOT / "data" / "warehouse"))
    rebuild_web.add_argument("--sim", default=str(REPO_ROOT / "data" / "sim"))
    rebuild_web.add_argument("--out", default=str(REPO_ROOT / "data" / "web"))
    rebuild_web.add_argument("--downloads", default=str(REPO_ROOT / "apps" / "web" / "public" / "downloads"))
    rebuild_web.add_argument(
        "--extraction-quality", default=str(REPO_ROOT / "data" / "extraction_quality.json")
    )
    rebuild_web.add_argument("--cadence", choices=("D", "W", "M"), default="M")
    rebuild_web.set_defaults(func=run_rebuild_web_artifacts)

    sim = subparsers.add_parser("run-sim", help="Run the package-owned benchmark/follower simulation.")
    sim.add_argument("--start", default="2021-01-04")
    sim.add_argument("--end", default=date.today().isoformat())
    sim.add_argument("--warehouse", default=str(REPO_ROOT / "data" / "warehouse"))
    sim.add_argument("--out", default=str(REPO_ROOT / "data" / "sim"))
    sim.add_argument(
        "--refresh-benchmark",
        action="store_true",
        help="Force re-download of the All-Weather benchmark prices.",
    )
    sim.set_defaults(func=run_account_sim)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not hasattr(args, "func"):
        parser.print_help()
        return 2
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
