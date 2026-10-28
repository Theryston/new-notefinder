#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${COOLIFY_DEPLOY_URL:-}" || -z "${COOLIFY_DEPLOY_TOKEN:-}" ]]; then
  echo '::error::The Coolify deployment URL and token must be configured.' >&2
  exit 1
fi

case "$COOLIFY_DEPLOY_URL" in
  http://*|https://*) ;;
  *)
    echo '::error::The Coolify deployment URL must use HTTP or HTTPS.' >&2
    exit 1
    ;;
esac

# Curl errors and response bodies can reveal the private deployment address.
# Do not retry a POST: an ambiguous failure may have already queued a deploy.
if ! curl --fail --silent --request POST \
  --connect-timeout 10 --max-time 60 \
  --header "Authorization: Bearer $COOLIFY_DEPLOY_TOKEN" \
  --output /dev/null "$COOLIFY_DEPLOY_URL" >/dev/null 2>&1; then
  echo '::error::The Coolify deployment request failed.' >&2
  exit 1
fi

echo 'Coolify deployment requested.'
