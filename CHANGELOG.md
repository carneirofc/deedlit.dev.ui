# Changelog

All notable changes to this project are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); commits follow Conventional Commits.

## [Unreleased]

### Changed
- `deedlit.dev.comfyhelper`: all props and data derived from zod schemas, route handlers/stores/fetches parse at the boundary, large pages (`library`, `[imageId]`, `admin`, `admin/db`, `compare`, `settings`, `Lightbox`) split into hooks and subcomponents.
- `deedlit.ingest`: queue payloads, catalog records, job snapshots and config as pydantic models (wire formats unchanged), split `_run_reconcile`/`_run_folder`/pipeline hotspots, no `Any`; malformed stored blobs and queue payloads are still tolerated.
- `deedlit.catalog`: typed row mapping and response models in the repository/routers, `ImageListQuery` query model for `GET /images` (same query params), split `upsert_image`/`library_stats`/migration `reconcile`, `JsonValue` for opaque JSON columns, no `Any`.
- `deedlit.vision`: typed embedding boundary over torch/open_clip (concrete `list[float]` outputs), split model loading, no `Any`.
- `@carneirofc/ui`: all component props and data types derived from zod schemas (exported type names unchanged), `DirectoryPicker` parses the fs-browse response, large components (`Gallery`, `DockPanel`, `TagSelect`, `DirectoryPicker`, `Toast`) split into hooks/subcomponents.
- `deedlit.api`: typed downstream clients, pydantic JSON-RPC envelope and per-tool argument models in the MCP registry, no `Any`; MCP now rejects non-object messages with `-32600` instead of a 500.
- `deedlit.metadata`: `ExtractResult`/`GenerationParams`/`References`/`LoraRef` models (wire-identical `/extract`), `JsonValue` for the ComfyUI graph, split parsing hotspots.
- `deedlit.graph`: typed Neo4j record extraction, response/rebuild models, split `upsert_edges`/`neighbors`/batch loop, no `Any`.
- `deedlit.search`: typed Qdrant boundary (`UpsertItem`, `CatalogImage`, response models), split batch loop and hybrid-query helpers, no `Any`.
- `deedlit.labelagent`: labels returned as `ImageLabel`/`HealthStatus` models, no `Any`, passes ruff + basedpyright strict.

### Added
- Biome enforcement for the TypeScript code-style rules: GritQL plugin `biome-plugins/no-hand-written-types.grit` bans `interface` and inline object types, `noExcessiveLinesPerFunction` (40 lines, 60 for `*.tsx`), `noExcessiveCognitiveComplexity` (warning). `docs/agents/code-style.md` now points at Biome instead of the removed ESLint config.

### Removed
- Leftover `eslint-disable` comments in `@carneirofc/ui` and `deedlit.dev.comfyhelper` (Biome ignores them).
- Python lint enforcement for the code-style rules: shared `ruff.toml` (ANN, banned `Any`/`TypedDict`/`NamedTuple`, complexity/statement limits) and basedpyright strict with `reportAny`/`reportExplicitAny` per service. Root `npm run lint:py`.
- `zod` added to `deedlit.dev.ui`.
- `docs/agents/code-style.md`: repo-wide rules — zod-derived TS types (including props), pydantic/dataclass Python models, no `any`/`Any`, small functions. Linked from root and every package `AGENTS.md` and from `CLAUDE.md`.
