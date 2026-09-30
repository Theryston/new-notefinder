#!/usr/bin/env bash
# Search engine benchmark harness (issue #68). Container lifecycle lives here,
# data work lives in bench/ (Python). Everything runs in throwaway containers
# named nfbench-* on a private network, so nothing touches other containers.
#
#   ./run.sh help
#
# Scratch data (dump, exports, results) goes to $BENCH_DIR, never to the repo.
set -euo pipefail

HARNESS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BENCH_DIR="${BENCH_DIR:-$HOME/.cache/nf-bench}"
NET=nfbench
SAMPLE_URL="${SAMPLE_URL:-https://data.metabrainz.org/pub/musicbrainz/data/sample/20260901-000002/mbdump-sample.tar.xz}"
SONIC_IMAGE="${SONIC_IMAGE:-valeriansaliou/sonic:v1.10.1}"
MEILI_IMAGE="${MEILI_IMAGE:-getmeili/meilisearch:v1.54.2}"
MB_PG_IMAGE="${MB_PG_IMAGE:-postgres:17-alpine}"
MEILI_KEY="${MEILI_KEY:-nfbench-master-key-0123456789}"
SONIC_PASSWORD="${SONIC_PASSWORD:-nfbench}"

# Same Postgres settings as the spike (this Postgres only holds the restored
# MusicBrainz sample the documents are built from; it is not benchmarked).
PG_FLAGS=(-c shared_buffers=1GB -c maintenance_work_mem=1GB
  -c max_wal_size=8GB -c checkpoint_timeout=30min)

mkdir -p "$BENCH_DIR"

net() { docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null; }

# Run a command in the tools image: harness mounted read-only, scratch dir
# mounted at /work, connection settings for every engine in the environment.
tools() {
  docker run --rm --network "$NET" \
    -v "$HARNESS":/harness:ro -v "$BENCH_DIR":/work \
    -e MBSLAVE_DB_HOST=nfbench-mbpg -e MBSLAVE_DB_USER=musicbrainz \
    -e MBSLAVE_DB_PASSWORD=musicbrainz -e MBSLAVE_DB_ADMIN_USER=postgres \
    -e MBSLAVE_DB_ADMIN_PASSWORD=postgres \
    -e PGPASSWORD=postgres -e BENCH_WORK=/work \
    -e MB_DSN="host=nfbench-mbpg dbname=musicbrainz user=postgres password=postgres" \
    -e SONIC_HOST=nfbench-sonic -e SONIC_PASSWORD="$SONIC_PASSWORD" \
    -e MEILI_URL=http://nfbench-meili:7700 -e MEILI_KEY="$MEILI_KEY" \
    -e PYTHONPATH=/harness -e PYTHONDONTWRITEBYTECODE=1 -e PYTHONUNBUFFERED=1 \
    "${TOOLS_EXTRA[@]}" nfbench-tools "$@"
}
TOOLS_EXTRA=()

wait_pg() { # container
  until docker exec "$1" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
}

cmd_help() { sed -n '2,12p' "$0"; grep -o '^cmd_[a-z0-9_]*' "$0" | sed 's/cmd_//; s/_/-/g'; }

cmd_build_tools() { docker build -t nfbench-tools "$HARNESS"; }

cmd_download_sample() {
  mkdir -p "$BENCH_DIR/dumps"
  curl -L -C - -o "$BENCH_DIR/dumps/mbdump-sample.tar.xz" "$SAMPLE_URL"
}

# MusicBrainz sample restored into its own Postgres: init --empty + import.
cmd_mb_restore() {
  net
  docker run -d --name nfbench-mbpg --network "$NET" --memory 4g \
    -e POSTGRES_PASSWORD=postgres -v nfbench-mbpg:/var/lib/postgresql/data \
    "$MB_PG_IMAGE" "${PG_FLAGS[@]}" >/dev/null
  wait_pg nfbench-mbpg
  sleep 3
  tools mbslave init --create-user --create-database --empty
  tools mbslave import /work/dumps/mbdump-sample.tar.xz
}

cmd_mb_start() { docker start nfbench-mbpg >/dev/null; wait_pg nfbench-mbpg; }
cmd_mb_stop() { docker stop nfbench-mbpg >/dev/null; }

# Documents, query sets and exports (needs the restored sample running).
cmd_prepare() {
  cmd_bench docs
  cmd_bench queries
  cmd_bench export
}

# Sonic with the spike's recommended configuration. SONIC_ROCKSDB=default
# drops the bulk-load RocksDB tuning (16 MiB write buffer, 2 memtables), which
# is what a serving instance would run after the first import.
cmd_sonic_up() {
  net
  docker rm -f nfbench-sonic >/dev/null 2>&1 || true
  local tuning=(
    -e SONIC_STORE__KV__DATABASE__WRITE_BUFFER_SIZE=262144
    -e SONIC_STORE__KV__DATABASE__MAX_WRITE_BUFFER_NUMBER=4
    -e SONIC_STORE__KV__DATABASE__MIN_WRITE_BUFFER_NUMBER_TO_MERGE=2
    -e SONIC_STORE__KV__DATABASE__MAX_BACKGROUND_JOBS=8
    -e SONIC_STORE__KV__DATABASE__PARALLELISM=8
    -e SONIC_STORE__KV__DATABASE__LEVEL_ZERO_FILE_NUM_COMPACTION_TRIGGER=8
    -e SONIC_STORE__KV__DATABASE__LEVEL_ZERO_SLOWDOWN_WRITES_TRIGGER=48
    -e SONIC_STORE__KV__DATABASE__LEVEL_ZERO_STOP_WRITES_TRIGGER=64
  )
  if [ "${SONIC_ROCKSDB:-tuned}" = default ]; then tuning=(); fi
  docker run -d --name nfbench-sonic --network "$NET" --memory 4g \
    -v nfbench-sonic:/var/lib/sonic/store \
    -e SONIC_SERVER__LOG_LEVEL=error \
    -e SONIC_CHANNEL__INET=0.0.0.0:1491 \
    -e SONIC_CHANNEL__AUTH_PASSWORD="$SONIC_PASSWORD" \
    -e SONIC_STORE__KV__PATH=/var/lib/sonic/store/kv/ \
    -e SONIC_STORE__FST__PATH=/var/lib/sonic/store/fst/ \
    -e SONIC_TOKENIZATION__DETECT_SPECIAL_PATTERNS=false \
    -e SONIC_NORMALIZATION__DIACRITIC_FOLDING_ENABLED=true \
    -e SONIC_STORE__KV__RETAIN_WORD_OBJECTS=1000000 \
    "${tuning[@]}" "$SONIC_IMAGE" >/dev/null
}

cmd_meili_up() {
  net
  docker rm -f nfbench-meili >/dev/null 2>&1 || true
  docker run -d --name nfbench-meili --network "$NET" --memory "${MEILI_MEMORY:-6g}" \
    -v nfbench-meili:/meili_data \
    -e MEILI_ENV=production -e MEILI_MASTER_KEY="$MEILI_KEY" \
    -e MEILI_NO_ANALYTICS=true -e MEILI_HTTP_PAYLOAD_SIZE_LIMIT=500000000 \
    -e MEILI_MAX_INDEXING_MEMORY="${MEILI_INDEXING_MEMORY:-3GiB}" \
    "$MEILI_IMAGE" >/dev/null
}

# Memory of a container as the kernel accounts it: anonymous (RSS-like) memory
# and page cache, in MB, from the cgroup v2 files on the host.
cmd_mem() { # container
  local id scope
  id="$(docker inspect -f '{{.Id}}' "$1")"
  scope="/sys/fs/cgroup/system.slice/docker-${id}.scope"
  awk '/^(anon|file) /{printf "%s_mb=%d ", $1, $2/1048576}' "$scope/memory.stat"
  printf 'current_mb=%d peak_mb=%d\n' \
    "$(($(cat "$scope/memory.current") / 1048576))" \
    "$(($(cat "$scope/memory.peak") / 1048576))"
}

# Bytes on disk of a volume (or of sub-paths of it), through a throwaway
# container because the Docker data directory is not readable by the user.
cmd_du() { # volume [path...]
  local vol="$1"; shift
  local paths=("${@:-.}")
  docker run --rm -v "$vol":/v:ro -w /v alpine du -sb "${paths[@]}"
}

cmd_bench() { TOOLS_EXTRA=(--user "$(id -u):$(id -g)"); tools python -m bench "$@"; }

# The measurement loop: grow the index 25% -> 50% -> 75% -> 100%, settle it,
# record memory and size, and run the query sets (the full list only at 100%,
# a short list at the smaller sizes to get the scaling curve).
#   ./run.sh matrix <sonic|meili> [first-stage]
SHORT_SETS="random-ta,heavy-ta,random-t,singles"
cmd_matrix() {
  local engine="$1" from="${2:-1}" n sets
  for n in $(seq "$from" 4); do
    echo "=== $engine stage $n ($(date +%T))"
    settle_engine "$engine" "$n"
    sets="$SHORT_SETS"; [ "$n" = 4 ] && sets=all
    engine_mem "$engine"
    cmd_bench run --engine "$engine" --sets "$sets" --out "$engine-s$n"
    engine_mem "$engine"
    engine_size "$engine"
  done
}

# Load (or rebuild) the index up to stage $2 and leave the engine settled.
settle_engine() {
  case "$1" in
    sonic)
      cmd_bench sonic-load --stage "$2"
      # Sonic consolidates its graph after 180 s idle; its tuned bulk-load
      # write buffers keep data in memtables that make reads ~10x slower
      # until they are flushed, which a restart does (measured, see doc).
      sleep 200; docker restart nfbench-sonic >/dev/null; sleep 10 ;;
    meili) cmd_bench meili-load --stage "$2"; sleep 30 ;;
  esac
}

engine_mem() {
  case "$1" in
    sonic) cmd_mem nfbench-sonic ;;
    meili) cmd_mem nfbench-meili ;;
  esac
}

engine_size() {
  case "$1" in
    sonic) cmd_du nfbench-sonic kv fst ;;
    meili) cmd_du nfbench-meili . ;;
  esac
}

cmd_shell() { TOOLS_EXTRA=(-it); tools bash; }

cmd_clean() {
  docker rm -f nfbench-mbpg nfbench-sonic nfbench-meili 2>/dev/null || true
  docker volume rm nfbench-mbpg nfbench-sonic nfbench-meili 2>/dev/null || true
  docker network rm "$NET" 2>/dev/null || true
  echo "Containers, volumes and network removed. Delete $BENCH_DIR by hand."
}

case "${1:-help}" in
  help | -h | --help) cmd_help ;;
  *) c="cmd_${1//-/_}"; shift; "$c" "$@" ;;
esac
