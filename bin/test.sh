#!/usr/bin/env bash
# Checks render.js draws every sample page as its port wrote it whole.
set -Eeu

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly IMAGE=ghcr.io/puppeteer/puppeteer:23.10.4

if [ "${1:-}" = '-h' ]; then
  cat <<EOF
Usage: bin/test.sh

For every page under samples/, a .html a port wrote whole with its
.data.json beside it, fills page.html with the data, as a port does,
loads both pages in headless Chrome, in Docker, and checks the drawn
page has the same title and <main> as the whole one, once every
script has run. Prints a line per page, and the first difference of
any that differs; exits non-zero if any does.

Options:
  -h    Show this help

Example:
  bin/test.sh
EOF
  exit 0
fi

docker run --rm --platform linux/amd64 --user root \
  --env NODE_PATH=/home/pptruser/node_modules \
  --env PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer \
  --volume "${ROOT}:/reporter:ro" \
  "${IMAGE}" node /reporter/test/compare.js
