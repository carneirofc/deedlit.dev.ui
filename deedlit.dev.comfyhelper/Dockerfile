# Multi-stage build for the deedlit.dev.comfyhelper Next.js app.
# Build context MUST be the monorepo root (see docker-compose.yml: context: ..)
# because comfyhelper depends on the workspace package @carneirofc/ui.

# ---- deps + build --------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Native build toolchain for better-sqlite3 / sharp.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# pnpm via corepack, pinned by the root package.json "packageManager" field.
RUN corepack enable

# Install workspace dependencies (root manifest + per-package manifests first
# so this layer caches across source-only changes).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY deedlit.dev.ui/package.json deedlit.dev.ui/package.json
COPY deedlit.dev.comfyhelper/package.json deedlit.dev.comfyhelper/package.json
RUN pnpm install --frozen-lockfile

# Copy the rest and build the shared UI + comfyhelper app.
COPY . .
RUN pnpm build:comfyhelper

# ---- runtime -------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable

# Copy the built monorepo. (Not using Next standalone output because the app
# uses a custom production start script that also runs Prisma migrate deploy.)
COPY --from=build /app /app

EXPOSE 3000
WORKDIR /app/deedlit.dev.comfyhelper
CMD ["pnpm", "start", "-H", "0.0.0.0"]
