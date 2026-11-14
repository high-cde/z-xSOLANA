#!/usr/bin/env python3
"""DSN balance gate for Æsir: multi-chain, read-only.

Access layer only: balance reads over JSON-RPC, no keys, no transactions.

$DSN is official on BOTH chains (decision recorded in docs/token.md):
  Polygon PoS  ERC-20      0xfc90516a1f736FaC557e09D8853dB80dA192c296  18 decimals
  Solana       Token-2022  35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4  6 decimals

DSN_CHAIN selects which chains count:
  both (default in dsn.env) | polygon | solana
Unset or unknown => FAIL CLOSED (balance 0, non-human intents denied).

Each wallet is checked on the chain its format belongs to (0x... -> Polygon,
base58 -> Solana). Optionally (VELVET_ENABLED=1) VELVET ($OV, Solana Token-2022
2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump, 6 decimals) also counts; it is a
community token with no yield and no financial promise, and is OFF by default.
A requester passes if ANY of its wallets meets that chain's
threshold. Thresholds are in whole tokens and scaled by each token's decimals.
"""
import os
import re
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
import aesir_paths  # noqa: E402
import solana_ata  # noqa: E402

_LEGACY_ENV = Path("/root/zdos-aesir/aesir/dsn.env")
_EVM_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
_B58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
CHAINS = ("polygon", "solana")


def _readable(p: Path) -> bool:
    try:
        return p.is_file() and os.access(p, os.R_OK)
    except OSError:
        return False


def load_env(path=None):
    p = Path(path) if path else aesir_paths.ENV_FILE
    if not _readable(p) and _readable(_LEGACY_ENV):
        p = _LEGACY_ENV
    if _readable(p):
        for line in p.read_text().splitlines():
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
    return p


load_env()


def _tokens_to_units(env_tokens, default_tokens, decimals, legacy_units_env=None):
    if legacy_units_env and os.getenv(legacy_units_env) and not os.getenv(env_tokens):
        return int(os.getenv(legacy_units_env))  # old *_WEI keys still honoured (Polygon)
    whole = os.getenv(env_tokens, default_tokens)
    from decimal import Decimal
    return int(Decimal(whole) * (10 ** decimals))


def _cfg():
    chain = os.getenv("DSN_CHAIN", "").strip().lower()
    active = {"both": CHAINS, "polygon": ("polygon",), "solana": ("solana",)}.get(chain, ())
    pdec = int(os.getenv("DSN_POLYGON_DECIMALS", os.getenv("DSN_DECIMALS", "18")))
    sdec = int(os.getenv("DSN_SOLANA_DECIMALS", "6"))
    return {
        "chain": chain, "active": active,
        "polygon": {
            "contract": os.getenv("DSN_CONTRACT", "").strip(),
            "chain_id": int(os.getenv("DSN_CHAIN_ID", "137")),
            "rpcs": [u for u in dict.fromkeys([os.getenv("POLYGON_RPC", ""), os.getenv("POLYGON_RPC_FALLBACK", "")]) if u],
            "decimals": pdec,
            "min": _tokens_to_units("DSN_POLYGON_MIN_TOKENS", "1", pdec, "DSN_MIN_BALANCE_WEI"),
            "high": _tokens_to_units("DSN_POLYGON_HIGH_TOKENS", "10", pdec, "DSN_HIGH_LIMIT_WEI"),
        },
        "solana": {
            "mint": os.getenv("DSN_SOLANA_MINT", "").strip(),
            "token_program": os.getenv("DSN_SOLANA_TOKEN_PROGRAM", solana_ata.TOKEN_2022_PROGRAM),
            "rpcs": [u for u in dict.fromkeys([os.getenv("SOLANA_RPC", ""), os.getenv("SOLANA_RPC_FALLBACK", "")]) if u],
            "decimals": sdec,
            "min": _tokens_to_units("DSN_SOLANA_MIN_TOKENS", "1000", sdec),
            "high": _tokens_to_units("DSN_SOLANA_HIGH_TOKENS", "10000", sdec),
        },
        # VELVET ($OV): optional community token, no yield, no financial promise.
        # OFF by default: the gate is a $DSN access layer; enable explicitly.
        "velvet": {
            "enabled": os.getenv("VELVET_ENABLED", "0").strip().lower() in ("1", "true", "yes", "on"),
            "mint": os.getenv("VELVET_MINT", "2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump").strip(),
            "token_program": os.getenv("VELVET_TOKEN_PROGRAM", solana_ata.TOKEN_2022_PROGRAM),
            "decimals": int(os.getenv("VELVET_DECIMALS", "6")),
            "min": _tokens_to_units("VELVET_MIN_TOKENS", "100000", int(os.getenv("VELVET_DECIMALS", "6"))),
            "high": _tokens_to_units("VELVET_HIGH_TOKENS", "1000000", int(os.getenv("VELVET_DECIMALS", "6"))),
        },
        "base_limit": int(os.getenv("DSN_HOURLY_BASE", "500000000")),
        "boost_limit": int(os.getenv("DSN_HOURLY_BOOSTED", "5000000000")),
    }


class RPCError(Exception):
    pass


def _call(rpc, method, params):
    r = requests.post(rpc, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=6)
    r.raise_for_status()
    body = r.json()
    # A JSON-RPC error must NOT be read as "balance 0": try the next endpoint.
    if not isinstance(body, dict) or "error" in body or "result" not in body:
        raise RPCError(f"{rpc}: {body.get('error') if isinstance(body, dict) else body}")
    return body["result"]


_CHAIN_OK = {}


def chain_of(address: str):
    if isinstance(address, str) and _EVM_RE.match(address):
        return "polygon"
    if isinstance(address, str) and _B58_RE.match(address):
        return "solana"
    return None


def _polygon_balance(address, c):
    if not _EVM_RE.match(c["contract"]):
        return 0
    data = "0x70a08231" + address[2:].lower().zfill(64)
    for rpc in c["rpcs"]:
        if rpc not in _CHAIN_OK:
            try:
                _CHAIN_OK[rpc] = int(_call(rpc, "eth_chainId", []), 16) == c["chain_id"]
            except Exception:
                continue
        if not _CHAIN_OK[rpc]:
            continue
        try:
            return int(_call(rpc, "eth_call", [{"to": c["contract"], "data": data}, "latest"]), 16)
        except Exception:
            continue
    return 0


def _spl_balance(owner, mint, token_program, rpcs):
    """Base-unit balance of an SPL / Token-2022 mint held by owner; 0 on failure (fail-closed)."""
    if not _B58_RE.match(mint or ""):
        return 0
    for rpc in rpcs:
        # 1) indexed call: sums every token account of the owner for this mint
        try:
            res = _call(rpc, "getTokenAccountsByOwner", [owner, {"mint": mint}, {"encoding": "jsonParsed"}])
            return sum(int(a["account"]["data"]["parsed"]["info"]["tokenAmount"]["amount"]) for a in res.get("value", []))
        except Exception:
            pass
        # 2) non-indexed fallback: read the owner's Associated Token Account directly
        try:
            ata = solana_ata.associated_token_address(owner, mint, token_program)
            res = _call(rpc, "getAccountInfo", [ata, {"encoding": "jsonParsed"}])
            v = res.get("value")
            if v is None:
                return 0  # no ATA => holds nothing there
            info = v["data"]["parsed"]["info"]
            if info.get("mint") != mint or info.get("owner") != owner:
                continue
            return int(info["tokenAmount"]["amount"])
        except Exception:
            continue
    return 0


def _solana_balance(owner, c):
    return _spl_balance(owner, c["mint"], c["token_program"], c["rpcs"])


def balance_on(chain, address):
    c = _cfg()
    if chain not in c["active"] or chain_of(address) != chain:
        return 0
    return _polygon_balance(address, c["polygon"]) if chain == "polygon" else _solana_balance(address, c["solana"])


def _wallets(addresses):
    if isinstance(addresses, str):
        return [addresses]
    return [a for a in (addresses or []) if isinstance(a, str)]


def balances(addresses) -> dict:
    """{wallet: (chain, balance_in_base_units)} for every wallet on an active chain."""
    out = {}
    for w in _wallets(addresses):
        ch = chain_of(w)
        out[w] = (ch, balance_on(ch, w) if ch else 0)
    return out


def get_balance(address: str) -> int:
    """Base-unit balance of one wallet on its own chain; 0 if inactive/malformed/RPC down (fail-closed)."""
    ch = chain_of(address)
    return balance_on(ch, address) if ch else 0


def velvet_balance(address) -> int:
    """VELVET ($OV) base units for a Solana wallet; 0 when VELVET is disabled."""
    c = _cfg()
    v = c["velvet"]
    if not v["enabled"] or chain_of(address) != "solana":
        return 0
    return _spl_balance(address, v["mint"], v["token_program"], c["solana"]["rpcs"])


def _level(bal, t):
    return 2 if bal >= t["high"] else 1 if bal >= t["min"] else 0


def _tier(addresses) -> int:
    """0 = below threshold, 1 = base, 2 = boosted; best tier across wallets, chains and assets."""
    c = _cfg()
    best = 0
    for w, (ch, bal) in balances(addresses).items():
        if ch in c["active"]:
            best = max(best, _level(bal, c[ch]))
        if c["velvet"]["enabled"] and ch == "solana" and best < 2:
            best = max(best, _level(velvet_balance(w), c["velvet"]))
    return best


def has_min_dsn(addresses, min_wei=None) -> bool:
    if min_wei is not None:  # legacy single-threshold call
        return any(bal >= min_wei for _, bal in balances(addresses).values())
    return _tier(addresses) >= 1


def get_limit_for(addresses) -> int:
    c = _cfg()
    return {2: c["boost_limit"], 1: c["base_limit"]}.get(_tier(addresses), 0)


if __name__ == "__main__":
    c = _cfg()
    print({"chain": c["chain"] or "UNSET (fail-closed)", "active": list(c["active"]),
           "polygon": {k: c["polygon"][k] for k in ("contract", "decimals", "min", "high")},
           "solana": {k: c["solana"][k] for k in ("mint", "decimals", "min", "high")},
           "velvet": {k: c["velvet"][k] for k in ("enabled", "mint", "decimals", "min", "high")}})
