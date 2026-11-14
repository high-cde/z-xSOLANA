# Stato (verificato il 14/11/2026, ora di Roma)

| Componente | Esito | Dettagli |
| --- | --- | --- |
| ZDOS live ISO | OK | `distro/build.sh` in 30,7 s; ISO 29.808.640 byte, sha256 `4d3df765ecfa39280b0c838d97c0db3612b94ded104ff35ed725ddae5060829a`. Kernel Debian 6.1.0-50, BusyBox. Solo BIOS (El Torito), niente UEFI. Build non riproducibile bit per bit. L'ISO non è nel repo. |
| ZDOS selftest | 25/25 PASS | `tools/zdos-selftest.sh --all --strict` in QEMU (TCG) + shell seriale interattiva (`uid=1000(zdos)`). |
| ZDOS installer BIOS | Non testato | Mai eseguito su un disco reale. Il kernel della macchina di test non ha iso9660. |
| Æsir | OK | 26 test Python (gate $DSN multi-catena, VELVET opzionale, ATA fallback) + 9 test Rust (policy). |
| zdesk Radar v2.1 | OK in locale e sul VPS | Selftest offline (`scripts/radar-staking-selftest.js`, incluso il controllo mint $DSN / xZDOS legacy). Endpoint `/api/radar`, `/api/connect`, `/api/staking/:address`, `/api/copytrader`, `/api/health` 200 in locale. Sul VPS applicato il 14/11/2026 alle 15:09 (ora di Roma): ESITO OK (health, radar, connect, staking, watchlist, token $DSN, copytrader e ninja). `scripts/ninja-selftest.js` falliva già nel codice originale (non dipende dal Radar). |
| Launchpad ZDOS + K.I.R.A. Guard | Solo piano | Non c'è codice di launchpad in questo monorepo. |
| Nodi Solana | Pianificati | Non sono in esercizio. L'approccio previsto è un proxy RPC privato davanti a un fornitore, non un validator o un RPC full-node su VPS. |
| ZLang | Pulito | Rimossi 3 backup tar identici da 80 MB. |
| labs/hybrid-prototype | Prototipo, compila | Il runtime ZLang e il bridge LLM sono **mock** (vedi `labs/hybrid-prototype/MOCKS.md`). 1 test fallisce (`cortex policy::tests::zlang_policy_allows_non_null_block`) proprio perché il runtime è un mock; `organism-bin` va in panic sul parser. |
| Agente direttore del Radar | Non creato | Esiste solo la specifica nella Page di stato. |

## Deploy zdesk Radar v2.1 sul VPS

Applicato il **14/11/2026 alle 15:09 (ora di Roma)**, esito **ESITO OK**.
Backup sul VPS: `/var/backups/zdesk/zdesk-pre-radar21-20261114-150900.tar.gz`.
Rollback: `bash /var/backups/zdesk/rollback-radar21-20261114-150900.sh`.

Pacchetto in `high-cde/zSWAP`, branch `deploy-velvet-tg`, cartella `deploy-zdesk-radar/` (copia dello script e dei checksum anche in `zdesk/deploy/`).
I repository high-cde sono privati: il download da raw.githubusercontent.com non funziona. Si usa l'API GitHub con un token fine-grained in sola lettura (Contents: Read, solo zSWAP), inserito con `read -s`.

| File | sha256 |
| --- | --- |
| zdesk-radar.tar.gz | `39c4785f0f0e9bb08728f47e32ba9bd2fcab4fd381b62dd296cfc7bf534902d9` |
| applica-radar.sh | `69a577c22f9cd2e229c3329799109433d31883401cb2472072f7040a64cba4be` |

Esiste anche `deploy-zdesk-dsnmint/` sullo stesso branch: corregge solo il mint $DSN, senza installare il Radar. Sul VPS non è stato necessario, perché la v2.1 include già quella correzione.
