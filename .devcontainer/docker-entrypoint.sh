#!/bin/sh
# Start Docker daemon in the background if running privileged
if command -v dockerd >/dev/null 2>&1; then
    sudo dockerd --storage-driver=vfs >/tmp/dockerd.log 2>&1 &
    for i in $(seq 1 30); do
        docker info >/dev/null 2>&1 && break
        sleep 1
    done
    docker info >/dev/null 2>&1 || echo "WARNING: Docker daemon did not start within 30s" >&2
fi

exec "$@"
