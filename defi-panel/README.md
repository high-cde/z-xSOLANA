# ZDOS DeFi · pannello unico (x-zdos.it/defi/)

Unisce zRoute (swap), Z-Pool e zBASKET in un solo pannello con tab **Swap · Pool · Basket · Posizioni · Dev**
e due modalità: **Normale** (client semplice) e **Dev** (risposte grezze, parametri bin/fee, endpoint, log).

- Dati reali: Meteora DLMM API, Jupiter (tokens v2, swap v1), DexScreener, RPC Solana. Nessun prezzo inventato.
- Wallet: firma ZDOS (`/firma/firma.js`, `/api/firma/*`, SIWS) + Wallet Standard (`solana:signAndSendTransaction` / `solana:signTransaction`).
- Swap: quotazione e transazione costruite da Jupiter, firmate solo dal wallet dell'utente, dopo un clic esplicito.
- Liquidità: SDK `@meteora-ag/dlmm`. Il server costruisce la transazione (nuovo conto posizione effimero), l'utente firma per primo,
  il server verifica la firma ed aggiunge quella del conto posizione, poi inoltra. Ritiro: transazioni firmate solo dall'utente.
- Controlli K.I.R.A. da dati reali (audit Jupiter, blacklist Meteora, holder, authority), avviso obbligatorio se il livello è rosso.
- Hashrate Z-Pool sempre etichettati "dichiarati". Nessun fondo custodito, nessuna liquidità della casa, nessun mint, nessun rendimento promesso.
- Filiera ÆSIR: stato pubblico in sola lettura (vBLOCKCHAIN :8899, ZDOS Miner :4197, Z-Pool :8844); snapshot orario del pool su zcomm (`pool_snapshot`, source `dex`).
- Tag Google: `tag/zdos-tag.js` (servito come /zdos-tag.js) e `tag/zdos-gtag.conf` (sub_filter). **Disattivato**: manca l'ID GA4.

Struttura: `server/` (API 127.0.0.1:4198, unit systemd), `web/` (statico), `nginx/zdos-defi.conf` (snippet), `deploy.sh` (backup in
/var/backups/defi-panel/<ts>/ con rollback.sh), `test.py` (Chromium headless + wallet finto: login, swap e LP fino alla firma).
© 2026 ZDOS1.3 · P.IVA 11040550961
