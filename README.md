# z-xSOLANA

Monorepo privato di ZDOS1.3: launchpad ZDOS, Æsir con K.I.R.A. Guard, zdesk Radar e nodi RPC Solana.
Contiene copie ripulite dei repository di lavoro; i repository originali restano dove sono.

> Proprietario, tutti i diritti riservati: vedi [LICENSE](LICENSE). Copyright (c) 2026 ZDOS1.3.

## Struttura

| Cartella | Cosa contiene | Stato |
| --- | --- | --- |
| `zdos/` | Sistema operativo ZDOS e build della ISO live x86_64 (BusyBox, kernel Debian 6.1). | Build e selftest 25/25 OK. Solo BIOS. |
| `aesir/` | Æsir: policy engine Rust, gate $DSN multi-catena (Polygon + Solana), VELVET opzionale, status server. | 26 test Python + 9 Rust OK. |
| `zlang/` | Linguaggio ZLang: compilatore, VM, CLI. | Pulito. |
| `zdesk/app/` | zdesk (Node/Express), con il tab Radar: X Trust, Token K.I.R.A., News, Watchlist, Staking, Connetti app. | Selftest Radar 8/8. |
| `zdesk/deploy/` | Script di applicazione del Radar v2 con backup e rollback (il pacchetto è in zSWAP). | Pubblicato su zSWAP `deploy-velvet-tg`. |
| `labs/hybrid-prototype/` | Prototipo ibrido Rust/Solana. **Contiene mock**: vedi `MOCKS.md`. | Prototipo, non per produzione. |
| `docs/` | Token, staking, Connetti app, stato build, visibilità dei repo. | |

## Token

**$DSN è ufficiale su entrambe le catene:**
- Polygon PoS (ERC-20, 18 decimali): `0xfc90516a1f736FaC557e09D8853dB80dA192c296`
- Solana (Token-2022, 6 decimali): `35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4`

**VELVET ($OV)**, token community su Solana (Token-2022, 6 decimali): `2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump`.
Nessun rendimento, nessuna promessa finanziaria.

Decisione e uso nel gate: [docs/token.md](docs/token.md).

## Sezioni zdesk
- [Connetti app](docs/connetti-app.md): X e GitHub in sola lettura, Phantom solo connessione (indirizzo pubblico). Nessuna firma, nessuno swap.
- [Staking](docs/staking.md): non custodial, sola lettura (stake nativi, LST JitoSOL/mSOL/bSOL/INF, ricompense). Guida in italiano per Phantom.

## Mock e limiti
- `labs/hybrid-prototype`: runtime ZLang e bridge LLM sono mock dichiarati.
- ISO ZDOS: solo BIOS; l'installer non va mai lanciato su un disco reale senza averlo verificato.
- Stake nativi in zdesk: serve un RPC con `getProgramAccounts` (`ZDESK_SOLANA_RPC`).

Stato dettagliato: [docs/STATUS.md](docs/STATUS.md). Visibilità dei repo esistenti: [docs/repo-visibility.md](docs/repo-visibility.md).
Pagina di stato: https://cursor.com/canvas/store-bae44b23-da65-43f1-849b-512e12685427/a180bcab-5439-4a9a-8896-df6b2549c14f

## Sicurezza
Nessuna chiave o credenziale nel repo (scansione gitleaks prima di ogni push). Le configurazioni con segreti
(nginx, htpasswd, ACCESS.txt, file `.env`) sono escluse da `.gitignore` e restano solo sui server.
