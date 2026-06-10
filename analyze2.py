import sys, json
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
ROOT = Path(__file__).resolve().parent
with open(ROOT / 'src/data/report-performance.json', encoding='utf-8') as f:
    data = json.load(f)
records = data['records']

# No price details
no_price = [r for r in records if r.get('ticker') and r.get('start_close') is None
            and r.get('data_issue') not in ('missing_report_date',)]
print(f'=== TICKER BUT NO PRICE ({len(no_price)}) ===')
for r in no_price:
    src = str(r.get('source_file',''))
    fname = src.split('\\')[-1] if '\\' in src else src.split('/')[-1]
    print(f"  {r.get('school',''):6} tk={str(r.get('ticker','')):12} mkt={r.get('market')} era={r.get('era')} rdate={r.get('report_date')} co={r.get('company')} f={fname}")

# High upside breakdown
high_upside = [r for r in records if r.get('stated_upside_pct') is not None and r.get('stated_upside_pct') > 300]
modern_high = [r for r in high_upside if r.get('era') == 'modern' and r.get('rating_class') == 'buy']
print(f'\n=== UPSIDE >300 breakdown ===')
print(f'Total: {len(high_upside)}, modern+buy: {len(modern_high)}')
for r in high_upside:
    sc = r.get('start_close')
    tp = r.get('target_price')
    ratio = (tp / sc) if (sc and tp) else None
    ratio_str = f"{ratio:.2f}" if ratio is not None else "N/A"
    print(f"  {r.get('era',''):8} {r.get('school',''):6} {str(r.get('ticker','')):10} upside={r.get('stated_upside_pct'):8.1f} tp={tp} sc={sc} ratio={ratio_str}")

# Modern buy with null target - non-OCR cases
modern_buy_no_target = [r for r in records if r.get('rating_class') == 'buy'
                        and r.get('era') == 'modern'
                        and r.get('target_price') is None]
no_ocr = [r for r in modern_buy_no_target if not (r.get('qa_flags') and 'ocr' in r.get('qa_flags',''))]
no_suspect = [r for r in no_ocr if not (r.get('qa_flags') and 'suspect' in r.get('qa_flags',''))]
print(f'\n=== MODERN BUY NULL TARGET - no OCR flag, no suspect ({len(no_suspect)}) ===')
for r in no_suspect:
    src = str(r.get('source_file',''))
    fname = src.split('\\')[-1] if '\\' in src else src.split('/')[-1]
    print(f"  {r.get('school',''):6} {str(r.get('ticker','')):10} {fname}")
