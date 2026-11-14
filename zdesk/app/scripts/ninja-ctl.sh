#!/usr/bin/env bash
# Supervisor for the HighKali Ninja daemon (no keys, no signing).
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIDFILE="${NINJA_PID_FILE:-$DIR/ninja.pid}"
LOG="${NINJA_DAEMON_LOG:-$DIR/ninja-daemon.log}"
NODE_BIN="${NODE_BIN:-node}"
DAEMON="$DIR/scripts/ninja-daemon.js"

is_running() {
  if [[ ! -f "$PIDFILE" ]]; then
    return 1
  fi
  local pid
  pid="$(tr -d '[:space:]' < "$PIDFILE")"
  if [[ -z "$pid" ]]; then
    return 1
  fi
  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi
  return 1
}

cmd_start() {
  if is_running; then
    echo "ninja already running pid=$(tr -d '[:space:]' < "$PIDFILE")"
    return 0
  fi
  mkdir -p "$(dirname "$LOG")"
  nohup "$NODE_BIN" "$DAEMON" >>"$LOG" 2>&1 &
  local pid=$!
  # daemon writes its own pid file; wait briefly
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if [[ -f "$PIDFILE" ]] && kill -0 "$(tr -d '[:space:]' < "$PIDFILE")" 2>/dev/null; then
      echo "ninja started pid=$(tr -d '[:space:]' < "$PIDFILE") log=$LOG"
      return 0
    fi
    sleep 0.15
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "$pid" > "$PIDFILE"
    echo "ninja started pid=$pid log=$LOG"
    return 0
  fi
  echo "ninja failed to start — see $LOG" >&2
  return 1
}

cmd_stop() {
  if ! is_running; then
    rm -f "$PIDFILE"
    echo "ninja not running"
    return 0
  fi
  local pid
  pid="$(tr -d '[:space:]' < "$PIDFILE")"
  kill -TERM "$pid" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$PIDFILE"
      echo "ninja stopped pid=$pid"
      return 0
    fi
    sleep 0.2
  done
  kill -KILL "$pid" 2>/dev/null || true
  rm -f "$PIDFILE"
  echo "ninja killed pid=$pid"
}

cmd_status() {
  if is_running; then
    echo "ninja running pid=$(tr -d '[:space:]' < "$PIDFILE")"
    return 0
  fi
  echo "ninja stopped"
  return 1
}

cmd_restart() {
  cmd_stop || true
  cmd_start
}

case "${1:-status}" in
  start) cmd_start ;;
  stop) cmd_stop ;;
  restart) cmd_restart ;;
  status) cmd_status ;;
  *)
    echo "usage: $0 start|stop|restart|status" >&2
    exit 2
    ;;
esac
