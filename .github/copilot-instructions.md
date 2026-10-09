# deedlit.dev.ui — Copilot Instructions

## Repo Map
- `deedlit.dev.ui/` is the shared React UI package `@carneirofc/ui`, published to GitHub Packages. It is the only package in this repo.
- Consumers live in separate repos: `carneirofc/deedlit.dev.comfyhelper` (image-library app) and `carneirofc/deedlit.dev.portal` (public site). They install released versions, never source.

## Rules
- Only app-agnostic presentation primitives, icons, tokens and styles belong here. No domain state, API calls or routing.
- Treat the `src/index.ts` export surface as a public contract and version it with semver; breaking changes need a major release.
- Read `deedlit.dev.ui/.github/copilot-instructions.md` and `deedlit.dev.ui/.github/instructions/*.instructions.md` before authoring components.

## Common Commands
- Build: `pnpm build`
- Lint: `pnpm lint`
- Storybook: `pnpm storybook` / `pnpm build-storybook`
- Release: publish a GitHub Release tagged `vX.Y.Z` → `.github/workflows/publish-ui.yml` publishes that version.
