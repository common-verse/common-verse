# Deployment

One LUMASERV cloud server (`lx51`: 8 vCPU, 32 GiB RAM, 160 GiB, Ubuntu 24.04 LTS)
runs every environment. Only the dev environment exists so far; staging (with a
sanitized copy of production data) and production follow later.

| Environment | Site                              | CMS                                   | Deployed by               |
| ----------- | --------------------------------- | ------------------------------------- | ------------------------- |
| Dev         | `https://common-verse.weimer.pro` | `https://cms-common-verse.weimer.pro` | push to `dev` (GitHub CI) |

Both hostnames are Cloudflare Tunnel routes (tunnel `common-verse`): requests
reach the server through `cloudflared`, and Cloudflare handles TLS. Hostnames stay
one level below `weimer.pro` (hence `cms-common-verse`) because Cloudflare's free
certificate covers only `*.weimer.pro`.

## Server

- Login: `ssh deploy@45.95.53.107` with a registered key. Root and password
  logins are disabled; `deploy` has sudo and Docker access.
- Firewall (ufw) allows only SSH (22); web traffic arrives through the tunnel. fail2ban bans IPs after repeated
  failed SSH connections for 10 minutes; automatic security updates are enabled.
- `/srv/common-verse/proxy`: `cloudflared` and Caddy (`deploy/proxy`). Its `.env`
  holds `TUNNEL_TOKEN`; Caddy routes by hostname over plain HTTP.
- `/srv/common-verse/dev`: dev stack (`deploy/dev`). Its `.env`
  holds the database password and app secrets, generated once on the server.
  Stripe keys are empty, so shop payments fail on dev.

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
`ghcr.io/veridynn/common-verse-{web,cms}` tagged `dev` and with the commit SHA.

The project has no production migrations yet ([migrations](migrations.md)). On
start, the CMS container runs the seed CLI in development mode: Payload pushes the
schema and seeds demo content into an empty database.

## Dev data

Dev starts fresh on every deploy: `deploy.sh` removes the dev database
and media volumes, then `deploy/dev/seed.sh` runs every demo seed from
[demo data](demo-data.md) (poems, bulk workshops with photos, programme, shop,
fixed pages, homepage) and creates one admin and one editor account. Anything
created on dev is lost with the next deploy; the site is down for about two
minutes while it reseeds.

The seed runs in a one-off CMS container that shares the database container's
network, so the database is `localhost` there, as the bulk, programme and shop
seeds require. The accounts come from `DEV_ADMIN_*` and `DEV_EDITOR_*`
in the dev `.env`; `deploy/dev/seed-accounts.ts` is dev-only, the
regular seeds never create credentials.

## Dev access

Cloudflare Access (Zero Trust team `weimer`, application `common-verse`) protects
the whole site and `cms-common-verse.weimer.pro/admin`. The CMS API and media stay
public, because the website and browsers load them; the CMS admin keeps its own
Payload login. Policy `Common Verse team` allows every `@thepoetryproject.de`
address plus individually added addresses; logins last one month and cover both
hostnames. Login methods: one-time PIN by email, Google and GitHub. To admit
someone, add their address to the policy under Access controls, Policies. Both
hostnames send `X-Robots-Tag: noindex`.

## CI setup

`.github/workflows/dev.yml` needs, in the GitHub environment `dev`:

- secret `DEV_SSH_KEY`: a private key used only by CI
- variable `DEV_KNOWN_HOSTS`: the server's ED25519 host key line
- variable `DEV_HOST`: `45.95.53.107`

The environment only accepts deployments from `dev`. On the server the public key
is limited to one command:
`restrict,command="/srv/common-verse/deploy.sh" ssh-ed25519 …` in
`/home/deploy/.ssh/authorized_keys`. `deploy/deploy.sh` receives the commit SHA,
downloads that commit's compose files and Caddyfile, and starts the images
tagged with the SHA. It does not update itself; after changing it, copy it to
`/srv/common-verse/deploy.sh`. Removing the key's line revokes CI access.

Deploys run one at a time. Rolling back: run the workflow on an older commit.

## Backups

Not set up yet. Back up the `dev_postgres` and `dev_media` volumes
together before risky changes.
