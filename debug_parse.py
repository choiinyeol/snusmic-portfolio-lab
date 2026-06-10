"""Debug why specific OCR files fail to extract target price."""
import sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent / 'scripts'))
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from build_report_performance import parse_report
from pathlib import Path

ROOT = Path(__file__).resolve().parent

test_files = [
    ("data/markdown/kuvic/2024-08-16_더존비즈온 - 이제는 DOU이상 ZONE버할 필요 없다.md", "kuvic"),
    ("data/markdown/kuvic/2025-02-24_SK바이오팜 - 바이오팜, 꿈과 미래를 팜.md", "kuvic"),
    ("data/markdown/kuvic/2025-06-27_SAMG엔터 - 나만 믿어핑!.md", "kuvic"),
    ("data/markdown/kuvic/2025-08-19_산일전기 - BESS를 연결하고, 미국 전력망을 점령하다.md", "kuvic"),
    ("data/markdown/kuvic/2024-11-11_유진테크 - 반도체가 여름이래'유~진'짜라니께.md", "kuvic"),
    ("data/markdown/kuvic/2024-02-28_CJ대한통운 - [Web발신] [CJ대한통운_상한가 배송완료].md", "kuvic"),
    ("data/markdown/2025-05-11_equity-research-한화솔루션-2.md", "smic"),
    ("data/markdown/2024-04-17_equity-research-한화오션.md", "smic"),
    ("data/markdown/2026-04-16_equity-research-golar-lng.md", "smic"),
    ("data/markdown/2025-10-23_equity-research-coreweave.md", "smic"),
]

for rel_path, school in test_files:
    full = ROOT / rel_path
    if not full.exists():
        print(f"MISSING: {rel_path}")
        continue
    r = parse_report(full, school)
    print(f"{'OK' if r.target_price else 'FAIL':4} {school:6} tp={str(r.target_price):12} raw={str(r.target_price_raw):25} cp={str(r.report_current_price):10} file={full.name[-50:]}")
