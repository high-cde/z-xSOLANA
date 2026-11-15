# Bot Discord z-xSOLANA (zdiscord)

© 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria (vedi `../LICENSE`).

discord.js v14, Node ≥ 20. Usa l'intent `Guilds` e, solo se attivo nel Developer Portal, `Server Members` (per l'anti-raid; il bot lo rileva da solo all'avvio, senza rischiare un login rifiutato). Niente lettura del contenuto dei messaggi. Risponde ai comandi slash e ai pulsanti. Gli unici post automatici sono gli eventi pubblici di VelvetHub (relay, vedi sotto). Nessuno scraping, nessun airdrop, nessun post su X.

## Comandi
| Comando | Cosa fa |
|---|---|
| `/kira <mint>` | Controlli K.I.R.A. reali (stesso modulo di zRoute, `src/kira-core.js`) |
| `/stato` | Stato HTTP di ZSwap, zRoute, ZQuest, Velvet, IDE e x-zdos.it, più `/api/health` di zdesk in locale |
| `/token` | $DSN (Solana e Polygon) e VELVET, con link a Solscan, DexScreener e Polygonscan; prezzo VELVET preso da DexScreener |
| `/radar` | Ultimi segnali da `/api/radar` di zdesk in locale, in sola lettura (risposta visibile solo a chi lo usa) |
| `/verifica` | Link monouso a https://x-zdos.it/discord/verify/: firmi un messaggio con Phantom (`signMessage`), il server verifica la firma ed25519 e assegna "Holder $DSN" e/o "Holder VELVET" se il saldo è maggiore di zero |
| `/quest` | Link a ZQuest |
| `/setup-server anteprima` / `applica` | Solo owner o Administrator. Crea o riordina ruoli, categorie e canali (vedi `src/club.js`), è idempotente e non cancella niente. Le categorie esistenti restano intatte sotto la nuova struttura (con `archivia_vecchie:True` vengono rinominate con 🗄️), i canali senza categoria vanno in 🗄️ ARCHIVIO. Pubblica il messaggio di ingresso con i pulsanti in #ingresso-18 e le regole in #regole-18, più i messaggi guida fissati (`src/guides.js`) in #benvenuto, #regole, #annunci, #info, #zroute, #ide, #zquest, #holder-lounge, #verifica-accesso: uno per canale, aggiornato se cambia, mai duplicato. Crea/aggiorna 5 regole AutoMod native con prefisso `ZDOS · ` (anti-spam, menzioni di massa, link esterni con whitelist, Telegram solo t.me/OurVelvetHub, frasi truffa; avvisi in #mod-log) e prepara la quarantena anti-raid (ruolo **In verifica**). L'anteprima elenca anche queste modifiche e segnala i permessi mancanti invece di fallire |
| `/rubina messaggio` | Rubina (IA, Ollama tramite `/api/rubina/chat` con `mode: "discord"`): flirt e conversazione, niente contenuti espliciti. Risponde solo nei canali 18+ della 18+ ROOM e del Velvet Club e solo a chi ha Verificato 18+; altrove dà un messaggio neutro. ROSSO la ferma e la silenzia per 60 minuti (`riprendi:True` per ripartire). Limiti: 1 messaggio ogni 20 s, 15 all'ora. Le conversazioni restano solo in memoria |
| `/velvet` | Mini app, Radar della Carne, categorie, ruoli e regole |
| `/ingresso-18` | Pulsante di ingresso: data di nascita (non salvata) + "ACCETTO" → ruolo Verificato 18+. Chi risulta minorenne è bloccato per 24 ore |
| `/curioso` | Prende o toglie il ruolo Curioso (serve Verificato 18+) |
| `/radar-collega` / `/radar-scollega` | Collega un profilo del Radar della Carne: Mistress/Master con handle + token di gestione, Fedele con id + token. Il token non viene salvato. Ogni 30 minuti il bot ricontrolla e toglie il ruolo se il profilo è stato cancellato o nascosto |

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

  Permessi del link (`2251802229722160`, senza Administrator): quelli di base (`2416036880`) più **Gestire il server** (solo per le regole AutoMod) e **Fissare i messaggi** (solo per i messaggi guida). Quelli di base: Gestire canali, Vedere canali, Inviare messaggi, Incorporare link, Allegare file, Leggere la cronologia, Gestire i ruoli, Usare i comandi delle applicazioni. Allegare file e Leggere la cronologia servono perché Discord permette al bot di impostare negli override solo i permessi che ha anche lui.
- Dopo l'invito, il ruolo del bot va trascinato sopra i ruoli holder, altrimenti Discord non gli permette di assegnarli.

## Relay eventi VelvetHub
Ogni 60 s il bot legge `GET /api/events/feed` di OurVelvet (127.0.0.1:8000). Pubblica in #velvet-eventi e/o #annunci dei server dove è stato fatto `/setup-server applica`, a partire dall'evento successivo al setup, e manda la bozza X (link intent) nel canale privato #bozze-x. Su X non pubblica mai. Lo stato sta in `/var/lib/zdiscord/state.json` (systemd `StateDirectory`): id dei messaggi fissi, cursore per server, collegamenti Radar (tipo e riferimento, mai token).

## Test
`npm test`: test unitari offline, senza token. Coprono:
- logica dei comandi;
- K.I.R.A. con dati simulati;
- ed25519 e base58;
- nonce monouso e con scadenza;
- API HTTP di verifica.

## Moderazione automatica e anti-raid

- **AutoMod nativo** (serve *Gestire il server*): regole `ZDOS · anti-spam`, `ZDOS · menzioni di massa` (max 5, protezione raid di menzioni), `ZDOS · link esterni` (bloccati tutti i link http/https tranne x-zdos.it, discord.com/.gg, discordapp.com, discord.media, solscan.io, polygonscan.com, jup.ag, t.me/telegram.me), `ZDOS · Telegram solo ufficiale` (solo t.me/OurVelvetHub), `ZDOS · frasi truffa`. Admin e chi ha *Gestire il server* sono esentati da Discord. Le regole di altri bot non vengono toccate.
- **Anti-raid lato bot** (serve l'intent *Server Members* nel Developer Portal): chi entra con un account più giovane di `MIN_ACCOUNT_DAYS` (7) riceve il ruolo **In verifica** e vede solo #verifica-accesso; si sblocca da solo quando l'account raggiunge l'età minima o con il pulsante *Approva* in #mod-log (staff con *Gestire i ruoli*). Con `RAID_JOINS` (8) ingressi in `RAID_WINDOW_S` (60) secondi scatta la modalità raid per `RAID_MINUTES` (15): tutti i nuovi ingressi vanno in verifica e servono l'approvazione dello staff. Log in #mod-log.

## Airdrop VELVET e invito pubblico

- `/setup-server` crea la categoria **🎁 AIRDROP VELVET** con #airdrop-velvet (sola lettura, messaggio fisso con periodo 15/12/2026–24/03/2027, massimo 100 wallet, 20.000 VELVET ($OV) ciascuno, requisiti: risposta al post su X, quest su https://quest.x-zdos.it, ruolo verificato su Discord) e #airdrop-domande. Nessuna promessa di guadagno, DYOR, nota anti-truffa (lo staff non scrive mai in DM per primo), link solo x-zdos.it.
- Il ruolo che conta come verificato si indica con `AIRDROP_VERIFIED_ROLE` in `config.env` (solo testo). Finché è vuoto il messaggio mostra "DA COMUNICARE". Il bot **non crea né assegna** ruoli airdrop.
- Invito pubblico permanente (max_age 0, usi illimitati) su #benvenuto: riusa quello salvato in `state.json`, poi un invito permanente già presente sul canale, altrimenti ne crea uno. Mostrato in anteprima, loggato in #log-bot e nel journal all'applicazione.

## Applicare dal terminale del VPS

Il bot in esecuzione apre un socket locale `/var/lib/zdiscord/admin.sock` (Unix, 0600, non esposto da nginx). Lo script usa la stessa logica del comando slash, con lo stato e la connessione del servizio:

```
node /opt/zdiscord/scripts/apply.js --dry-run          # anteprima, non cambia nulla
node /opt/zdiscord/scripts/apply.js --apply            # chiede di scrivere APPLICA
node /opt/zdiscord/scripts/apply.js --apply --yes      # non interattivo (SSH)
# opzioni: --guild <id>  --archive-old  --json
```
