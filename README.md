# SMIC 판결 아카이브 — 시간이 매긴 성적표

대학 투자동아리 리서치 리포트 PDF를 markdown으로 전사하고, 목표가·투자의견을 파싱한 뒤
point-in-time 시세로 발간 이후의 실제 주가 경로를 검증하는 아카이브입니다.

> 모든 리포트는, 결국 시장의 판결을 받는다.

## 구성

- `data/pdfs/` — 원본 리포트 PDF (git 미추적, 1회만 다운로드)
- `data/markdown/` — PDF 전사 결과
- `scripts/build_report_performance.py` — 파싱 + 시세 결합 → `src/data/report-performance.json`
- `src/` — Next.js 웹 (판결문 · 연대기 · 증거의 서가 UI)

## 실행

```bash
npm install
npm run dev        # http://localhost:3000

# 데이터 파이프라인 재생성
.venv/Scripts/python scripts/build_report_performance.py
```

## 데이터 소스 (로드맵 포함)

| 동아리 | 학교 | 상태 |
|---|---|---|
| SMIC | 서울대학교 | 수집 완료 (216건) |
| YIG | 연세대학교 | 예정 — https://yig.yonsei.ac.kr/research |
| STAR | 성균관대학교 | 예정 — http://starskku.com/board/board_list?code=research |
| KUVIC | 고려대학교 | 예정 — https://www.kuvic.com/research |

수집 원칙: 각 PDF는 **1회만 다운로드**하고 manifest로 관리하며, 요청 간 지연을 두어
원 서버에 부하를 주지 않습니다.

## Legacy

이전 버전(리서치 워크스테이션, 422 커밋)은 [`legacy` 브랜치](../../tree/legacy)에 보존되어 있습니다.
파서 교정 규칙·시세 웨어하우스 등은 legacy에서 선별 이식합니다.
