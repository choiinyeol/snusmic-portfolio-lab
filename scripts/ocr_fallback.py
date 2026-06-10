"""텍스트 추출이 실패한(거의 빈) 마크다운을 Windows 내장 OCR로 복구한다.

대상: data/markdown/{school}/*.md 중 한글 글자 수가 임계 미만인 파일.
방법: 원본 PDF의 앞 N페이지를 래스터화 → winocr(ko) → 마크다운 덮어쓰기.
파서가 쓰는 표지 정보(회사명·티커·목표가·현재가·날짜)가 목적이므로 앞 페이지만 처리한다.
OCR 산출물에는 `<!-- ocr_fallback -->` 마커를 남긴다.

사용:
    python scripts/ocr_fallback.py [--school yig|kuvic|star] [--pages 3] [--limit N]
"""

from __future__ import annotations

import argparse
import io
import re
import sys
from pathlib import Path

import fitz
import winocr
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MD_ROOT = ROOT / "data" / "markdown"
PDF_ROOT = ROOT / "data" / "pdfs"
SCHOOLS = ("smic", "yig", "star", "kuvic", "ewha", "voera")
NEAR_EMPTY_THRESHOLD = 300
OCR_MARKER = "<!-- ocr_fallback -->"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def korean_count(text: str) -> int:
    return len(re.findall(r"[가-힣]", text[:20000]))


def normalize_ocr(text: str) -> str:
    text = text.replace("0/0", "%").replace("O/o", "%").replace("o/o", "%")
    # 숫자 사이의 흔한 오인식: '28기000' → '281,000' 류는 일반화가 어려우므로 손대지 않는다
    return text


def ocr_pdf_head(pdf_path: Path, pages: int) -> str | None:
    try:
        doc = fitz.open(pdf_path)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! open failed: {pdf_path.name} ({exc})", flush=True)
        return None
    chunks: list[str] = []
    for page in doc[: min(pages, len(doc))]:
        pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5))
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        try:
            result = winocr.recognize_pil_sync(img, "ko")
        except Exception as exc:  # noqa: BLE001
            print(f"  ! ocr failed: {pdf_path.name} ({exc})", flush=True)
            return None
        chunks.append(result["text"] if isinstance(result, dict) else result.text)
    return normalize_ocr("\n\n".join(chunks))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--school", choices=SCHOOLS, default=None)
    parser.add_argument("--pages", type=int, default=3)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    done = 0
    for school in [args.school] if args.school else list(SCHOOLS):
        md_dir = MD_ROOT / school
        if not md_dir.exists():
            continue
        targets = []
        for md in sorted(md_dir.glob("*.md")):
            text = md.read_text(encoding="utf-8", errors="ignore")
            if OCR_MARKER in text or korean_count(text) >= NEAR_EMPTY_THRESHOLD:
                continue
            pdf = PDF_ROOT / school / f"{md.stem}.pdf"
            if pdf.exists():
                targets.append((md, pdf))
        if args.limit:
            targets = targets[: args.limit]
        print(f"== {school}: {len(targets)} near-empty files to OCR ==", flush=True)
        for md, pdf in targets:
            text = ocr_pdf_head(pdf, args.pages)
            if not text or korean_count(text) < 50:
                print(f"  ! ocr produced too little text: {pdf.name}", flush=True)
                continue
            md.write_text(f"{OCR_MARKER}\n\n{text}\n", encoding="utf-8")
            done += 1
            print(f"  + {md.relative_to(ROOT).as_posix()} ({korean_count(text)} 한글)", flush=True)
    print(f"== done: {done} files recovered via OCR ==", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
