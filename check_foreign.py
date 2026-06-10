import csv

with open("data/report_performance.csv", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

# Find foreign listings
foreign = []
seen = set()
for r in rows:
    t = r.get("ticker", "") or ""
    company = r.get("company", "") or ""
    rcp_raw = r.get("report_current_price_raw", "") or ""
    tp_raw = r.get("target_price_raw", "") or ""
    # dot-exchange suffixes or yen-priced
    if "." in t and not t.replace(".", "").isdigit():
        k = (t, company)
        if k not in seen:
            seen.add(k)
            foreign.append(("dot_ticker", r))
    if "엔" in rcp_raw or "엔" in tp_raw:
        k = (t, company)
        if k not in seen:
            seen.add(k)
            foreign.append(("yen_price", r))

for reason, r in foreign:
    print(f"reason={reason}, ticker={r['ticker']}, company={r['company']}, rcp_raw={r['report_current_price_raw']}, tp_raw={r['target_price_raw']}, date={r['report_date']}, school={r['school']}")

# Count D+0
d0 = [r for r in rows if r.get("days_to_target") == "0"]
print(f"\nTotal rows: {len(rows)}, days_to_target==0: {len(d0)}")
for r in d0[:20]:
    print(f"  d0: company={r['company']}, ticker={r['ticker']}, date={r['report_date']}, tp={r['target_price']}, rcp={r['report_current_price']}")
