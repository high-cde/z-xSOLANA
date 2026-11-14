#!/usr/bin/env python3
"""Æsir hybrid core: Unix-socket intent gate (DSN check -> policy engine -> signer socket)."""
import json
import logging
import os
import socket
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, os.environ.get("AESIR_HOME") or str(Path(__file__).resolve().parent.parent))
import aesir_paths  # noqa: E402
from dsn_gate import get_limit_for, has_min_dsn  # noqa: E402

log = logging.getLogger("aesir")

KIRA_SOCK = aesir_paths.SOCK_DIR / "kira_intent.sock"
SIGN_SOCK = aesir_paths.SOCK_DIR / "sign.sock"
POLICY_BIN = aesir_paths.POLICY_BIN


def setup_logging():
    aesir_paths.LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(filename=str(aesir_paths.LOG_DIR / "hybrid.log"), level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(message)s")


def ensure_sockets():
    aesir_paths.SOCK_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(aesir_paths.SOCK_DIR, 0o770)
    # Only our own listening socket is recreated; sign.sock belongs to the signer.
    if KIRA_SOCK.exists():
        KIRA_SOCK.unlink()


def call_policy_engine(intent):
    if POLICY_BIN.exists():
        proc = subprocess.run([str(POLICY_BIN)], input=json.dumps(intent).encode(), capture_output=True, timeout=5)
        if proc.returncode == 0:
            return json.loads(proc.stdout.decode())
    return {"approved": False, "reason": "policy_engine unavailable"}


def forward_to_sign(approval, intent):
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
            s.connect(str(SIGN_SOCK))
            s.send(json.dumps({"approval": approval, "intent": intent}).encode())
    except Exception as e:
        log.warning(f"sign forward failed: {e}")


def handle_intent(intent, policy=call_policy_engine, sign=forward_to_sign):
    """Pure decision path (testable). The DSN gate checks the REQUESTER's wallet,
    never the destination: gating on the destination let anyone borrow a rich
    wallet's balance by sending to it."""
    wallets = [w for w in ([intent.get("requester_wallet")] + list(intent.get("requester_wallets") or [])) if w]
    wallet = ",".join(wallets)
    if intent.get("requester") != "human":
        if not wallets:
            log.info("DENIED missing requester_wallet")
            return {"approved": False, "reason": "requester_wallet required"}
        # passes if ANY of the requester's wallets holds enough on its chain
        if not has_min_dsn(wallets):
            log.info(f"DENIED {wallet}")
            return {"approved": False, "reason": "Insufficient DSN"}
        intent["hourly_limit_override"] = get_limit_for(wallets)
    log.info(f"Intent from {wallet or 'human'} amount={intent.get('amount_atomic')}")
    result = policy(intent)
    if result.get("approved"):
        sign(result, intent)
        log.info(f"APPROVED {wallet or 'human'}")
    else:
        log.info(f"POLICY_DENIED {wallet or 'human'} {result.get('reason')}")
    return result


def listen_intent():
    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    sock.bind(str(KIRA_SOCK))
    os.chmod(KIRA_SOCK, 0o660)
    sock.listen(1)
    log.info("Hybrid listening (DSN + logging)")
    print(f"[hybrid] Listening on {KIRA_SOCK}")
    while True:
        conn, _ = sock.accept()
        try:
            result = handle_intent(json.loads(conn.recv(8192).decode()))
        except Exception as e:
            log.error(f"Error: {e}")
            result = {"approved": False, "reason": str(e)}
        conn.send(json.dumps(result).encode())
        conn.close()


if __name__ == "__main__":
    setup_logging()
    ensure_sockets()
    listen_intent()
