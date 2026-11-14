# ZDESK — pannello admin ZDOS (sola lettura)

Dashboard **locale**, **single-user**, **sola lettura**, ispirata alle funzioni
di un terminale tipo GMGN (trending, rug check, watchlist, sfera predittiva,
tracker wallet, copy-trader PAPER, titoli tokenizzati in solo watch).

Non è un clone di GMGN, non chiama l'API GMGN (Cloudflare 403) e **non esegue
trade**. Nessun invio on-chain. L'accesso X è facoltativo, in sola lettura, e
non conserva token sul server.

## Avvio (solo sul box)

```bash
cd zdesk   # cartella del progetto
npm start
```

Si mette in ascolto su **http://127.0.0.1:8787** (non è esposta all'esterno).

Variabili opzionali:

- `HOST` (default `127.0.0.1`)
- `PORT` (default `8787`)
- `DESK_DIR` (cartella dei file desk sincronizzati in sola lettura)
- `ZDESK_AGENT_WALLET` (indirizzo pubblico del wallet agente; in questa copia non è scritto nel codice)
- `ZDESK_PRIVATE_ADDRS` (facoltativa: altri indirizzi da mascherare nelle risposte, separati da virgola)

Per fermarla: `kill $(cat zdesk.pid)` se avviata in background con lo script
di run. Sul VPS gira come servizio systemd `zdesk`.

### Demone Ninja (auto-start con supervisor)

```bash
scripts/ninja-ctl.sh start
scripts/ninja-ctl.sh status
```

PID in `ninja.pid`, log in `ninja-daemon.log`. Spec e doveri dell'Executor:
`ninja.md` nella cartella desk. Test offline: `npm run ninja:test`.

## Pannello admin (stile x-zdos.it)

Da questa versione zdesk si apre su **Panoramica**, con layout admin nello stile
di [x-zdos.it](https://x-zdos.it/): menu laterale (su telefono si apre con ☰),
palette Solana (viola #9945FF, verde #14F195), font Space Grotesk e IBM Plex Mono,
card in vetro, sfondo con orb e griglia. Tutte le sezioni di prima restano:
In tendenza, Nuove pair, Watchlist, Titoli tokenizzati, Copy trader, Ninja,
Desk, Wallet, Radar (X Trust, K.I.R.A., News, Watchlist, Staking, Connetti con
login X).

La Panoramica mostra:

- **Siti ZDOS**: x-zdos.it, ZSwap, Pinguino RPG, VelvetHub (18+, solo link e
  stato, nessuna anteprima) e dev.to/asapkali. Lo stato arriva da
  `GET /api/ecosystem`: il server fa una GET con timeout di 8 s, senza seguire i
  redirect, e riporta codice HTTP, latenza, dimensione, sha256 (12 caratteri)
  della pagina e giorni alla scadenza del certificato TLS. Cache 60 s. Nessun
  iframe e nessun contenuto dei siti passa al browser.
- **Token**: $DSN ufficiale (Polygon `0xfc90516a1f736FaC557e09D8853dB80dA192c296`,
  Solana `35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4`) e $OV (VELVET), solo
  indirizzi e link di consultazione.
- **Ultimi articoli dev.to** dall'API pubblica
  `https://dev.to/api/articles?username=asapkali` (cache 10 minuti; se dev.to
  non risponde restano gli ultimi dati letti, segnalati come vecchi).
- Indicatori: siti online, fonti dati, accesso X configurato, stato Ninja.

**Privacy.** Tutte le risposte `/api/*` passano da `lib/privacy.js`: gli
indirizzi del wallet agente compaiono solo mascherati (4…4), IP pubblici, nome
host del VPS, email e percorsi assoluti del server vengono nascosti. Gli
indirizzi privati non sono scritti in chiaro nel filtro (confronto per impronta
sha256). Nelle risposte che riguardano il wallet agente i link alle transazioni
vengono tolti e le firme abbreviate (dalla firma si risalirebbe al wallet).
Altri indirizzi da mascherare: `ZDESK_PRIVATE_ADDRS`.

Test offline: `node scripts/ecosystem-selftest.js`, `node scripts/privacy-selftest.js`.
Controllo su file o risposte salvate: `node scripts/privacy-scan.js <file>...`.

## Funzioni

1. **In tendenza / Nuove pair** — tabella ordinabile e filtrabile (prezzo,
   mcap, liquidità, vol 1h/6h/24h, buy/sell, età, sfera).
2. **Dettaglio token** — rug check (mint/freeze, top10%, holder maggiore,
   rischio RugCheck), holder, link, scomposizione dello score, curva pump.fun
   se il token è ancora sulla bonding curve (letto on-chain).
3. **Watchlist** — `$OV` (`2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump`) con
   progresso curva se disponibile; `$DSN` ufficiale Solana
   (`35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4`, Token-2022, 6 decimali,
   nessuna pair ancora; su Polygon
   `0xfc90516a1f736FaC557e09D8853dB80dA192c296`, 18 decimali); e `xZDOS`
   pump.fun legacy, non `$DSN` ufficiale
   (`EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump`). Il mint EnxZ non è
   stato rimosso: è solo rietichettato.
4. **Desk** — lettura sola di `risk.md`, `go.md`, `survivors.md`,
   `gmgn-signals.md`.
5. **Sfera predittiva** — colonna 0–1, formula in [FORMULA.md](FORMULA.md).
6. **Wallet agente live** — pannello in evidenza sulla home (e tab Wallet)
   del wallet Phantom dell'agente (in pagina e nelle API compare solo mascherato, 4…4):
   saldo totale USD/SOL, holding, movimenti (swap/in/out, ora Europe/Rome,
   link Solscan), counter animato, flash verde/rosso sui movimenti, sparkline
   da snapshot in `wallet-spark.json`. Solo RPC/prezzi pubblici, poll ~20s,
   nessuna chiave. Si può ancora ispezionare un altro indirizzo dal form.
7. **Copy trader** — HighKali esegue compra/vendita LIVE sul wallet agente
   (sola lettura in UI). Floor $50 su SOL+USDC, budget dinamico fino a $30,
   solo wallet APPROVED in `copy-wallets.md`. La scansione dei top holder
   resta visibile come segnali pubblici, non come lista LIVE.
8. **Sniffer anti-fake** — verdetti da `anti-fake.json` (OK / WARN / EXIT_LIQ /
   FAKE) in topbar, home e tab Copy trader. API `GET /api/antifake`. FAKE e
   EXIT_LIQ bloccano i buy. Nessun controllo ancora se il file è vuoto.
8b. **copy.top (sola lettura)** — classifica pubblica e monete che i top trader
   stanno comprando, da pagine/API pubbliche di copy.top. Cache in
   `copy-top.json` / `copy-top.md`. API `GET /api/copytop` (stato vuoto amichevole
   se manca il file). Non è la lista APPROVED e non genera buy. Nessun deposito,
   nessun collegamento wallet, nessun referral.
9. **Ninja** — watcher di uscita veloce (WARN al primo rosso, EXIT al secondo
   distinto o allo stop duro −3%). Stato in `highkali-desk/ninja.json`.
   Nessuna chiave, nessuna firma: vende solo l'Executor via Phantom.
10. **Titoli tokenizzati** — SPYx, QQQx, NVDAx, TSLAx, GOOGLx (mint da
   DexScreener + Jupiter tag `xstocks`). **Acquisto bloccato**
   (georestriction Phantom): solo watch, nessuna elusione.

11. **Radar · Connetti app** — GitHub in sola lettura, Phantom (indirizzo
    pubblico, nessuna firma) e, se configurato sul VPS, **Accedi con X**
    (OAuth 2.0 Authorization Code + PKCE, scope `tweet.read users.read`).
    Si verifica solo il profilo (`/2/users/me`); l'access token viene
    revocato subito e non è conservato. Nessun post, nessun elenco follower.
    Callback: `https://zdesk.x-zdos.it/api/connect/x/callback` (zdesk è
    servito alla radice dell'host, senza prefisso `/zdesk`). Le chiavi
    (`X_CLIENT_ID`, `X_CLIENT_SECRET`, `ZDESK_SESSION_SECRET`) stanno in
    `/etc/zdesk/x-oauth.env` (root:zdesk 640), caricato da un drop-in
    systemd. Se mancano, zdesk funziona come prima e resta l'handle locale.

Auto-refresh circa 45–55 secondi, con cache e rispetto dei rate limit.

## Fonti

| Fonte | Uso | Esito atteso |
|---|---|---|
| GeckoTerminal `trending_pools` / `new_pools` | liste principali | OK, limite ~30 req/min |
| DexScreener pairs/tokens/search/boosts | prezzo, vol, enrich, xStocks, fallback liste | OK |
| RugCheck `/v1/tokens/{mint}/report` | rug, holder, authority | OK (cache 8 min) |
| Solana RPC `publicnode` | `getAccountInfo`, `getBalance`, bonding curve | OK |
| Solana RPC `api.mainnet-beta.solana.com` | `getSignaturesForAddress`, `getTokenAccountsByOwner`, `getTransaction` | OK ma rate-limited |
| `getTokenLargestAccounts` | holder on-chain | spesso 429 / richiede indice — si usa RugCheck |
| Pump.fun HTTP API | curva | **fallisce** (Cloudflare 403) |
| Jupiter lite-api search | conferma mint xStocks | OK |
| GMGN | — | **non usato** (Cloudflare 403, nessun bypass) |

## Screenshot

Generati in `screens/`:

- `01-trending.png` — tabella principale (stile ZDOS)
- `02-token-detail.png` — dettaglio token con grafico OHLCV e gauge
- `03-watchlist.png` — $OV / $DSN ufficiale / xZDOS legacy
- `04-desk.png` — pannello risk/go/survivors/signals
- `05-copytrader.png` — copy LIVE + copy.top sola lettura
- `06-xstocks.png` — titoli tokenizzati (solo watch)
- `07-wallet.png` — tracker wallet desk

```bash
node scripts/screenshots.js
```

## Deploy privato su VPS

zdesk è online su https://zdesk.x-zdos.it dietro nginx con basic auth; i
aggiornamenti si installano a mano con i pacchetti `deploy-zdesk-*` (backup,
selftest, rollback automatico). Principi del deploy:

1. Copiare la cartella sul VPS (senza `.env` con chiavi: qui non ce ne sono).
2. `npm ci --omit=dev` e un process manager (`systemd` o `node` sotto
   `127.0.0.1`).
3. Reverse proxy (Caddy o Nginx) con **HTTPS** e **autenticazione**
   (basic auth con password hash, oppure un SSO). Esempio Caddy:

   ```
   zdesk.example.com {
     basicauth {
       doc $HASH_PASSWORD
     }
     reverse_proxy 127.0.0.1:8787
   }
   ```

4. Firewall: porta Node non esposta, solo 443.
5. Continuare a non mettere chiavi, a non collegare Phantom in trade,
   a non aggirare la georestriction xStocks.
6. Se il desk (`risk.md` ecc.) deve comparire, montare o sincronizzare in
   sola lettura la cartella desk (`DESK_DIR`). `scripts/sync-desk.sh` legge
   l'host solo da `ZDESK_SSH_HOST`.
7. Rate limit più stretti se il VPS ha un IP condiviso verso le API pubbliche.

---
© 2026 ZDOS1.3 — P.IVA 11040550961 · tutti i diritti riservati.
