#!/usr/bin/env python3
"""Æsir status endpoint (GET /status), bound to AESIR_STATUS_HOST:AESIR_STATUS_PORT."""
import datetime
import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import aesir_paths  # noqa: E402
from dsn_gate import _cfg  # noqa: E402


def status():
    try:
        log_tail = (aesir_paths.LOG_DIR / "hybrid.log").read_text().splitlines()[-5:]
    except OSError:
        log_tail = []
    running = subprocess.run(["pgrep", "-f", "hybrid_core"], capture_output=True).returncode == 0
    return {
        "hybrid": "running" if running else "stopped",
        "policy_bin": aesir_paths.POLICY_BIN.exists(),
        "dsn_chain": _cfg()["chain"] or "unset",
        "last_logs": log_tail,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/status":
            body = json.dumps(status(), indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    HTTPServer((aesir_paths.STATUS_HOST, aesir_paths.STATUS_PORT), Handler).serve_forever()
