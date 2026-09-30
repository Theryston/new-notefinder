# Tools image for the search benchmark: mbslave pinned to a git tag (PyPI only
# has 28.0.0, MusicBrainz is on schema 31), psql (`mbslave init` shells out to
# it) and psycopg for the harness. Same base as the spike's mbslave image.
FROM python:3.13-slim
ARG MBSLAVE_REF=v31.0.1
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client git gcc libc6-dev libpq-dev dumb-init \
 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "git+https://github.com/acoustid/mbslave.git@${MBSLAVE_REF}" "psycopg[binary]==3.2.*"
WORKDIR /harness
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["bash"]
