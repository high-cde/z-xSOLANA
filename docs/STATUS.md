# Stato build (verificato il 14/11/2026, ora di Roma)

| Componente | Esito | Dettagli |
| --- | --- | --- |
| ZDOS live ISO | OK | `distro/build.sh` in 30,7 s; ISO 29.808.640 byte, sha256 `4d3df765ecfa39280b0c838d97c0db3612b94ded104ff35ed725ddae5060829a`. Kernel Debian 6.1.0-50, BusyBox. Solo BIOS (El Torito), niente UEFI. Build non riproducibile bit per bit. L'ISO non è nel repo. |
| ZDOS selftest | 25/25 PASS | `tools/zdos-selftest.sh --all --strict` in QEMU (TCG) + shell seriale interattiva (`uid=1000(zdos)`). |
| ZDOS installer BIOS | Non testato | Mai eseguito su un disco reale. Il kernel della macchina di test non ha iso9660. |
| Æsir | OK | 26 test Python (gate $DSN multi-catena, VELVET opzionale, ATA fallback) + 9 test Rust (policy). |
| zdesk Radar v2 | OK | Selftest offline 8/8 (`scripts/radar-staking-selftest.js`), endpoint `/api/radar`, `/api/connect`, `/api/staking/:address`, `/api/copytrader`, `/api/health` 200 in locale. `scripts/ninja-selftest.js` fallisce già nel codice originale (non dipende dal Radar). |
| ZLang | Pulito | Rimossi 3 backup tar identici da 80 MB. |
| labs/hybrid-prototype | Prototipo, compila | Il runtime ZLang e il bridge LLM sono **mock** (vedi `labs/hybrid-prototype/MOCKS.md`). 1 test fallisce (`cortex policy::tests::zlang_policy_allows_non_null_block`) proprio perché il runtime è un mock; `organism-bin` va in panic sul parser. |

## Deploy zdesk Radar v2
Pacchetto in `high-cde/zSWAP`, branch `deploy-velvet-tg`, cartella `deploy-zdesk-radar/` (vedi `zdesk/deploy/README.md`).

| File | sha256 |
| --- | --- |
| zdesk-radar.tar.gz | `a150694221ba0de6eb5ae0a31c9d19a5413be4b171e1b5fbe1f388c38305fcf2` |
| applica-radar.sh | `7b5e342f3b4d24f0ddfbe81b28b48431a37152530cddeec2475631579fa427e8` |
