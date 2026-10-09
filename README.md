# deedlit.dev.ui

Home of **`@carneirofc/ui`**: the shared React component library, design tokens and
styles for the deedlit.dev apps. The package lives in [`deedlit.dev.ui/`](./deedlit.dev.ui/)
(see its [README](./deedlit.dev.ui/README.md)).

- **Storybook:** <https://carneirofc.github.io/deedlit.dev.ui/>
- **Package:** published to GitHub Packages as `@carneirofc/ui`

## Consumers

These repos install released versions of the package:

| Repo | What |
|---|---|
| [`carneirofc/deedlit.dev.comfyhelper`](https://github.com/carneirofc/deedlit.dev.comfyhelper) | ComfyHelper image-library app, FastAPI services, docker-compose stack |
| [`carneirofc/deedlit.dev.portal`](https://github.com/carneirofc/deedlit.dev.portal) | Public deedlit.dev site |

To install the package, add this to the consumer's `.npmrc`:

```ini
@carneirofc:registry=https://npm.pkg.github.com
```

You also need a token with `read:packages` in user-level config:

```bash
pnpm config set "//npm.pkg.github.com/:_authToken" "$(gh auth token)"
```

## Development

```bash
pnpm install
pnpm build              # tsc + ESM import fix → deedlit.dev.ui/dist
pnpm lint               # Biome (biome.jsonc)
pnpm storybook          # dev server on :6006
pnpm build-storybook    # static build → deedlit.dev.ui/storybook-static
```

## CI

- [`publish-ui.yml`](./.github/workflows/publish-ui.yml) runs when a GitHub Release is published. The release tag (`vX.Y.Z`) sets the npm version that gets published.
- [`storybook-pages.yml`](./.github/workflows/storybook-pages.yml) runs on pushes to `master` that touch `deedlit.dev.ui/`, and deploys Storybook to GitHub Pages. This needs a one-time setting: **Settings → Pages → Source: GitHub Actions**.

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
Agent and code-style rules are in [`AGENTS.md`](./AGENTS.md) and
[`docs/agents/code-style.md`](./docs/agents/code-style.md).
