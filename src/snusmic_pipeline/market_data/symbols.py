from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SymbolRule:
    ticker: str
    exchange: str
    yfinance_symbol: str
    currency: str = ""


YFINANCE_SUFFIXES = {
    "AMS": ".AS",
    "ASX": ".AX",
    "EPA": ".PA",
    "ETR": ".DE",
    "FRA": ".F",
    "HKEX": ".HK",
    "HKG": ".HK",
    "LON": ".L",
    "LSE": ".L",
    "SHA": ".SS",
    "SHE": ".SZ",
    "SIX": ".SW",
    "SSE": ".SS",
    "SWX": ".SW",
    "SZSE": ".SZ",
    "TPE": ".TW",
    "TSE": ".T",
    "TSX": ".TO",
    "TWSE": ".TW",
    "TYO": ".T",
}


KOSDAQ_TICKERS = frozenset(
    [
        "033500",
        "035900",
        "036930",
        "041830",
        "043650",
        "044490",
        "049720",
        "053030",
        "054210",
        "054780",
        "060150",
        "067160",
        "089600",
        "089860",
        "089890",
        "098120",
        "099430",
        "100840",
        "101160",
        "101490",
        "108490",
        "114810",
        "119610",
        "119850",
        "122640",
        "131970",
        "148150",
        "159010",
        "166090",
        "170790",
        "182360",
        "189300",
        "192400",
        "194480",
        "196170",
        "200710",
        "204620",
        "211050",
        "214450",
        "215000",
        "218410",
        "228670",
        "234300",
        "237690",
        "252990",
        "259960",
        "263750",
        "280360",
        "285490",
        "287410",
        "293490",
        "294570",
        "298020",
        "310200",
        "328130",
        "344820",
        "348210",
        "348370",
        "353810",
        "356860",
        "363250",
        "366030",
        "368600",
        "376980",
        "403870",
        "408920",
        "420770",
        "440110",
        "453340",
        "456160",
        "461300",
        "472850",
        "473980",
        "475960",
        "476830",
        "950160",
        "950170",
    ]
)


TICKER_EXCHANGES = {
    "002340": "SZSE",
    "002714": "SZSE",
    "1211": "HKG",
    "1833": "HKG",
    "2124": "TYO",
    "3443": "TWSE",
    "4680": "TYO",
    "4689": "TYO",
    "4751": "TYO",
    "5253": "TYO",
    "5726": "TYO",
    "6857": "TYO",
    "AIXA": "ETR",
    "ANET": "NYSE",
    "BAC": "NYSE",
    "BESI": "AMS",
    "BILI": "NASDAQ",
    "CAMT": "NASDAQ",
    "CHGG": "NYSE",
    "CHWY": "NYSE",
    "CLBT": "NASDAQ",
    "CRWV": "NASDAQ",
    "DOCS": "NYSE",
    "EAF": "NYSE",
    "ESTA": "NASDAQ",
    "FIX": "NYSE",
    "FLNC": "NASDAQ",
    "FNKO": "NASDAQ",
    "GLNG": "NASDAQ",
    "GLW": "NYSE",
    "GRND": "NYSE",
    "GTT": "EPA",
    "IMAX": "NYSE",
    "INMD": "NASDAQ",
    "IRMD": "NASDAQ",
    "ISRG": "NASDAQ",
    "LEU": "NYSE",
    "LEVI": "NYSE",
    "LIF": "NASDAQ",
    "LITE": "NASDAQ",
    "LLY": "NYSE",
    "LONN": "SIX",
    "MP": "NYSE",
    "NE": "NYSE",
    "NETI": "NYSE",
    "OPEN": "NASDAQ",
    "PLTR": "NASDAQ",
    "ROKU": "NASDAQ",
    "SBLK": "NASDAQ",
    "SE": "NYSE",
    "SOI": "EPA",
    "SRAD": "NASDAQ",
    "STNG": "NYSE",
    "STRL": "NASDAQ",
    "SXT": "NYSE",
    "TEM": "NASDAQ",
    "TS": "NYSE",
    "TSM": "NYSE",
    "VRT": "NYSE",
    "VTNR": "NASDAQ",
    "WFG": "NYSE",
    "WOLF": "NYSE",
}


COMPANY_SYMBOL_RULES = {
    "Advantest Corporation": SymbolRule("6857", "TYO", "6857.T", "JPY"),
    "Aixtron SE": SymbolRule("AIXA", "ETR", "AIXA.DE", "EUR"),
    "Arista Networks": SymbolRule("ANET", "NYSE", "ANET", "USD"),
    "BE Semiconductor Industries N.V.": SymbolRule("BESI", "AMS", "BESI.AS", "EUR"),
    "BYD": SymbolRule("1211", "HKG", "1211.HK", "HKD"),
    "Bank of America Corp.": SymbolRule("BAC", "NYSE", "BAC", "USD"),
    "Bili bili": SymbolRule("BILI", "NASDAQ", "BILI", "USD"),
    "Bilibili": SymbolRule("BILI", "NASDAQ", "BILI", "USD"),
    "Camtek": SymbolRule("CAMT", "NASDAQ", "CAMT", "USD"),
    "Cellebrite DI": SymbolRule("CLBT", "NASDAQ", "CLBT", "USD"),
    "Centrus Energy Corp": SymbolRule("LEU", "NYSE", "LEU", "USD"),
    "Chegg": SymbolRule("CHGG", "NYSE", "CHGG", "USD"),
    "Comfort Systems USA, Inc.": SymbolRule("FIX", "NYSE", "FIX", "USD"),
    "Coreweave": SymbolRule("CRWV", "NASDAQ", "CRWV", "USD"),
    "Corning": SymbolRule("GLW", "NYSE", "GLW", "USD"),
    "Cover Corp": SymbolRule("5253", "TYO", "5253.T", "JPY"),
    "Cyber Agent": SymbolRule("4751", "TYO", "4751.T", "JPY"),
    "CyberAgent Inc.": SymbolRule("4751", "TYO", "4751.T", "JPY"),
    "Doximity": SymbolRule("DOCS", "NYSE", "DOCS", "USD"),
    "Eli Lilly & Co.": SymbolRule("LLY", "NYSE", "LLY", "USD"),
    "Eneti Inc.": SymbolRule("NETI", "NYSE", "NETI", "USD"),
    "Establishment Labs Holdings": SymbolRule("ESTA", "NASDAQ", "ESTA", "USD"),
    "Fluence Energy Inc.": SymbolRule("FLNC", "NASDAQ", "FLNC", "USD"),
    "Funko Inc.": SymbolRule("FNKO", "NASDAQ", "FNKO", "USD"),
    "GEM Co., Ltd.": SymbolRule("002340", "SZSE", "002340.SZ", "CNY"),
    "Gaztransport&technigaz": SymbolRule("GTT", "EPA", "GTT.PA", "EUR"),
    "Global Unichip Corp.": SymbolRule("3443", "TWSE", "3443.TW", "TWD"),
    "Golar LNG": SymbolRule("GLNG", "NASDAQ", "GLNG", "USD"),
    "GrafTech International Ltd.": SymbolRule("EAF", "NYSE", "EAF", "USD"),
    "Grindr Inc.": SymbolRule("GRND", "NYSE", "GRND", "USD"),
    "IMAX Corp": SymbolRule("IMAX", "NYSE", "IMAX", "USD"),
    "Inmode": SymbolRule("INMD", "NASDAQ", "INMD", "USD"),
    "Intuitive Surgical": SymbolRule("ISRG", "NASDAQ", "ISRG", "USD"),
    "Iradimed Corporation": SymbolRule("IRMD", "NASDAQ", "IRMD", "USD"),
    "JAC recruitment Co. Ltd": SymbolRule("2124", "TYO", "2124.T", "JPY"),
    "Levi Strauss & Co": SymbolRule("LEVI", "NYSE", "LEVI", "USD"),
    "Life360 Inc": SymbolRule("LIF", "NASDAQ", "LIF", "USD"),
    "Lonza Group AG": SymbolRule("LONN", "SIX", "LONN.SW", "CHF"),
    "Lumentum Holdings Inc": SymbolRule("LITE", "NASDAQ", "LITE", "USD"),
    "MP Materials": SymbolRule("MP", "NYSE", "MP", "USD"),
    "Muyuan foods co ltd": SymbolRule("002714", "SZSE", "002714.SZ", "CNY"),
    "Noble Corporation PLC": SymbolRule("NE", "NYSE", "NE", "USD"),
    "OSAKA Titanium Technologies Co.,Ltd.": SymbolRule("5726", "TYO", "5726.T", "JPY"),
    "Opendoor": SymbolRule("OPEN", "NASDAQ", "OPEN", "USD"),
    "Palantir Technologies Inc.": SymbolRule("PLTR", "NASDAQ", "PLTR", "USD"),
    "Ping An Healthcare & Technology": SymbolRule("1833", "HKG", "1833.HK", "HKD"),
    "Roku": SymbolRule("ROKU", "NASDAQ", "ROKU", "USD"),
    "Round One Corp": SymbolRule("4680", "TYO", "4680.T", "JPY"),
    "SEA ltd.": SymbolRule("SE", "NYSE", "SE", "USD"),
    "Scorpio Tankers Inc.": SymbolRule("STNG", "NYSE", "STNG", "USD"),
    "Sensient Technologies Corp": SymbolRule("SXT", "NYSE", "SXT", "USD"),
    "Soitec SA": SymbolRule("SOI", "EPA", "SOI.PA", "EUR"),
    "Sportradar": SymbolRule("SRAD", "NASDAQ", "SRAD", "USD"),
    "Star Bulk Carriers": SymbolRule("SBLK", "NASDAQ", "SBLK", "USD"),
    "Sterling Infrastructure Inc": SymbolRule("STRL", "NASDAQ", "STRL", "USD"),
    "TSMC": SymbolRule("TSM", "NYSE", "TSM", "USD"),
    "Tempus AI Inc": SymbolRule("TEM", "NASDAQ", "TEM", "USD"),
    "Tenaris S.A.": SymbolRule("TS", "NYSE", "TS", "USD"),
    "Vertex Energy, Inc.": SymbolRule("VTNR", "NASDAQ", "VTNR", "USD"),
    "Vertiv Holdings Co.": SymbolRule("VRT", "NYSE", "VRT", "USD"),
    "West Fraser Timber. Co. Ltd": SymbolRule("WFG", "NYSE", "WFG", "USD"),
    "Wolfspeed": SymbolRule("WOLF", "NYSE", "WOLF", "USD"),
    "Z-holdings": SymbolRule("4689", "TYO", "4689.T", "JPY"),
    "샘씨엔에스": SymbolRule("252990", "KRX", "252990.KQ", "KRW"),
    "쿠쿠홈시스": SymbolRule("284740", "KRX", "284740.KS", "KRW"),
    "한화솔루션": SymbolRule("009830", "KRX", "009830.KS", "KRW"),
}


def company_ticker(company: str) -> str:
    rule = COMPANY_SYMBOL_RULES.get(str(company or "").strip())
    return rule.ticker if rule else ""


def company_symbol_rule(company: str) -> SymbolRule | None:
    return COMPANY_SYMBOL_RULES.get(str(company or "").strip())


def exchange_for_ticker(ticker: str) -> str:
    return TICKER_EXCHANGES.get(str(ticker or "").strip().upper(), "")


def infer_yfinance_symbol(ticker: str, exchange: str) -> str:
    raw = str(ticker or "").strip().upper()
    code = str(exchange or "").strip().upper()
    if not raw:
        return ""
    if "." in raw:
        return raw
    if code in {"KRX", "KOSPI", "KOSDAQ"} and raw.isdigit() and len(raw) == 6:
        if code == "KOSDAQ" or (code == "KRX" and raw in KOSDAQ_TICKERS):
            return f"{raw}.KQ"
        return f"{raw}.KS"
    suffix = YFINANCE_SUFFIXES.get(code, "")
    if suffix:
        return f"{raw}{suffix}"
    return raw
