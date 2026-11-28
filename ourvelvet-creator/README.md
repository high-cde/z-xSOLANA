# OurVelvet Creator (ourvelvet.online/creator-radar/)

Hub creator 18+ in HTML/CSS/JS statici, nessuna dipendenza esterna.
- Viste: Esplora, Crea, Feed, AI, Dom-Coin & VELVET, Il mio profilo (hash, nessun redirect).
- Profili e feed sono **esempi dichiarati** (personaggi fittizi adulti); bozze e like restano nel browser.
- "Accedi con OurVelvet" usa /firma/firma.js e /api/firma/*; badge «wallet verificato» con /firma/badge.js.
- AI: stato e personaggi da /api/velvet-ai/status. Dom-Coin: valore **dichiarato**, non prezzo di mercato.
- Tag Google: `site/zdos-ga.js`, disattivato finché GA4_ID è vuoto (ID da fornire, con consenso).
- Gioco Radar originale spostato in /creator-radar/gioco/.
- Deploy: copiare `site/` in /var/www/ourvelvet/creator-hub/ e applicare `nginx/creator-radar.location.conf` in snippets/ourvelvet-velvet-pages.conf.
- Rollback sul server: /var/backups/creator/20261128-0245/rollback.sh
