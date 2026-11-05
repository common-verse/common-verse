# Images for the website (target "web") and the CMS (target "cms").
# Both keep the full pnpm workspace: the CMS needs tsx and its sources at startup
# to push the prototype schema and seed demo content (see docs/deployment.md).

FROM node:26.10.0-bookworm-slim AS base
RUN npm install -g pnpm@12.3.4
WORKDIR /app

FROM base AS workspace
COPY . .
RUN pnpm install --frozen-lockfile

FROM workspace AS web-build
# Astro inlines these at build time.
ARG PUBLIC_SITE_URL
ARG PUBLIC_CMS_URL
ARG TRUST_PROXY=true
RUN pnpm --filter @poetry/web build

FROM base AS web
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY --from=web-build /app /app
WORKDIR /app/apps/web
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]

FROM workspace AS cms-build
RUN pnpm --filter @poetry/cms generate:types && pnpm --filter @poetry/cms build

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
