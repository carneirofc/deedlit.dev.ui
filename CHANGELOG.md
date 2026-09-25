# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); commits follow Conventional Commits.

## [Unreleased]

### Changed
- `deedlit.vision`: typed embedding boundary over torch/open_clip (concrete `list[float]` outputs), split model loading, no `Any`.
- `@carneirofc/ui`: all component props and data types derived from zod schemas (exported type names unchanged), `DirectoryPicker` parses the fs-browse response, large components (`Gallery`, `DockPanel`, `TagSelect`, `DirectoryPicker`, `Toast`) split into hooks/subcomponents.
- `deedlit.api`: typed downstream clients, pydantic JSON-RPC envelope and per-tool argument models in the MCP registry, no `Any`; MCP now rejects non-object messages with `-32600` instead of a 500.
- `deedlit.metadata`: `ExtractResult`/`GenerationParams`/`References`/`LoraRef` models (wire-identical `/extract`), `JsonValue` for the ComfyUI graph, split parsing hotspots.
- `deedlit.graph`: typed Neo4j record extraction, response/rebuild models, split `upsert_edges`/`neighbors`/batch loop, no `Any`.
- `deedlit.search`: typed Qdrant boundary (`UpsertItem`, `CatalogImage`, response models), split batch loop and hybrid-query helpers, no `Any`.
- `deedlit.labelagent`: labels returned as `ImageLabel`/`HealthStatus` models, no `Any`, passes ruff + basedpyright strict.

### Added
- Lint enforcement for the code-style rules: shared `ruff.toml` (ANN, banned `Any`/`TypedDict`/`NamedTuple`, complexity/statement limits), basedpyright strict with `reportAny`/`reportExplicitAny` per service, shared `eslint.config.base.mjs` (no `any`, no hand-written object types, function-size/complexity limits). Root `npm run lint` and `npm run lint:py`.
- ESLint configs for `deedlit.dev` (replacing `next lint`) and `deedlit.dev.ui`; `zod` added to both.
- `docs/agents/code-style.md`: repo-wide rules — zod-derived TS types (including props), pydantic/dataclass Python models, no `any`/`Any`, small functions. Linked from root and every package `AGENTS.md` and from `CLAUDE.md`.
