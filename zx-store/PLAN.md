# Z-X SOLANA — piano, API verificate e roadmap

Prototipo per **doc / ZDOS**, avviato il 15/11/2026 (ora di Roma) e allineato il 21/11/2026. La versione pubblica dell'agenzia è su `https://zx.x-zdos.it/`. La vecchia beta su beta.x-zdos.it non ha più DNS. In locale: `PORT=8742 HOST=127.0.0.1 node server/dev-server.mjs`.

## 1. Cosa c'è nel prototipo

| Sezione | Cosa fa | Dati / librerie |
|---|---|---|
| ✈️ **Viaggi** | Ricerca destinazione + date + ospiti, mappa Leaflet/OSM con hotel, punti d'interesse, colonnine EV e percorso in auto; meteo 7 giorni, qualità dell'aria, fuso orario, festività durante il viaggio, sintesi Wikivoyage, convertitore valuta BCE; pulsanti **precompilati** verso Booking, Airbnb, Google Flights, Skyscanner, GetYourGuide, Hostelworld, Wikivoyage; link a Viaggiare Sicuri; condivisione su X | Photon, Nominatim, Open-Meteo (+AQ), Frankfurter, Wikipedia geosearch, Wikivoyage, Nager.Date, OSRM, autocomplete Travelpayouts (codici città) |
| 🛡️ **Scudo K.I.R.A.** | Semaforo 🟢🟡🔴 con i motivi per **token**, **link/domini**, **wallet**, **annunci di viaggio**; avviso condivisibile su X | `kira-core.js` di zRoute (RPC + RugCheck), GoPlus, blocklist Phantom, rdap.org, dns.google |
| 📶 **eSIM** + 🛰️ **Starlink-ready** | Paese → Airalo (pagina paese), Holafly, eSIMDB; nessun prezzo inventato. Slot Starlink con il **link referral personale di doc** ("premi e termini secondo Starlink, variano per paese", nessuna affiliazione) | link verificati con curl |
| 🪙 **Store crypto** | Prezzo live SOL e VELVET (Jupiter price v3) + SOL in € (CoinGecko), convertitore €→SOL, Phantom **in sola lettura** (indirizzo + saldo, nessuna firma), "Paga in SOL" come concept **disattivato** | Jupiter, CoinGecko, Solana RPC |
| 🔌 **X · Grok · EV** | Assistente viaggio via **backend proxy** verso l'API xAI (disattivato: "richiede API key"), Segui @ZDOS_Core, timeline embed con fallback, share intent ovunque; colonnine EV sulla mappa; Tesla Fleet API in roadmap | `server/dev-server.mjs` |
| 🧩 **Agenzia** | Servizi: web dev, bot, contenuti (preventivo su richiesta, nessun prezzo) | — |
| ☁️ **xCLOUD** (beta / in costruzione) | Kanban con priorità/scadenze/tag; fogli XLSX/CSV; documenti con import/export DOCX; PDF vista/unisci/estrai; ZIP crea/estrai, RAR/7Z **solo estrazione**; **ZComm** chat E2EE | SheetJS CE, Quill, docx.js, mammoth.js, pdf.js, pdf-lib, JSZip, libarchive.js (WASM) — tutto in `xcloud/vendor/`, nessun CDN |
| 🛰️ **Starlink Dish** (xCLOUD) | HUD arcade con downlink, uplink, latenza, ostruzione, uptime e alert della **propria** antenna; badge LIVE o **DATI MOCK** | `server/starlink_status.py` (starlink-grpc-core 1.2.5, gRPC reflection su 192.168.100.1:9200, sola lettura, ID mascherato) ← proxy `/api/starlink` del dev-server. Dal box l'antenna non è raggiungibile (TimeoutError), quindi mock etichettato. "Progetto personale, non affiliato a SpaceX/Starlink", nessun logo |
| Footer | DYOR, nota anti-truffa, "i prezzi vengono dai siti partner", attribuzioni, nessuna affiliazione implicita | — |

Test eseguiti nel browser headless (Chrome + playwright-core): ricerca Roma→Lisbona, 4 controlli K.I.R.A., export XLSX/DOCX reali, re-import DOCX con mammoth, 2 PDF creati e uniti (`%PDF-1.7`), ZIP creato e ri-estratto, **RAR reale estratto** (fixture ufficiale di libarchive), ZComm fra due schede con **safety number identici** e messaggi decifrati.

## 2. API: stato verificato (curl dal box + browser, 15/11/2026)

### ✅ Funzionano gratis senza chiave (usate)
| API | Uso | Note |
|---|---|---|
| Photon (photon.komoot.io) `/api` e `/reverse?osm_tag=` | geocoding, hotel `tourism=hotel`, colonnine `amenity=charging_station` | CORS ok. `lang=it` non supportato. Fair use |
| Nominatim (OSM) | geocoding di riserva | max 1 req/s, User-Agent; per produzione self-host o provider |
| Open-Meteo forecast | meteo 7 giorni + **fuso orario** (`timezone=auto`) | CC BY 4.0, gratis non commerciale → piano commerciale se il sito guadagna |
| Open-Meteo Air Quality | AQI europeo, PM2.5 | come sopra |
| Frankfurter `api.frankfurter.dev/v1` | tassi BCE | ⚠️ `api.frankfurter.app` ora fa 301 **senza CORS**: usare `.dev/v1` |
| Jupiter `lite-api.jup.ag/price/v3` | prezzo SOL e VELVET | VELVET ~$0,0000021, liquidità ~$2,2k |
| CoinGecko `simple/price` | SOL in € | demo pubblica con rate limit |
| DexScreener `tokens/v1` | (verificata, già usata in ZSwap) | — |
| RugCheck `v1/tokens/<mint>/report` | rischi, holder, mercati | usata da kira-core |
| Solana RPC `solana-rpc.publicnode.com` | getAccountInfo, getBalance | `getTokenLargestAccounts` → 403 dal browser (kira-core passa a RugCheck). `api.mainnet-beta` 403/429 |
| GoPlus `solana/token_security`, `phishing_site`, `address_security` | token, phishing, wallet segnalati | gratis con rate limit; per volumi serve chiave |
| Blocklist Phantom (raw GitHub, ~2.250 domini) | phishing domini crypto | solo domini, niente wallet |
| rdap.org | età del dominio | ⚠️ **.it non ha RDAP** (non è nel bootstrap IANA, rdap.nic.it non risponde) → serve WHOIS porta 43 lato server |
| dns.google `resolve` | il dominio esiste? | — |
| Wikipedia geosearch / Wikivoyage summary | cosa vedere, sintesi | CC BY-SA, attribuzione |
| Travelpayouts `autocomplete …/places2` | codici città IATA per i deep link voli | senza token |
| OSRM demo `router.project-osrm.org` | km e tempo in auto | solo demo, niente uso intensivo |
| Nager.Date | festività per paese | — |
| X web intent `x.com/intent/post`, `intent/follow`, `platform.twitter.com/widgets.js` | condivisione, segui, embed | la timeline embed da non loggati risponde **429**: c'è il fallback al profilo |
| Tile OSM | mappa | policy d'uso: in produzione un provider tile (MapTiler, Stadia, self-host) |

Funzionano ma non usate: timeapi.io (fuso: basta Open-Meteo), urlscan.io search, feed OpenPhish, Phishing.Database (lista molto grande, va bene lato server).

### 🔑 Servono chiave o registrazione (gratis o a pagamento)
| API | Risposta senza chiave | Note |
|---|---|---|
| **xAI API** (Grok) `https://api.x.ai/v1/chat/completions` | 401 `no-credentials` | a pagamento a consumo. Docs: docs.x.ai (modello in docs: `grok-4.7`, configurabile con `XAI_MODEL`) |
| **Travelpayouts** data API (Aviasales, hotel, Airalo…) | 401 | registrazione gratuita + token; è anche il programma affiliati principale |
| **Airalo Partner API** | 401 OAuth | account partner |
| OpenTripMap | 401 | chiave gratuita |
| Geoapify | 401 | free tier con chiave |
| REST Countries | v3.1 **deprecata**, v5 richiede chiave | free 1.000 req/mese → nel prototipo dati paese statici |
| Open Charge Map | 403 "API key" | chiave gratuita |
| OpenRouteService | 401 | chiave gratuita (anche mezzi pubblici e isocrone) |
| aviationstack | 500 senza chiave | free tier limitato con chiave |
| Kiwi Tequila | 403 header `apikey` | accesso su richiesta |
| Amadeus Self-Service (test) | errore TLS dal box | richiede chiave; da riverificare da un'altra rete |
| Google Safe Browsing v4 | 403 | chiave Google Cloud gratuita (uso non commerciale: per commerciale c'è Web Risk) |
| URLhaus (abuse.ch) | 401 | ora serve Auth-Key gratuita |
| Chainabuse | 401 | chiave |
| **Tesla Fleet API** | 401 | app registrata su developer.tesla.com + account business + consenso del proprietario dell'auto |
| X API (Sign in with X, OAuth 2.0 PKCE) | — | app su developer.x.com, gestita dal backend |

### ❌ Non disponibili / non usabili
- **Airbnb e Booking**: nessuna API pubblica gratuita per prezzi e disponibilità → deep link precompilati (verificati: 200/301). Booking ha un programma affiliati. Che Airbnb non abbia più un programma affiliati aperto è da riverificare: nel prototipo usiamo solo link diretti.
- **Overpass API** (overpass-api.de e mirror): timeout o 504 dal box in tutti i test → sostituita da Photon reverse con `osm_tag`.
- **PhishTank checkurl**: 403 (Cloudflare).
- **crt.sh**: 502 o timeout, inaffidabile.
- **RDAP per .it**: non esiste.
- GetYourGuide e Rome2rio: 403 ai client non-browser (protezione bot), quindi da qui non si possono verificare. Il link GetYourGuide resta per i browser; Rome2rio non è usato. La ricerca Hostelworld via URL dà 404 → link alla homepage.

## 3. Scudo K.I.R.A. (solo difensivo)
- **Token**: `KiraCore.kiraReport` di zRoute **riusato così com'è** (mint/freeze authority, estensioni Token-2022 pericolose, concentrazione holder escluse pool, RugCheck), più GoPlus. `fail` → 🔴, `warn` → 🟡.
- **Link/dominio**: sosia di `x-zdos.it` (normalizzazione omoglifi 0→o, 1/l→i, rn→m + distanza di Levenshtein ≤ 2), punycode, **imitazione di marchi** spesso usati nel phishing (airbnb, booking, phantom, solana, jupiter, skyscanner, airalo, paypal) su domini non ufficiali, blocklist Phantom, GoPlus phishing, età RDAP (<30 gg 🔴, <180 gg 🟡), DNS, HTTPS.
- **Wallet**: formato base58, tipo di account (mint, programma, token account = 🟡 "non è un wallet"), GoPlus address security, **address poisoning** (stessi 4+4 caratteri di un indirizzo ufficiale o salvato dall'utente ma diverso).
- **Annuncio viaggio**: pagamento fuori piattaforma, bonifico, crypto, gift card, Western Union = 🔴; chat privata, caparra o urgenza = 🟡; prezzo sotto il 50% della media che l'utente inserisce (non inventiamo medie) = 🔴, sotto il 70% = 🟡; ogni link nel testo passa dal controllo domini.
- Niente profilazione di persone: si controllano solo token, URL, domini e indirizzi incollati dall'utente.
- Roadmap: WHOIS .it lato server, Safe Browsing/Web Risk, URLhaus, Chainabuse con chiavi sul backend; cache e rate limit; storico segnalazioni della community, moderato.

## 4. Architettura verso il prodotto reale
```
Browser (statico, CSP rigida, nessuna chiave)
  └── api.x-zdos.it (VPS 5.189.180.13, Nginx + TLS, già previsto per K.I.R.A.)
        ├── /api/grok        proxy xAI (XAI_API_KEY solo in env, rate limit Nginx/Redis, log senza dati personali)
        ├── /api/kira/*      WHOIS .it, Safe Browsing/Web Risk, URLhaus, Chainabuse, cache
        ├── /api/travel/*    Travelpayouts/Airalo con token, cache prezzi (sempre "prezzo indicativo, conferma sul partner")
        ├── /api/auth/x      Sign in with X (OAuth 2.0 + PKCE), sessione httpOnly
        ├── /api/pay/solana  Solana Pay: ordine → reference → verifica on-chain → fattura in €
        └── /api/zcomm       relay E2EE: vede solo ciphertext (vedi §6)
RPC Solana dedicato (es. Helius, chiave lato server) · tile provider · Postgres per ordini, task e utenti
```
Roadmap:
1. **Settimane 1–2**: iscrizioni affiliate, deploy statico su sottodominio di preview, cookie banner e privacy policy, font self-hosted, embed X caricato solo al click.
2. **Settimane 3–4**: backend (proxy Grok, KIRA lato server, token Travelpayouts/Airalo), link affiliati dichiarati in pagina.
3. **Mese 2**: Sign in with X, quest, Solana Pay in **USDC/SOL** su devnet, poi mainnet con fatturazione.
4. **Mese 3+**: OpenRouteService/transit, Open Charge Map, Tesla Fleet API (se registrata), xCLOUD con sync cifrato e ZComm su Signal/MLS dopo l'audit.

## 5. Firme e iscrizioni che deve fare doc
1. **Travelpayouts** (copre voli Aviasales, hotel, Airalo, GetYourGuide e altri partner) → token API e marker affiliato.
2. **Booking.com Affiliate Partner**.
3. **Airalo Partner** (diretto o via Travelpayouts).
4. **xAI API key** (a pagamento, con un tetto di spesa).
5. Chiavi gratuite: OpenRouteService, Open Charge Map, Google Safe Browsing/Web Risk, URLhaus, OpenTripMap (facoltativa), REST Countries v5 (facoltativa).
6. Facoltative: X developer app (Sign in with X), Tesla developer + account business, RPC Solana dedicato.
7. **Starlink**: verificare nei termini del programma referral se il link personale si può usare su un sito commerciale.

## 6. ZComm (prototipo E2EE): design attuale e di produzione
**Prototipo**: identità ECDH P-256 generata con WebCrypto e chiave privata **non estraibile** → ECDH → HKDF-SHA-256 (salt = hash delle due pubbliche) → AES-GCM 256, **nonce casuale da 96 bit per messaggio**, AAD = mittente|destinatario|contatore, contatore anti-replay, **safety number** di 60 cifre da confrontare fuori banda. Trasporto demo: BroadcastChannel fra due schede; la "vista sniffer" mostra che sul canale passa solo ciphertext.
**Limiti dichiarati in UI**: non ha audit, chiavi statiche per sessione (niente forward secrecy né post-compromise security), metadati visibili, niente multi-dispositivo. **Non usarlo per segreti reali finché non c'è un audit di sicurezza.**
**Produzione**: TLS ovunque (HSTS), CSP rigida (`script-src 'self'`, niente inline né CDN, SRI), **Signal protocol via libsignal** (X3DH/PQXDH + Double Ratchet) oppure **MLS (RFC 9420, OpenMLS)** per i gruppi; relay server che memorizza solo ciphertext e prekey pubbliche; verifica dei contatti con safety number/QR; WebRTC DataChannel P2P (DTLS) dove possibile; chiavi in IndexedDB non estraibili o WebAuthn/passkey; audit esterno e bug bounty prima dell'uso.

## 7. Note legali (Italia, P.IVA) — da confermare con commercialista e legale
- **Solo affiliazione/referral** (link verso i partner, commissioni): attività di intermediazione pubblicitaria e marketing. Codice ATECO e regime (anche forfettario) da scegliere con il commercialista. Le commissioni sono ricavi, da fatturare o documentare secondo il partner.
- **Vendere pacchetti o servizi turistici in proprio** = agenzia di viaggi: SCIA regionale, direttore tecnico, polizza RC e fondo di garanzia (Codice del Turismo, D.Lgs. 79/2011, e D.Lgs. 62/2018 sui pacchetti, direttiva UE 2015/2302). Il prototipo è pensato per **non** ricadere in questo caso: rimanda sempre al partner.
- **Trasparenza**: segnalare chiaramente i link affiliati e referral (Codice del Consumo e pratiche commerciali scorrette AGCM; linee guida AGCOM sugli influencer per i post su X). Mai "partner ufficiale" o loghi che suggeriscono un'approvazione.
- **GDPR e cookie**: privacy policy, banner secondo le linee guida del Garante (2021), Google Fonts e X embed sono terze parti (self-host dei font, embed solo al click), nessun dato personale verso xAI senza informativa.
- **Crypto**: accettare SOL/USDC come pagamento è possibile, ma fattura e contabilità in € al cambio del momento. Niente custodia o cambio per conto terzi (altrimenti registrazione OAM/MiCA). VELVET è un token community senza valore garantito: niente promesse di rendimento.
- **Licenze open source**: SheetJS CE e pdf.js (Apache-2.0), Quill e mammoth (BSD), docx.js, pdf-lib e libarchive.js (MIT), JSZip (MIT/GPL, usata come MIT): tenere le note di licenza nel deploy. Creare file RAR richiede la licenza proprietaria RARLAB, quindi non lo offriamo.

## 8. Riusato dai repo ZDOS (copie locali sul box, sola lettura, nessun push)
- `kira-core.js` (UMD) da `z-xSOLANA/discord-bot/src/kira-core.js`, la stessa logica dei controlli K.I.R.A. di zRoute: copiato identico.
- Connessione Phantom (rilevamento provider, deep link mobile `phantom.app/ul/browse`) da `zswap/app.js` (ZSwap Hub), ridotta alla **sola lettura**.
- Stile: base CSS di ZSwap Hub (card, pill, gradienti) con la palette Solana #9945FF→#14F195 e i font del sito x-zdos.it (Space Grotesk, IBM Plex Mono), più Press Start 2P per il tocco arcade. Logo `zdos-pixel.svg` da ZSwap.
- Indirizzi ufficiali ($DSN, VELVET, xZDOS legacy) da `z-xSOLANA/README.md` e `updates-for-zcreator.md`. Il wallet agente **non** è pubblicato.
- Backend previsto su `api.x-zdos.it` / VPS già pianificato per K.I.R.A. (`Zdos-K.I.R.A/README.md`).
- Repo GitHub privati non letti via MCP: le copie locali bastavano.

## 9. File
```
index.html style.css app.js shield.js data.js kira-core.js zdos-pixel.svg
server/dev-server.mjs        statico + proxy Grok (nessuna dipendenza)
xcloud/index.html xcloud.css xcloud.js office-modules.js zcomm.js vendor/*
server/starlink_status.py    lettura gRPC antenna (venv: python3 -m venv .venv-starlink && .venv-starlink/bin/pip install starlink-grpc-core)
career/cv-portfolio.md       bozza CV IT/EN
shots/*.png                  screenshot · shots.mjs, shots-xcloud.mjs per rifarli
```


## 10. Deploy beta (21/11/2026, Europe/Rome)

- URL: `https://beta.x-zdos.it` — vhost nginx dedicato, certificato Let's Encrypt proprio, `X-Robots-Tag: noindex, nofollow, noarchive`, `robots.txt` Disallow: /.
- Autenticazione: HTTP Basic, file `/etc/nginx/htpasswd-beta` (non tocca gli htpasswd di zdesk/velvet/quest). Credenziali solo in `/root/BETA-ACCESS.txt` sul VPS (chmod 600).
- File del sito: `/var/www/zxstore-beta/`. Servizio `zxstore-beta` (Node, `127.0.0.1:8742`) per `/api/grok` e `/api/starlink`. Grok resta spento senza `XAI_API_KEY`.
- Backup e rollback: `/var/backups/zxstore-beta/<timestamp>/rollback.sh`.
- Non pubblicare in chiaro e non collegare la beta dai post o dalla home pubblica finché doc non lo chiede.


## 11. Go-live zx.x-zdos.it (28/11/2026, Europe/Rome)

- Sito pubblico, senza password, `robots.txt` consente l'indicizzazione della home (non /api/ né /xcloud/).
- Stile della beta del 21/11 (palette Solana, arcade). La versione "ZX Sovereign Nexus" su porta 8884 è stata sostituita (resta in backup, processo PM2 non terminato).
- Aggiunti deep link di noleggio auto (Kayak con codice città e date, Rentalcars per città).
- Voce di menu Rivista → `/rivista/` senza creare la pagina.
- Pagamenti in crypto: solo su richiesta (Solana Pay non era implementato in modo verificato).
