# Velvet Club · OurVelvet (VelvetHub 18+)

© 2026 ZDOS1.3 — P.IVA 11040550961 · Licenza ZSEL proprietaria.

Aggiunte al backend FastAPI di OurVelvet (`/opt/ourvelvet`, servizio `ourvelvet`).

- `ourvelvet/app/api/events.py`, montato su `/api/events`. SQLite in `/opt/ourvelvet/data/events.db`.
  - `GET /categories`: categorie del club e regole. Descrizioni sobrie, nessun contenuto esplicito.
  - `GET /feed?after=N`: eventi pubblici, ognuno con `x_text` e `x_intent`, cioè la bozza X.
  - `GET /xdrafts`: le ultime bozze X, mostrate in zdesk nella sezione "Bozze X".
  - `GET /status`: numero di eventi, coda Telegram, esito del controllo admin sul canale.
  - `POST /admin` (header `X-Admin-Key`, la stessa chiave admin del Radar): inserisce contest, eventi e annunci. Ogni evento nuovo viene pubblicato in automatico su @OurVelvetHub, solo se il bot Telegram è admin del canale con permesso di pubblicare; altrimenti resta in coda. Va su Discord tramite zdiscord.
  - `DELETE /admin/{id}`.
  - Dal Radar della Carne: un evento per ogni nuovo profilo Mistress/Master verificato e non nascosto, più un conteggio aggregato giornaliero dei nuovi Fedeli, senza nomi.
  - `POST /radar-link/check` e `GET /radar-link/state`: il bot Discord verifica il token di gestione o del Fedele e assegna il ruolo. Il token non viene salvato.
- `ourvelvet/patch_ourvelvet.py`: modifiche idempotenti ai file esistenti.
  - Su `rubina.py` aggiunge il campo `mode` e il prompt Discord, cioè flirt e conversazione senza contenuti espliciti. Il prompt della chat web resta invariato.
  - Su `main.py` aggiunge il router degli eventi.
  - Nella mini app aggiunge i tag del club suggeriti sotto il campo Tag del Radar.

Esempio di inserimento di un evento: lo pubblica davvero su Telegram e Discord.
```
curl -sS -X POST https://velvet.x-zdos.it/api/events/admin -H 'content-type: application/json' -H "X-Admin-Key: $CHIAVE" \
  -d '{"kind":"contest","category":"fetish","title":"Contest Carne e Lattice","body":"Iscrizioni aperte ai creator verificati 18+.","url":"https://velvet.x-zdos.it/app"}'
```
Valori di `kind`: evento, contest, annuncio, radar, info. Valori di `category`: bdsm-consensuale, fetish, lgbtq, coppie, solo-creator, mistress-master, creator-showcase, asmr-audio, cosplay-adulti.
