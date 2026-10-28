#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
test_dir=$(mktemp -d)
trap 'rm -rf -- "$test_dir"' EXIT

cat > "$test_dir/curl" <<'CURL'
#!/usr/bin/env bash
printf '%s\n' "$@" >> "$CURL_RECORD"
printf 'Sensitive response: %s %s\n' "$COOLIFY_DEPLOY_URL" "$COOLIFY_DEPLOY_TOKEN"
printf 'Sensitive error: %s %s\n' "$COOLIFY_DEPLOY_URL" "$COOLIFY_DEPLOY_TOKEN" >&2
exit "$CURL_EXIT"
CURL
chmod +x "$test_dir/curl"
export PATH="$test_dir:$PATH"
export CURL_RECORD="$test_dir/curl-record"

deploy_url='http://private-coolify.invalid/api/v1/services/catalog/restart?latest=true'
deploy_token='test-only-deploy-token'

run_deploy() {
  rm -f -- "$CURL_RECORD"
  result=0
  env CURL_EXIT="$1" COOLIFY_DEPLOY_URL="$2" COOLIFY_DEPLOY_TOKEN="$3" \
    bash "$script_dir/deploy-coolify.sh" > "$test_dir/output" 2>&1 || result=$?
}

assert_private_output() {
  if grep -Fq -e 'private-coolify.invalid' -e "$deploy_token" "$test_dir/output"; then
    echo 'Deployment output revealed a private value.' >&2
    exit 1
  fi
}

for scheme in http https; do
  url="${scheme}://${deploy_url#*://}"
  run_deploy 0 "$url" "$deploy_token"
  [[ "$result" == 0 ]]
  grep -Fxq -- "$url" "$CURL_RECORD"
  grep -Fxq -- 'POST' "$CURL_RECORD"
  grep -Fxq -- "Authorization: Bearer $deploy_token" "$CURL_RECORD"
  grep -Fxq -- '--fail' "$CURL_RECORD"
  grep -Fxq -- '/dev/null' "$CURL_RECORD"
  [[ $(grep -Fxc -- "$url" "$CURL_RECORD") == 1 ]]
  grep -Fxq -- 'Coolify deployment requested.' "$test_dir/output"
  assert_private_output
done

# DNS, connection, HTTP and timeout failures all fail CI without leaking secrets.
for curl_exit in 6 7 22 28; do
  run_deploy "$curl_exit" "$deploy_url" "$deploy_token"
  [[ "$result" == 1 ]]
  [[ $(grep -Fxc -- "$deploy_url" "$CURL_RECORD") == 1 ]]
  grep -Fq -- 'The Coolify deployment request failed.' "$test_dir/output"
  assert_private_output
done

for missing in url token; do
  url="$deploy_url"
  token="$deploy_token"
  if [[ "$missing" == url ]]; then url=''; else token=''; fi
  run_deploy 0 "$url" "$token"
  [[ "$result" == 1 ]]
  [[ ! -e "$CURL_RECORD" ]]
  grep -Fq -- 'must be configured.' "$test_dir/output"
  assert_private_output
done

run_deploy 0 'file:///private-coolify.invalid' "$deploy_token"
[[ "$result" == 1 ]]
[[ ! -e "$CURL_RECORD" ]]
grep -Fq -- 'must use HTTP or HTTPS.' "$test_dir/output"
assert_private_output

echo 'Coolify deployment request tests passed.'
