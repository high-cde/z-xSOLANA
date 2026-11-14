#!/usr/bin/env python3
"""Helper callable from ZLang or scripts: prints the DSN gate result as JSON."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dsn_gate import _cfg, balances, has_min_dsn, get_limit_for  # noqa: E402

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: zlang_dsn_helper.py <wallet> [<wallet> ...]   (0x... = Polygon, base58 = Solana)")
        sys.exit(1)
    ws = sys.argv[1:]
    print(json.dumps({"mode": _cfg()["chain"] or None,
                      "wallets": {w: {"chain": ch, "balance": b} for w, (ch, b) in balances(ws).items()},
                      "has_min": has_min_dsn(ws), "hourly_limit": get_limit_for(ws)}))
