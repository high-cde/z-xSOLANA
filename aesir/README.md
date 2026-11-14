# Æsir — ZDOS Orchestration Layer

Æsir contains components for evaluating transaction intents through a Rust policy engine and a Python orchestration layer. The repository also includes a DSN balance gate, a Tor configuration, and scripts for starting or managing parts of the system.

## Components

| Path | Purpose |
| --- | --- |
| `policy/` | Rust command-line policy engine. It reads one intent as JSON from standard input and writes a JSON decision to standard output. |
| `dsn_gate.py` and `dsn.env` | Python helpers that query a token balance through Polygon JSON-RPC and apply configured DSN thresholds. |
| `hybrid/hybrid_core.py` | Python Unix-socket service that applies the DSN check to non-human requesters, calls the policy engine, and forwards approved intents to a signing socket. |
| `nexus/torrc` | Tor configuration with SOCKS and control ports and a data directory. |
| `status_server.py` | HTTP status handler bound to `127.0.0.1:8080`; it serves status data at `/status`. |
| `scripts/start-aesir.sh` | Shell launcher for Tor and the hybrid process. Its path assumptions are described under [Runtime notes](#runtime-notes). |
| `aesir-advance.sh` | Administrative script that writes service/configuration files and operates on systemd. Review it before use. |

## Policy engine

The policy engine deserializes an intent with these fields: `asset`, `amount_atomic`, `destination`, `network_constraints`, `requester`, and the optional `hourly_limit_override`. The source applies a default amount limit of `500000000` atomic units when no override is provided. An intent is approved only when its amount is within the selected limit and at least one network constraint contains `tor` or `onion`; otherwise it is denied.

Build the policy component from the repository root with Cargo:

```sh
cargo build --release --manifest-path policy/Cargo.toml
```

To send a sample intent directly to the built policy executable:

```sh
printf '%s\n' '{"asset":"ZEPH","amount_atomic":1000000,"destination":"0x0000000000000000000000000000000000000000","network_constraints":["tor"],"requester":"kira"}' \
  | ./policy/target/release/policy_engine
```

This exercises the policy executable only; it does not start the Python service, query DSN, or connect to a signer. The executable prints a JSON decision containing `approved`, `reason`, `token_hash`, and `expires_unix`.

## DSN configuration

**$DSN is official on both chains** (see [`docs/token.md`](docs/token.md)):

| Chain | Standard | Official address | Decimals |
| --- | --- | --- | --- |
| Polygon PoS (137) | ERC-20 | `0xfc90516a1f736FaC557e09D8853dB80dA192c296` | 18 |
| Solana | Token-2022 | `35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4` | 6 |

Optional community asset **VELVET ($OV)**, Solana Token-2022 `2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump` (6 decimals), no yield and no financial promise: off by default (`VELVET_ENABLED=0`); when on, `VELVET_MIN_TOKENS=100000` / `VELVET_HIGH_TOKENS=1000000` (editable).

`DSN_CHAIN` in `dsn.env`: `both` (default), `polygon` or `solana`; empty/unknown = **fail-closed**. A non-human requester passes if **any** of its wallets (`requester_wallet`, `requester_wallets`) meets the threshold of that wallet's chain (`0x…` → Polygon `balanceOf`, base58 → Solana `getTokenAccountsByOwner`, falling back to reading the Token-2022 Associated Token Account with the non-indexed `getAccountInfo`). Thresholds are whole tokens scaled by each chain's decimals and are editable: `DSN_POLYGON_MIN_TOKENS=1`, `DSN_POLYGON_HIGH_TOKENS=10`, `DSN_SOLANA_MIN_TOKENS=1000`, `DSN_SOLANA_HIGH_TOKENS=10000`. The legacy `DSN_MIN_BALANCE_WEI` / `DSN_HIGH_LIMIT_WEI` are still honoured for Polygon when the new keys are absent. Public Solana RPCs rate-limit or refuse indexed calls: point `SOLANA_RPC` at your own RPC for production. The gate never checks the destination.

## Runtime paths

All paths come from `aesir_paths.py` and default to the checkout directory: `AESIR_HOME`, `DSN_ENV`, `AESIR_LOG_DIR` (default `/var/log/aesir`), `AESIR_SOCK_DIR` (`/var/run/zdos`), `AESIR_POLICY_BIN`, `AESIR_TORRC`, `AESIR_STATUS_HOST`/`AESIR_STATUS_PORT` (`127.0.0.1:8080`). The legacy `/root/zdos-aesir/aesir/dsn.env` is still read as a fallback. `scripts/start-aesir.sh` works from any directory. `aesir-advance.sh` is legacy (it rewrites the Python files with the old `/root`, Polygon-only code) and now refuses to run unless `AESIR_ALLOW_LEGACY_OVERWRITE=1`.

## Tests

```sh
cargo test --manifest-path policy/Cargo.toml          # 9 unit tests (policy logic)
cargo build --release --manifest-path policy/Cargo.toml
pip install -r requirements.txt
python3 -m unittest discover -s tests -v               # 26 offline tests (RPC stubbed)
```

## Known limits

- `requester: "human"` is self-declared by the caller and skips the DSN gate; restrict who can write to the socket (mode 0660, group).
- `token_hash` is not a cryptographic token and `expires_unix` is always 0.
- `hourly_limit_override` is a per-intent cap, not a rolling hourly budget.
