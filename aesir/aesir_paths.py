#!/usr/bin/env python3
"""Single source of truth for Æsir runtime paths.

Every path can be overridden with an environment variable, so the same
checkout works from /root/zdos-aesir/aesir (legacy VPS layout), /opt/aesir,
or a developer workspace. Defaults are relative to this file.
"""
import os
from pathlib import Path

HOME = Path(os.environ.get("AESIR_HOME") or Path(__file__).resolve().parent)
ENV_FILE = Path(os.environ.get("DSN_ENV") or HOME / "dsn.env")
LOG_DIR = Path(os.environ.get("AESIR_LOG_DIR") or "/var/log/aesir")
SOCK_DIR = Path(os.environ.get("AESIR_SOCK_DIR") or "/var/run/zdos")
POLICY_BIN = Path(os.environ.get("AESIR_POLICY_BIN") or HOME / "policy/target/release/policy_engine")
TORRC = Path(os.environ.get("AESIR_TORRC") or HOME / "nexus/torrc")
STATUS_HOST = os.environ.get("AESIR_STATUS_HOST", "127.0.0.1")
STATUS_PORT = int(os.environ.get("AESIR_STATUS_PORT", "8080"))
