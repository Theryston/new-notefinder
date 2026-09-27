#!/bin/bash
# Installs nub and the workspace dependencies in Claude Code on the web
# sessions, whose containers don't ship with nub.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

NUB_VERSION="0.9.5"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"

if ! command -v nub >/dev/null 2>&1; then
  # npm refuses to run inside the repo (devEngines requires nub).
  (cd /tmp && npm install --global "@nubjs/nub@${NUB_VERSION}")
fi

cd "$PROJECT_DIR"
nub install
