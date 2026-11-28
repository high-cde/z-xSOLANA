# ZLang Launcher by ZDOS (demo + piano)

Demo statica e piano di progetto di un lanciatore di token su Solana, identità **ZLang by ZDOS**. © ZDOS1.3, P.IVA 11040550961.

- `site/` → pubblicato su `https://x-zdos.it/launcher/` (demo) e `/launcher/piano/` (piano). Solo simulazione: nessuna transazione, nessuna chiave, nessuna rete.
- `PIANO.md` → piano completo, **con appendice interna** (ricerca commissioni, fonti): non pubblicare l'appendice. La pagina pubblica si genera con `python3 build_piano.py`, che toglie i blocchi `<!--INTERNO-->`.
- `snippet.conf` → snippet nginx (`/etc/nginx/snippets/zdos-launcher.conf`), incluso nel server 443 di x-zdos.it. `rollback.sh` lo toglie (sostituire `__TS__`).
- `test_demo.py` → prova con Playwright (412×915 e desktop).

Deploy: copiare `site/` in `/var/www/zlang-launcher/`, installare lo snippet, `nginx -t` e reload. Backup/rollback sul VPS: `/var/backups/launcher/<ts>/`.
