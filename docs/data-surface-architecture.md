# Data Surface Architecture

Last updated: 2026-05-13

## Problem

The app has been improving visually, but several pages still reconstruct the same meaning independently:

- Overview hardcodes a primary persona.
- Portfolio defaults to a different local selector rule.
- Strategies owns benchmark separation through frontend constants.
- Report ranking views can show different columns for the same rows.
- Strategy IDs encode meaning that should be data.

This creates a negative feedback loop: each UI improvement adds another local interpretation, then later work has to patch the duplicates.

## Target boundary

The Python exporter should produce product-shaped data bundles. The frontend renders those bundles and only performs light formatting/filtering.

```text
Pipeline → domain artifacts → page bundles → frontend readers → shared components
```

A page should be able to answer: “which artifact owns my data?” without importing every raw artifact.

## Strategy catalog contract

`data/web/strategies/catalog.json` is the first required step. It defines benchmark/strategy/oracle taxonomy and strategy methodology.

Required semantics:

- Benchmarks are comparison baselines.
- Weak Prophet is an oracle/future-information benchmark.
- Selectable strategies are user-reviewable broker-ledger strategies.
- Default overview strategy is chosen from the catalog, not hardcoded.
- MTT strategy buy/sell rules are rendered from catalog methodology.

## Page bundle plan

### Overview

Consumes:

- selected/default strategy snapshot,
- objective gate result,
- concise strategy/benchmark comparison,
- current holdings including cash,
- latest research pulse.

Does not own full tables.

### Portfolio

Consumes:

- strategy catalog selector options,
- holdings by selected strategy,
- cash by selected strategy,
- trade ledger,
- position episodes,
- equity path.

Owns “why did it buy/sell?” explanations.

### Reports / Research

Consumes one unified report table and presets. Ranking modes must change sort/filter defaults, not columns.

### Strategies

Consumes:

- strategy catalog,
- leaderboard metrics,
- benchmark lines,
- selectable strategy lines,
- objective gate,
- methodology cards.

Owns “what are the rules and why did it pass/fail?”

### Guide

Consumes curated examples or small derived samples, not raw full artifacts. It explains the product flow and metric definitions interactively.

## Deletion targets

- Frontend hardcoded `PRIMARY_PERSONA` as business truth.
- Frontend-only benchmark taxonomy as the only source of truth.
- Multiple report ranking UIs with different columns over the same row type.
- Long chart legends without series visibility controls.
- Developer-facing copy in primary SaaS surfaces.

## Implemented slices

1. `strategies/catalog.json` export defines benchmark / strategy / oracle taxonomy.
2. Zod readers validate the strategy catalog and required app artifacts.
3. Overview default strategy is selected from the catalog rather than a hardcoded persona.
4. MTT strategy method summaries are rendered from exported rules and params.
5. Performance charts use visible series controls.
6. Page-owned bundles now exist under:

```text
data/web/overview/
data/web/portfolio/
data/web/reports/
data/web/strategies/
data/web/screener/
```

7. The frontend readers now consume those page bundles for overview, portfolio, reports, strategies, and screener data.

Top-level artifacts are still exported as raw/download surfaces during the cutover, but route-level product code should read the page-owned bundles first.
