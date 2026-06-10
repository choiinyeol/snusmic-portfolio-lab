import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
from pykrx import stock

tickers = ['006650','004000','073010','012345','075189','120000','012300',
           '096235','039944','103150','009960','210960',
           '063280','052970','114120','085810','048260','033180',
           '009310','095720','214330','192250','001120']
for t in tickers:
    try:
        name = stock.get_market_ticker_name(t)
        print(f"{t}: {name}")
    except Exception as e:
        print(f"{t}: ERROR {e}")
