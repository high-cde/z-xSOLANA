#!/usr/bin/env bash
# Ricostruisce zlang.wasm dal codice di zlang/src (compiler + vm) e verifica il port di zlangc.
set -euo pipefail
cd "$(dirname "$0")/.."
rustup target add wasm32-unknown-unknown >/dev/null
(cd wasm && cargo build --release --target wasm32-unknown-unknown)
cp wasm/target/wasm32-unknown-unknown/release/zlang_wasm.wasm ide/assets/zlang.wasm
node ide/tests/zlangc-parity.mjs tools/zlangc.py ide/assets/zlangc.js test.zl
sha256sum ide/assets/zlang.wasm
