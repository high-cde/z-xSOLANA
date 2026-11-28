# Passata "product ready" · ZDOS1.3 · 28/11/2026

Copia dei file modificati, con gli stessi percorsi del VPS (`var/www/...`, `opt/zdesk/...`). Nessuna chiave, nessun segreto.

Cosa cambia:
- /lsd-trasparenza/ (+ /merito/, /vesting/): piano ZDOS1.3 (merito 20M già eseguito il 28/11/2026, tesoreria 90M con Jupiter Lock non revocabile, Hss8o82…rLBk insider da identificare), checklist "Cosa manca per il verde".
- /lsd-liquidita/: opzione ±37,5% (2 bin array) e posizione di doc 4Eg17LYZ…U3fK. /lsd-revoca/: eseguita.
- Rimosso il "Reference peg €0,0064" (pagine, metadata.json, widget, zdesk, gateway).
- ourvelvet.online: privacy/termini (contatti: Discord + ZDOS1.3 P.IVA 11040550961, nessuna email inventata), /mint-lsd/ pagina di sola lettura, /magazine/ (niente GTM senza consenso, niente link pump.fun, niente ticker finti), /merito/ senza GTM e con font locali.
- /defi/: niente overflow orizzontale su mobile.
- nginx: /creator/ → 302 /creator-radar/ (demo con saldo finto non più pubblica).

Rollback sul VPS:
- /var/backups/prodready/20261128-1632/rollback.sh (batch 1)
- /var/backups/prodready/20261128-1640-b2/rollback.sh (gateway + zdesk index)
- /var/backups/prodready/20261128-1710-b3/rollback.sh (magazine, defi css, trasparenza)
