# deedlit.dev.ui — @carneirofc/ui

## Purpose
- Shared, app-agnostic React component library and design-token system published to GitHub Packages as `@carneirofc/ui` and consumed by `carneirofc/deedlit.dev.portal` and `carneirofc/deedlit.dev.comfyhelper`.

## Ownership
- Owns presentation-only primitives, icons, design tokens, and CSS variables.
- Must NOT own domain state, API calls, routing, or any app-specific business logic — those stay in the consuming app.

## Local Contracts
- `package.json` name `@carneirofc/ui`, `"type": "module"`; public surface is `src/index.ts` → built `dist/`, plus the `./styles.css` export. Consumers install the released build, so treat the export surface as a contract and follow semver.
- `src/*.tsx` components each paired with `src/*.stories.tsx`; `src/foundations/*.stories.tsx`; `src/lib/`; `styles/styles.css`; `.storybook/`; `scripts/fix-esm-imports.mjs`.
- Authoring conventions (`.github/copilot-instructions.md`, `.github/instructions/component-authoring.instructions.md`, `README.md`): typed props, `forwardRef`, `className` override, `testId`→`data-testid`, token-driven styling. Prefer reusing existing primitives (`SurfacePanel`, `TextInput`, `SelectInput`, `TextAreaInput`, `StatusBadge`).
- Storybook is published to GitHub Pages at `https://carneirofc.github.io/deedlit.dev.ui/` via [`../.github/workflows/storybook-pages.yml`](../.github/workflows/storybook-pages.yml).

## Work Guidance
- Follow [`docs/agents/code-style.md`](../docs/agents/code-style.md) (zod/pydantic types, no `any`, small functions).
- Promote reusable pieces here; keep app-specific behavior out. A change only reaches consumers after a GitHub Release (`publish-ui.yml`) and a version bump in the consuming repo.

## Verification
- `pnpm --filter @carneirofc/ui build` (type-check via `tsc` + ESM import fix). No unit tests in this package.
- `pnpm --filter @carneirofc/ui lint` (Biome; config is the root `biome.jsonc`). Currently zero errors, and consumers gate on it.
- `pnpm --filter @carneirofc/ui build-storybook` for the static Storybook.

## Child Guides
- None.
