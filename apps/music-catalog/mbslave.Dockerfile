# The Music catalog's mbslave image: Node to run this repo's compiled restore
# (`apps/music-catalog/dist/restore.js`, built on the host with
# `nub run build --filter=music-catalog` and mounted from the repo in the dev
# compose) plus mbslave itself and `psql`, which `mbslave init` shells out to.
#
# mbslave is pinned to a git tag and installed from git, not PyPI (PyPI is
# stuck at 28.0.0 while MusicBrainz is on schema 31). Bump MBSLAVE_REF
# together with MBSLAVE_REF in
# apps/music-catalog/test/setup/musicbrainz-schema.ts, which creates the same
# schema in the e2e database.
ARG MBSLAVE_REF=v31.0.1
FROM node:26-bookworm-slim
# python3-dev and the compilers build mbslave's psycopg2 from source (psycopg2
# publishes no wheels; only psycopg2-binary has them, which pip does not
# accept for mbslave's psycopg2 requirement); postgresql-client is what
# `mbslave init` shells out to for its SQL scripts.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-dev postgresql-client git gcc libc6-dev libpq-dev \
  && rm -rf /var/lib/apt/lists/*
ARG MBSLAVE_REF
# Debian's pip is too old to resolve current metadata, so upgrade it first.
RUN pip install --break-system-packages --no-cache-dir --upgrade pip \
  && pip install --break-system-packages --no-cache-dir "git+https://github.com/acoustid/mbslave.git@${MBSLAVE_REF}" \
  && mbslave --help > /dev/null
# The repo is mounted at /repo by the compose file (read-only: the restore
# only reads its own dist); mbslave downloads the dumps into its work
# directory, which keeps them across restarts so an interrupted download
# resumes instead of starting over.
WORKDIR /var/lib/mbslave
CMD ["node", "/repo/apps/music-catalog/dist/restore.js"]
