#!/bin/sh
set -e

SEEDS_OUTPUT="${SEEDS_OUTPUT:-/app/data/seeds.json}"
scanner_pid=""

# Launch low-priority background seed scanner up to seed 10000 if not disabled
if [ -f /app/scanner.mjs ] && [ "${DISABLE_SEED_SCANNER:-0}" != "1" ]; then
  echo "Starting background seed scanner (seeds 1 to 10000, low priority)..."
  nice -n 19 node /app/scanner.mjs \
    --start "${SEED_SCANNER_START:-1}" \
    --count "${SEED_SCANNER_COUNT:-10000}" \
    --max-states "${SEED_SCANNER_MAX_STATES:-15000}" \
    --timeout "${SEED_SCANNER_TIMEOUT_MS:-5000}" \
    --flush-interval "${SEED_SCANNER_FLUSH_INTERVAL:-50}" \
    --yield-ms "${SEED_SCANNER_YIELD_MS:-5}" \
    --resume \
    --output "$SEEDS_OUTPUT" &
  scanner_pid=$!
fi

# No scanner: let the main process own PID 1 directly.
if [ -z "$scanner_pid" ]; then
  exec "$@"
fi

# Stay as PID 1 and forward stop signals to both children, so the scanner's
# SIGTERM handler can flush progress before `docker stop` escalates to SIGKILL.
# The nginx base image stops with SIGQUIT (graceful), so pass that through as-is.
"$@" &
main_pid=$!
forward() {
  kill -"$1" "$main_pid" 2>/dev/null || true
  kill -TERM "$scanner_pid" 2>/dev/null || true
}
trap 'forward QUIT' QUIT
trap 'forward TERM' TERM INT

set +e
wait "$main_pid"
status=$?
kill -TERM "$scanner_pid" 2>/dev/null
wait "$scanner_pid" 2>/dev/null
exit "$status"
