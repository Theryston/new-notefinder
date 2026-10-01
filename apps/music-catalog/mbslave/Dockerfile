FROM python:3.13-slim AS build

ARG MBSLAVE_REF=v31.0.1

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates gcc git libc6-dev libpq-dev \
  && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir \
    "git+https://github.com/acoustid/mbslave.git@${MBSLAVE_REF}"

FROM python:3.13-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl dumb-init libpq5 postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /opt/venv /opt/venv
COPY entrypoint.sh /usr/local/bin/mbslave-entrypoint

ENV PATH="/opt/venv/bin:${PATH}" \
  PYTHONUNBUFFERED=1

RUN chmod 0755 /usr/local/bin/mbslave-entrypoint

ENTRYPOINT ["/usr/bin/dumb-init", "--", "/usr/local/bin/mbslave-entrypoint"]
