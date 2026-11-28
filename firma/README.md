# Firma ZDOS / OurVelvet v1
server/server.mjs (Node, tweetnacl+bs58, 127.0.0.1:8905) · web/ (verifica + firma.js/badge.js/css) · nginx-zdos-firma.conf · zdos-firma.service
Test: `node server/test-e2e.mjs https://x-zdos.it x-zdos.it` (24 controlli e2e + test-message-ascii.mjs) · `python3 browser-test.py` (wallet simulato) · `python3 shot.py`
Rollback sul VPS: /var/backups/firma/20261128-0224/rollback.sh

2026-11-28: statement SIWS in ASCII stampabile (Phantom mobile: invalid formatting su ·/è). Rollback: /var/backups/login-fix/<ts>/rollback.sh
