import csv

with open("data/report_performance.csv", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

d0 = [r for r in rows if r.get("days_to_target") == "0"]
print(f"Total days_to_target==0: {len(d0)}")

# How many are in modern era (>= 2019-07-01)?
modern_d0 = [r for r in d0 if (r.get("report_date") or "") >= "2019-07-01"]
print(f"Modern era (>=2019-07-01) d+0: {len(modern_d0)}")
for r in modern_d0:
    print(f"  company={r['company']}, ticker={r['ticker']}, date={r['report_date']}, tp={r['target_price']}, rcp={r['report_current_price']}, school={r['school']}")

# Also check how many have rcp missing
d0_no_rcp = [r for r in d0 if not r.get("report_current_price")]
print(f"\nd+0 with no report_current_price: {len(d0_no_rcp)}")
print("These are the ones where tp could equal start_close on publication day")

# Breakdown by year
from collections import Counter
years = Counter((r.get("report_date") or "")[:4] for r in d0)
for y in sorted(years):
    print(f"  {y}: {years[y]}")
