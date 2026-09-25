# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); commits follow Conventional Commits.

## [Unreleased]

### Changed
- `deedlit.search`: typed Qdrant boundary (`UpsertItem`, `CatalogImage`, response models), split batch loop and hybrid-query helpers, no `Any`.
- `deedlit.labelagent`: labels returned as `ImageLabel`/`HealthStatus` models, no `Any`, passes ruff + basedpyright strict.

### Added
- Python lint enforcement for the code-style rules: shared `ruff.toml` (ANN, banned `Any`/`TypedDict`/`NamedTuple`, complexity/statement limits) and basedpyright strict with `reportAny`/`reportExplicitAny` per service. Root `npm run lint:py`.
- `zod` added to `deedlit.dev.ui`.
- `docs/agents/code-style.md`: repo-wide rules — zod-derived TS types (including props), pydantic/dataclass Python models, no `any`/`Any`, small functions. Linked from root and every package `AGENTS.md` and from `CLAUDE.md`.
