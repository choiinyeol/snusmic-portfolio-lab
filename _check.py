import json

raw = json.load(open("src/data/report-performance.json", encoding="utf-8"))
reports = raw["records"]

print("=== target_unit_corrected records ===")
for r in reports:
    if "target_unit_corrected" in (r.get("qa_flags") or ""):
        sf = r["source_file"][-60:]
        tp = r.get("target_price")
        tr = r.get("target_price_raw")
        cr = r.get("report_current_price_raw")
        up = r.get("stated_upside_pct")
        print(f"  {sf}")
        print(f"    target={tp} raw={tr}")
        print(f"    current_raw={cr} stated_upside={up}")
        print()

print()
print("=== KUVIC target_gone / changed cases ===")
interest = [
    "271560",               # target_gone ewha
    "2023-10-11",           # target_gone kuvic
    "HD",                   # target_gone kuvic
    "145020",               # target_gone yig
    "2023-11-20_HK",        # changed kuvic 64300->45000
    "2024-02-28",           # changed kuvic 31900->23025
    "2024-11-11",           # changed kuvic 443520->326000
    "undated_kuvic-5ec6f7", # changed 159000->15900
    "2019-08-11",           # changed smic 332495->33249.5
    "centrus-energy",       # LEU 832->83
]
for r in reports:
    sf = r["source_file"]
    if any(k in sf for k in interest):
        print(f"  {sf[-65:]}")
        print(f"    target={r.get('target_price')} raw={r.get('target_price_raw')}")
        print(f"    cur_raw={r.get('report_current_price_raw')} qa={r.get('qa_flags')}")
        print()
