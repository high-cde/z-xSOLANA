# Bot Discord z-xSOLANA (zdiscord)

© 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria (vedi `../LICENSE`).

discord.js v14, Node ≥ 20. Usa solo l'intent `Guilds`: niente intent privilegiati, niente lettura dei messaggi. Risponde solo ai comandi slash, nel canale dove vengono usati: nessun post automatico, nessuno scraping, nessun airdrop.

## Comandi
| Comando | Cosa fa |
|---|---|
| `/kira <mint>` | Controlli K.I.R.A. reali (stesso modulo di zRoute, `src/kira-core.js`) |
| `/stato` | Stato HTTP di ZSwap, zRoute, ZQuest, Velvet, IDE e x-zdos.it, più `/api/health` di zdesk in locale |
| `/token` | $DSN (Solana e Polygon) e VELVET, con link a Solscan, DexScreener e Polygonscan; prezzo VELVET preso da DexScreener |
| `/radar` | Ultimi segnali da `/api/radar` di zdesk in locale, in sola lettura (risposta visibile solo a chi lo usa) |
| `/verifica` | Link monouso a https://x-zdos.it/discord/verify/: firmi un messaggio con Phantom (`signMessage`), il server verifica la firma ed25519 e assegna "Holder $DSN" e/o "Holder VELVET" se il saldo è maggiore di zero |
| `/quest` | Link a ZQuest |

La verifica non chiede nessuna transazione e non dà nessun accesso ai fondi. Il nonce è monouso e scade dopo 10 minuti, e il wallet non viene salvato.

## Sul server
- Servizio systemd `zdiscord` (utente `zdiscord`), con l'API di verifica su `127.0.0.1:8790`. nginx espone `/discord/api/` e la pagina statica `/discord/verify/` su x-zdos.it.
- Il token sta solo in `/etc/zdiscord/bot.env` (640, root:zdiscord) e non entra mai nel repo.
- Prima attivazione: `bash /opt/zdiscord/setup-token.sh`. Lo script:
  1. chiede token e Application ID con `read -s`;
  2. scrive il file env;
  3. registra i comandi;
  4. abilita e avvia il servizio;
  5. stampa il link di invito.

  Permessi del link: Gestire i ruoli, Inviare messaggi, Incorporare link, Usare i comandi delle applicazioni (`2415937536`).
- Dopo l'invito, il ruolo del bot va trascinato sopra i ruoli holder, altrimenti Discord non gli permette di assegnarli.

## Test
`npm test`: test unitari offline, senza token. Coprono:
- logica dei comandi;
- K.I.R.A. con dati simulati;
- ed25519 e base58;
- nonce monouso e con scadenza;
- API HTTP di verifica.
