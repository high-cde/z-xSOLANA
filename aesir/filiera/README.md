# ÆSIR · Filiera ZDOS
Pannello admin (sola lettura) che unisce Z-Pool, zBASKET, zAI (zcore-vcpu, grok2, velvet-ai), Sovereign DEX, vBLOCKCHAIN, K.I.R.A., merito/zcomm e tutte le monete.
- `web/` → `x-zdos.it/aesir/` (auth staff esistente)
- `server/` → `aesir-filiera.service` (127.0.0.1:4196), `zbus.mjs` client del bus zcomm
- `miner/` → `zdos-miner.service` (127.0.0.1:4197): ZDOS Miner, lavoro utile al posto di XMRig, sempre attivo, CPU ≤ 25 %
- `patches/vchain-work-root.js` → endpoint locale `POST /api/vchain/work-root` in `/opt/zdos-vblockchain/server.js`
vBLOCKCHAIN è il ledger ZDOS programmabile in Zlang, ancorato su Solana. Piano: [PIANO.md](PIANO.md)
