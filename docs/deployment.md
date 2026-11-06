# Deployment

One LUMASERV cloud server (`lpx31`: 4 vCPU, 8 GiB RAM, 160 GiB, Ubuntu 24.04 LTS)
runs the dev environment. Staging (with a sanitized copy of production data) follows
later; production gets its own server (#72).

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
- IPv4 only: the IPv6 interface (`eth1`) is removed from `/etc/netplan/50-cloud-init.yaml`
  because its first setup dropped all traffic every few minutes, and cloud-init no longer
  rewrites the network configuration. Cloudflare still serves visitors over IPv6.
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
migrations. Astro inlines `PUBLIC_SITE_URL`, `PUBLIC_CMS_URL`, `TRUST_PROXY` and
`PUBLIC_COMMIT_SHA` at build time, so each environment needs its own web image.
With a commit set, the footer links it, and open pages poll `/api/version` every
minute while visible and offer a reload once a newer version runs. CI pushes
`ghcr.io/veridynn/common-verse-{web,cms}` tagged `dev` and with the commit SHA.

The project has no production migrations yet ([migrations](migrations.md)). On
start, the CMS container runs the seed CLI in development mode: Payload pushes the
schema and seeds demo content into an empty database.

## Dev data

Deploys keep dev's database and media and only replace the containers. While
they restart (the CMS takes about 15 seconds), Caddy holds requests for up to 30
seconds instead of failing; longer outages show a notice that reloads itself.
Payload pushes schema changes into the existing database on start; if a change
cannot be applied to the data, reset dev.

To reset, run the "Deploy dev" workflow on `dev` with "Reset dev data" checked.
It skips the image build, removes the dev database and media volumes, then
`deploy/dev/seed.sh` runs every demo seed from [demo data](demo-data.md) (poems,
bulk workshops with photos, programme, shop, fixed pages, homepage) and creates
one admin and one editor account. Dev shows the notice for about two minutes.
A server without a dev database is seeded the same way on its first deploy.

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
and `@weimer.pro` address. Login is a one-time code by email or GitHub (OAuth app `common-verse Access`,
which only confirms the address); it lasts one month
(Cloudflare's maximum) and covers both hostnames. To admit someone else, add their
address to the policy under Access controls, Policies. Both
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
