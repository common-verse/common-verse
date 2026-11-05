#!/bin/sh
# Forced command of the CI deploy key (see docs/deployment.md): the SSH command is
# the commit SHA to deploy, stdin is a short-lived GitHub token for ghcr.io.
set -eu

sha=$(printf %s "${SSH_ORIGINAL_COMMAND:-}" | tr -cd '0-9a-f')
[ ${#sha} -eq 40 ] || { echo "expected a 40-character commit SHA" >&2; exit 2; }

root=/srv/common-verse
base=https://raw.githubusercontent.com/veridynn/common-verse/$sha/deploy
# This script itself is not updated here: sh reads it while running. Changes to it
# are installed by hand (docs/deployment.md).
for file in proxy/compose.yml proxy/Caddyfile staging/compose.yml; do
  curl -fsSL "$base/$file" -o "$root/$file.new"
  # Rewrite in place: Caddy bind-mounts the Caddyfile by inode.
  cat "$root/$file.new" > "$root/$file" && rm "$root/$file.new"
done

read -r token
printf %s "$token" | docker login ghcr.io -u ci --password-stdin >/dev/null
trap 'docker logout ghcr.io >/dev/null' EXIT

cd "$root/proxy"
docker compose up -d
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile

cd "$root/staging"
export IMAGE_TAG="$sha"
docker compose pull
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
