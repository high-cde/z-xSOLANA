# ZDESK · tab Radar v2.1 (sola lettura) + mint $DSN

Tab **Radar** con sei sotto-sezioni: X Trust, Token K.I.R.A., News anticipo, Watchlist, **Staking**, **Connetti app**.
Solo GET: `/api/radar`, `/api/staking/:address`, `/api/connect`. Nessuna chiave, nessuna firma, nessun trade.
Non modifica copytrader.js, ninja.js, wallet.js, nginx, htpasswd, ACCESS.txt.

**v2.1** aggiorna anche `lib/sources.js` e il README di zdesk: `$DSN` ufficiale Solana e `xZDOS` pump.fun legacy (vedi sotto). Il pacchetto `deploy-zdesk-dsnmint/` fa la stessa correzione del mint senza installare il Radar.

Nessun segnale garantisce profitto. Il Radar mostra controlli e red flag, non consigli di acquisto.

## Novità v2 / v2.1
- **Watchlist desk (`lib/sources.js`)** e Radar: `$DSN` ufficiale Solana `35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4` (Token-2022, 6 decimali, nessuna pair ancora; su Polygon `0xfc90516a1f736FaC557e09D8853dB80dA192c296`, 18 decimali). `xZDOS` pump.fun (`EnxZzNG8ZarHt1Tez4ipu5yUnXj8rAbyAnXttxnMpump`) resta in lista con etichetta "legacy, non $DSN ufficiale". VELVET ($OV, `2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump`, token community senza rendimento) sempre presente.
- **Staking** (non custodial, sola lettura): stake account nativi (validator, stato, importo), saldi LST (JitoSOL, mSOL, bSOL, INF),
  reward dell'ultima epoch quando costa poco; cache 5 min. Guida italiana per mettere SOL in staking da Phantom.
  $DSN e VELVET: "staking a punti, nessun rendimento", solo progetto.
  Gli stake nativi richiedono un RPC che consenta `getProgramAccounts`: impostare `ZDESK_SOLANA_RPC` nella unit (facoltativo; senza, la sezione mostra un link Solscan).
- **Connetti app**: X (link al profilo pubblico, nessun post), GitHub (stato pubblico dell'org, sola lettura),
  Phantom (solo connessione: legge l'indirizzo pubblico; nessuna firma, nessuno swap, nessun fondo).

## Contenuto del pacchetto
- `server.js` (route GET /api/radar, /api/staking/:address, /api/connect)
- `lib/radar.js`, `lib/staking.js`, `lib/connect.js`, `lib/solana-ata.js`, `lib/sources.js`
- `public/index.html`, `public/app.js`, `public/app.css`, `README.md`
- `scripts/radar-staking-selftest.js`, `scripts/dsnmint-selftest.js` (selftest offline, eseguiti prima di copiare)
- `radar/*.json`: file dati vuoti + schema + esempio fittizio (installati in /opt/zdesk/desk solo se assenti)

## Applicazione (da root, nel tmux "up")
Funziona dal master originale, dal master dopo `applica-dsnmint.sh`, dal Radar v1, e da un Radar v2 precedente (d057910).
I repo high-cde sono privati: il download usa l'API GitHub con un token in sola lettura, inserito con `read -s`.

```
read -s -p "Token GitHub: " GT; echo; cd /tmp; for f in zdesk-radar.tar.gz applica-radar.sh; do curl -fsSL -H "Authorization: Bearer $GT" -H "Accept: application/vnd.github.raw" -o $f "https://api.github.com/repos/high-cde/zSWAP/contents/deploy-zdesk-radar/$f?ref=deploy-velvet-tg"; done; unset GT; sha256sum zdesk-radar.tar.gz applica-radar.sh; bash /tmp/applica-radar.sh
```

sha256 attesi:
```
39c4785f0f0e9bb08728f47e32ba9bd2fcab4fd381b62dd296cfc7bf534902d9  zdesk-radar.tar.gz
69a577c22f9cd2e229c3329799109433d31883401cb2472072f7040a64cba4be  applica-radar.sh
```

Lo script: verifica lo sha del pacchetto; si ferma se i file in /opt/zdesk non sono un punto di partenza noto (FORCE=1 per forzare);
fa il backup completo in /var/backups/zdesk/; esegue sintassi e selftest offline; scrive /var/backups/zdesk/rollback-radar21-<data>.sh;
copia i file; `systemctl restart zdesk`; controlla /api/health, /api/radar, /api/connect, /api/staking, /api/watchlist (mint ufficiale e legacy), /api/token del mint $DSN, /api/copytrader, /api/ninja;
in caso di errore fa il rollback da solo. Alla fine stampa **ESITO OK**.

Se vuoi solo la correzione del mint, senza Radar, usa `deploy-zdesk-dsnmint/`.

## Rollback manuale
`bash /var/backups/zdesk/rollback-radar21-<data>.sh`
