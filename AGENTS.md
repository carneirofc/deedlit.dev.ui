# deedlit.dev.ui Agent Guide

Root guide for `carneirofc/deedlit.dev.ui`: the shared `@carneirofc/ui` component library and the CI that builds, publishes and documents it. Each nested `AGENTS.md` is the local contract for its subtree. See [Maintaining These Guides](#maintaining-these-guides) before editing any `AGENTS.md`.

## Start Here
- The repo root is a thin pnpm workspace around one package, `deedlit.dev.ui/`.
- Toolchain: Node via **fnm**, see [`docs/agents/toolchain.md`](docs/agents/toolchain.md).

## Package Ownership
- `deedlit.dev.ui/`: shared UI components, icons, tokens, CSS variables and app-agnostic presentation primitives, published to GitHub Packages as `@carneirofc/ui`.
- Consumers live in other repos and install released versions:
  - `carneirofc/deedlit.dev.comfyhelper`: the image-library app, the FastAPI services and the docker-compose stack.
  - `carneirofc/deedlit.dev.portal`: the public site.
- Do not add app code, services or infrastructure here.

## Working Rules
- Do not move app-specific domain behavior into `@carneirofc/ui`.
- The `src/index.ts` export surface is a public contract. Follow semver; breaking changes need a major release.
- A change reaches consumers only after a GitHub Release (`vX.Y.Z`) runs `.github/workflows/publish-ui.yml`, followed by a version bump in the consuming repo.

## Code Quality Rules
- Every type (data, config, props) is `z.infer<typeof XSchema>` from a zod schema. Never hand-write an `interface`, a `type {…}` or an inline object type.
- Never use `any`; use `unknown` plus a zod parse, or a union.
- Keep functions small (~40 lines, components ~60) with one responsibility.
- Details and lint enforcement: [`docs/agents/code-style.md`](docs/agents/code-style.md).

## Command Reference
- Build: `pnpm build` (tsc + ESM import fix → `deedlit.dev.ui/dist`).
- Lint: `pnpm lint` runs **Biome** with the single config in `biome.jsonc`. `pnpm lint:fix` applies safe fixes. Biome suppressions use `// biome-ignore <rule>: <reason>`, and the reason is required.
- Format: `pnpm format` reports and `pnpm format:write` rewrites. Apply the formatter only in its own commit.
- Storybook: `pnpm storybook` serves on :6006. `pnpm build-storybook` builds the static site, which `.github/workflows/storybook-pages.yml` deploys to <https://carneirofc.github.io/deedlit.dev.ui/>.

## Commit Convention

All commits must follow **[Conventional Commits](https://www.conventionalcommits.org/)**: `<type>(optional scope): <description>`.

## Agent Skills
- **Issue tracker**: issues are GitHub issues on `carneirofc/deedlit.dev.ui`, managed with the `gh` CLI. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).
- **Triage labels**: [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

## Maintaining These Guides

`AGENTS.md` files are the working contract for their subtree. Any file, folder, or workflow should stay understandable from the nearest `AGENTS.md` plus every parent above it. Follow these rules across any edit.

### Read before editing
1. Read this root guide.
2. Identify every file or folder you expect to touch, and walk from the repo root to each one.
3. Read every `AGENTS.md` along the way; when a guide lists a nested child whose scope contains your path, read that child and continue from there.
4. Use the nearest `AGENTS.md` as the local contract and parent guides for repo-wide rules. If they conflict, the closer guide wins for local details.

Re-read the relevant guides in the current session — don't rely on memory.

### Update after editing
Update the closest owning `AGENTS.md` when a change affects:
- purpose, scope, ownership, or responsibilities;
- durable structure, contracts, workflows, or operating rules;
- required inputs, outputs, permissions, constraints, side effects, or artifacts;
- user preferences about behavior, process, organization, or quality;
- creation, deletion, move, rename, or index contents of any `AGENTS.md`.

Update parent guides when parent-level structure, ownership, workflow, or the child index changes; update child guides when a parent change alters local rules. Remove stale or contradictory text immediately.

### Hierarchy & shape
- The root guide holds project-wide rules, global preferences, and the top-level child index. Nested guides own domain-specific rules and their own child index. Each parent explains what its direct children cover and what stays owned by the parent.
- The closer a guide is to the work, the more specific and practical it must be.
- Add a nested `AGENTS.md` when a folder becomes a durable boundary with its own purpose, rules, workflow, or quality standards. Suggested section order: Purpose, Ownership, Local Contracts, Work Guidance, Verification, Child Guides. Leave Work Guidance or Verification empty until real standards or checks exist.

### Style
- Keep guides concise, current, and operational — document stable contracts, not history.
- Put broad rules in parent guides, concrete details in child guides; don't duplicate a rule across scopes unless each needs a local version.
- Prefer direct bullets with explicit names. Delete stale notes instead of explaining them.

### Closeout
1. Re-check changed paths against the guides above them.
2. Update the nearest owning guide and any affected parents or children, and refresh every affected child index.
3. Remove stale or contradictory text, run existing verification when relevant, and report any guide left unchanged and why.

## User Preferences

When the user requests a durable behavior change, record it here or in the relevant child AGENTS.md.

## Child Guides

- [`deedlit.dev.ui/AGENTS.md`](deedlit.dev.ui/AGENTS.md): the `@carneirofc/ui` component library and its tokens.
- [`docs/agents/toolchain.md`](docs/agents/toolchain.md): fnm toolchain locations.
- [`docs/agents/code-style.md`](docs/agents/code-style.md): zod typing, no `any`, small functions, lint enforcement.
- [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md): GitHub issue workflow via `gh`.
- [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md): canonical triage vocabulary.
