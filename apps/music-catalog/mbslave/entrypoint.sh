#!/bin/sh

set -eu

: "${CATALOG_DATASET:?CATALOG_DATASET must be sample or full}"
: "${MBSLAVE_DB_HOST:?MBSLAVE_DB_HOST is required}"
: "${MBSLAVE_DB_PORT:?MBSLAVE_DB_PORT is required}"
: "${MBSLAVE_DB_DB:?MBSLAVE_DB_DB is required}"
: "${MBSLAVE_DB_USER:?MBSLAVE_DB_USER is required}"
: "${MBSLAVE_DB_PASSWORD:?MBSLAVE_DB_PASSWORD is required}"
: "${MBSLAVE_DB_ADMIN_USER:?MBSLAVE_DB_ADMIN_USER is required}"
: "${MBSLAVE_DB_ADMIN_PASSWORD:?MBSLAVE_DB_ADMIN_PASSWORD is required}"

case "$CATALOG_DATASET" in
  sample|full) ;;
  *)
    echo 'CATALOG_DATASET must be sample or full' >&2
    exit 1
    ;;
esac

MUSICBRAINZ_DUMP_BASE_URL="${MUSICBRAINZ_DUMP_BASE_URL:-https://data.metabrainz.org/pub/musicbrainz/data}"
case "$MUSICBRAINZ_DUMP_BASE_URL" in
  http://*|https://*) ;;
  *)
    echo 'MUSICBRAINZ_DUMP_BASE_URL must use http or https' >&2
    exit 1
    ;;
esac
MUSICBRAINZ_DUMP_BASE_URL="${MUSICBRAINZ_DUMP_BASE_URL%/}"

admin_psql() {
  PGPASSWORD="$MBSLAVE_DB_ADMIN_PASSWORD" psql \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    --host="$MBSLAVE_DB_HOST" \
    --port="$MBSLAVE_DB_PORT" \
    --username="$MBSLAVE_DB_ADMIN_USER" \
    --dbname="$MBSLAVE_DB_DB" \
    "$@"
}

wait_for_database() {
  attempt=1
  while [ "$attempt" -le 60 ]; do
    if admin_psql --quiet --tuples-only --no-align --command='select 1' \
      >/dev/null 2>&1; then
      return
    fi
    sleep 2
    attempt=$((attempt + 1))
  done
  echo 'Music catalog Postgres did not become available' >&2
  exit 1
}

on_exit() {
  exit_code=$?
  trap - EXIT
  if [ -n "${work_dir:-}" ]; then
    rm -rf "$work_dir"
  fi
  if [ "$exit_code" -ne 0 ]; then
    printf 'MusicBrainz restore failed (exit %s)\n' "$exit_code" >&2
  fi
  exit "$exit_code"
}
trap on_exit EXIT

wait_for_database

if ! admin_psql --quiet --command='select 1 from music_catalog.bootstrap_state limit 0' \
  >/dev/null 2>&1; then
  echo 'Music catalog migrations must be applied before the mbslave restore' >&2
  exit 1
fi

state="$(admin_psql --tuples-only --no-align --command="
  select phase::text || '|' || dataset::text
  from music_catalog.bootstrap_state
  where id = true
")"
if [ -n "$state" ]; then
  phase="${state%%|*}"
  restored_dataset="${state#*|}"
  case "$phase" in
    restored|indexing|ready)
      if [ "$restored_dataset" != "$CATALOG_DATASET" ]; then
        printf 'MusicBrainz is already restored as %s; keeping it until the local database is reset\n' \
          "$restored_dataset"
      else
        printf 'MusicBrainz %s restore is already complete; skipping\n' "$restored_dataset"
      fi
      exit 0
      ;;
    restoring) ;;
    *)
      printf 'Unknown MusicBrainz bootstrap phase: %s\n' "$phase" >&2
      exit 1
      ;;
  esac
fi

printf 'Starting MusicBrainz %s restore\n' "$CATALOG_DATASET"
admin_psql --quiet <<SQL
BEGIN;
INSERT INTO music_catalog.bootstrap_state (id, phase, dataset)
VALUES (true, 'restoring', '$CATALOG_DATASET')
ON CONFLICT (id) DO UPDATE
SET phase = 'restoring', dataset = EXCLUDED.dataset, updated_at = now();
DELETE FROM music_catalog.indexing_checkpoint;
DROP TEXT SEARCH CONFIGURATION IF EXISTS public.mb_simple CASCADE;
DROP SCHEMA IF EXISTS musicbrainz CASCADE;
DROP SCHEMA IF EXISTS cover_art_archive CASCADE;
DROP SCHEMA IF EXISTS event_art_archive CASCADE;
DROP SCHEMA IF EXISTS statistics CASCADE;
DROP SCHEMA IF EXISTS documentation CASCADE;
DROP SCHEMA IF EXISTS wikidocs CASCADE;
DROP SCHEMA IF EXISTS dbmirror2 CASCADE;
COMMIT;
SQL

echo 'Creating the MusicBrainz schema with mbslave'
mbslave init --create-user --create-database --empty

dump_root="$MUSICBRAINZ_DUMP_BASE_URL"
if [ "$CATALOG_DATASET" = 'sample' ]; then
  dump_root="$dump_root/sample"
else
  dump_root="$dump_root/fullexport"
fi

version="$(curl --fail --location --silent --show-error "$dump_root/LATEST" | tr -d '\r\n')"
case "$version" in
  ''|*[!a-zA-Z0-9_-]*)
    echo 'The MusicBrainz LATEST file contains an invalid dump version' >&2
    exit 1
    ;;
esac

work_dir="$(mktemp -d /tmp/mbslave-import.XXXXXX)"
if [ "$CATALOG_DATASET" = 'sample' ]; then
  echo "Importing the MusicBrainz sample dump $version"
  mbslave import --work-dir "$work_dir" \
    "$dump_root/$version/mbdump-sample.tar.xz"
else
  echo "Importing the MusicBrainz full dump $version"
  mbslave import --work-dir "$work_dir" \
    "$dump_root/$version/mbdump.tar.bz2" \
    "$dump_root/$version/mbdump-derived.tar.bz2"
fi

restored_state="$(admin_psql --quiet --tuples-only --no-align --command="
  update music_catalog.bootstrap_state
  set phase = 'restored', updated_at = now()
  where id = true and phase = 'restoring' and dataset = '$CATALOG_DATASET'
  returning phase::text || '|' || dataset::text
")"
if [ "$restored_state" != "restored|$CATALOG_DATASET" ]; then
  printf 'MusicBrainz restore finished but its bootstrap state changed: %s\n' \
    "$restored_state" >&2
  exit 1
fi

printf 'MusicBrainz %s restore is complete\n' "$CATALOG_DATASET"
