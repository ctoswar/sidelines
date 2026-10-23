#!/usr/bin/env sh
# Run drizzle-kit migrations inside a disposable Node 22 container.
#
# Escape hatch for machines whose host Node toolchain is broken or missing
# (see issue #89): requires only Docker — no local Node, no node_modules.
# Versions come straight from package-lock.json, so this always runs the
# same drizzle-kit as `npm run db:migrate`.
#
# Usage: npm run db:migrate:docker
#   NODE_IMAGE=node:20 npm run db:migrate:docker   # override the image

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
node_image="${NODE_IMAGE:-node:22-bookworm-slim}"

env_flag=""
if [ -f "$repo_root/.env" ]; then
  env_flag="--env-file $repo_root/.env"
fi

# shellcheck disable=SC2086 # $env_flag is intentionally word-split
exec docker run --rm $env_flag \
  -v "$repo_root":/src:ro \
  -w /work \
  "$node_image" \
  sh -c '
    set -eu
    cp /src/package.json /src/package-lock.json /src/drizzle.config.ts .
    cp -r /src/drizzle .
    npm ci --no-audit --no-fund --loglevel=error
    node node_modules/drizzle-kit/bin.cjs migrate
  '
