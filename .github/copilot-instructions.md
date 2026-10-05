# Deedlit Monorepo — Copilot Instructions

## Workspace Map
- `deedlit.dev.comfyhelper/` is the Next.js app for managing ComfyUI image libraries, metadata, notes, and scan workflows.
- `deedlit.dev.ui/` is the shared React UI package, consumed in-tree by comfyhelper and published to GitHub Packages as `@carneirofc/ui` for `carneirofc/deedlit.dev.portal` (a separate repo, the public landing/gallery/books site) to consume.

## Monorepo Rules
- Start in the package that owns the behavior. Do not edit multiple packages unless the change genuinely crosses package boundaries.
- Put reusable, app-agnostic UI primitives in `deedlit.dev.ui`; keep app-specific components inside the app that owns the domain logic.
- Before assuming a component should be copied into an app, check whether `@carneirofc/ui` already has a suitable primitive.
- Root scripts orchestrate the workspace, but package-local scripts remain the source of truth for package-specific build, dev, and test commands.
- When changing `deedlit.dev.comfyhelper`, account for the shared UI build step: it depends on `deedlit.dev.ui` being built before development or production builds. A `deedlit.dev.ui` change also needs a release (`.github/workflows/publish-ui.yml`) before `deedlit.dev.portal` can pick it up.

## Package Selection Heuristics
- Choose `deedlit.dev.comfyhelper/` for filesystem scans, image metadata processing, SQLite/Prisma state, SSE flows, admin configuration, stats, notes, or ComfyUI-specific behavior.
- Choose `deedlit.dev.ui/` for shared buttons, inputs, dialogs, panels, badges, icons, layout primitives, design tokens, and component styling conventions reused across both this monorepo's comfyhelper app and the portal repo.

## Shared Engineering Expectations
- Keep changes minimal and package-scoped.
- Preserve strict TypeScript behavior and existing naming conventions.
- Prefer existing docs and current package structure over stale assumptions.
- Document specialized workflow rules in package-local `.github/instructions/*.instructions.md` files instead of duplicating them at the monorepo root.
- If a task touches shared UI and an app, update the UI package first, then adjust the consuming app.

## Common Commands
- Root workspace build: `pnpm build`
- Root shared UI build: `pnpm build:ui`
- Comfyhelper dev: `pnpm dev:comfyhelper`

## Where To Look Next
- Read the package-local `copilot-instructions.md` before making package-specific changes.
- Read scoped `.instructions.md` files when working in tests, shared UI component authoring, or comfyhelper backend/runtime code.
