# Home pulite (index-clean) · ZDOS1.3

Home di x-zdos.it, ourvelvet.online e zx.x-zdos.it ridotte a un hero, una fascia ricevuta ZLang / Solana e poche fasce sottili (stile monospace, bordo ciano tenue). Le sezioni tolte sono nelle copie `home-completa.html` (noindex), raggiungibili dal menu. Nessun file cancellato.

- x-zdos.it → `/var/www/x-zdos-portal/current/` (`index.html`, `assets/hub/home-clean.{css,js}`, `assets/hub/site-nav.js`, `home-completa.html`) + `nginx/x-zdos-home.conf`
- ourvelvet.online → `/var/www/ourvelvet/` (`index.html`, `assets/ov-home-clean.{css,js}`, `assets/home-completa.html`)
- zx.x-zdos.it → `/var/www/zx-store/` (`index.html`, `home-clean.{css,js}`, `home-completa.html`)
- Rollback sul VPS: `/var/backups/index-clean/20261128-1315/rollback.sh`

- ourvelvet.online (ripristino 20261128-1427): home primaria ripristinata (orbita, ticker discreto, Lo-Fi, Dom-Coin, notizie, cover, sezione 18+) con stile unificato in `ov-home-restore.{css,js}`; rollback `/var/backups/index-clean/20261128-1427/rollback.sh`.

- x-zdos.it (robottini 20261128-1930): nella hero i due robottini ZDOS (versione rifinita dell'originale della splash d'ingresso, vedi `x-zdos.it/robot-originale-splash.svg`) e OV♥ (dalla sfera del logo OurVelvet) si incontrano e si salutano. Solo SVG + CSS (transform/opacity), `duo.css` e `duo.js` in `/var/www/x-zdos-portal/current/assets/hub/`; tocca per rivedere; `prefers-reduced-motion` rispettato. Rollback sul VPS: `/var/backups/robots/20261128-1930/rollback.sh`.

- x-zdos.it (robottini v2, 20261128-1950): splash d'ingresso con i due personaggi (2,5 s, saltabile, una volta a sessione, rispetto di prefers-reduced-motion); carte con testi più chiari su Solana e assistente IA (niente nome Grok); ricevuta senza hash tagliati; «1 profilo». Rollback VPS: `/var/backups/robots/20261128-1950/rollback.sh`.
