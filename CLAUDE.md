# Project rules for Claude

This repo (`carneirofc/deedlit.dev.ui`) contains only the shared `@carneirofc/ui` component library (`deedlit.dev.ui/`) and its CI. Apps and services live elsewhere: `carneirofc/deedlit.dev.comfyhelper` (image-library app, FastAPI services, docker-compose) and `carneirofc/deedlit.dev.portal` (public site). Do not add app code, services or infrastructure here.

## Typing & function size

- TypeScript: derive every type (including props) from a zod schema via `z.infer` — no hand-written or inline types.
- Never use `any`.
- Keep functions small (~40 lines, components ~60).

Full rules: `docs/agents/code-style.md`.
