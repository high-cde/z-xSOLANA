# Pool Party inverso · OurVelvet (proposta, sola lettura)

Pagina https://ourvelvet.online/pool-party/ e API pubblica `GET /api/social/pool/state` (servizio zdos-social).
Calcola un punteggio di merito per epoca (settimana, lunedì 00:00 Europe/Rome, come zcomm) e una distribuzione **proposta**.
**Non esegue pagamenti, non tocca fondi, config o emissioni.** Il pagamento richiede la firma manuale dell'approvatore
(`/etc/zdos-social/pool-approver.pub`, assente = approvazioni disattivate) sull'hash dell'epoca.

Tutte le cifre sono proposte da confermare con doc: 10% = 20M L$D in 26 settimane, metà delle fee DLMM, tetto 5% a profilo.
Punti: post (2, max 5), like da profili distinti (1, max 10), nuovi follower (1, max 10), badge verificato (3),
liquidità nel pool L$D-SOL (fino a 20, pesata per ore), punti zcomm se c'è un profilo OV. Detenere L$D = 0; solo moltiplicatore a scaglioni con tetto +20%.
Account di test DSN-X: mai pagabili. work_proof dello ZDOS Miner: senza attore, 0 punti.

- `server/pool.mjs` → /opt/zdos-social/pool.mjs · `server/social-server.mjs` → server.mjs (import + route + fix auto-like)
- `web/index.html` → /var/www/ourvelvet/pool-party/ · `deploy/deploy-web.sh` (backup + rollback.sh in /var/backups/pool-party/)
- `tests/` → journey utente con firma tweetnacl e test unitario dell'approvazione
© 2026 ZDOS1.3 · P.IVA 11040550961
