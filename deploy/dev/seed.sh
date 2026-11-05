#!/bin/sh
# Rebuilds the dev database from scratch: all demo seeds plus the shared
# admin and editor accounts. Called by deploy.sh after the dev volumes were
# removed; expects IMAGE_TAG and runs from /srv/common-verse/dev.
set -eu

set -a; . ./.env; set +a
image=ghcr.io/veridynn/common-verse-cms:$IMAGE_TAG

# Sharing the database container's network makes it reachable as localhost,
# which the bulk, programme and shop seeds require.
docker run --rm \
  --network container:dev-postgres-1 \
  -v dev_media:/app/apps/cms/media \
  -v "$PWD/seed-accounts.ts:/app/apps/cms/scripts/dev-accounts.ts:ro" \
  -e NODE_ENV=development \
  -e DATABASE_URL="postgresql://poetry:$POSTGRES_PASSWORD@localhost:5432/poetry" \
  -e PAYLOAD_SECRET -e PREVIEW_SECRET -e ORDER_LOOKUP_SECRET \
  -e PAYLOAD_PUBLIC_SERVER_URL=https://cms-common-verse.weimer.pro \
  -e PUBLIC_SITE_URL=https://common-verse.weimer.pro \
  -e DEV_ADMIN_EMAIL -e DEV_ADMIN_PASSWORD \
  -e DEV_EDITOR_EMAIL -e DEV_EDITOR_PASSWORD \
  "$image" sh -ec '
    tsx() { node_modules/.bin/tsx "$@"; }
    tsx scripts/seed/seed-cli.ts
    tsx scripts/seed/seed-cli.ts --bulk --photos
    tsx scripts/seed/seed-programme.ts
    tsx scripts/seed/seed-shop.ts
    node --import tsx scripts/seed/seed-fixed-pages-cli.ts
    tsx scripts/seed/seed-homepage.ts
    tsx scripts/dev-accounts.ts
  '
