FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

# Install Node.js 20 (frontend) and PostgreSQL client (migrations/psql)
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        nodejs \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*
