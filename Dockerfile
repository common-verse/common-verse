# Images for the website (target "web") and the CMS (target "cms").
# Each build installs only its own app and the workspace packages it depends on.

FROM node:26.10.0-bookworm-slim AS base
RUN npm install -g pnpm@12.3.4
WORKDIR /app

FROM base AS web-build
COPY . .
RUN --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@poetry/web..."
# Astro inlines these at build time.
ARG PUBLIC_SITE_URL
ARG PUBLIC_CMS_URL
ARG TRUST_PROXY=true
ARG PUBLIC_COMMIT_SHA
RUN pnpm --filter @poetry/web build

# Astro bundles every package into dist (vite.ssr.noExternal), so no node_modules.
FROM node:26.10.0-bookworm-slim AS web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
WORKDIR /app
COPY --from=web-build /app/apps/web/dist dist
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]

FROM base AS cms-build
COPY . .
RUN --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@poetry/cms..."
RUN pnpm --filter @poetry/cms generate:types \
  && pnpm --filter @poetry/cms build \
  && rm -rf apps/cms/.next/cache

# Keeps development dependencies: the CMS needs tsx and its sources at startup
# to push the prototype schema and seed demo content (see docs/deployment.md).
FROM base AS cms
ENV NODE_ENV=production
COPY --from=cms-build --chown=node:node /app /app
WORKDIR /app/apps/cms
RUN mkdir -p media && chown node:node media
USER node
EXPOSE 3001
# Prototype without production migrations: a development-mode Payload start pushes
# the schema and seeds demo content into an empty database, then the app starts.
CMD ["sh", "-c", "NODE_ENV=development node_modules/.bin/tsx scripts/seed/seed-cli.ts --if-empty && exec node_modules/.bin/next start --port 3001"]
