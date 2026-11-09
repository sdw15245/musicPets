#!/bin/sh
set -eu
# Reload only this deployment's running Nginx after a successful renewal.
for container in $(docker ps -q --filter label=com.docker.compose.project=musicpets-production --filter label=com.docker.compose.service=nginx); do
    docker exec "$container" nginx -t
    docker exec "$container" nginx -s reload
done
# During initial server setup, a temporary Nginx serves the ACME path.
if docker ps --format '{{.Names}}' | grep -qx musicpets-acme; then
    docker exec musicpets-acme nginx -t
    docker exec musicpets-acme nginx -s reload
fi
