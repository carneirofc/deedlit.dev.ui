# deedlit.dev — Public Site + Service Portal

## Purpose
- Public-facing Next.js site (port 3001): home, books shelf (Goodreads metadata), image gallery, and PWA-facing work.
- Plus `/portal`: an authenticated, logged-in-only dashboard listing the cluster's services and their health. Deployed to Kubernetes from `deedlit.dev.infra/apps/portal`.

## Ownership
- Owns landing/content routes, the service portal, the Goodreads scrape pipeline, and PWA assets.
- Must NOT own generic reusable UI primitives — those belong in `deedlit.dev.ui`.

## Local Contracts
- App Router, Server Components by default: `src/app/` (`books`, `gallery`, `image`, `login`, `portal`, `api`, `layout.tsx`, `manifest.ts`, `robots.ts`, `sitemap.ts`); feature folders under `src/features/{books,gallery,home,services,showcase}/`; `src/components/{layout,pwa}/`; `src/lib/`.
- `scripts/scrape-goodreads.ts` populates `src/features/books/data/books-metadata.json` from `books-config.ts` (`npm run scrape-goodreads`).
- Consumes `@carneirofc/ui` via `file:../deedlit.dev.ui`; `build` rebuilds the UI first. No backend/gateway dependency.
- Conventions: `.github/copilot-instructions.md` (App Router, feature folders, reuse `@carneirofc/ui`). Note: the `test:e2e` script exists but no Playwright config or `e2e/` specs are currently committed — treat old `e2e/` references (and `.cursorrules`) as historical.
- Linting is **Biome**, configured once in `biome.jsonc` at the repo root (ESLint is gone — `next lint` had been removed by Next 16 anyway). `npm run lint` here is `biome lint .`; `npm run lint:fix` applies safe fixes. This package is clean and CI gates on it, so keep it that way.

## Authentication
- Auth.js v5 (`next-auth@beta`) in `src/auth.ts`; JWT sessions, no database.
- GitHub is the only provider, and sign-in is **authorization** as well: `callbacks.signIn` admits only active members of `AUTH_ALLOWED_GITHUB_ORG` (optionally narrowed by `AUTH_ALLOWED_GITHUB_TEAM`), plus anyone in `AUTH_ALLOWED_GITHUB_USERS`. It fails closed — a missing or broken config locks everyone out rather than letting everyone in.
- Two layers guard `/portal`: `src/proxy.ts` redirects anonymous requests (UX), and `src/app/portal/layout.tsx` re-checks the session server-side. **The layout check is the security boundary**; route handlers under `/api/portal/*` check `auth()` themselves.
- Env: `AUTH_SECRET` (≥32 chars — `signIn` refuses to authorize below that, since a guessable secret makes session JWEs forgeable), `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_TRUST_HOST=true` (required behind Traefik), **`AUTH_URL`** (see below), `AUTH_ALLOWED_GITHUB_ORG`, optional `AUTH_ALLOWED_GITHUB_TEAM` / `AUTH_ALLOWED_GITHUB_USERS`. OAuth callback: `<origin>/api/auth/callback/github`.
- `AUTH_URL` is not optional in a deployment. `trustHost` makes Auth.js derive its origin from the `Host`/`X-Forwarded-Host` header, which a client controls; `AUTH_URL` pins it to configuration instead. Its scheme also decides `useSecureCookies`, so an `https://` value is what puts the `__Secure-` prefix and the `Secure` attribute on the session cookie. The chart sets it from the Ingress host — keep the two in step.

## Security
- `src/proxy.ts` owns the security headers and generates a per-request CSP nonce, consumed by the inline theme script in `src/app/layout.tsx`. Adding another inline script means giving it that nonce — do not relax the policy to `unsafe-inline`.
- The portal's health prober takes its target from Kubernetes annotations, so `server/discover.ts` validates every component and `server/health.ts` re-checks the final URL before dialling. Keep that; see `src/features/services/README.md`.
- `/portal` and `/login` are excluded from `robots.ts` and marked `noindex`.
- `callbackUrl` reaches `/login` from the query string, so it is attacker-controlled. `safeCallbackUrl()` admits only site-relative paths and rejects `//host` and `/\host`, which browsers read as protocol-relative. Do not pass a raw `callbackUrl` to `redirect()`.
- Keep `next` on a patched release. 16.1.6 carried CVE-2026-64642 (authentication bypass) and CVE-2026-44575 (middleware bypass) — both directly defeat this app's `/portal` boundary. The range is `^16.3.0`: 16.2.x pins `sharp: ^0.34.5`, whose bundled libvips carries open CVEs, and only 16.3.0 moved to `^0.35.3`. Keep both web workspaces on the same range so npm hoists one copy. `npm audit --omit=dev --audit-level=high --workspace deedlit.dev` gates it in CI.

## Deployment
- `Dockerfile` builds from the **monorepo root** context (`docker build -f deedlit.dev/Dockerfile .`) because the app depends on the sibling `deedlit.dev.ui` workspace. Standalone output runs as `node deedlit.dev/server.js`.
- The root context is *not* an invitation to ship the rest of the monorepo. `npm ci` is scoped with `--workspace deedlit.dev --workspace @carneirofc/ui`, so comfyhelper's tree (Prisma, the AWS SDK, `@qdrant/js-client-rest` → a vulnerable `undici`) never enters the build. comfyhelper's `package.json` is still copied because `npm ci` validates the lockfile against every workspace it declares.
- Runtime is **distroless** (`gcr.io/distroless/nodejs24-debian12`) and both bases are **pinned by digest**. The Debian-slim runtime used to carry npm and yarn, which were the source of every CRITICAL/HIGH image finding that was not the app itself; distroless also removes the shell, so there is no interactive foothold in a compromised pod. `USER 1001:1001` is numeric to match `podSecurityContext.runAsUser` and satisfy `runAsNonRoot`. Refresh a digest by re-pulling the tag and reading `RepoDigests` — the Dockerfile header has the command.
- The build also deletes `node_modules/typescript` from the standalone output: Next's tracer pulls the compiler in via a dev-only code path in `next-server`, and it is 19 MB a production server never loads.
- `.github/workflows/portal.yml` typechecks, audits, hadolints, **builds and Trivy-scans the image before any push**, then publishes to `ghcr.io/carneirofc/deedlit.dev-portal` and prints the digest to pin in `apps/portal/values-prd.yaml`. Scanner exceptions live in `.trivyignore.yaml` at the repo root and every one of them must carry an `expired_at`.
- `package-lock.json` is **multi-platform** and must stay that way: it carries the optional native binaries (`lightningcss`, `@tailwindcss/oxide`, `sharp`, …) for win32, linux-gnu, linux-musl and darwin, so `npm ci` works on a Windows workstation and in a Linux container alike. It was win32-only once, which made `npm ci` on Linux silently skip those binaries and the Tailwind build fail with `Cannot find module '../lightningcss.linux-x64-gnu.node'`. If that returns, re-add the missing platforms rather than special-casing the Dockerfile — `npm install --package-lock-only --include=optional --os=linux --cpu=x64 --libc=glibc` (repeat per platform) on a machine with a fresh lockfile, or patch the entries in directly.
- `/api/health` is the unauthenticated liveness/readiness endpoint.

## Work Guidance
- Keep changes package-local; promote reusable UI to `deedlit.dev.ui` rather than duplicating it here.
- Service listings are data from the cluster, not code here — to add a service, annotate its Ingress in `deedlit.dev.infra`.

## Verification
- `npx tsc --noEmit --project .` · `npm run build` (from repo root: `npm run dev:dev`).
- Container: build from the repo root, then check `/api/health` → 200, `/api/portal/services` → 401 unauthenticated, `/portal` → 307 to `/login`.
- `npm run lint` (Biome) must stay at zero errors for this package. `npm run test:e2e` is defined but has no committed specs yet.

## Child Guides
- [`docs/AGENTS.md`](./docs/AGENTS.md) — Playwright/testing & local-setup guide for this app (port 3001, npm scripts, scraper). Reference material; verify against `package.json` before relying on the e2e steps, since no Playwright specs are currently committed.
