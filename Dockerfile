# Phase 9: production image for self-hosted deployment on Contabo (Docker
# Compose + Nginx reverse proxy - see docker-compose.prod.yml and
# RUNBOOK.md §Deployment readiness). Multi-stage build keeps the runtime
# image to Next.js's traced "standalone" output only, not the full
# devDependencies tree.

# ---- deps: install once, reused by the builder stage ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the app and generate the Prisma client ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time-only placeholder values, never real secrets (docker build's
# "SecretsUsedInArgOrEnv" lint warning on this block is a false positive
# for that reason). `next build` always runs in production mode, and
# `getServerEnvironment()` validates these for FORMAT (min length, url
# shape, and - since NODE_ENV=production - the MinIO/Resend vars being
# merely present) while collecting page data; nothing at build time
# connects to a real database, MinIO, or Resend. None of this is used once
# the container starts - the real values come from docker-compose's
# `env_file` (see docker-compose.prod.yml).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="postgresql://build-only:unused@localhost:5432/build_only" \
    DIRECT_DATABASE_URL="postgresql://build-only:unused@localhost:5432/build_only" \
    AUTH_SECRET="build-time-placeholder-not-a-real-secret-do-not-use-000000" \
    IP_HASH_SECRET="build-time-placeholder-not-real" \
    MINIO_ENDPOINT="http://build-only:9000" \
    MINIO_ACCESS_KEY="build-only" \
    MINIO_SECRET_KEY="build-only" \
    RESEND_API_KEY="build-only" \
    RESEND_FROM_EMAIL="build-only@example.test"

RUN npx prisma generate
RUN npm run build

# ---- runner: minimal runtime image ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# The `prisma` CLI (needed for `prisma migrate deploy`/`prisma db seed` -
# see RUNBOOK.md §Deployment readiness, run via `docker compose run --rm
# app npx prisma ...`) is a devDependency, never imported by application
# code, so Next's standalone output tracing above never pulls it in
# (`@prisma/client` DOES get traced in - src/lib/db.ts imports it at
# runtime - only the separate CLI package is missing). Without this,
# `npx prisma ...` finds no local binary and falls back to npm
# auto-installing whatever the LATEST prisma release is at that moment
# (an untested, possibly different major version - hit an actual npm
# resolver crash in practice, and even when it succeeds, running
# migrations with a Prisma version that doesn't match the one this
# schema/migration history was authored against is a real correctness
# risk, not just an inconvenience). Overwriting with the full `deps`
# node_modules (superset of what standalone's pruned copy already has,
# same npm-resolved versions) guarantees `prisma` resolves to the exact
# pinned version from package-lock.json, offline, every time.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs
EXPOSE 3000

# Liveness only (no DB check) - see /api/readiness for a DB-aware probe if
# the orchestrator wants to distinguish "process up" from "ready for
# traffic".
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
