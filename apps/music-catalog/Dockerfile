# syntax=docker/dockerfile:1
#
# The Music catalog's Node image: one image, several commands. The production
# compose (deploy/compose.yaml) runs the compiled entrypoints from it:
#   node dist/server.js            the WebSocket server (the default command)
#   node dist/worker.js            the worker
#   node dist/database/migrate.js  the migrations, a deploy step
# It is built from the repository root, in the image, so building it needs
# nothing on the host but Docker (CI publishes it to GHCR; the server only
# pulls it):
#   docker build -f apps/music-catalog/Dockerfile .
#
# apps/music-catalog/mbslave.Dockerfile builds the same compiled app and
# production dependencies in its own `app-deps` and `app-build` stages: keep
# the two in step.
ARG NODE_IMAGE=node:26-bookworm-slim

# nub is the repo's package manager. It ships on npm as a prebuilt binary,
# which is only how this stage gets it; the installs below run through nub
# with the committed lockfile.
FROM ${NODE_IMAGE} AS nub
# Keep in step with devEngines.packageManager in the root package.json.
ARG NUB_VERSION=0.9.5
RUN npm install --global "@nubjs/nub@${NUB_VERSION}" && nub --version
WORKDIR /app

# The production dependencies of the Music catalog and of the workspace
# package it imports, from the manifests and the lockfile alone, so this
# layer is reused until a dependency changes. The lockfile lists every
# workspace, so every manifest is copied (`--parents` keeps their folders);
# `--filter` links only what the Music catalog needs. A separate install from
# the build's, because pruning a full install leaves the development
# packages in nub's virtual store.
FROM nub AS app-deps
COPY --parents package.json nub.lock apps/*/package.json packages/*/package.json ./
RUN nub install --frozen-lockfile --prod --ignore-scripts --filter 'music-catalog...'

# The compiled app: all dependencies (tsc and the types), then the contracts
# package and the app that imports it, in that order.
FROM nub AS app-build
COPY --parents package.json nub.lock apps/*/package.json packages/*/package.json ./
RUN nub install --frozen-lockfile --ignore-scripts --filter 'music-catalog...'
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/music-catalog apps/music-catalog
RUN nub --cwd packages/contracts run build && nub --cwd apps/music-catalog run build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
# The workspace layout is kept, because the installed packages link to each
# other by relative path (the app's node_modules/@notefinder/contracts points
# at packages/contracts).
WORKDIR /app/apps/music-catalog
COPY --from=app-deps /app/node_modules /app/node_modules
COPY --from=app-deps /app/packages/contracts/node_modules /app/packages/contracts/node_modules
COPY --from=app-deps /app/apps/music-catalog/node_modules ./node_modules
COPY --from=app-build /app/packages/contracts/package.json /app/packages/contracts/package.json
COPY --from=app-build /app/packages/contracts/dist /app/packages/contracts/dist
COPY --from=app-build /app/apps/music-catalog/package.json ./package.json
COPY --from=app-build /app/apps/music-catalog/dist ./dist
# The migrations sit next to dist: dist/database/migrate.js resolves ../../drizzle.
COPY --from=app-build /app/apps/music-catalog/drizzle ./drizzle
# LRCLIB's dump is unpacked here (the worker's temp directory, pointed at it
# by the compose file): a named volume mounted over it starts with this
# owner, so the unprivileged user can write to it.
RUN mkdir /scratch && chown node:node /scratch
USER node
CMD ["node", "dist/server.js"]
