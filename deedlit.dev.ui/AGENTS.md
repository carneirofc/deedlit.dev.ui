# deedlit.dev.ui — @carneirofc/ui

## Purpose
- Shared, app-agnostic React component library and design-token system consumed by both Next.js apps as `@carneirofc/ui`.

## Ownership
- Owns presentation-only primitives, icons, design tokens, and CSS variables.
- Must NOT own domain state, API calls, routing, or any app-specific business logic — those stay in the consuming app.

## Local Contracts
- `package.json` name `@carneirofc/ui`, `"type": "module"`; public surface is `src/index.ts` → built `dist/`, plus the `./styles.css` export. Both apps depend on the built output, so treat the export surface as a contract.
- `src/*.tsx` components each paired with `src/*.stories.tsx`; `src/foundations/*.stories.tsx`; `src/lib/`; `styles/styles.css`; `.storybook/`; `scripts/fix-esm-imports.mjs`.
- Authoring conventions (`.github/copilot-instructions.md`, `.github/instructions/component-authoring.instructions.md`, `README.md`): typed props, `forwardRef`, `className` override, `testId`→`data-testid`, token-driven styling. Prefer reusing existing primitives (`SurfacePanel`, `TextInput`, `SelectInput`, `TextAreaInput`, `StatusBadge`).
- Interaction effects: hover/press/cursor/glow live in `styles/styles.css` (`.ui-interactive`, `.ui-lift`, `.ui-press`, `.ui-spotlight`, the `fx-hover` variant, and redefined `motion-safe`/`motion-reduce`), gated by `data-ui-hover|cursor|motion|intensity` on `<html>`. `EffectsSettingsProvider` writes those attributes and persists to `localStorage` key `carneirofc-ui:effects:v1`; the attribute names and the key are part of the public contract (bump the key's `:vN` for an incompatible shape). Components compose these classes and must not add `cursor-pointer` or their own hover transforms.
- Storybook is published to GitHub Pages at `https://carneirofc.github.io/deedlit.dev/ui/storybook/` via [`../.github/workflows/storybook-pages.yml`](../.github/workflows/storybook-pages.yml).

## Work Guidance
- Promote reusable pieces here; keep app-specific behavior out. When a change touches shared UI and an app, build the UI first, then adjust the consumer.

## Verification
- `pnpm --filter @carneirofc/ui build` (type-check via `tsc` + ESM import fix).
- `pnpm --filter @carneirofc/ui test`: unit tests for the pure modules in `src/lib/` (`*.test.ts`, Node's built-in runner, no test dependency; excluded from the build).
- `pnpm --filter @carneirofc/ui lint` (Biome; config is the root `biome.jsonc`). It had zero errors under the `recommended` preset; it has zero errors under the aggressive config too (warnings remain), and must stay that way, because the portal pipeline gates on it — this package is built into the portal image, so a regression here breaks that release.
- `pnpm --filter @carneirofc/ui build-storybook` for the static Storybook.

## Child Guides
- None.
