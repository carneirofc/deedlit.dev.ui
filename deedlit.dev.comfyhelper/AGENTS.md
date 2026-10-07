# deedlit.dev.comfyhelper — ComfyHelper UI

## Purpose
- Next.js app (port 3000): UI for browsing and managing the generated-image library — hybrid search, tag/safety filters, Neo4j graph filter, and an admin page for ingestion, source folders, cache, and maintenance jobs.

## Ownership
- UI only. No database, no direct datastore access — every read/write proxies through the `deedlit.api` gateway.
- Must not own app-agnostic primitives (those belong in `deedlit.dev.ui`) and must not reimplement MCP tools (those live in `deedlit.api/mcp.py`).

## Local Contracts
- Source of truth for architecture: `IMAGE_LIBRARY.md` + `README.md` + the actual code (`lib/api-client.ts`, `app/api/mcp/route.ts`, `app/api/library/**`, `lib/library/**`, `lib/store/**`).
- ⚠️ `.github/copilot-instructions.md` and `.github/instructions/architecture.instructions.md` describe a pre-refactor Prisma/contracts/messaging/worker monolith that no longer exists — do not follow them for architecture; prefer `IMAGE_LIBRARY.md` and the current tree.
- `package.json` name `deedlit.dev.comfyhelper`; talks to the gateway at `DEEDLIT_API_URL` (default `http://localhost:8088`). `dev` starts Redis then `next dev`.
- Playwright configs: `playwright.config.ts` (e2e, `tests/e2e`), `playwright.unit.config.ts` (`tests/unit/*.unit.ts`), `playwright.verify.config.ts` (`*verify*.spec.ts`). Only `test:e2e*` scripts are wired into `package.json`.
- Cross-service id helper: `lib/library/id-scheme.ts` (see [`../id-scheme/`](../id-scheme/AGENTS.md)).

## Work Guidance
- Keep the app a gateway client — no datastore logic. New backend behavior belongs in the owning FastAPI service, exposed via `deedlit.api`.

## Verification
- `pnpm run lint` (Biome; root `biome.jsonc`) · `pnpm run build` · `pnpm run test:e2e` (from repo root: `pnpm run dev:comfyhelper`).
- `pnpm run lint` reports zero errors here under the aggressive Biome config (warnings and infos remain as the backlog); keep it that way. The pre-commit hook lints every staged file, so a new error blocks the commit. Suppressions use `// biome-ignore <rule>: <reason>` and must state why the code is intentional.

## Child Guides
- None.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
