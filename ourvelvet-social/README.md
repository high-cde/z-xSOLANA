# OurVelvet Social v1 — backend reale della sezione Creator

© 2026 ZDOS1.3 · P.IVA 11040550961 · Licenza ZSEL proprietaria.

La sezione https://ourvelvet.online/creator-radar/ ora usa dati reali: profili creator, post con immagine, like, follow, feed globale e «chi segui», segnalazioni, blocco utenti, moderazione staff, export e cancellazione GDPR. Nessun profilo di esempio: se il DB è vuoto la pagina mostra «Sii il primo creator».

## Servizio
- `zdos-social.service` → Node 22 + SQLite (better-sqlite3) + sharp, su `127.0.0.1:8910`, utente di sistema `zdossocial` (gruppo extra `zcomm` solo per leggere la chiave HMAC del bus).
- Hardening systemd: `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `PrivateDevices`, `NoNewPrivileges`, `RestrictNamespaces`, `InaccessiblePaths=/root /etc/zdos-agi-wallets`, `MemoryMax=320M`, `CPUQuota=50%`.
- Dati: `/var/lib/zdos-social/social.db` e `/var/lib/zdos-social/media/*.webp` (0700).
- Chiave interna staff: `/etc/zdos-social/admin.key` (root:zdossocial 640); nginx la aggiunge solo dietro htpasswd staff tramite `/etc/nginx/snippets/zdos-social-admin-key.conf` (600, non nel repo).

## Identità
Solo la sessione della firma OurVelvet (cookie `zdos_firma` / Bearer JWT), validata su `zdos-firma` `GET /api/firma/session` con `X-Forwarded-Host: ourvelvet.online`. Nessuna password, nessuna email.

## API (`/api/social/`)
| Metodo | Percorso | Note |
|---|---|---|
| GET | `/health`, `/meta` | stato, categorie, versione termini |
| GET | `/me` | sessione + profilo, consensi, i miei post (anche in revisione) |
| PUT | `/me/profile` | crea/modifica: handle, bio, categorie; alla creazione servono `maggiorenne`, `termini`, `consenso` = true |
| POST | `/me/avatar` | corpo binario `image/jpeg|png|webp` ≤ 5 MB → WebP 512×512, EXIF rimossi, in revisione |
| POST | `/media` | immagine per un post → WebP ≤ 1280 px, EXIF rimossi, in revisione |
| GET | `/media/:id` | pubblica solo se approvata (il proprietario vede la sua in revisione) |
| GET | `/me/export` | export GDPR (JSON) |
| DELETE | `/me` | cancellazione GDPR, corpo `{"conferma":"ELIMINA"}` |
| GET | `/creators?q=&cat=` | creator attivi |
| GET | `/creators/:handle` | profilo + post pubblici |
| POST | `/creators/:handle/follow` · `/block` | toggle |
| GET | `/feed?scope=tutti|seguiti&prima=<ts>` | feed |
| POST | `/posts` | `{text, media?}`; con immagine → `in_revisione` fino all'approvazione |
| POST | `/posts/:id/like` | toggle |
| DELETE | `/posts/:id` | solo i propri |
| POST | `/report` | `{kind: post|profile, target, reason}`; 3 segnalazioni su un post lo nascondono in attesa dello staff |
| GET | `/me/blocks` | elenco bloccati |

Le modifiche richiedono l'intestazione `X-OV-Social: 1` e, se presente, `Origin: https://ourvelvet.online` (CSRF).

## Staff (`/creator-radar/admin/`, htpasswd `/etc/nginx/htpasswd-velvet-staff` esistente, non modificato)
API su `/creator-radar/admin/api/`: `GET stats|queue|reports|log`, `GET media/:id`, `POST media/:id {azione: approva|rifiuta}`, `POST reports/:id {azione: archivia|nascondi}`, `POST profiles/:handle {azione: sospendi|ripristina}`. `/api/social/admin/*` dall'esterno risponde 404.

## Regole e privacy
- Filtro testo lato server (`filter.mjs`, normalizza accenti, leetspeak e lettere spaziate): blocca minori, «teen», «step», non consenso, violenza non consensuale, età < 18. Safeword ROSSO visibile in tutta la pagina e nella chat.
- Rate limit in memoria: per IP (solo hash HMAC con sale casuale a ogni avvio, mai salvato), per wallet (240 azioni/10 min, 10 post/ora, 20 immagini/ora, 120 like/10 min, 60 follow/10 min, 20 segnalazioni/ora).
- Badge «wallet verificato» da `/api/firma/badge`: l'indirizzo del creator compare solo se ha scelto il badge pubblico.
- Merito: eventi zcomm `creator_profile_published` / `creator_post_published` (sorgente `creator`) con attore `OV-XXXX-VELVET` **solo** se il wallet ha già un profilo merito (lookup locale `GET /zcomm/api/ovid-by-wallet`). Questi tipi non hanno punti nelle regole del fondo: merito e VELVET invariati.
- Chat AI: la vista AI chiama `velvet-ai` `/api/velvet-ai/chat` con la sessione dell'utente (cookie). Nessuna cronologia pubblica.

## Test
`node test-e2e.mjs fase1 && node test-e2e.mjs fase2` (root sul VPS): wallet effimeri, firma SIWS reale, 73 controlli; la fase 2 cancella tutti i dati di test.
