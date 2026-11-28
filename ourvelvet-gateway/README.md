# OurVelvet Gateway v1

Un solo ingresso OurVelvet per agenzia viaggi, Velvet Route (Amsterdam ↔ Lago di Garda), widget della rivista ARIA 18+, richieste di preventivo e lista d'attesa, messaggi con lo staff, token e merito. Servizio di ZDOS1.3 (P.IVA 11040550961).

- Pagine: https://ourvelvet.online/gateway/ · /gateway/velvet-route/ · /gateway/widget-demo.html
- Staff (htpasswd staff esistente): https://ourvelvet.online/gateway/staff/
- API: /api/gateway/{health,catalog,prices,convert,me,requests,requests/:id/messages,requests/:id/cancel,me/data}; admin solo via /gateway/staff/api/ (header aggiunto da nginx, /api/gateway/admin pubblico = 404)
- Servizio: zdos-gateway.service su 127.0.0.1:8912 (utente zdosgateway), codice /opt/zdos-gateway, dati /var/lib/zdos-gateway (SQLite)
- Identità: sessione firma OurVelvet (zdos-firma :8905, SIWS), nessuna email o password
- Prezzi: zdos-defi :4198 (pool Meteora L$D-SOL 383iZ9n…) + cambio BCE (Frankfurter)

## Regole (vincolanti)
- Solo 18+, consenso, safeword ROSSO. Nessun minore e nessuna immagine che ricordi minori.
- OurVelvet non organizza, non intermedia e non incassa prestazioni sessuali; nessuna persona è prenotabile. Il server rifiuta testi che lo chiedono (filtro in server.mjs) oltre al filtro minori/non consenso di OurVelvet Social.
- Performer degli eventi: solo professioniste maggiorenni contrattualizzate da un locale o organizzatore autorizzato, non prenotabili né contattabili.
- «Incontri» = solo social (eventi, community, match reciproco tra adulti verificati), nessun pagamento legato a una persona.
- Amsterdam: tour mai davanti alle vetrine (dal 1/4/2020), 08–22, max 15 persone, guida con esenzione comunale; pub crawl vietati.
- Nessun prezzo, partner o recensione inventati: partner = «partner in selezione», prezzo = preventivo reale dello staff/partner.
- Nessun pagamento sul sito. ZDOS1.3 raccoglie richieste e le gira a partner autorizzati (non vende pacchetti in proprio).

## Rimborso crypto L$D (proposta, da confermare con doc)
- Base 3% dell'importo confermato in euro; +1% con badge «wallet verificato» (zdos-firma); +1% con profilo merito OV collegato (zcomm ovid-by-wallet); massimo 5% e 150 € a viaggio.
- Conversione in L$D al prezzo del pool Meteora al momento del completamento; se la liquidità del pool è sotto 1.000 USD l'importo L$D è marcato «indicativo» (oggi ~0,81 USD).
- Quando lo staff segna «completata» viene scritta una riga nel registro `ledger` con stato `proposta`. Nessun codice paga: ogni rimborso va approvato e firmato da doc, e il fondo merito resta in STOP.

## Merito (proposta, da collegare più avanti)
- Azione `gateway_booking_completed`: 10 punti + 1 ogni 100 € confermati, tetto 40 a viaggio; salvata in tabella `merit` con stato `proposta` (con l'OV-ID se esiste).
- Aggancio futuro: pubblicare l'evento su zcomm (zbus, source `gateway`, actor OV-ID) e aggiungere il tipo alla tabella punti / Pool Party. Oggi NON viene emesso nulla e la config del fondo non è toccata.

## Widget ARIA 18+
```html
<div data-ov-gateway data-formula="velvet-route"></div>
<script src="https://ourvelvet.online/gateway/widget.js" async></script>
```
Opzioni: `data-formula` (velvet-route, ams-weekend, garda-lounge), `data-compact="1"`. Shadow DOM, nessun cookie. Installato in https://zx.x-zdos.it/rivista/ sezione «Prenota» (#prenota).

## Cosa manca prima di vendere davvero
- Agenzia/tour operator partner con SCIA regionale, direttore tecnico, polizza RC e fondo di garanzia (D.Lgs. 79/2011, D.Lgs. 62/2018, dir. UE 2015/2302), oppure agenzia ZDOS con gli stessi requisiti.
- Contratti con hotel, locali, organizzatori; licenze per spettacoli; contratti e verifica età delle performer a cura dell'organizzatore.
- Guida con esenzione del Comune di Amsterdam.
- Crypto: fattura in euro; niente custodia/cambio per terzi senza OAM/MiCA.
- Informativa privacy dedicata.

## Deploy e rollback
`deploy/deploy.sh <TS>` (backup in /var/backups/gateway/<TS>/, nginx -t prima del reload, rollback.sh generato). Test: `tests/journey.mjs` (20 controlli, dati di test cancellati alla fine).
