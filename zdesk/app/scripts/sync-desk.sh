#!/usr/bin/env bash
# Push HighKali desk files to the VPS ZDESK instance every 60s.
# Usage: sync-desk.sh start|stop|status|once|loop
set -euo pipefail

KEY="${ZDESK_SSH_KEY:-$HOME/.ssh/zdesk_vps}"
HOST="${ZDESK_SSH_HOST:?imposta ZDESK_SSH_HOST=utente@host del VPS}"
REMOTE_DIR="${ZDESK_REMOTE_DIR:-/opt/zdesk/desk}"
SRC_DIR="${ZDESK_SRC_DIR:-/workspace/highkali-desk}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="${ZDESK_SYNC_PID:-$ROOT/sync-desk.pid}"
LOG="${ZDESK_SYNC_LOG:-$ROOT/sync-desk.log}"
INTERVAL="${ZDESK_SYNC_INTERVAL:-60}"

FILES=(
  risk.md
  go.md
  survivors.md
  gmgn-signals.md
  copy-signals.md
  copy-live.md
  copy-wallets.md
  ninja.json
  anti-fake.json
  anti-fake.md
  copy-top.json
  copy-top.md
  engines.md
  ov-sweep.md
  wallet-spark.json
)

ssh_cmd() {
  ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 "$HOST" "$@"
}

refresh_copytop() {
  # Public read-only fetch, at most every 8 minutes. Never logs secrets.
  local js="$ROOT/scripts/copytop-fetch.js"
  local cache="$SRC_DIR/copy-top.json"
  local now age
  now="$(date +%s)"
  if [[ -f "$cache" ]]; then
    age="$(( now - $(stat -c %Y "$cache" 2>/dev/null || echo 0) ))"
    if [[ "$age" -lt 480 ]]; then
      return 0
    fi
  fi
  if [[ -f "$js" ]] && command -v node >/dev/null 2>&1; then
    node "$js" --force >>"$LOG" 2>&1 || echo "$(date '+%Y-%m-%d %H:%M:%S %Z') copytop fetch failed" >>"$LOG"
  fi
}

sync_once() {
  refresh_copytop || true
  local -a present=()
  local f
  for f in "${FILES[@]}"; do
    if [[ -f "$SRC_DIR/$f" ]]; then
      present+=("$SRC_DIR/$f")
    fi
  done
  if [[ ${#present[@]} -eq 0 ]]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S %Z') nothing to sync" >>"$LOG"
    return 0
  fi
  local names=""
  local f
  for f in "${present[@]}"; do names+="$(basename "$f") "; done
  ssh_cmd "mkdir -p '$REMOTE_DIR' && chmod 755 '$REMOTE_DIR'"
  scp -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
    -q "${present[@]}" "$HOST:$REMOTE_DIR/"
  ssh_cmd "chown zdesk:zdesk '$REMOTE_DIR' $REMOTE_DIR/* 2>/dev/null || true; chmod 755 '$REMOTE_DIR'; chmod 644 $REMOTE_DIR/* 2>/dev/null || true"
  echo "$(date '+%Y-%m-%d %H:%M:%S %Z') synced ${#present[@]} file(s): $names" >>"$LOG"
}

alive_pid() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

cmd="${1:-status}"
case "$cmd" in
  once)
    sync_once
    ;;
  loop)
    # Executed as the long-running process. Writes this PID.
    echo $$ >"$PIDFILE"
    while true; do
      sync_once || echo "$(date '+%Y-%m-%d %H:%M:%S %Z') sync failed (exit $?)" >>"$LOG"
      sleep "$INTERVAL"
    done
    ;;
  start)
    if [[ -f "$PIDFILE" ]] && alive_pid "$(cat "$PIDFILE")"; then
      echo "already running pid $(cat "$PIDFILE")"
      exit 0
    fi
    mkdir -p "$(dirname "$PIDFILE")"
    nohup "$0" loop >>"$LOG" 2>&1 &
    # wait briefly for pid file
    for _ in 1 2 3 4 5; do
      if [[ -f "$PIDFILE" ]] && alive_pid "$(cat "$PIDFILE")"; then
        echo "started pid $(cat "$PIDFILE")"
        exit 0
      fi
      sleep 0.2
    done
    echo "failed to start; see $LOG" >&2
    exit 1
    ;;
  stop)
    if [[ -f "$PIDFILE" ]]; then
      pid="$(cat "$PIDFILE")"
      if alive_pid "$pid"; then
        kill "$pid" || true
        sleep 0.3
        alive_pid "$pid" && kill -9 "$pid" || true
      fi
      rm -f "$PIDFILE"
      echo "stopped"
    else
      echo "not running"
    fi
    ;;
  status)
    if [[ -f "$PIDFILE" ]] && alive_pid "$(cat "$PIDFILE")"; then
      echo "running pid $(cat "$PIDFILE")"
      exit 0
    fi
    echo "not running"
    exit 1
    ;;
  *)
    echo "usage: $0 start|stop|status|once|loop" >&2
    exit 2
    ;;
esac
