#!/bin/sh
# Forced command of the CI deploy key (see docs/deployment.md): the SSH command is
# the commit SHA to deploy, stdin is a short-lived GitHub token for ghcr.io.
set -eu

sha=$(printf %s "${SSH_ORIGINAL_COMMAND:-}" | tr -cd '0-9a-f')
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
base=https://raw.githubusercontent.com/veridynn/common-verse/$sha/deploy
# This script itself is not updated here: sh reads it while running. Changes to it
# are installed by hand (docs/deployment.md).
for file in proxy/compose.yml proxy/Caddyfile staging/compose.yml; do
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

cd "$root/staging"
export IMAGE_TAG="$sha"
retry docker compose pull -q
docker compose up -d --remove-orphans
# Removes every image no container uses, including earlier deploys.
docker image prune -af >/dev/null
