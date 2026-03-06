FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

# Install Node.js 20 (frontend), PostgreSQL client (migrations/psql), and Docker CE (testcontainers)
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
       | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
       > /etc/apt/sources.list.d/nodesource.list \
    && curl -fsSL https://download.docker.com/linux/debian/gpg \
       | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" \
       > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
        nodejs \
        postgresql-client \
        docker-ce docker-ce-cli containerd.io \
    && rm -rf /var/lib/apt/lists/* \
    && usermod -aG docker vscode \
    && echo "vscode ALL=(root) NOPASSWD: /usr/bin/dockerd" > /etc/sudoers.d/docker \
    && chmod 440 /etc/sudoers.d/docker

# Pre-install Python dependencies globally (workspace mount overlays /workspace at runtime)
COPY backend/pyproject.toml /tmp/backend/pyproject.toml
RUN mkdir -p /tmp/backend/app && touch /tmp/backend/app/__init__.py \
    && pip install --no-cache-dir /tmp/backend[dev] \
    && rm -rf /tmp/backend
ENV PYTHONPATH=/workspace/backend

# Pre-populate npm cache so "npm install" at runtime is near-instant
COPY frontend/package.json frontend/package-lock.json /tmp/frontend/
RUN cd /tmp/frontend && npm ci --ignore-scripts && rm -rf /tmp/frontend

COPY .devcontainer/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bash"]
