#!/bin/sh
# Start Docker daemon in the background if running privileged
if command -v dockerd >/dev/null 2>&1; then
    sudo dockerd --storage-driver=vfs >/tmp/dockerd.log 2>&1 &
    # Wait for Docker to be ready
    for i in $(seq 1 30); do
        docker info >/dev/null 2>&1 && break
        sleep 1
    done
fi

exec "$@"
