# Z-X SOLANA Store — Agenzia viaggi ZDOS

Sito pubblico: `https://zx.x-zdos.it/`

Agenzia viaggi di ZDOS1.3 (P.IVA 11040550961). Ricerche già compilate verso voli, hotel, B&B e noleggio auto sui siti partner. I prezzi si vedono solo là: qui non ne inventiamo. Preventivi e pagamenti in crypto sono su richiesta.

## Sezioni

- **Viaggi**: mappa OpenStreetMap, meteo, cambi BCE, percorso auto, link a Booking, Airbnb, Google Flights, Skyscanner, Kayak (noleggio), Rentalcars, GetYourGuide, Hostelworld, Wikivoyage.
- **Scudo K.I.R.A.**: controlli difensivi su token, link, wallet e annunci.
- **eSIM** e referral Starlink personale, con nota di non affiliazione.
- **Token**: SOL e VELVET ($OV) da API pubbliche. $DSN (Solana e Polygon) con indirizzi ufficiali; se non è quotato, la pagina lo dice.
- **xCLOUD**: strumenti nel browser, ancora in costruzione.
- **Rivista**: ARIA, rivista digitale 18+ in `rivista/` (sorgenti generatore in `rivista-src/`, nginx in `deploy/zx-rivista.conf`), pubblicata su `/rivista/`. Pubblicazione: copiare `rivista/` in `/var/www/rivista/` e installare lo snippet.

## Vincoli

- Solo API pubbliche gratuite verificate. Niente prezzi inventati.
- Phantom in sola lettura. Nessun pagamento automatico sul sito.
- Nessuna affiliazione con Musk, SpaceX, Tesla o Starlink.
- Grok resta spento senza `XAI_API_KEY` sul server.
- Licenza ZSEL.

## Avvio locale

```bash
PORT=8742 HOST=127.0.0.1 node server/dev-server.mjs
```
