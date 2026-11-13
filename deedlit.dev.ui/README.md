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
  under `reduce`. The user can override this with the effects settings below.

## Interaction effects

Hover lift, press scale, the pointer-follow glow and the pointer cursor are styled
once in `styles/styles.css` and composed by the components:

| Class / token | What it does |
| --- | --- |
| `.ui-interactive` | Shared transition list and timing; drops movement under reduced motion |
| `.ui-lift` | Hover lift (`--ui-fx-lift`) + `--shadow-lift`, press scale (`--ui-fx-press`) |
| `.ui-press` | Press scale only (tabs, segments, chips, list rows) |
| `.ui-spotlight` | Pointer-follow glow; pair with `useSpotlight()` or the `spotlight` prop on `SurfacePanel` / `CyberPanel` / `CyberSubpanel` |
| `--ui-cursor-interactive` | Cursor for activatable elements (base layer: buttons, `role=button/option/menuitem*`, `summary`, `label[for]`, checkbox/radio labels, `select`); disabled controls get `not-allowed` |
| `fx-hover:` | Tailwind variant for decorative hover (hover-capable pointers, off with `data-ui-hover="off"`) |
| `motion-safe:` / `motion-reduce:` | Redefined to honour `data-ui-motion` before `prefers-reduced-motion` |

These live in `@layer components`, so any utility you pass in `className` still wins.
`INTERACTION_PATTERNS` (exported) has the matching class strings plus focus-ring recipes.

### Effects settings

`EffectsSettingsProvider` stores the user's choices and writes them on `<html>` as data
attributes, which the stylesheet reads. No component takes a prop for this.

| Setting | Values (default first) | Attribute |
| --- | --- | --- |
| `hoverEffects` | `true` / `false` | `data-ui-hover="on\|off"` |
| `cursorStyle` | `"pointer"` / `"system"` | `data-ui-cursor` |
| `reducedMotion` | `"system"` / `"reduce"` / `"full"` | `data-ui-motion` |
| `intensity` | `"normal"` / `"subtle"` / `"strong"` | `data-ui-intensity` |

- **CSS works without JS.** No attribute means the default, so server-rendered HTML and
  apps without the provider look the same as the defaults. You can also set the attributes
  by hand, or on a subtree: `data-ui-intensity` scales the `--ui-fx-*` tokens for
  everything inside it.
- **Persistence:** `localStorage` key `carneirofc-ui:effects:v1` (JSON). Missing, corrupt or
  unknown values fall back to the defaults field by field. Changes in other tabs are picked
  up through the `storage` event.
- **SSR:** the provider never reads `window` during render. The server and the first client
  render use the defaults, and stored values apply after mount. A user with non-default
  settings briefly sees the defaults on first paint.

Place the provider once, in the root layout of a Next.js app (it is a client component):

```tsx
// app/layout.tsx
import { EffectsSettingsProvider } from "@carneirofc/ui";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The data-ui-* attributes are added to <html> in an effect, after
    // hydration, so they cause no hydration mismatch.
    <html lang="en">
      <body>
        <EffectsSettingsProvider>{children}</EffectsSettingsProvider>
      </body>
    </html>
  );
}
```

Then render the ready-made controls anywhere below it, or build your own with the hook:

```tsx
import { EffectsSettingsPanel, useEffectsSettings } from "@carneirofc/ui";

<EffectsSettingsPanel />;

const { settings, effectiveMotion, updateSettings, resetSettings } = useEffectsSettings();
updateSettings({ intensity: "subtle" });
```

`defaultSettings` changes the starting values (and what reset returns to); `storageKey`
isolates a sandbox. The pure helpers (`parseEffectsSettings`, `serializeEffectsSettings`,
`resolveEffectiveMotion`, `effectsDataAttributes`, `EFFECTS_SETTINGS_STORAGE_KEY`) are
exported too, for example to render the attributes server-side from a cookie.

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
- The **Hover fx / Cursor / Motion / Intensity** toolbar menus drive an
  `EffectsSettingsProvider` that wraps every story; **Foundations/Interaction** shows
  each interactive component's states at every intensity.
- The a11y addon reports accessibility issues in the **Accessibility** panel.

## Tests

```bash
pnpm --filter @carneirofc/ui test   # node --test on src/**/*.test.ts
```

Unit tests cover the pure modules in `src/lib/`. They use Node's built-in test runner
(Node strips the TypeScript types), so there is no test dependency. Test files import
siblings with a `.ts` extension and are excluded from the build.
- See the **Introduction** page in Storybook for the story-authoring template.

