# Deployment

One LUMASERV cloud server (`lx51`: 8 vCPU, 32 GiB RAM, 160 GiB, Ubuntu 24.04 LTS)
runs every environment. There is no production yet; staging is deployed from `dev`.

| Environment | Site                              | CMS                                   | Deployed by               |
| ----------- | --------------------------------- | ------------------------------------- | ------------------------- |
| Staging     | `https://common-verse.weimer.pro` | `https://cms.common-verse.weimer.pro` | push to `dev` (GitHub CI) |

DNS for `common-verse.weimer.pro` and `*.common-verse.weimer.pro` points to the
server without the Cloudflare proxy; Caddy obtains the TLS certificates.

## Server

- Login: `ssh deploy@45.95.53.107` with a registered key. Root and password
  logins are disabled; `deploy` has sudo and Docker access.
- Firewall (ufw) allows 22, 80 and 443 only. fail2ban bans IPs after repeated
  failed SSH connections for 10 minutes; automatic security updates are enabled.
- `/srv/common-verse/proxy`: shared Caddy proxy (`deploy/proxy`). Its `.env`
  holds the staging basic-auth user and password hash.
- `/srv/common-verse/staging`: staging stack (`deploy/staging`). Its `.env`
  holds the database password and app secrets, generated once on the server.
  Stripe keys are empty, so shop payments fail on staging.

Every deploy replaces the compose files and the Caddyfile; the `.env` files
are never in Git or CI and must be kept when changing the server.

## Images

The root `Dockerfile` builds `web` and `cms` targets. Each build installs only its
app and the workspace packages it uses; the pnpm store stays in a build cache.
Astro bundles every package into `dist` (`vite.ssr.noExternal`), so the web image
holds only Node and `dist` (about 85 MB). The CMS image (about 2 GB) keeps
development dependencies and sources for the startup
seed below, so Next's standalone output is not used until the CMS has production
migrations. Astro inlines `PUBLIC_SITE_URL`, `PUBLIC_CMS_URL` and `TRUST_PROXY` at build time,
so each environment needs its own web image. CI pushes
`ghcr.io/veridynn/common-verse-{web,cms}` tagged `staging` and with the commit SHA.

The project has no production migrations yet ([migrations](migrations.md)). On
start, the CMS container runs the seed CLI in development mode: Payload pushes the
schema and seeds demo content into an empty database.

## Staging data

Staging starts fresh on every deploy: `deploy.sh` removes the staging database
and media volumes, then `deploy/staging/seed.sh` runs every demo seed from
[demo data](demo-data.md) (poems, bulk workshops with photos, programme, shop,
fixed pages, homepage) and creates one admin and one editor account. Anything
created on staging is lost with the next deploy; the site is down for about two
minutes while it reseeds.

The seed runs in a one-off CMS container that shares the database container's
network, so the database is `localhost` there, as the bulk, programme and shop
seeds require. The accounts come from `STAGING_ADMIN_*` and `STAGING_EDITOR_*`
in the staging `.env`; `deploy/staging/seed-accounts.ts` is staging-only, the
regular seeds never create credentials. When production exists, staging should
load a sanitized copy of production data instead of the demo seeds.

## Staging access

The site is behind basic auth and sends `X-Robots-Tag: noindex`. The basic-auth
and CMS account credentials are not in Git.

## CI setup

`.github/workflows/staging.yml` needs, in the GitHub environment `staging`:

- secret `STAGING_SSH_KEY`: a private key used only by CI
- variable `STAGING_KNOWN_HOSTS`: the server's ED25519 host key line
- variable `STAGING_HOST`: `45.95.53.107`

The environment only accepts deployments from `dev`. On the server the public key
is limited to one command:
`restrict,command="/srv/common-verse/deploy.sh" ssh-ed25519 …` in
`/home/deploy/.ssh/authorized_keys`. `deploy/deploy.sh` receives the commit SHA,
downloads that commit's compose files and Caddyfile, and starts the images
tagged with the SHA. It does not update itself; after changing it, copy it to
`/srv/common-verse/deploy.sh`. Removing the key's line revokes CI access.

Deploys run one at a time. Rolling back: run the workflow on an older commit.

## Backups

Not set up yet. Back up the `staging_postgres` and `staging_media` volumes
together before risky changes.
