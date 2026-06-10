import re, glob, sys

# Find target_gone files and test KUVIC regex on them
KUVIC_PRICE_BLOCK_RE = re.compile(
    r"목표주가\s+현재주가.*?(?P<tp>(?:[$₩])?\s*\d{1,3}(?:[,]\d{3})+(?:\.\d+)?(?:\s*원)?)"
    r"\s+(?P<cp>(?:[$₩])?\s*\d{1,3}(?:[,]\d{3})+(?:\.\d+)?(?:\s*원)?)"
    r"(?:\s+\d+(?:\.\d+)?\s*%)?",
    re.I | re.S,
)

target_gone_patterns = ["271560", "2023-10-11_효성", "2024-08-16_HD현대일렉트릭", "145020"]

# search all markdown files
all_files = glob.glob("data/markdown/**/*.md", recursive=True)
for pat in target_gone_patterns:
    matches = [f for f in all_files if pat in f or any(p in f for p in [pat])]
    # also try by key fragments

for f in all_files:
    fname = f.replace("\\", "/")
    # Check files that were target_gone
    is_target = (
        "271560" in f and "220813" in f
        or ("2023-10-11" in f and "효" in f)
        or ("2024-08-16" in f and "HD" in f and "일렉" in f)
        or ("145020" in f)
    )
    if not is_target:
        continue

    try:
        lines = open(f, encoding="utf-8", errors="replace").readlines()
    except Exception as e:
        print(f"ERROR opening {f}: {e}")
        continue

    first_page = " ".join(l.strip() for l in lines[:180])
    kb = KUVIC_PRICE_BLOCK_RE.search(first_page)

    print(f"\nFILE: {f[-70:]}")
    if kb:
        print(f"  KUVIC match: tp={kb.group('tp')!r} cp={kb.group('cp')!r}")
    else:
        print("  KUVIC: no match")

    # Show first 30 non-empty lines
    for i, l in enumerate(lines[:50]):
        ls = l.strip()
        if ls:
            print(f"  L{i}: {ls[:120]}")
