#!/bin/bash
# Avvia Tor (se non attivo) e il servizio hybrid, da qualunque directory.
set -euo pipefail
AESIR_HOME="${AESIR_HOME:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
export AESIR_HOME
SOCK_DIR="${AESIR_SOCK_DIR:-/var/run/zdos}"
LOG_DIR="${AESIR_LOG_DIR:-/var/log/aesir}"
TORRC="${AESIR_TORRC:-$AESIR_HOME/nexus/torrc}"
POLICY_BIN="${AESIR_POLICY_BIN:-$AESIR_HOME/policy/target/release/policy_engine}"

[ -x "$POLICY_BIN" ] || { echo "policy_engine mancante: cargo build --release --manifest-path $AESIR_HOME/policy/Cargo.toml" >&2; exit 1; }
sudo mkdir -p "$SOCK_DIR" "$LOG_DIR" /var/lib/zdos-tor
sudo chown -R "$USER:$USER" "$SOCK_DIR" "$LOG_DIR" || true
if ! pgrep -x tor >/dev/null; then
  sudo tor -f "$TORRC" &
  sleep 2
fi
python3 "$AESIR_HOME/hybrid/hybrid_core.py" &
echo "Æsir + DSN running (AESIR_HOME=$AESIR_HOME)"
echo "Test: echo '{\"asset\":\"ZEPH\",\"amount_atomic\":1000000,\"destination\":\"<DEST>\",\"requester_wallet\":\"<TUO_WALLET>\",\"network_constraints\":[\"tor\"],\"requester\":\"kira\"}' | socat - UNIX-CONNECT:$SOCK_DIR/kira_intent.sock"
