#!/bin/sh
set -e

# A mounted volume arrives owned by root, whatever the image did at build time.
# The bot runs unprivileged, so hand the data directory over before dropping
# privileges — otherwise every state write fails with EACCES.
#
# Failure here is not fatal: the bot degrades to running without persistence
# rather than refusing to start, and says so in its logs.
if [ -d /app/data ]; then
  chown -R node:node /app/data 2>/dev/null || \
    echo "[entrypoint] Could not take ownership of /app/data; continuing without persistence."
fi

exec su-exec node "$@"
