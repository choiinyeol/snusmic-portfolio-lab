"""Trace why target_gone files lost their target price."""
import re, glob, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Minimal copy of the relevant regex constants from build script
TARGET_LABEL_RE = re.compile(
    r"(?:\d{2,4}E?\s*)?(목표\s*주가|목표주가|적정\s*주가|적정주가|Target\s+Price|목표주7[Hh]|목표주7h)",
    re.I,
)
CURRENT_LABEL_RE = re.compile(
    r"(현재\s*주가|현재주가|현재가(?!치)|Current\s+Price)", re.I
)
PRICE_TOKEN_RE = re.compile(
    r"(?P<prefix2>\b(?:KRW|USD|JPY)\s*)?"
    r"(?P<prefix>[$₩])?"
    r"(?P<a>\d{1,3}(?:,\d{3})*(?:\.\d+)?)"
    r"(?:\s*[-~]\s*(?P<b>\d{1,3}(?:,\d{3})*(?:\.\d+)?))?"
    r"(?P<suffix>\s*(?:원|₩|엔|달러|USD|KRW|\$))?",
    re.I,
)
KUVIC_PRICE_BLOCK_RE = re.compile(
    r"목표주가\s+현재주가.*?(?P<tp>(?:[$₩])?\s*\d{1,3}(?:[,]\d{3})+(?:\.\d+)?(?:\s*원)?)"
    r"\s+(?P<cp>(?:[$₩])?\s*\d{1,3}(?:[,]\d{3})+(?:\.\d+)?(?:\s*원)?)"
    r"(?:\s+\d+(?:\.\d+)?\s*%)?",
    re.I | re.S,
)
CURRENT_THEN_TARGET_PAIR_RE = re.compile(
    r"현재\s*주가\s+목표\s*주가[^\d]{0,30}?"
    r"(?P<v1>\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:원|₩)?)\s+"
    r"(?P<v2>\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:원|₩)?)",
    re.I,
)
TARGET_THEN_CURRENT_PAIR_RE = re.compile(
    r"목표\s*주가\s+현재\s*주가[^\d]{0,30}?"
    r"(?P<v1>\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:원|₩)?)\s+"
    r"(?P<v2>\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:원|₩)?)",
    re.I,
)

target_gone = [
    "2022-08-13_[220813]",  # 271560
    "2023-10-11_효성",
    "2024-08-16_HD",
    "145020",
]

all_files = glob.glob("data/markdown/**/*.md", recursive=True)

def compact_line(l):
    return re.sub(r'\s+', ' ', l.strip())

for f in all_files:
    is_match = (
        ("271560" in f and "220813" in f) or
        ("2023-10-11" in f and ("첨단" in f or "효성" in f)) or
        ("2024-08-16" in f and "일렉" in f) or
        ("145020" in f)
    )
    if not is_match:
        continue

    try:
        lines = open(f, encoding='utf-8', errors='replace').readlines()
    except Exception as e:
        print(f"OPEN ERROR {f}: {e}")
        continue

    print(f"\n=== {f[-70:]} ===")
    first_page = " ".join(compact_line(l) for l in lines[:180])
    rating_pos = first_page.lower().find("rating")
    if rating_pos >= 0:
        text = first_page[rating_pos:rating_pos+900] + " " + first_page[:rating_pos]
    else:
        text = first_page

    # Step -1: KUVIC
    kb = KUVIC_PRICE_BLOCK_RE.search(first_page)
    if kb:
        print(f"  -1 KUVIC: tp={kb.group('tp')!r} cp={kb.group('cp')!r}")
    else:
        print("  -1 KUVIC: no match")

    # Step 0: pairs
    pm = CURRENT_THEN_TARGET_PAIR_RE.search(text)
    if pm:
        print(f"  0a CTP: v1={pm.group('v1')!r} v2={pm.group('v2')!r}")
    else:
        pm2 = TARGET_THEN_CURRENT_PAIR_RE.search(text)
        if pm2:
            print(f"  0b TPC: v1={pm2.group('v1')!r} v2={pm2.group('v2')!r}")
        else:
            print("  0 pairs: no match")

    # Step 1: label after
    for m in TARGET_LABEL_RE.finditer(text):
        window = text[m.end():m.end()+120]
        print(f"  1 label_after window: {window[:80]!r}")
        break

    # Show relevant lines
    for i, l in enumerate(lines[:60]):
        ls = l.strip()
        if any(kw in ls for kw in ['목표', '현재', 'Target', 'Price', '주가']):
            try:
                print(f"  L{i}: {ls[:120]}")
            except Exception:
                pass
