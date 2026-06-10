import csv, pathlib, sys

csv_path = pathlib.Path("data/report_performance.csv")
if not csv_path.exists():
    print("report_performance.csv not found")
    sys.exit(1)

with open(csv_path, encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

target_dates = {"2025-04-12", "2023-11-03", "2023-06-01", "2023-05-19", "2022-05-21", "2021-05-15", "2020-10-31", "2023-04-07"}

found = 0
for row in rows:
    rd = row.get("report_date", "")
    school = row.get("school", "")
    if rd in target_dates and school == "smic":
        found += 1
        print(f"date={rd}, company={row.get('company','')}, ticker={row.get('ticker','')}")
        print(f"  rcp={row.get('report_current_price','')}, rcp_raw={row.get('report_current_price_raw','')}")
        print(f"  tp={row.get('target_price','')}, tp_raw={row.get('target_price_raw','')}")
        print(f"  days_to_target={row.get('days_to_target','')}, qa_flags={row.get('qa_flags','')}")
        print()

print(f"Found {found} rows")

# Also count D+0
d0 = sum(1 for r in rows if r.get("days_to_target") == "0")
print(f"Total days_to_target==0: {d0}")
