import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = Path(__file__).resolve().parent
with open(ROOT / 'src/data/report-performance.json', encoding='utf-8') as f:
    data = json.load(f)
records = data['records']

print('Total records:', len(records))

# Issue 1: target_price_suspect
suspects = [r for r in records if r.get('qa_flags') and 'target_price_suspect' in r.get('qa_flags', '')]
print(f'target_price_suspect count: {len(suspects)}')
print('\n=== SUSPECT RECORDS ===')
for r in suspects:
    src = r.get('source_file', '')
    src_short = src[-70:] if len(src) > 70 else src
    print(f"  {r.get('school',''):6} {str(r.get('ticker','')):10} raw={str(r.get('target_price_raw','')):25} start_close={r.get('start_close')} file={src_short}")

# Issue 2: upside > 300
high_upside = [r for r in records if r.get('stated_upside_pct') is not None and r.get('stated_upside_pct') > 300]
print(f'\n=== UPSIDE > 300% ({len(high_upside)}) ===')
for r in high_upside:
    print(f"  {r.get('school',''):6} {str(r.get('ticker','')):10} upside={r.get('stated_upside_pct'):8.1f} target={r.get('target_price')} start_close={r.get('start_close')} raw={r.get('target_price_raw')}")

# Issue 3: modern buys with null target
modern_buy_no_target = [r for r in records if r.get('rating_class') == 'buy' and r.get('era') == 'modern' and r.get('target_price') is None]
print(f'\n=== MODERN BUY WITH NULL TARGET ({len(modern_buy_no_target)}) ===')
for r in modern_buy_no_target:
    src = r.get('source_file', '')
    src_short = src[-70:] if len(src) > 70 else src
    print(f"  {r.get('school',''):6} {str(r.get('ticker','')):10} parse_issue={r.get('parse_issue')} qa={r.get('qa_flags')} file={src_short}")

# Issue 4: ticker but no price
no_price = [r for r in records if r.get('ticker') and r.get('start_close') is None and r.get('data_issue') not in ('missing_report_date',)]
print(f'\n=== TICKER BUT NO PRICE ({len(no_price)}) ===')
for r in no_price:
    print(f"  {r.get('school',''):6} {str(r.get('ticker','')):10} market={r.get('market')} data_issue={r.get('data_issue')} company={r.get('company')}")

# Issue 5: ocr_inconsistent
ocr_inc = [r for r in records if r.get('qa_flags') and 'ocr_inconsistent_prices' in r.get('qa_flags', '')]
print(f'\n=== OCR_INCONSISTENT_PRICES ({len(ocr_inc)}) ===')
for r in ocr_inc:
    src = r.get('source_file', '')
    src_short = src[-70:] if len(src) > 70 else src
    print(f"  {r.get('school',''):6} {str(r.get('ticker','')):10} file={src_short}")
