# 운영 가이드 (OPS)

판결 아카이브의 자동화 파이프라인, 수동 재실행, 배포, 보안 절차를 정리한 문서입니다.

## 자동화 워크플로

두 개의 GitHub Actions 워크플로가 동일한 파이프라인(수집 → 전사 → 파싱·시세 결합 → 차트 export → 백테스트 → 커밋)을 주기만 달리해 실행합니다. 같은 concurrency group(`verdict-archive-refresh`)을 공유하므로 둘이 겹쳐 돌지 않습니다.

| 워크플로 | 파일 | 스케줄 (UTC / KST) | 모드 |
|---|---|---|---|
| `refresh-daily` | `.github/workflows/refresh-daily.yml` | `30 9 * * 1-5` (평일 18:30 KST, 장 마감 후) | 증분 — 새 게시글이 없으면 수집기가 조기 종료. 시세·백테스트는 항상 재생성 |
| `full-sweep-manual` | `.github/workflows/refresh-reports.yml` | 스케줄 없음 (workflow_dispatch 전용) | 전체 스윕 — 평소엔 일간 증분이 전부 커버, 복구용으로만 수동 실행 |

공통 사항:

- 커밋 주체는 `verdict-archive-bot`이며 `src/data/*.json`, `public/prices/`, `data/` 산출물만 스테이징합니다. 변경이 없으면 커밋 없이 종료합니다.
- `data/prices/` 시세 캐시는 `actions/cache`로 복원되어 증분 조회만 발생합니다.
- OCR 폴백(`scripts/ocr_fallback.py`)은 Windows `winocr` 전용이라 CI에서는 의도적으로 건너뜁니다. 이미지 전용 PDF가 새로 들어오면 로컬(Windows)에서 한 번 돌려 커밋하면 됩니다.

### 필요한 Secrets

레포 Settings → Secrets and variables → Actions:

| Secret | 용도 |
|---|---|
| `KRX_ID` | KRX 데이터 포털 로그인 ID (`build_report_performance.py` 시세 조회) |
| `KRX_PW` | KRX 데이터 포털 비밀번호 |

### 수동 재실행

두 워크플로 모두 `workflow_dispatch`를 지원합니다.

```bash
gh workflow run refresh-daily.yml --repo ChoiInYeol/SNUSMIC-Portfolio
gh workflow run refresh-reports.yml --repo ChoiInYeol/SNUSMIC-Portfolio

# 실행 상태 확인
gh run list --repo ChoiInYeol/SNUSMIC-Portfolio --workflow refresh-daily.yml --limit 5
gh run watch --repo ChoiInYeol/SNUSMIC-Portfolio
```

또는 GitHub UI: Actions 탭 → 워크플로 선택 → "Run workflow".

## Vercel 배포

| 항목 | 값 |
|---|---|
| 프로젝트 | `verdict-archive` (`prj_LPAuSB8gjKIdw6OZ3yIhuMiu63ae`) |
| 팀 | `team_bhIzHPiilnrcujrv6YdR8Isr` |
| 프로덕션 URL | https://verdict-archive.vercel.app |
| 트리거 | `main` 브랜치 push 시 자동 빌드·배포 (Next.js 자동 감지, 추가 설정 없음) |

사이트는 SSG이므로 Vercel 측에는 런타임 시크릿이 필요 없습니다. KRX 자격증명은 GitHub Actions에서만 사용됩니다.
자동 갱신 워크플로의 봇 커밋이 push될 때마다 재배포가 일어나므로, GitHub deployments 기록은 주기적으로 쌓입니다(2026-06 기준 최신 3건만 남기고 정리함).

## SECURITY — KRX 자격증명 노출 [DONE 2026-06-11]

**`.env`(KRX_ID/KRX_PW)가 public 히스토리 `51a789f`~`af2cb8b` 구간(23개 커밋)에 노출되었습니다.**
`af2cb8b`에서 untrack 처리했지만, 그 이전 커밋들의 트리에는 파일이 그대로 남아 있어 public 레포에서 누구나 열람 가능했습니다.

**완료된 조치 (2026-06-11):**

1. **KRX 비밀번호 교체** — http://data.krx.co.kr 비밀번호 변경 + 레포 Secrets 갱신 완료.
2. **git filter-repo 히스토리 세척** — 전체 히스토리에서 `.env` 제거 후 강제 푸시 완료. 모든 커밋 SHA 재작성됨.
3. **잔여 (선택)** — GitHub Support에 GC(가비지 컬렉션) 요청 (dangling object 완전 제거용). 비밀번호를 이미 교체했으므로 필수는 아님.

### 참고 — 세척 과정에서 발생한 영향

- **모든 커밋 SHA가 바뀌었습니다.** 릴리스 노트(v1.0.0 등)에 박힌 구 SHA 링크가 끊어졌습니다.
- **협업자(있을 경우)는 re-clone이 필요합니다.**
- GitHub 측 캐시(PR, 포크, API의 dangling commit)에는 구 객체가 한동안 남을 수 있습니다.

### 세척에 사용한 절차 (기록용)

```bash
# filter-repo는 fresh clone에서만 동작
pip install git-filter-repo
git clone https://github.com/ChoiInYeol/SNUSMIC-Portfolio.git smic-scrub
cd smic-scrub

# 전체 히스토리(전 브랜치·태그)에서 .env 제거
git filter-repo --invert-paths --path .env

# 리모트 재등록 후 강제 푸시
git remote add origin https://github.com/ChoiInYeol/SNUSMIC-Portfolio.git
git push origin --force --all
git push origin --force --tags
```

## 릴리스 / 태그 정책

- 구 422-커밋 시대의 v0.x~v1.0.5 태그·릴리스(121개 태그, 11개 릴리스)는 2026-06-11에 일괄 삭제했습니다. 현재 main에서 도달 불가능한 고아 히스토리를 가리키고 있었기 때문입니다.
- 현행 릴리스는 `v1.0.0`(판결 아카이브 v1.0)부터 시작합니다. 새 릴리스는 `gh release create vX.Y.Z --target <sha>`로 생성하세요.
