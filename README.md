# 판결 아카이브 — 시간이 매긴 성적표

대학 투자동아리(서울대 SMIC · 연세대 YIG · 성균관대 STAR · 고려대 KUVIC)의 리서치 리포트
PDF를 markdown으로 전사하고, 목표가·투자의견을 파싱한 뒤 point-in-time 시세로 발간 이후의
실제 주가 경로를 검증하는 아카이브입니다.

> 모든 리포트는, 결국 시장의 판결을 받는다.

## 페이지

- `/` — 판결 아카이브 (판결문 · 연대기 · 증거의 서가)
- `/clubs`, `/clubs/[school]` — 학회별 성적표 (최신순 장부, 연도별 요약)
- `/stocks/[market-ticker]` — 종목별 학회 컨센서스 (교차 학회 비교)
- `/strategy` — 학회 리포트 × 모멘텀(신고가 돌파 + ATR 트레일링) 전략 백테스트

## 파이프라인

```bash
npm install && npm run dev          # http://localhost:3000

# 1) 수집 (1회만 다운로드, manifest 관리, 요청 간 2.5초 지연)
.venv/Scripts/python scripts/collect_smic.py              # SMIC (증분, WP REST API)
.venv/Scripts/python scripts/collect_smic.py --full       # SMIC 전체 789건 순회
.venv/Scripts/python scripts/collect_reports.py --source all
.venv/Scripts/python scripts/collect_kuvic_browser.py     # KUVIC 전체 목록(브라우저)

# 2) 전사 (opendataloader-pdf, 로컬 JDK) + OCR 폴백 (텍스트 없는 PDF 표지)
.venv/Scripts/python scripts/transcribe_pdfs.py
.venv/Scripts/python scripts/ocr_fallback.py

# 3) 파싱 + 시세 결합 (.env의 KRX_ID/KRX_PW 사용, data/prices/ 증분 캐시)
.venv/Scripts/python scripts/build_report_performance.py

# 4) 종목 차트 데이터 → public/prices/{slug}.json
.venv/Scripts/python scripts/export_stock_charts.py

# 5) 전략 백테스트 (민감도 그리드 포함) → src/data/strategy-backtest.json
.venv/Scripts/python scripts/backtest_momentum.py
```

## 배포 / 자동 갱신

- `.github/workflows/refresh-data.yml` — 매주 월요일 시세 갱신 → 데이터셋·차트·백테스트 재생성 → 커밋.
  레포 Settings → Secrets에 `KRX_ID`, `KRX_PW` 등록 필요.
- Vercel: 대시보드에서 이 레포를 연결하면 끝 (Next.js 자동 감지, 추가 설정 불필요).
  주간 갱신 커밋이 푸시될 때마다 자동 재배포됩니다.

데이터 복구 체인: 일반 전사 → 파일명/수집 메타데이터 힌트 → 네이버 자동완성 티커 복구
→ Windows OCR 표지 폴백. 사람이 검증한 교정값은 `data/sources/corrections.json`으로 유지됩니다.

## 데이터 소스

| 동아리 | 학교 | 수집 |
|---|---|---|
| SMIC | 서울대학교 | 771건 — http://snusmic.com/research/ |
| YIG | 연세대학교 | 104건 — https://yig.yonsei.ac.kr/research |
| STAR | 성균관대학교 | 281건 — http://starskku.com/board/board_list?code=research |
| KUVIC | 고려대학교 | 104건 — https://www.kuvic.com/research |

수집 원칙: 각 PDF는 **1회만 다운로드**하고 SHA256 manifest로 관리하며, 요청 간 지연을 두어
원 서버에 부하를 주지 않습니다.

## Legacy

이전 버전(리서치 워크스테이션, 422 커밋)은 [`legacy` 브랜치](../../tree/legacy)에 보존되어 있습니다.
파서 교정 규칙·시세 웨어하우스 등은 legacy에서 선별 이식합니다.
