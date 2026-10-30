# UI Library

This package contains app-agnostic UI building blocks and the shared visual system.

Usage:
- Import components from `@carneirofc/ui`.
- Import the design system stylesheet from `@carneirofc/ui/styles.css` once in your app shell,
  after `@import "tailwindcss";` and without a `layer()`:

  ```css
  @import "tailwindcss";
  @import "@carneirofc/ui/styles.css";
  ```

  The form-control defaults (`button, input, select, textarea`: `font: inherit` and the
  shared transition) live in `@layer base`, so any Tailwind utility on those elements
  (`text-xs`, `font-*`, `transition-*`, `duration-*`) wins without `!`.
- Motion respects `prefers-reduced-motion`: hover lifts, press scales and spinners are
  `motion-safe:`-gated, and the base transition drops `transform`/`translate`/`scale`
  under `reduce`.

Conventions:
- Prefer `testId` for test selectors (mapped to `data-testid`).
- Use `className` for styling overrides and keep components presentation-focused.
- Prefer shared primitives (`SurfacePanel`, `TextInput`, `SelectInput`, `TextAreaInput`, `StatusBadge`) before writing one-off class bundles.
- Keep primitives token-driven (CSS variables) so theme behavior stays centralized in `styles/styles.css`.

## Storybook

This package documents its components with [Storybook](https://storybook.js.org/)
(React + Vite builder, Tailwind v4). The published build lives at
**<https://carneirofc.github.io/deedlit.dev/ui/storybook/>** (deployed to GitHub
Pages by [`storybook-pages.yml`](../.github/workflows/storybook-pages.yml),
alongside the monorepo landing page at the
[site root](https://carneirofc.github.io/deedlit.dev/)).

```bash
# from the repo root
pnpm --filter @carneirofc/ui storybook        # dev server on http://localhost:6006
pnpm --filter @carneirofc/ui build-storybook  # static build into storybook-static/
```

- Stories live next to their component as `src/<Component>.stories.tsx` (CSF).
- The **Theme** toolbar toggles `data-theme` (light/dark) so you can preview both
  token sets; the canvas styling is wired up in `.storybook/preview.tsx` and
  `.storybook/preview.css` (which re-imports `styles/styles.css`).
- The a11y addon reports accessibility issues in the **Accessibility** panel.
- See the **Introduction** page in Storybook for the story-authoring template.

