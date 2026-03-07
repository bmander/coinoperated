FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

# Install Node.js 20 (frontend) and PostgreSQL server (tests)
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        nodejs \
        postgresql \
    && rm -rf /var/lib/apt/lists/*

# Pre-install Python dependencies globally (workspace mount overlays /workspace at runtime)
COPY backend/pyproject.toml /tmp/backend/pyproject.toml
RUN mkdir -p /tmp/backend/app && touch /tmp/backend/app/__init__.py \
    && pip install --no-cache-dir /tmp/backend[dev] \
    && rm -rf /tmp/backend
ENV PYTHONPATH=/workspace/backend

# Pre-populate npm cache as vscode so it's usable at runtime
COPY --chown=vscode:vscode frontend/package.json frontend/package-lock.json /tmp/frontend/
RUN su vscode -c 'cd /tmp/frontend && npm ci --ignore-scripts' && rm -rf /tmp/frontend

COPY .devcontainer/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bash"]
