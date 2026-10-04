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

# The container ships a Chromium whose revision may not match the pinned
# @playwright/test; point Playwright at it (see apps/web/playwright.config.ts).
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]; then
  chromium="$(ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | sort -V | tail -n1 || true)"
  if [ -n "$chromium" ]; then
    echo "export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=\"$chromium\"" >> "$CLAUDE_ENV_FILE"
  fi
fi
