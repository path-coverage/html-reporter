#!/usr/bin/env bash
# Checks report.js writes each sample run's pages with the sample's
# data, and render.js draws every sample page as it was written whole.
set -Eeu

readonly ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly IMAGE=ghcr.io/puppeteer/puppeteer:23.10.4

if [ "${1:-}" = '-h' ]; then
  cat <<EOF
Usage: bin/test.sh

In Docker, first, for every sample under samples/ holding a run's
path_coverage.json and path_coverage.source.json, writes its report
with report.js and checks each page's data is the sample's
.data.json. Then, for every page under samples/, a .html written
whole with its .data.json beside it, fills page.html with the data,
loads both pages in headless Chrome, and checks the drawn page has
the same title and <main> as the whole one, once every script has
run. Prints a line per page, and the first difference of any that
differs; exits non-zero if any does.

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
  "${IMAGE}" sh -c \
  'node /reporter/test/report_data.js && node /reporter/test/compare.js'
