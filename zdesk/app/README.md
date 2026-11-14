# ZDESK — dashboard Solana privata (HighKali)

Dashboard **locale**, **single-user**, **sola lettura**, ispirata alle funzioni
di un terminale tipo GMGN (trending, rug check, watchlist, sfera predittiva,
tracker wallet, copy-trader PAPER, titoli tokenizzati in solo watch).

Non è un clone di GMGN, non chiama l'API GMGN (Cloudflare 403) e **non esegue
trade**. Nessuna chiave, nessun login, nessun invio on-chain.

## Avvio (solo sul box)

```bash
cd /workspace/zdesk-dashboard
npm start
```

Si mette in ascolto su **http://127.0.0.1:8787** (non è esposta all'esterno).

Variabili opzionali:

- `HOST` (default `127.0.0.1`)
- `PORT` (default `8787`)
- `DESK_DIR` (default `/workspace/highkali-desk`)

Per fermarla: `kill $(cat /workspace/zdesk-dashboard/zdesk.pid)` se avviata
in background con lo script di run, oppure `pkill -f 'node server.js'`.

### Demone Ninja (auto-start con supervisor)

```bash
/workspace/zdesk-dashboard/scripts/ninja-ctl.sh start
/workspace/zdesk-dashboard/scripts/ninja-ctl.sh status
```

PID in `ninja.pid`, log in `ninja-daemon.log`. Spec e doveri dell'Executor:
`/workspace/highkali-desk/ninja.md`. Test offline: `npm run ninja:test`.

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
   del wallet Phantom l'agente:
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

## Deploy privato su VPS (non fatto qui)

Questa app è stata lasciata **solo in locale**. Per una copia privata sul VPS
dell'utente, in un secondo momento servirebbe:

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
   sola lettura `/workspace/highkali-desk` (o l'equivalente sul VPS).
7. Rate limit più stretti se il VPS ha un IP condiviso verso le API pubbliche.

Il Radar v2.1 (con la correzione del mint $DSN) è stato applicato sul VPS il 14/11/2026 alle 15:09 (ora di Roma), ESITO OK. Dettagli in `../../docs/STATUS.md`. Pacchetto e script: `../deploy/`.

## Tab Radar (sola lettura)
Sotto-sezioni: X Trust, Token K.I.R.A., News anticipo, Watchlist ($DSN ufficiale, VELVET e xZDOS legacy), **Staking** (non custodial,
vedi `../../docs/staking.md`) e **Connetti app** (X: solo handle locale e link al profilo; GitHub: stato pubblico in lettura; Phantom: solo indirizzo pubblico; vedi `../../docs/connetti-app.md`).
Endpoint GET: `/api/radar`, `/api/staking/:address`, `/api/connect`. Selftest: `node scripts/radar-staking-selftest.js` e `node scripts/dsnmint-selftest.js`.

$DSN ufficiale: Polygon `0xfc90516a1f736FaC557e09D8853dB80dA192c296` (18 decimali) e Solana `35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4` (Token-2022, 6 decimali).
`EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump` è xZDOS pump.fun (legacy, non $DSN ufficiale).
VELVET ($OV), community su Solana, mint `2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump`. Nessun rendimento, nessuna promessa finanziaria.
