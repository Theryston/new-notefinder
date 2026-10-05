# syntax=docker/dockerfile:1
#
# The Music catalog's mbslave image: Node to run this repo's compiled restore
# (`dist/restore.js`) plus mbslave itself and `psql`, which `mbslave init`
# shells out to. Built from the repository root. Two targets:
#
# - `production` (the default, last stage): self-contained. The compiled
#   restore and its production dependencies are built into the image, so the
#   server needs no source code, no build toolchain and no host mount. CI
#   publishes it to GHCR (.github/workflows/music-catalog-images.yml).
#     docker build -f apps/music-catalog/mbslave.Dockerfile .
# - `dev`: only the tooling; the dev compose mounts the repo and runs the
#   `dist` built on the host with `nub run build --filter=music-catalog`
#   (apps/music-catalog/docker-compose.yml builds this target).
#
# mbslave is pinned to a git tag and installed from git, not PyPI (PyPI is
# stuck at 28.0.0 while MusicBrainz is on schema 31). Bump MBSLAVE_REF
# together with MBSLAVE_REF in
# apps/music-catalog/test/setup/musicbrainz-schema.ts, which creates the same
# schema in the e2e database.
ARG MBSLAVE_REF=v31.0.1
ARG NODE_IMAGE=node:26-bookworm-slim

# mbslave and psql on the Node image, shared by both targets.
FROM ${NODE_IMAGE} AS mbslave-base
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
# The release running here, recorded with a schema-change stall so the
# reimport starts once the container runs a newer release than the stalled
# one (see apps/music-catalog/CLAUDE.md "Yearly schema change"). Baked in
# from the build argument, so the bump PR touches no compose file.
ENV MBSLAVE_REF=${MBSLAVE_REF}
# mbslave downloads the dumps into its work directory, which a volume keeps
# across restarts so an interrupted download resumes instead of starting over.
WORKDIR /var/lib/mbslave

# The compiled restore, built the way apps/music-catalog/Dockerfile builds the
# Node image (the same three stages: keep them in step, see there for why).
FROM ${NODE_IMAGE} AS nub
# Keep in step with devEngines.packageManager in the root package.json.
ARG NUB_VERSION=0.9.5
RUN npm install --global "@nubjs/nub@${NUB_VERSION}" && nub --version
WORKDIR /app

FROM nub AS app-deps
COPY --parents package.json nub.lock apps/*/package.json packages/*/package.json ./
RUN nub install --frozen-lockfile --prod --ignore-scripts --filter 'music-catalog...'

FROM nub AS app-build
COPY --parents package.json nub.lock apps/*/package.json packages/*/package.json ./
RUN nub install --frozen-lockfile --ignore-scripts --filter 'music-catalog...'
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/music-catalog apps/music-catalog
RUN nub --cwd packages/contracts run build && nub --cwd apps/music-catalog run build

# The dev target: nothing of the app. The repo is mounted at /repo by the dev
# compose (read-only: the restore only reads its own dist).
FROM mbslave-base AS dev
CMD ["node", "/repo/apps/music-catalog/dist/restore.js"]

FROM mbslave-base AS production
ENV NODE_ENV=production
# The workspace layout is kept (the installed packages link to each other by
# relative path), under /app because the work directory is the dumps volume.
COPY --from=app-deps /app/node_modules /app/node_modules
COPY --from=app-deps /app/packages/contracts/node_modules /app/packages/contracts/node_modules
COPY --from=app-deps /app/apps/music-catalog/node_modules /app/apps/music-catalog/node_modules
COPY --from=app-build /app/packages/contracts/package.json /app/packages/contracts/package.json
COPY --from=app-build /app/packages/contracts/dist /app/packages/contracts/dist
COPY --from=app-build /app/apps/music-catalog/package.json /app/apps/music-catalog/package.json
COPY --from=app-build /app/apps/music-catalog/dist /app/apps/music-catalog/dist
# Unprivileged: the only place it writes is the dumps directory, which a
# named volume mounted over it takes the owner of.
RUN chown node:node /var/lib/mbslave
USER node
CMD ["node", "/app/apps/music-catalog/dist/restore.js"]
