FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

# Install Node.js 20 (frontend) and PostgreSQL client (migrations/psql)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends \
        nodejs \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*
