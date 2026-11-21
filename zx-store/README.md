# Z-X SOLANA Store

Agenzia viaggi / web agency di ZDOS (Z-X SOLANA Store). Beta riservata su `https://beta.x-zdos.it` (password, `noindex`). Non è il sito pubblico.

## Cosa c'è

- **Viaggi**: ricerca destinazione, mappa OpenStreetMap, meteo 7 giorni, qualità dell'aria, festività, cambi BCE, percorso auto (OSRM). Pulsanti precompilati verso Booking, Airbnb, Google Flights, Skyscanner, GetYourGuide, Hostelworld e Wikivoyage. Nessun prezzo inventato: i prezzi restano sui siti partner.
- **Scudo K.I.R.A.**: controlli difensivi su token, link, wallet e annunci di viaggio.
- **eSIM**: link ad Airalo, Holafly e eSIMDB per paese. Slot Starlink con il referral personale di doc e la nota «non affiliati a Starlink/SpaceX».
- **Token**: prezzi live di SOL e VELVET ($OV) da API pubbliche. $DSN (Solana e Polygon) è indicato con gli indirizzi ufficiali; se Jupiter non lo quota, la pagina lo dice chiaramente.
- **xCLOUD** (ancora in costruzione): task, fogli, documenti, PDF, archivi e ZComm nel browser. Il pannello Starlink Dish, sul server, mostra dati MOCK se l'antenna di casa non è raggiungibile.
- **Assistente Grok**: spento finché sul server non c'è `XAI_API_KEY`.

## Non incluso in questo albero

- `career/` e qualsiasi dato personale
- dipendenze di sviluppo (Playwright) e `.venv-starlink`
- credenziali, `htpasswd`, chiavi API

## Avvio locale

```bash
PORT=8742 HOST=127.0.0.1 node server/dev-server.mjs
```

Apri http://127.0.0.1:8742 e http://127.0.0.1:8742/xcloud/

## Vincoli

- Solo API pubbliche gratuite verificate. Niente prezzi inventati.
- Phantom in sola lettura (niente firme, niente pagamenti attivi).
- Nessuna affiliazione con Musk, SpaceX, Tesla o Starlink.
- $OV si chiama sempre VELVET, senza promesse di rendimento.
- DYOR, licenza ZSEL, P.IVA 11040550961, azienda ZDOS1.3.
