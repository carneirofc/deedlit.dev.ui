# Project rules for Claude

## Docker Compose

There is exactly ONE docker-compose file in this repository: `docker-compose.yml` at the repo root.

Do NOT create `docker-compose.yml` (or `docker-compose.*.yml`, `compose.yml`, etc.) inside any sub-directory or service folder. If a new service needs infrastructure (database, cache, broker, …), add it to the root `docker-compose.yml` under the relevant section comment.

## Typing & function size

- TypeScript: derive every type (including props) from a zod schema via `z.infer` — no hand-written or inline types.
- Python: use pydantic models or dataclasses — no `TypedDict`, `NamedTuple`, or `dict[str, Any]` records.
- Never use `any` / `Any`.
- Keep functions small (~40 lines, components ~60).

Full rules: `docs/agents/code-style.md`.
