# zcomm · bus eventi ZDOS ⇄ OurVelvet e miner merito VELVET

Servizio Node 22 su `127.0.0.1:4192` (unità `zcomm.service`). Pagine: https://velvet.x-zdos.it/merito/

## Cosa fa
- **Bus eventi firmato.** `POST /zcomm/api/events` accetta solo eventi con firma HMAC-SHA256 (`x-zcomm-ts`, `x-zcomm-signature` = HMAC(chiave, `ts + "." + body)`), solo da 127.0.0.1. Chiave: `/etc/zcomm/hmac.key` (root:zcomm 640). nginx espone solo GET.
- **Ingestori (ogni 60 s, sola lettura):** Radar (`profile_created`, `role_set`, `invite_accepted`, `invitee_verified`, `profile_revoked`, `stage_rsvp`), badge (`profile_verified`), zNFT (`work_certified`, solo opere `certificata` non d'esempio), ZQuest (`quest_done`, stato `fatta`). zdiscord pubblica `discord_linked`/`discord_unlinked` con `src/zcomm-client.js` (ID Discord pseudonimo). Zara e il bot Telegram leggono soltanto (`/merito`).
- **Merito:** punti base per evento reale (config `merit.points`), revoca automatica se l'ID viene cancellato, quest con tetto settimanale. Moltiplicatori: attivo x2, Mistress/Master verificati x1,5, bonus holder a scaglioni (+10% da 10.000, +20% da 100.000 VELVET, massimo +20%) solo su wallet collegato con firma e solo se ci sono punti. Detenere da solo non dà punti.
- **Pagamenti:** `payout.mjs` (timer `zcomm-payout.timer`, lunedì 00:10 Europe/Rome). Paga solo dal fondo `GEntwhy…CECDd`, solo profili Radar verificati con wallet collegato e punti reali; mai il fondatore né le AI; pool settimanale del semestre (prima settimana pro rata), tetto 5% a profilo, tetto per semestre. Simulazione on-chain prima di ogni invio. Un invio interrotto va in `to_verify` e non viene mai reinviato da solo. Il fondo non paga l'apertura dei conti token: chi non ha un conto VELVET resta in attesa.
- **Kill switch:** `bash /opt/zcomm/kill-switch.sh` (file STOP + `emissionsLive=false`).

## API pubbliche (GET)
`/merito/api/summary` · `/merito/api/me` (header `X-Radar-Token`) · `/merito/api/profile/OV-XXXX-VELVET` · `/merito/api/payouts` · `/merito/api/ov` · `/zcomm/api/events`

## Comandi
`node payout.mjs status` · `node payout.mjs dry-run current|previous|YYYY-Www` · `node payout.mjs settle previous`

Il codice Zlang scritto nell'IDE resta nel browser e non è legato a un ID: oggi non dà punti.

© 2026 ZDOS1.3 · Licenza ZSEL proprietaria.
