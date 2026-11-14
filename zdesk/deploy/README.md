# ZDESK · tab Radar v2 (sola lettura)

Tab **Radar** con sei sotto-sezioni: X Trust, Token K.I.R.A., News anticipo, Watchlist, **Staking**, **Connetti app**.
Solo GET: `/api/radar`, `/api/staking/:address`, `/api/connect`. Nessuna chiave, nessuna firma, nessun trade.
Non modifica copytrader.js, ninja.js, wallet.js, sources.js, nginx, htpasswd, ACCESS.txt.

Nessun segnale garantisce profitto. Il Radar mostra controlli e red flag, non consigli di acquisto.

## Novità v2
- **Watchlist**: $DSN (Solana `35w74RT77BPSYNpmzpvxmR9wu2ihpgzubKy4bkGHR3F4`) e VELVET ($OV, `2EN6Y1zM4yyt41gE2muzdJSAgRCAZiXqnmkgpbrspump`, token community senza rendimento) sempre presenti.
- **Staking** (non custodial, sola lettura): stake account nativi (validator, stato, importo), saldi LST (JitoSOL, mSOL, bSOL, INF),
  reward dell'ultima epoch quando costa poco; cache 5 min. Guida italiana per mettere SOL in staking da Phantom.
  $DSN e VELVET: "staking a punti, nessun rendimento", solo progetto.
  Gli stake nativi richiedono un RPC che consenta `getProgramAccounts`: impostare `ZDESK_SOLANA_RPC` nella unit (facoltativo; senza, la sezione mostra un link Solscan).
- **Connetti app**: X (link al profilo pubblico, nessun post), GitHub (stato pubblico dell'org, sola lettura),
  Phantom (solo connessione: legge l'indirizzo pubblico; nessuna firma, nessuno swap, nessun fondo).

## Contenuto del pacchetto
- `server.js` (route GET /api/radar, /api/staking/:address, /api/connect)
- `lib/radar.js`, `lib/staking.js`, `lib/connect.js`, `lib/solana-ata.js`
- `public/index.html`, `public/app.js`, `public/app.css`
- `scripts/radar-staking-selftest.js` (selftest offline, eseguito prima di copiare)
- `radar/*.json`: file dati vuoti + schema + esempio fittizio (installati in /opt/zdesk/desk solo se assenti)

## Applicazione (da root, nel tmux "up")
Funziona sia dal master originale sia dal Radar v1.
```
cd /tmp
curl -fsSLO https://raw.githubusercontent.com/high-cde/zSWAP/deploy-velvet-tg/deploy-zdesk-radar/zdesk-radar.tar.gz
curl -fsSLO https://raw.githubusercontent.com/high-cde/zSWAP/deploy-velvet-tg/deploy-zdesk-radar/applica-radar.sh
sha256sum zdesk-radar.tar.gz applica-radar.sh
bash /tmp/applica-radar.sh
```
sha256 attesi:
```
a150694221ba0de6eb5ae0a31c9d19a5413be4b171e1b5fbe1f388c38305fcf2  zdesk-radar.tar.gz
7b5e342f3b4d24f0ddfbe81b28b48431a37152530cddeec2475631579fa427e8  applica-radar.sh
```

Lo script: verifica lo sha del pacchetto; si ferma se i file in /opt/zdesk non sono né il master né il Radar v1 (FORCE=1 per forzare);
fa il backup completo in /var/backups/zdesk/; esegue sintassi e selftest offline; scrive /var/backups/zdesk/rollback-radar2-<data>.sh;
copia i file; `systemctl restart zdesk`; controlla /api/health, /api/radar, /api/connect, /api/staking, /api/copytrader, /api/ninja;
in caso di errore fa il rollback da solo. Alla fine stampa **ESITO OK**.

## Rollback manuale
`bash /var/backups/zdesk/rollback-radar2-<data>.sh`
