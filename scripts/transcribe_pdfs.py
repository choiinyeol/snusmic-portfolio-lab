"""data/pdfs/{school}/ 의 PDF를 data/markdown/{school}/ 마크다운으로 전사한다.

- 이미 전사된 파일(.md 존재)은 건너뛴다 → PDF당 1회만 전사.
- opendataloader-pdf(자바 기반)를 사용하며, 로컬 JDK(.tools/jdk-21)를 PATH에 추가한다.

사용:
    python scripts/transcribe_pdfs.py [--school smic|yig|star|kuvic|ewha|voera] [--limit N] [--shard i:n]
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PDF_ROOT = ROOT / "data" / "pdfs"
MD_ROOT = ROOT / "data" / "markdown"
SCHOOLS = ("smic", "yig", "star", "kuvic", "ewha", "voera")
BATCH_SIZE = 24

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def ensure_java() -> None:
    if shutil.which("java"):
        return
    for candidate in (ROOT / ".tools" / "jdk-21").glob("*/bin"):
        if (candidate / "java.exe").exists() or (candidate / "java").exists():
            os.environ["PATH"] = f"{candidate}{os.pathsep}{os.environ['PATH']}"
            os.environ.setdefault("JAVA_HOME", str(candidate.parent))
            return
    raise SystemExit("java를 찾을 수 없습니다 (.tools/jdk-21 또는 PATH 확인)")


def transcribe_batch(pdfs: list[Path], target_dir: Path) -> int:
    """한글/특수문자 파일명이 Java CLI 인자 인코딩(cp949)에서 깨지는 문제를 피하려고
    임시 ASCII 이름으로 복사한 뒤 변환하고, 결과를 원래 이름의 .md로 되돌린다.

    - 0바이트 PDF는 경고만 출력하고 건너뛴다 (변환 시도 없음).
    - 변환 후 markdown이 생성되지 않은 PDF는 빈 stub .md를 생성한다
      → ocr_fallback.py가 near-empty 파일로 인식해 OCR을 시도한다.
    """
    import opendataloader_pdf

    # 0바이트 PDF 필터링
    valid_pdfs: list[Path] = []
    for pdf in pdfs:
        if pdf.stat().st_size == 0:
            print(f"  ! skipping 0-byte PDF: {pdf.name}", flush=True)
        else:
            valid_pdfs.append(pdf)
    if not valid_pdfs:
        return 0

    done = 0
    with tempfile.TemporaryDirectory(prefix="odl_in_") as tmp_in, tempfile.TemporaryDirectory(prefix="odl_out_") as tmp_out:
        in_dir, out_dir = Path(tmp_in), Path(tmp_out)
        alias_map: dict[str, Path] = {}
        for i, pdf in enumerate(valid_pdfs):
            alias = f"r{i:04d}"
            shutil.copyfile(pdf, in_dir / f"{alias}.pdf")
            alias_map[alias] = pdf
        try:
            opendataloader_pdf.convert(
                input_path=[str(in_dir / f"{alias}.pdf") for alias in alias_map],
                output_dir=str(out_dir),
                format="markdown",
                image_output="off",
                quiet=True,
            )
        except Exception as exc:  # noqa: BLE001 - 배치 실패는 기록하고 다음 배치 진행
            print(f"  ! batch failed ({len(valid_pdfs)} pdfs): {exc}", flush=True)
            return 0
        for alias, pdf in alias_map.items():
            produced = list(out_dir.rglob(f"{alias}.md"))
            if not produced:
                print(f"  ! no markdown produced: {pdf.name} — writing empty stub for OCR", flush=True)
                stub = target_dir / f"{pdf.stem}.md"
                stub.write_text("", encoding="utf-8")
                continue
            target = target_dir / f"{pdf.stem}.md"
            shutil.move(str(produced[0]), target)
            done += 1
            print(f"  + {target.relative_to(ROOT).as_posix()}", flush=True)
    return done


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--school", choices=SCHOOLS, default=None)
    parser.add_argument("--limit", type=int, default=None, help="학교당 최대 전사 건수 (테스트용)")
    parser.add_argument("--shard", default=None, help="i:n — 대기 목록을 n개로 나눠 i번째만 처리 (병렬 실행용)")
    args = parser.parse_args()

    ensure_java()
    schools = [args.school] if args.school else list(SCHOOLS)
    total = 0
    for school in schools:
        pdf_dir = PDF_ROOT / school
        if not pdf_dir.exists():
            continue
        target_dir = MD_ROOT / school
        target_dir.mkdir(parents=True, exist_ok=True)
        pending = [p for p in sorted(pdf_dir.glob("*.pdf")) if not (target_dir / f"{p.stem}.md").exists()]
        if args.shard:
            try:
                i, n = (int(x) for x in args.shard.split(":"))
                if not (n > 0 and 0 <= i < n):
                    raise ValueError(f"index out of range: {i}:{n}")
            except ValueError as exc:
                sys.exit(f"--shard must be 'i:n' with 0 <= i < n (got {args.shard!r}): {exc}")
            pending = pending[i::n]
        if args.limit:
            pending = pending[: args.limit]
        print(f"== {school}: {len(pending)} pdfs to transcribe ==", flush=True)
        for start in range(0, len(pending), BATCH_SIZE):
            total += transcribe_batch(pending[start : start + BATCH_SIZE], target_dir)
    print(f"== done: {total} transcribed ==", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
