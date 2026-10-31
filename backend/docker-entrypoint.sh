#!/bin/sh
set -e
if [ "$(id -u)" = "0" ]; then
    for dir in /app/uploads /app/chroma_db /app/reports /hf_cache; do
        if [ -d "$dir" ] && [ "$(stat -c %u "$dir")" != "10001" ]; then
            chown -R ragentis:ragentis "$dir"
        fi
    done
    exec setpriv --reuid=ragentis --regid=ragentis --init-groups "$@"
fi
exec "$@"
