#!/bin/sh
# Forced command of the CI deploy key (see docs/deployment.md): the SSH command is
# the commit SHA to deploy, optionally preceded by "reset" to reseed the demo data;
# stdin is a short-lived GitHub token for ghcr.io.
set -eu

command=${SSH_ORIGINAL_COMMAND:-}
reset=
[ "${command%% *}" = reset ] && reset=1
sha=$(printf %s "${command##* }" | tr -cd '0-9a-f')
[ ${#sha} -eq 40 ] || { echo "expected a 40-character commit SHA" >&2; exit 2; }
read -r token

# The server's network drops out for a few minutes at a time; outside calls are
# retried for about five minutes before the deploy fails.
retry() {
  attempt=1
  until "$@"; do
    [ "$attempt" -ge 6 ] && return 1
    echo "attempt $attempt failed, retrying: $*" >&2
    sleep $((attempt * 20))
    attempt=$((attempt + 1))
  done
}
login() { printf %s "$token" | docker login ghcr.io -u ci --password-stdin >/dev/null; }

root=/srv/common-verse
base=https://raw.githubusercontent.com/common-verse/common-verse/$sha/deploy
# This script itself is not updated here: sh reads it while running. Changes to it
# are installed by hand (docs/deployment.md).
for file in proxy/compose.yml proxy/Caddyfile dev/compose.yml dev/seed.sh dev/seed-accounts.ts; do
  retry curl -fsSL "$base/$file" -o "$root/$file.new"
  # Rewrite in place: Caddy bind-mounts the Caddyfile by inode.
  cat "$root/$file.new" > "$root/$file" && rm "$root/$file.new"
done

retry login
trap 'docker logout ghcr.io >/dev/null' EXIT

cd "$root/proxy"
retry docker compose pull -q
docker compose up -d
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile

cd "$root/dev"
export IMAGE_TAG="$sha"
retry docker compose pull -q
# Deploys keep dev's data; a reset (or a server without data yet) reseeds it.
docker volume inspect dev_postgres >/dev/null 2>&1 || reset=1
if [ -n "$reset" ]; then
  docker compose down -v --remove-orphans
  docker compose up -d --wait postgres
  retry sh seed.sh
fi
docker compose up -d --remove-orphans
# Removes every image no container uses, including earlier deploys.
docker image prune -af >/dev/null
