# OurVelvet — stile «Dom-Coin & Velvet by ZDOS» + Registrati con TikTok
© ZDOS1.3 — licenza proprietaria.

- `assets/velvet-zdos.css` token e componenti condivisi (palette #070410/#ff3d7f/#9b5cff/#f5c36c, Georgia + Inter + mono, aurora, vetro, coin pulse; animazioni solo transform/opacity, rispetta prefers-reduced-motion).
- `assets/vz-tiktok.js` bottone «Registrati con TikTok» (in attivazione finché /api/social/tiktok/status → attivo:false).
- `assets/velvet-skin.js` + `verifica-theme.js` skin di /verifica/ (CSP stretta: solo file same-origin, nessun inline).
- `assets/vz-ov.png`, `vz-coin.png` logo OV e moneta L$D.
- `legal/privacy`, `legal/termini` pagine pubbliche (servite da `deploy/zdos-legal.conf`).
- `deploy/rollback-20261128-1559.sh` rollback del deploy; `deploy/tiktok.json.example` config (disabilitata, senza chiavi).
- Backend TikTok: `../ourvelvet-social/tiktok.mjs` (+ `test-tiktok.mjs`, 42 controlli con TikTok simulato). Il segreto va solo in /etc/zdos-social/tiktok.secret (600), mai nel repo.
- Pagine ristilizzate: ourvelvet-zsound/web, ourvelvet-gateway/web (+widget.js), ourvelvet-creator/pool-party/web, ourvelvet-creator/site.
- /verifica/ e i file firma non sono tracciati in questo repo.
