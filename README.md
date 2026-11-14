# z-xSOLANA

Monorepo privato di **ZDOS1.3** (P.IVA 11040550961).

z-xSOLANA raccoglie il sistema ZDOS, Æsir, ZLang, il desk Radar e la documentazione di progetto. Il launchpad con K.I.R.A. Guard è per ora solo un piano. I nodi Solana sono pianificati: l'approccio previsto è un proxy RPC privato, non un full-node su VPS.

> Licenza proprietaria ZSEL-1.0, tutti i diritti riservati: [LICENSE](LICENSE) e [NOTICE](NOTICE). Copyright (c) 2026 ZDOS1.3.

## Struttura

| Cartella | Cosa contiene | Stato |
| --- | --- | --- |
| `zdos/` | Sistema operativo ZDOS e build della ISO live x86_64 (BusyBox, kernel Debian 6.1). | Build e selftest 25/25 OK. Solo BIOS. L'installer su disco reale non è stato provato. |
| `aesir/` | Æsir: policy engine Rust, gate $DSN su Polygon e Solana, VELVET opzionale, status server. | 26 test Python + 9 Rust OK. |
| `zlang/` | Linguaggio ZLang: compilatore, VM, CLI. | Pulito. |
| `zdesk/app/` | zdesk (Node/Express) con il tab Radar v2.1: X Trust, Token K.I.R.A., News, Watchlist, Staking, Connetti app. Include la correzione del mint $DSN. | Selftest Radar OK. Applicato sul VPS il 14/11/2026 alle 15:09 (ora di Roma), ESITO OK. |
| `zdesk/deploy/` | Script `applica-radar.sh` v2.1, checksum e istruzioni. Il tar del pacchetto sta su zSWAP, branch `deploy-velvet-tg`. I repo sono privati: il download passa dall'API GitHub con un token in sola lettura. | Applicato sul VPS (sha `39c4785f…` / `69a577c2…`). |
| `labs/hybrid-prototype/` | Prototipo ibrido Rust/Solana. **Contiene mock**: vedi `MOCKS.md`. | Prototipo, non per produzione. |
| `docs/` | Token, staking, Connetti app, stato, visibilità dei repo. | |

## Token

**$DSN è ufficiale su entrambe le catene:**

- Polygon PoS (ERC-20, 18 decimali): `0xfc90516a1f736FaC557e09D8853dB80dA192c296`
- Solana (Token-2022, 6 decimali): `35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4`

`EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump` è **xZDOS pump.fun (legacy, non $DSN ufficiale)**. Resta in watchlist con questa etichetta.

**VELVET ($OV)**, token community su Solana (Token-2022, 6 decimali): `2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump`.
Nessun rendimento, nessuna promessa finanziaria.

Dettaglio e uso nel gate: [docs/token.md](docs/token.md).

## Sezioni zdesk

- [Connetti app](docs/connetti-app.md): X (solo handle nel browser e link al profilo pubblico; niente OAuth), GitHub (stato pubblico in sola lettura), Phantom (solo indirizzo pubblico). Nessuna firma, nessuno swap.
- [Staking](docs/staking.md): non custodial, sola lettura (stake nativi, LST JitoSOL/mSOL/bSOL/INF, ricompense). Guida in italiano per Phantom.

## Cosa non è ancora nel codice

- Launchpad ZDOS con K.I.R.A. Guard: solo piano, in una Page di progetto.
- Nodi Solana: non in esercizio; previsti come proxy RPC.
- Agente che guida il Radar: non creato.

## Mock e limiti

- `labs/hybrid-prototype`: runtime ZLang e bridge LLM sono mock dichiarati; un test fallisce per questo.
- ISO ZDOS: solo BIOS; l'installer non va mai lanciato su un disco reale senza averlo verificato.
- Stake nativi in zdesk: serve un RPC con `getProgramAccounts` (`ZDESK_SOLANA_RPC`).
- I repository high-cde sono privati; i siti GitHub Pages non sono attivi. I siti sul VPS (https://x-zdos.it e gli altri host x-zdos.it) non dipendono da GitHub Pages.

Stato dettagliato: [docs/STATUS.md](docs/STATUS.md). Visibilità: [docs/repo-visibility.md](docs/repo-visibility.md).

## Sicurezza

Nessuna chiave o credenziale nel repo (scansione gitleaks prima di ogni push). Le configurazioni con segreti
(nginx, htpasswd, ACCESS.txt, file `.env`) sono escluse da `.gitignore` e restano solo sui server.
`zdesk/app/scripts/sync-desk.sh` richiede `ZDESK_SSH_HOST` e non contiene un indirizzo di server.
