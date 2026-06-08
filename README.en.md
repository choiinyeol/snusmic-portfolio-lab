# SNUSMIC Portfolio Lab

[한국어 README](./README.md) - [Live site](https://smic-portfolio.vercel.app) - [Changelog](./CHANGELOG.md) - [Design system](./DESIGN.md)

SNUSMIC Portfolio Lab is a **verification-first PIT research system**. It turns SMIC report PDFs into markdown evidence plus structured extraction artifacts, validates report claims as downside-aware `VerificationCase` objects, promotes repeated evidence-backed rules into `AlphaHypothesis` candidates, and then proves whether a resulting `PortfolioStrategy` can beat all-weather or index benchmarks.

### What This Repo Does

- Collects SMIC report PDFs and extracted report rows.
- Normalizes reports, prices, FX, and benchmark data into `data/warehouse`.
- Preserves dual extraction outputs: markdown evidence plus structured machine-readable artifacts.
- Builds downside-aware `VerificationCase` records from report claims and PIT price paths.
- Promotes repeated evidence-backed selection rules into `AlphaHypothesis` candidates.
- Proves portfolio strategies against all-weather or index benchmarks through deterministic static artifacts.
- Exposes historical daily buy/sell trace visibility so humans can follow why, what, how much, price, and PnL without requiring live broker execution.

### Core Commands

```bash
uv sync --locked --group dev
pnpm --dir apps/web install --frozen-lockfile --prefer-offline
```

Refresh data and static artifacts:

```bash
uv run --locked python -m snusmic_pipeline refresh-web-artifacts
```

Full rebuild:

```bash
uv run --locked python -m snusmic_pipeline rebuild-web-artifacts
```

Export web artifacts only:
The default serving mode is **local committed shards**. `external_artifacts` remains an optional path and does not become the default deploy path until hydrate / validate / build proof passes again.

```bash
uv run --locked python -m snusmic_pipeline export-web --warehouse data/warehouse --sim data/sim --out data/web
```

### Core Product Objects

| Object | Role |
| --- | --- |
| `ReportArtifact` | Source document artifact carrying PDF, markdown, and structured extraction fields |
| `VerificationCase` | PIT post-publication validation unit for one report claim |
| `AlphaHypothesis` | Repeated evidence-backed selection rule derived from many validation cases |
| `PortfolioStrategy` | Benchmark-comparable proof layer that consumes alpha hypotheses |
| `Execution trace` | Historical daily explanation surface for buy/sell reasons, size, price, and PnL |

Live broker execution is out of scope. The requirement is historical explainability at a level where a human could understand or mirror the behavior, not direct order submission.

### Web Routes

- `/` — VerificationCase board
- `/reports` — source report / evidence drilldown
- `/reports/[symbol]/[reportId]`
- `/calendar` — PIT observation-date diagnostics
- `/statistics` — validation-case distribution diagnostics
- `/portfolio` — portfolio proof catalogue
- `/portfolio/[account]` — selected strategy proof
- `/portfolio/[account]/holdings`
- `/portfolio/[account]/trades`

### Docs

| Korean | English | Purpose |
| --- | --- | --- |
| [docs/product-spec.md](./docs/product-spec.md) | [docs/product-spec.en.md](./docs/product-spec.en.md) | Verification-first product intent and priorities |
| [docs/data-artifact-policy.md](./docs/data-artifact-policy.md) | [docs/data-artifact-policy.en.md](./docs/data-artifact-policy.en.md) | Data ownership and generated-cache policy |
| [docs/backtest-contract.md](./docs/backtest-contract.md) | [docs/backtest-contract.en.md](./docs/backtest-contract.en.md) | PIT and no-lookahead contract |
| [docs/technical-architecture.md](./docs/technical-architecture.md) | [docs/technical-architecture.en.md](./docs/technical-architecture.en.md) | Pipeline, artifact, and route map |

### Validation

```bash
uv run --locked ruff check src tests scripts
uv run --locked pytest -q -m "not slow" -x
pnpm --dir apps/web artifact:check
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec biome check .
pnpm --dir apps/web build
pnpm --dir apps/web smoke:static
```

### Current Contract

This repo is PIT-first and verification-first: build trustworthy point-in-time data, validate report claims before promotion, promote only repeated evidence-backed rules, and expose strategy proof rather than account-ledger truth.
