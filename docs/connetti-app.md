# Connetti app

Nel Radar di zdesk il sotto-tab «Connetti app» offre tre collegamenti, tutti in sola lettura.
Non è un'app OAuth e non esiste un login X o GitHub lato server.

File: `zdesk/app/public/app.js` (funzione `renderConnect`), `zdesk/app/lib/connect.js`, `zdesk/app/server.js` (route `GET /api/connect`), markup in `zdesk/app/public/index.html` (pannello `#radar-connect`).

| App | Cosa fa, in concreto | Cosa NON fa |
| --- | --- | --- |
| X | L'utente scrive un handle (`@[A-Za-z0-9_]{1,15}`). Viene salvato solo nel browser, in `localStorage` alla chiave `zdesk.connect.x`. L'interfaccia mostra un link a `https://x.com/<handle>`. | Nessun OAuth, nessun token, nessuna verifica del profilo, nessun oEmbed, nessun post, nessuna lettura di DM o follower. Il server non riceve l'handle. |
| GitHub | `GET /api/connect` restituisce `{ github, readOnly: true }`. `lib/connect.js` chiama l'API pubblica `https://api.github.com/users/high-cde` (cache 30 min, `User-Agent: zdesk-radar`) e mostra link a `https://github.com/high-cde` e a `https://github.com/high-cde/z-xSOLANA` (quest'ultimo è privato: si apre solo con accesso). | Nessun OAuth, nessun token salvato sul server, nessuna scrittura. Se l'API pubblica risponde errore o è in limite, restano i link. |
| Phantom | Se l'estensione è presente (`window.phantom.solana` o `window.solana` con `isPhantom`), il pulsante chiama `provider.connect()` e tiene solo la stringa `publicKey` in `localStorage` (`zdesk.connect.phantom`). Si può anche incollare un indirizzo Solana (base58, 32–44 caratteri). «Disconnetti» cancella il valore e chiama `provider.disconnect()` se esiste. Su telefono, se Phantom non è nel browser, c'è il link `https://phantom.app/ul/browse/<url>?ref=<origin>`. L'indirizzo serve a mostrare saldi e staking in sola lettura. | Nessuna firma, nessuno swap, nessuna transazione, nessun fondo spostato, nessuna chiave sul server. |

Nessun collegamento a launchpad o piattaforme di trading (niente pump.fun, niente pulsanti di acquisto).
